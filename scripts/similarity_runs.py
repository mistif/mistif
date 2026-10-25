"""Print the shared 8-word runs between NEW.md and OLD files/dirs (companion to similarity.py).

usage: python scripts/similarity_runs.py NEW.md OLD [OLD ...]
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from similarity import RUN, old_files, words  # noqa: E402

new = words(Path(sys.argv[1]).read_text(encoding="utf-8"))
src = {}
for f in old_files(sys.argv[2:]):
    w = words(f.read_text(encoding="utf-8", errors="ignore"))
    for i in range(len(w) - RUN + 1):
        src[tuple(w[i:i + RUN])] = f
i = 0
while i <= len(new) - RUN:
    if tuple(new[i:i + RUN]) in src:
        j = i + RUN
        while j < len(new) and tuple(new[j - RUN + 1:j + 1]) in src:
            j += 1
        print(" ".join(new[i:j]), "<-", src[tuple(new[i:i + RUN])].name)
        i = j
    else:
        i += 1
