"""Tests for scripts/similarity.py and scripts/similarity_runs.py (shared 8-word runs, clean-room check).
Run from the plugin folder: python -m unittest tests.similarity_test
Scripts are loaded by path; the CLIs run under python -I. Temp files only, no network."""
import contextlib
import importlib.util
import io
import re
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
SIMILARITY = ROOT / "scripts" / "similarity.py"
RUNS = ROOT / "scripts" / "similarity_runs.py"

_spec = importlib.util.spec_from_file_location("similarity_under_test", SIMILARITY)
sim = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(sim)

SHARED7 = "river stone quiet lantern winter harbor copper"
SHARED8 = SHARED7 + " meadow"
SHARED9 = SHARED8 + " bright"
SHARED10 = SHARED9 + " candle"
ANOTHER8 = "saddle velvet orchard pebble marble thunder ember feather"
OLD_WITH_8 = "Gardens grow slowly. " + SHARED8 + ". Rain falls."


def filler(n):
    return " ".join(f"filler{i}" for i in range(n))


def report(stdout):
    m = re.search(r"words=(\d+) shared-run words=(\d+) share=([\d.]+)%", stdout)
    return {"words": int(m[1]), "covered": int(m[2]), "share": m[3]}


class WordsTest(unittest.TestCase):
    def test_words_are_lowercased(self):
        self.assertEqual(sim.words("The QUICK Fox"), ["the", "quick", "fox"])

    def test_punctuation_and_markdown_split_words(self):
        self.assertEqual(sim.words("**Bold** `code`, (x)! well-known"), ["bold", "code", "x", "well", "known"])

    def test_apostrophe_stays_inside_a_word(self):
        self.assertEqual(sim.words("Don't stop"), ["don't", "stop"])

    def test_empty_and_blank_text_have_no_words(self):
        self.assertEqual(sim.words(""), [])
        self.assertEqual(sim.words(" \n\t "), [])

    def test_non_ascii_letters_split_words(self):
        # Current behaviour, not endorsed: "é" is not a word character, so "café" becomes "caf".
        self.assertEqual(sim.words("café"), ["caf"])


class HeadingsTest(unittest.TestCase):
    def test_heading_is_lowercased_with_punctuation_removed(self):
        self.assertEqual(sim.headings("## Setup: The Guide!"), {"setup the guide"})

    def test_hash_inside_a_line_is_not_a_heading(self):
        self.assertEqual(sim.headings("see # here"), set())


class TempCase(unittest.TestCase):
    def setUp(self):
        tmp = tempfile.TemporaryDirectory()
        self.addCleanup(tmp.cleanup)
        self.dir = Path(tmp.name)

    def write(self, name, text):
        p = self.dir / name
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_text(text, encoding="utf-8")
        return p

    def check(self, new_text, *old_texts):
        new = self.write("new.md", new_text)
        olds = [self.write(f"old{i}.md", t) for i, t in enumerate(old_texts)]
        out = io.StringIO()
        with contextlib.redirect_stdout(out):
            code = sim.main(str(new), [str(o) for o in olds])
        return code, out.getvalue()


