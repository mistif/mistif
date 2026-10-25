"""Tests for skills/interview/scripts/guard.py against throwaway git repos. Run from the plugin folder: python -m unittest tests.guard_test
Each test builds its own repo in a temp folder that is removed afterwards. Git's global and system config are switched off
so the result does not depend on the machine."""
import os
import shutil
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

GUARD = Path(__file__).resolve().parent.parent / "skills" / "interview" / "scripts" / "guard.py"


class GuardTest(unittest.TestCase):
    def setUp(self):
        self.root = Path(tempfile.mkdtemp(prefix="guard-"))
        self.addCleanup(shutil.rmtree, self.root, ignore_errors=True)
        config = self.root / "gitconfig"
        config.write_text("", encoding="utf-8")
        self.env = {
            **os.environ,
            "HOME": str(self.root),
            "USERPROFILE": str(self.root),
            "GIT_CONFIG_GLOBAL": str(config),
            "GIT_CONFIG_NOSYSTEM": "1",
            "GIT_CEILING_DIRECTORIES": str(self.root.parent),
            "GIT_AUTHOR_NAME": "t",
            "GIT_AUTHOR_EMAIL": "t@example.com",
            "GIT_COMMITTER_NAME": "t",
            "GIT_COMMITTER_EMAIL": "t@example.com",
        }
        self.repo = self.root / "repo"
        self.repo.mkdir()
        self.git("init", "-q", "-b", "main")

    def git(self, *args):
        subprocess.run(["git", *args], cwd=self.repo, env=self.env, check=True, capture_output=True)

    def write(self, name, text):
        path = self.repo / name
        path.parent.mkdir(parents=True, exist_ok=True)
        with open(path, "w", encoding="utf-8", newline="\n") as f:
            f.write(text)

    def commit(self, files):
        for name, text in files.items():
            self.write(name, text)
        self.git("add", "-A")
        self.git("commit", "-q", "-m", "base")

    def guard(self, *args):
        r = subprocess.run([sys.executable, "-I", str(GUARD), *args], cwd=self.repo, env=self.env,
                           capture_output=True, text=True, encoding="utf-8")
        return r.returncode, r.stdout, r.stderr

    def test_clean_change_prints_clean_and_exits_zero(self):
        self.commit({"app.py": "a = 1\n"})
        self.write("app.py", "a = 1\nb = 2\n")
        self.assertEqual(self.guard(), (0, "clean\n", ""))

    def test_suppression_comment_is_flagged_with_file_and_line(self):
        self.commit({"app.py": "a = 1\n"})
        self.write("app.py", "a = 1\nb = foo()  # noqa\n")
        self.assertEqual(self.guard(), (1, "new check suppression: app.py:2\n", ""))

    def test_every_suppression_marker_is_flagged(self):
        self.commit({"app.py": "a = 1\n"})
        self.write("app.py", "a = 1\n" + "\n".join([
            "x = 1  # noqa",
            "x = 1  # type: ignore",
            "// eslint-disable-next-line",
            "// @ts-ignore",
            "// @ts-nocheck",
            "x = 1  # nosec",
            "x = 1  # pylint: disable=unused-import",
            "// nolint",
        ]) + "\n")
        self.assertEqual(self.guard(), (1, "\n".join([
            "new check suppression: app.py:2",
            "new check suppression: app.py:3",
            "new check suppression: app.py:4",
            "new check suppression: app.py:5",
            "new check suppression: app.py:6",
            "new check suppression: app.py:7",
            "new check suppression: app.py:8",
            "new check suppression: app.py:9",
        ]) + "\n", ""))

    def test_every_skip_form_is_flagged(self):
        self.commit({"app.py": "a = 1\n"})
        self.write("app.py", "a = 1\n" + "\n".join([
            'it.skip("works", () => {',
            'xit("works", () => {',
            'xdescribe("suite", () => {',
            "@pytest.mark.skip",
            "@unittest.skip",
            't.Skip("later")',
        ]) + "\n")
        self.assertEqual(self.guard(), (1, "\n".join([
            "skipped test: app.py:2",
            "skipped test: app.py:3",
            "skipped test: app.py:4",
            "skipped test: app.py:5",
            "skipped test: app.py:6",
            "skipped test: app.py:7",
        ]) + "\n", ""))

    def test_stub_code_is_flagged_in_any_case(self):
        self.commit({"app.py": "a = 1\n"})
        self.write("app.py", "a = 1\n" + "\n".join([
            "raise NotImplementedError()",
            'throw new Error("not implemented");',
            "todo: implement parsing",
        ]) + "\n")
        self.assertEqual(self.guard(), (1, "\n".join([
            "stub or unfinished code: app.py:2",
            "stub or unfinished code: app.py:3",
            "stub or unfinished code: app.py:4",
        ]) + "\n", ""))

    def test_empty_error_handler_is_flagged(self):
        self.commit({"app.py": "a = 1\n"})
        self.write("app.py", "a = 1\n" + "\n".join([
            "except ValueError: pass",
            "} catch (e) {}",
        ]) + "\n")
        self.assertEqual(self.guard(), (1, "\n".join([
            "empty error handler: app.py:2",
            "empty error handler: app.py:3",
        ]) + "\n", ""))

    def test_secret_assignment_is_flagged_without_printing_the_value(self):
        self.commit({"app.py": "a = 1\n"})
        self.write("app.py", 'a = 1\nAPI_KEY = "abcdefghijklmnop"\n')
        self.assertEqual(self.guard(), (1, "possible secret (value hidden): app.py:2\n", ""))

    def test_aws_key_and_private_key_header_are_flagged(self):
        self.commit({"app.py": "a = 1\n"})
        # the fake key is joined at run time so no key-shaped text sits in the file
        self.write("app.py", 'a = 1\naws = "' + 'AKIA' + 'ABCDEFGHIJKLMNOP' + '"\n-----BEGIN RSA ' + 'PRIVATE KEY-----\n')
        self.assertEqual(self.guard(), (1, "\n".join([
            "possible secret (value hidden): app.py:2",
            "possible secret (value hidden): app.py:3",
        ]) + "\n", ""))

    def test_removed_assert_line_is_counted(self):
        self.commit({"app.py": "def test_total():\n    assert total(2) == 3\n"})
        self.write("app.py", "def test_total():\n    pass\n")
        self.assertEqual(self.guard(), (1, "removed assertion lines: 1\n", ""))

    def test_removed_line_without_assert_is_not_counted(self):
        self.commit({"app.py": "a = 1\nb = 2\n"})
        self.write("app.py", "a = 1\n")
        self.assertEqual(self.guard(), (0, "clean\n", ""))

    def test_suppression_already_committed_is_not_reported(self):
        self.commit({"app.py": "a = foo()  # noqa\n"})
        self.write("app.py", "a = foo()  # noqa\nb = 2\n")
        self.assertEqual(self.guard(), (0, "clean\n", ""))

    def test_added_line_is_reported_at_its_own_line_number(self):
        self.commit({"app.py": "one\ntwo\nthree\nfour\nfive\nsix\n"})
        self.write("app.py", "one\ntwo\nthree\nX  # noqa\nfour\nfive\nsix\n")
        self.assertEqual(self.guard(), (1, "new check suppression: app.py:4\n", ""))

    def test_line_number_counts_the_new_file_after_an_earlier_deletion(self):
        self.commit({"app.py": "one\ntwo\nthree\nfour\nfive\nsix\n"})
        self.write("app.py", "one\nthree\nfour\nfive  # noqa\nsix\n")
        self.assertEqual(self.guard(), (1, "new check suppression: app.py:4\n", ""))

    def test_new_untracked_file_is_scanned(self):
        self.commit({"app.py": "a = 1\n"})
        self.write("new.py", "a = 1\nb = 2  # noqa\n")
        self.assertEqual(self.guard(), (1, "new check suppression: new.py:2\n", ""))

    def test_gitignored_file_is_not_scanned(self):
        self.commit({".gitignore": "*.local.py\n", "app.py": "a = 1\n"})
        self.write("scratch.local.py", "x = 1  # noqa\n")
        self.assertEqual(self.guard(), (0, "clean\n", ""))

    # Known bug: git quotes non-ASCII paths in diff headers and ls-files output, so guard drops the file silently.
    def test_tracked_file_with_non_ascii_name_is_scanned(self):
        self.commit({"café.py": "a = 1\n"})
        self.write("café.py", "a = 1\nb = 2  # noqa\n")
        self.assertEqual(self.guard(), (1, "new check suppression: café.py:2\n", ""))

    # Known bug: same cause as above, through the untracked-file path.
    def test_untracked_file_with_non_ascii_name_is_scanned(self):
        self.commit({"app.py": "a = 1\n"})
        self.write("naïve.py", "b = 2  # noqa\n")
        self.assertEqual(self.guard(), (1, "new check suppression: naïve.py:1\n", ""))

    def test_unknown_base_ref_exits_two(self):
        self.commit({"app.py": "a = 1\n"})
        rc, out, err = self.guard("no-such-ref")
        self.assertEqual((rc, out), (2, ""))
        self.assertTrue(err.startswith("could not run: "), err)

    def test_no_main_or_origin_main_exits_two(self):
        self.commit({"app.py": "a = 1\n"})
        self.git("branch", "-m", "main", "trunk")
        self.assertEqual(self.guard(), (2, "", "could not run: no base branch found\n"))

    def test_origin_main_is_preferred_over_main(self):
        self.commit({"app.py": "a = 1\n"})
        self.git("update-ref", "refs/remotes/origin/main", "HEAD")
        self.commit({"app.py": "a = 1\nb = 2  # noqa\n"})
        self.assertEqual(self.guard(), (1, "new check suppression: app.py:2\n", ""))

    def test_explicit_base_argument_is_compared_against(self):
        self.commit({"app.py": "a = 1\n"})
        self.commit({"app.py": "a = 1\nb = 2  # noqa\n"})
        self.assertEqual(self.guard("HEAD~1"), (1, "new check suppression: app.py:2\n", ""))


if __name__ == "__main__":
    unittest.main()
