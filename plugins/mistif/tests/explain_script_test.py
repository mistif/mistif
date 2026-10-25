"""Tests for hooks/explain.py against a made-up home folder. Run: python -m unittest tests/explain_script_test.py
(from the plugin folder). `claude plugin test` cannot start a process, so this one runs on its own."""
import json
import os
import shutil
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

SCRIPT = Path(__file__).resolve().parent.parent / "hooks" / "explain.py"


def skill(root, rel, desc):
    d = Path(root, rel)
    d.mkdir(parents=True)
    (d / "SKILL.md").write_text(f"---\nname: x\ndescription: {desc}\n---\n", encoding="utf-8")


def fake_home():
    """A registered marketplace, an unregistered clone of it, a worktree inside it, a stale cached version."""
    home = tempfile.mkdtemp(prefix="explain-")
    claude = Path(home, ".claude")
    market = claude / "local-marketplaces" / "mk"
    skill(market, "plugins/pl/skills/alpha", "Alpha does the alpha thing. More text.")
    skill(market, "plugins/pl/skills/alphabet", "Longer name that starts the same.")
    skill(market, ".claude/worktrees/wt/plugins/pl/skills/inworktree", "Lives in a worktree.")
    skill(claude / "local-marketplaces" / "mk-clone", "plugins/pl/skills/inclone", "Lives in an unregistered clone.")
    skill(claude, "plugins/cache/mk2/p2/1.0/skills/stale", "Old cached version.")
    skill(claude, "plugins/cache/mk2/p2/2.0/skills/fresh", "Current cached version.")
    skill(claude, "plugins/cache/mk3/p3/1.0/skills/switchedoff", "Plugin that is switched off.")
    fwd = lambda p: str(p).replace("\\", "/")
    (claude / "plugins" / "known_marketplaces.json").write_text(json.dumps({"mk": {"installLocation": fwd(market)}}), encoding="utf-8")
    (claude / "plugins" / "installed_plugins.json").write_text(json.dumps({"plugins": {
        "p2@mk2": [{"installPath": fwd(claude / "plugins/cache/mk2/p2/2.0")}],
        "p3@mk3": [{"installPath": fwd(claude / "plugins/cache/mk3/p3/1.0")}],
    }}), encoding="utf-8")
    (claude / "settings.json").write_text(json.dumps({"enabledPlugins": {"p3@mk3": False}}), encoding="utf-8")
    return home


class ExplainScript(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.home = fake_home()

    @classmethod
    def tearDownClass(cls):
        shutil.rmtree(cls.home, ignore_errors=True)

    def run_script(self, *args):
        env = {**os.environ, "HOME": self.home, "USERPROFILE": self.home}
        return subprocess.run([sys.executable, "-I", str(SCRIPT), *args], env=env, cwd=self.home, capture_output=True, text=True, encoding="utf-8").stdout

    def labels(self):
        return [label for label, _ in json.loads(self.run_script("--all"))]

    def test_registered_marketplace_is_listed(self):
        self.assertIn("pl:alpha", self.labels())

    def test_worktree_inside_a_marketplace_is_skipped(self):
        self.assertFalse([l for l in self.labels() if "inworktree" in l])

    def test_unregistered_local_marketplaces_folder_is_skipped(self):
        self.assertFalse([l for l in self.labels() if "inclone" in l])

    def test_cache_keeps_only_the_installed_version(self):
        labels = self.labels()
        self.assertIn("p2:fresh", labels)
        self.assertFalse([l for l in labels if "stale" in l])

    def test_plugin_switched_off_is_not_listed(self):
        self.assertFalse([l for l in self.labels() if "switchedoff" in l])

    def test_builtins_are_listed_too(self):
        self.assertTrue([l for l in self.labels() if ":" not in l])

    def test_exact_name_beats_a_longer_one(self):
        self.assertEqual(self.run_script("--lookup", "alpha").split("\t")[0], "pl:alpha")

    def test_prefix_finds_the_shortest_name(self):
        self.assertEqual(self.run_script("--lookup", "alph").split("\t")[0], "pl:alpha")

    def test_plugin_prefix_narrows_and_description_follows_a_tab(self):
        self.assertEqual(self.run_script("--lookup", "pl:alphab").strip(), "pl:alphabet\tLonger name that starts the same.")

    def test_unknown_name_prints_nothing(self):
        self.assertEqual(self.run_script("--lookup", "nosuchskill-zz").strip(), "")

    def test_which_tool_skill_runs_this_script_not_a_copy(self):
        skill = SCRIPT.parent.parent / "skills" / "which-tool"
        self.assertIn("/../../hooks/explain.py", (skill / "SKILL.md").read_text(encoding="utf-8"))
        self.assertFalse((skill / "scripts").exists())
        self.assertTrue((skill / ".." / ".." / "hooks" / "explain.py").resolve().samefile(SCRIPT))


if __name__ == "__main__":
    unittest.main()