class ShareTest(TempCase):
    def test_identical_text_is_100_percent_and_fails(self):
        code, out = self.check(OLD_WITH_8, OLD_WITH_8)
        self.assertEqual(report(out), {"words": 13, "covered": 13, "share": "100.00"})
        self.assertEqual(code, 1)

    def test_disjoint_text_is_0_percent_and_passes(self):
        code, out = self.check(
            "Alpha beta gamma delta epsilon zeta eta theta iota kappa lambda.",
            "Completely unrelated sentence about gardens and weather patterns today.",
        )
        self.assertEqual(report(out), {"words": 11, "covered": 0, "share": "0.00"})
        self.assertEqual(code, 0)

    def test_eight_word_overlap_counts(self):
        code, out = self.check("Begin here. " + SHARED8 + ". Then zebra ends.", OLD_WITH_8)
        self.assertEqual(report(out), {"words": 13, "covered": 8, "share": "61.54"})
        self.assertEqual(code, 1)

    def test_seven_word_overlap_does_not_count(self):
        code, out = self.check(SHARED7 + ". Then zebra ends.", OLD_WITH_8)
        self.assertEqual(report(out), {"words": 10, "covered": 0, "share": "0.00"})
        self.assertEqual(code, 0)

    def test_overlapping_windows_are_counted_once(self):
        code, out = self.check(SHARED9 + " zebra", "Gardens grow slowly. " + SHARED9 + ". Rain falls.")
        self.assertEqual(report(out), {"words": 10, "covered": 9, "share": "90.00"})

    def test_runs_in_several_old_files_all_count(self):
        code, out = self.check(
            SHARED8 + " gap " + ANOTHER8,
            "Gardens grow slowly. " + SHARED8 + ".",
            "Rain falls on " + ANOTHER8 + ".",
        )
        self.assertEqual(report(out), {"words": 17, "covered": 16, "share": "94.12"})

    def test_matching_ignores_case_and_punctuation(self):
        old = "Gardens grow slowly. River, STONE; quiet! lantern-winter (harbor) copper meadow."
        code, out = self.check(SHARED8 + " zebra", old)
        self.assertEqual(report(out), {"words": 9, "covered": 8, "share": "88.89"})

    def test_old_directory_only_reads_md_files(self):
        self.write("old/notes.txt", OLD_WITH_8)
        out = io.StringIO()
        with contextlib.redirect_stdout(out):
            code = sim.main(str(self.write("new.md", SHARED8 + " zebra")), [str(self.dir / "old")])
        self.assertEqual(report(out.getvalue()), {"words": 9, "covered": 0, "share": "0.00"})
        self.assertEqual(code, 0)

    def test_old_directory_includes_md_in_subfolders(self):
        self.write("old/sub/deep.md", OLD_WITH_8)
        out = io.StringIO()
        with contextlib.redirect_stdout(out):
            code = sim.main(str(self.write("new.md", SHARED8 + " zebra")), [str(self.dir / "old")])
        self.assertEqual(report(out.getvalue()), {"words": 9, "covered": 8, "share": "88.89"})
        self.assertEqual(code, 1)

    def test_exactly_two_percent_fails(self):
        code, out = self.check(SHARED8 + " " + filler(392), OLD_WITH_8)
        self.assertEqual(report(out), {"words": 400, "covered": 8, "share": "2.00"})
        self.assertEqual(code, 1)

    def test_one_percent_passes(self):
        code, out = self.check(SHARED8 + " " + filler(792), OLD_WITH_8)
        self.assertEqual(report(out), {"words": 800, "covered": 8, "share": "1.00"})
        self.assertEqual(code, 0)

    def test_empty_new_file_is_0_percent_and_passes(self):
        code, out = self.check("", OLD_WITH_8)
        self.assertEqual(report(out), {"words": 0, "covered": 0, "share": "0.00"})
        self.assertEqual(code, 0)

    def test_shared_heading_fails_even_with_0_percent_share(self):
        code, out = self.check("# Installation Notes\n\nZebra text here.", "## installation notes!\n\nOther text.")
        self.assertEqual(report(out)["share"], "0.00")
        self.assertIn("installation notes", out)
        self.assertEqual(code, 1)

    def test_placeholder_hash_dots_heading_is_not_shared(self):
        # BUG (expected red): "# ..." normalises to the empty heading "", so any two files that both
        # contain it fail the check.
        code, _ = self.check("# ...\n\nZebra text here.", "# ...\n\nOther text.")
        self.assertEqual(code, 0, "a punctuation-only placeholder heading must not count as shared")


class CliTest(TempCase):
    def cli(self, *args):
        return subprocess.run(
            [sys.executable, "-I", str(SIMILARITY), *map(str, args)],
            capture_output=True, text=True, encoding="utf-8",
        )

    def test_cli_exits_1_when_share_is_over_the_limit(self):
        r = self.cli(self.write("new.md", OLD_WITH_8), self.write("old.md", OLD_WITH_8))
        self.assertEqual(r.returncode, 1, r.stderr)
        self.assertEqual(report(r.stdout)["share"], "100.00")

    def test_cli_refuses_a_missing_old_path(self):
        # BUG (expected red): a mistyped OLD path compares against nothing and passes with 0.00%.
        r = self.cli(self.write("new.md", "Zebra text here."), self.dir / "no-such-file.md")
        self.assertNotEqual(r.returncode, 0, "a missing OLD path must not pass the check")


class RunsCliTest(TempCase):
    def runs(self, new_text, old_text):
        new = self.write("new.md", new_text)
        old = self.write("old.md", old_text)
        return subprocess.run(
            [sys.executable, "-I", str(RUNS), str(new), str(old)],
            capture_output=True, text=True, encoding="utf-8",
        )

    def test_prints_the_whole_shared_run_not_just_the_first_window(self):
        r = self.runs("Intro words here. " + SHARED10 + " outro.", "Gardens. " + SHARED10 + ". Rain.")
        self.assertEqual(r.stdout, SHARED10 + " <- old.md\n")
        self.assertEqual(r.returncode, 0)

    def test_separate_shared_runs_get_their_own_lines(self):
        r = self.runs(SHARED8 + " zebra " + ANOTHER8, "Gardens. " + SHARED8 + ". Rain. " + ANOTHER8 + ".")
        self.assertEqual(r.stdout, f"{SHARED8} <- old.md\n{ANOTHER8} <- old.md\n")

    def test_seven_word_overlap_prints_nothing(self):
        r = self.runs(SHARED7 + ". Then zebra ends.", OLD_WITH_8)
        self.assertEqual(r.stdout, "")
        self.assertEqual(r.returncode, 0)


if __name__ == "__main__":
    unittest.main()
