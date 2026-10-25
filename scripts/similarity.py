"""Clean-room similarity check.

usage: python scripts/similarity.py NEW.md OLD_FILE_OR_DIR [OLD_FILE_OR_DIR ...]

Reports the share of NEW's words covered by runs of 8+ words that also occur
in any OLD file, plus headings shared with OLD. Exit 1 when the share is 2%
or more or any heading is shared.
"""
import re
import sys
from pathlib import Path

RUN = 8
LIMIT = 0.02


def words(text):
    return re.findall(r"[a-z0-9']+", text.lower())


def headings(text):
    found = {re.sub(r"\W+", " ", h).strip().lower() for h in re.findall(r"^#+\s*(.+)$", text, re.M)}
    return found - {""}  # a heading of only punctuation says nothing


def old_files(paths):
    for p in map(Path, paths):
        if not p.exists():
            sys.exit(f"similarity: {p} does not exist")
        yield from ([p] if p.is_file() else sorted(p.rglob("*.md")))


def main(new, olds):
    new_text = Path(new).read_text(encoding="utf-8")
    new_words = words(new_text)
    grams = set()
    old_heads = set()
    for f in old_files(olds):
        t = f.read_text(encoding="utf-8", errors="ignore")
        w = words(t)
        grams.update(tuple(w[i:i + RUN]) for i in range(len(w) - RUN + 1))
        old_heads |= headings(t)
    covered = set()
    for i in range(len(new_words) - RUN + 1):
        if tuple(new_words[i:i + RUN]) in grams:
            covered.update(range(i, i + RUN))
    share = len(covered) / max(len(new_words), 1)
    shared_heads = sorted(headings(new_text) & old_heads)
    print(f"words={len(new_words)} shared-run words={len(covered)} share={share:.2%}")
    print("shared headings:", shared_heads or "none")
    return 1 if share >= LIMIT or shared_heads else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1], sys.argv[2:]))
