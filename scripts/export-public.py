#!/usr/bin/env python3
"""Export the committed tree as a fresh git repository with ONE commit, then scan it.

usage: python scripts/export-public.py DEST [--ref REF]

DEST must not exist or must be empty. Files come from `git archive REF` (default HEAD), so
uncommitted changes and untracked files are never exported and no private history is carried over.
The new repository gets one commit with a placeholder author; set MISTIF_EXPORT_NAME and
MISTIF_EXPORT_EMAIL to the identity you want to publish under. The script never adds a remote and
never pushes.

After the commit it scans every text file (this script included) for e-mail, home paths, secrets,
session ids and files that must not ship, and checks that the two copies of CREDITS.md match.
Personal terms (your name, other project names, private plugin names) are NOT kept in this
repository: put one regular expression per line in the file named by MISTIF_EXPORT_DENY
(default ~/.claude/mistif-export-deny.txt). The export fails if that file is missing or empty. Any finding prints and exits 1; DEST is left in place to inspect.
"""
import io
import os
import re
import subprocess
import sys
import tarfile
from pathlib import Path

NAME = os.environ.get("MISTIF_EXPORT_NAME", "mistif")
EMAIL = os.environ.get("MISTIF_EXPORT_EMAIL", "noreply@example.com")
DENY_FILE = Path(os.environ.get("MISTIF_EXPORT_DENY") or Path.home() / ".claude" / "mistif-export-deny.txt")
MAX_FILE = 1_000_000
MAX_TOTAL = 5_000_000

B = "\\"
PATTERNS = {
    "personal e-mail": r"[\w.+-]+@(?:gmail|hotmail|outlook|yahoo|icloud)\.[a-z]+",
    "windows user path": r"[A-Za-z]:[\/]+Users[\/]+(?!someone\b|user\b|Public\b)[\w.-]+",
    "unix home path": r"(?:/Users/|/home/)(?!user\b|runner\b|someone\b|name\b)[A-Za-z][\w.-]*",
    "app data path": r"AppData[\/]",
    "local marketplace path": r"\.claude[\/]local-marketplaces[\/]mistif",
    "secret or token": r"sk-[A-Za-z0-9_-]{20,}|ghp_[A-Za-z0-9]{30,}|github_pat_\w{20,}|AKIA[0-9A-Z]{16}|xox[baprs]-|AIza[0-9A-Za-z_-]{35}|BEGIN [A-Z ]*PRIVATE KEY|nvapi-[A-Za-z0-9_-]{20,}|eyJ[A-Za-z0-9_-]{20,}\.",
    "session id": r"local_[0-9a-f]{8}-[0-9a-f]{4}-|\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b",
}
BAD_NAMES = re.compile(r"(^|/)(\.env(\..*)?|.*\.pem|.*\.key|settings\.local\.json|.*\.log|id_rsa.*|\.claude|\.mistif)$")


def git(dest, *args, **kw):
    return subprocess.run(["git", *args], cwd=dest, check=True, capture_output=True, text=True, **kw).stdout


def main():
    args = sys.argv[1:]
    ref = "HEAD"
    if "--ref" in args:
        i = args.index("--ref")
        ref = args[i + 1]
        del args[i:i + 2]
    if len(args) != 1:
        sys.exit(__doc__)
    dest = Path(args[0]).resolve()
    if dest.exists() and any(dest.iterdir()):
        sys.exit(f"{dest} exists and is not empty")
    dest.mkdir(parents=True, exist_ok=True)

    tar = subprocess.run(["git", "archive", "--format=tar", ref], check=True, capture_output=True).stdout
    with tarfile.open(fileobj=io.BytesIO(tar)) as t:
        t.extractall(dest, filter="data")

    git(dest, "init", "-q", "-b", "main")
    git(dest, "config", "user.name", NAME)
    git(dest, "config", "user.email", EMAIL)
    git(dest, "add", "-A")
    git(dest, "commit", "-q", "-m", "mistif: first public release")

    problems = []
    if git(dest, "rev-list", "--count", "HEAD").strip() != "1":
        problems.append("history is not a single commit")
    if git(dest, "remote").strip():
        problems.append("the export has a remote")
    meta = git(dest, "log", "-1", "--format=%an <%ae> / %cn <%ce>")
    if EMAIL not in meta or re.search(PATTERNS["personal e-mail"], meta, re.I):
        problems.append(f"commit metadata looks personal: {meta.strip()}")

    root_credits, plugin_credits = dest / "CREDITS.md", dest / "plugins/mistif/CREDITS.md"
    if not (root_credits.is_file() and plugin_credits.is_file() and root_credits.read_bytes() == plugin_credits.read_bytes()):
        problems.append("CREDITS.md and plugins/mistif/CREDITS.md differ or are missing")
    for need in ("LICENSE", "plugins/mistif/LICENSE", "plugins/mistif/LICENSE-EFFORTLESS", "vendor/effortless-1.71.0/LICENSE", "NOTICE.md", "README.md"):
        if not (dest / need).is_file():
            problems.append(f"missing {need}")

    total = 0
    rules = {k: re.compile(v, re.I) for k, v in PATTERNS.items()}
    try:
        deny = [l.strip() for l in DENY_FILE.read_text(encoding="utf-8").splitlines() if l.strip() and not l.startswith("#")]
    except OSError:
        deny = []
    if not deny:
        problems.append(f"no personal deny-list at {DENY_FILE}: the scan for names and private projects did not run")
    for i, d in enumerate(deny, 1):
        rules[f"deny-list entry {i}"] = re.compile(d, re.I)
    names = git(dest, "ls-files") + chr(10) + git(dest, "log", "-1", "--format=%B")
    for label, rx in rules.items():
        m = rx.search(names)
        if m:
            problems.append(f"file name or commit message: {label}: {m.group(0)}")
    for rel in git(dest, "ls-files").splitlines():
        p = dest / rel
        size = p.stat().st_size
        total += size
        if BAD_NAMES.search(rel):
            problems.append(f"{rel}: file name must not ship")
        if size > MAX_FILE:
            problems.append(f"{rel}: {size} bytes is over the {MAX_FILE} byte limit")
        try:
            text = p.read_text(encoding="utf-8")
        except (UnicodeDecodeError, OSError):
            continue
        for n, line in enumerate(text.splitlines(), 1):
            for label, rx in rules.items():
                m = rx.search(line)
                if m and not (label == "session id" and "github.com/user-attachments/assets/" in line):  # a public image URL in upstream's README
                    problems.append(f"{rel}:{n}: {label}: {m.group(0)}")
    if total > MAX_TOTAL:
        problems.append(f"tree is {total} bytes, over the {MAX_TOTAL} byte limit")

    print(f"exported {len(git(dest, 'ls-files').splitlines())} files, {total / 1e6:.2f} MB, one commit, to {dest}")
    if problems:
        print(f"\nSCAN FAILED: {len(problems)} finding(s)")
        for x in problems:
            print("  " + x)
        sys.exit(1)
    print(f"scan clean ({len(deny)} personal deny-list entries applied): no e-mail, home paths, secrets or session ids")


if __name__ == "__main__":
    main()
