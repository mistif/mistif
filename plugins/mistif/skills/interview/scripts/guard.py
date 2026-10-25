"""Flag lines in the diff (and untracked files) that lower the quality bar.

usage: python guard.py [base-ref]
exit: 0 clean, 1 violations, 2 could not run.
"""
import re
import subprocess
import sys

RULES = [
    ("new check suppression", re.compile(r"(eslint-disable|@ts-ignore|@ts-nocheck|# noqa|# type: ignore|nosec|pylint: disable|// nolint)")),
    ("skipped test", re.compile(r"(\.skip\(|\bxit\(|\bxdescribe\(|@pytest\.mark\.skip|@unittest\.skip|\bt\.Skip\()")),
    ("stub or unfinished code", re.compile(r"(TODO: implement|NotImplementedError|throw new Error\(['\"]not implemented)", re.I)),
    ("empty error handler", re.compile(r"(except[^:\n]*:\s*pass\b|catch\s*(\([^)]*\))?\s*\{\s*\})")),
]
SECRET = re.compile(r"(AKIA[0-9A-Z]{16}|-----BEGIN [A-Z ]*PRIVATE KEY-----|(api[_-]?key|secret|token)\s*[:=]\s*['\"][^'\"]{12,})", re.I)
ASSERT = re.compile(r"\b(assert|expect)\b")


def git(*args):
    r = subprocess.run(["git", "-c", "core.quotePath=false", *args], capture_output=True, text=True, encoding="utf-8", errors="replace")
    if r.returncode:
        raise RuntimeError(r.stderr.strip())
    return r.stdout


def diff_lines(base):
    """Yield (file, line_no, text, added) for each changed line; removed lines have no line number."""
    path, n = None, 0
    for line in git("diff", "-U0", base).splitlines():
        if line.startswith("+++ "):
            path = line[6:] if line.startswith("+++ b/") else None
        elif line.startswith("@@"):
            n = int(re.search(r"\+(\d+)", line).group(1)) - 1
        elif line.startswith("+") and path:
            n += 1
            yield path, n, line[1:], True
        elif line.startswith("-") and not line.startswith("---"):
            yield path, 0, line[1:], False


def untracked_lines():
    for path in git("ls-files", "--others", "--exclude-standard").splitlines():
        try:
            with open(path, encoding="utf-8") as f:
                for n, text in enumerate(f, 1):
                    yield path, n, text.rstrip("\n"), True
        except (OSError, UnicodeDecodeError):
            continue


def find_base():
    for cand in ("origin/main", "main"):
        try:
            git("rev-parse", "--verify", cand)
            return cand
        except RuntimeError:
            pass
    raise RuntimeError("no base branch found")


def main():
    try:
        base = sys.argv[1] if len(sys.argv) > 1 else find_base()
        findings, removed = [], 0
        for path, n, text, added in [*diff_lines(base), *untracked_lines()]:
            if not added:
                removed += bool(ASSERT.search(text))
                continue
            for name, rx in RULES:
                if rx.search(text):
                    findings.append(f"{name}: {path}:{n}")
            if SECRET.search(text):
                findings.append(f"possible secret (value hidden): {path}:{n}")
        if removed:
            findings.append(f"removed assertion lines: {removed}")
    except (RuntimeError, OSError) as e:
        print(f"could not run: {e}", file=sys.stderr)
        return 2
    sys.stdout.reconfigure(encoding="utf-8")  # accented file names survive a Windows code page
    print("\n".join(findings) or "clean")
    return 1 if findings else 0


if __name__ == "__main__":
    sys.exit(main())
