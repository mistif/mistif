"""Finds skills and commands by name or by topic.
  python explain.py --lookup <name>   closest match: "<plugin:skill>\\t<description>"
  python explain.py --all             every skill as JSON [[label, description], ...]
  python explain.py --search <text>   best matches for what someone is trying to do
Used by the explain mod and the which-tool skill."""
import glob, json, math, os, re, sys

HOME = os.path.expanduser("~/.claude")
HERE = os.path.dirname(os.path.abspath(__file__))
STOP = set("the and for with that this what are was were you your have has had not but can could should would into from about they them then than when where how why our out any all its just like want need make get got use using also".split())

def disabled():
    off = set()
    for p in (f"{HOME}/settings.json", f"{os.getcwd()}/.claude/settings.json"):
        try:
            plugins = json.load(open(p, encoding="utf-8")).get("enabledPlugins", {})
        except Exception:
            continue
        for key, on in plugins.items():
            (off.discard if on else off.add)(key.split("@")[0])
    return off

def owner_of(path):
    """(plugin, marketplace) a file belongs to; ("", "") for a personal skill."""
    p = path.replace("\\", "/")
    m = re.search(r"/plugins/cache/([^/]+)/([^/]+)/", p) or re.search(r"/local-marketplaces/([^/]+)/plugins/([^/]+)/", p)
    if m:
        return m.group(2), m.group(1)
    m = re.search(r"/plugins/synced/[^/]+/([^/]+)/", p)
    if m:
        try:
            return json.load(open(f"{p[:m.end(1)]}/.claude-plugin/plugin.json", encoding="utf-8"))["name"], ""
        except Exception:
            return re.sub(r"~.*$", "", m.group(1)), ""
    return ("anthropic-skills", "") if "/skills/synced/" in p else ("", "")

def installed_paths():
    """Folders of the plugin versions that are actually installed; the cache also keeps stale old ones."""
    try:
        data = json.load(open(f"{HOME}/plugins/installed_plugins.json", encoding="utf-8"))["plugins"]
    except Exception:
        return None
    return tuple(i["installPath"].replace("\\", "/") for items in data.values() for i in items)

def registered_markets():
    """Install folders of the marketplaces Claude Code knows about, or None if the list cannot be read."""
    try:
        data = json.load(open(f"{HOME}/plugins/known_marketplaces.json", encoding="utf-8"))
        return tuple(m["installLocation"].replace("\\", "/").rstrip("/") + "/" for m in data.values() if m.get("installLocation"))
    except Exception:
        return None

def collect(plugin, typed, include_off=False):
    """label -> (is_builtin, description or path, is_off, marketplace)"""
    off = disabled()
    live = installed_paths()
    markets = registered_markets()
    found = {}
    pats = [(f"{HOME}/skills/*/SKILL.md", 1), (f"{HOME}/skills/synced/*/*/SKILL.md", 1),
            (f"{HOME}/plugins/cache/**/skills/*/SKILL.md", 1), (f"{HOME}/plugins/cache/**/commands/*.md", 0),
            (f"{HOME}/plugins/synced/*/*/skills/*/SKILL.md", 1), (f"{HOME}/plugins/synced/*/*/commands/*.md", 0),
            (f"{HOME}/local-marketplaces/**/skills/*/SKILL.md", 1), (f"{os.getcwd()}/.claude/skills/*/SKILL.md", 1)]
    for pat, is_dir in pats:
        for path in sorted(glob.glob(pat, recursive=True), reverse=True):
            norm = path.replace("\\", "/")
            if "/.claude/worktrees/" in norm:
                continue  # other branches' working copies carry old plugin names and would be listed as live skills
            if markets and "/local-marketplaces/" in norm and not norm.startswith(markets):
                continue  # a folder under local-marketplaces that is not a registered marketplace (a git clone or worktree of one)
            if live and "/plugins/cache/" in path.replace("\\", "/") and not path.replace("\\", "/").startswith(live):
                continue
            skill = os.path.basename(os.path.dirname(path)) if is_dir else os.path.basename(path)[:-3]
            owner, market = owner_of(path)
            is_off = owner in off
            if not skill.startswith(typed) or (plugin and owner != plugin) or (is_off and not include_off):
                continue
            found.setdefault(f"{owner}:{skill}" if owner else skill, (False, path, is_off, market))
    if not plugin:
        try:
            builtins = json.load(open(os.path.join(HERE, "builtins.json"), encoding="utf-8"))
        except Exception:
            builtins = {}
        for skill, desc in builtins.items():
            if skill.startswith(typed):
                found[skill] = (True, desc, False, "")
    return found

def describe(entry, label):
    if entry[0]:
        return entry[1]
    m = re.search(r"^description:\s*(.+)$", open(entry[1], encoding="utf-8").read(), re.M)
    return (m.group(1).strip("\"' ") if m else label)[:400]

def find(name):
    plugin, _, typed = name.rpartition(":")
    found = collect(plugin, typed)
    if not found:
        return None
    # exact name first, built-ins before plugins on a tie, then the shortest name starting with what was typed
    best = min(found, key=lambda f: (f.rpartition(":")[2] != typed, not found[f][0], len(f.rpartition(":")[2]), f))
    return best, describe(found[best], best)

def curated():
    """The shipped starter list: label -> {"w": weight 1-3, "when": plain trigger text}."""
    try:
        return json.load(open(os.environ.get("MISTIF_CURATED") or os.path.join(HERE, "recommended.json"), encoding="utf-8"))
    except Exception:
        return {}

def usage():
    """How often this person ran each skill, read from their own session files; keyed by skill name."""
    # Opt-in: this reads every session file under ~/.claude/projects, so it stays off unless MISTIF_USAGE=1.
    if os.environ.get("MISTIF_USAGE") != "1":
        return {}
    # Session files are big and only ever grow, so each file's counts are cached with the byte
    # offset already read; later runs read just the new tail.
    cache_path = f"{HOME}/mistif-usage.json"
    try:
        cache = json.load(open(cache_path, encoding="utf-8"))
    except Exception:
        cache = {}
    for path in glob.glob(f"{HOME}/projects/*/*.jsonl"):
        try:
            size = os.path.getsize(path)
            entry = cache.get(path)
            if not entry or entry["offset"] > size:
                entry = {"offset": 0, "counts": {}}
            if size > entry["offset"]:
                with open(path, "rb") as f:
                    f.seek(entry["offset"])
                    chunk = f.read()
                end = chunk.rfind(b"\n") + 1  # leave a half-written last line for next time
                for line in chunk[:end].decode("utf-8", "ignore").splitlines():
                    if '"name":"Skill"' in line:
                        names = re.findall(r'"skill":"([^"]+)"', line)
                    elif "<command-name>" in line:
                        names = re.findall(r"<command-name>/?([^<]+)</command-name>", line)
                    else:
                        continue
                    for n in names:
                        key = n.rpartition(":")[2].lower()
                        entry["counts"][key] = entry["counts"].get(key, 0) + 1
                entry["offset"] += end
            cache[path] = entry
        except OSError:
            continue
    try:
        json.dump(cache, open(cache_path, "w", encoding="utf-8"))
    except OSError:
        pass
    counts = {}
    for entry in cache.values():
        for k, v in entry["counts"].items():
            counts[k] = counts.get(k, 0) + v
    return counts

def uses_of(label, picks, used):
    """Times this skill was run, by its bare name."""
    return used.get(label.rpartition(":")[2], 0)

def words(text):
    return re.findall(r"[a-z0-9]{3,}", text.lower())

def search(query, limit=8):
    q = [w for w in words(query) if w not in STOP]
    items = [(label, entry, describe(entry, label)) for label, entry in collect("", "", True).items()]
    stems = [{w[:5] for w in words(d)} for _, _, d in items]
    blend = os.environ.get("MISTIF_BLEND", "1") != "0"
    picks = curated() if blend else {}
    used = usage() if blend else {}
    # the curated "when" text counts as extra description, so hand-written triggers help the match
    stems = [s | {w[:5] for w in words(picks.get(label, {}).get("when", ""))} for (label, _, _), s in zip(items, stems)]
    # a word found in many descriptions ("design", "performance") says little: weigh it by how rare it is
    weight = {w: math.log(len(items) / (1 + sum(w[:5] in s for s in stems))) for w in q}
    scored = []
    for (label, entry, desc), desc_stems in zip(items, stems):
        name_stems = {w[:5] for w in words(label)}
        fit = sum(weight[w] * (3 if w[:5] in name_stems else 1) for w in q if w[:5] in name_stems | desc_stems)
        if fit <= 0:
            continue  # nothing is recommended on habit or ranking alone: it has to fit the goal
        uses = uses_of(label, picks, used)
        score = fit * (1 + 0.3 * picks.get(label, {}).get("w", 0)) + 0.4 * min(math.log1p(uses), 3)
        scored.append((-score, entry[2], label, entry, desc, uses))  # ties: switched-on plugins first
    lines, seen = [], set()
    for _, _, label, entry, desc, uses in sorted(scored, key=lambda s: s[:3]):
        if desc[:80] in seen:
            continue  # the same skill under another plugin name
        seen.add(desc[:80])
        if len(lines) == limit:
            break
        tag = f" [OFF here: enable \"{label.partition(':')[0]}@{entry[3]}\"]" if entry[2] else ""
        tag += " [recommended]" if label in picks else ""
        tag += f" [you used it {uses}x]" if uses else ""
        lines.append(f"{label}{tag}: {desc[:150]}")
    return "\n".join(lines)

def menu(query):
    """The curated list as a short menu Claude reads and judges by meaning, plus a few keyword finds from the rest."""
    picks, used, everything = curated(), usage(), collect("", "", True)
    rows = []
    for label, p in sorted(picks.items(), key=lambda kv: (-kv[1]["w"], kv[0])):
        if label not in everything:
            continue  # recommended, but not installed on this machine
        n = uses_of(label, picks, used)
        off = f" [OFF here: enable \"{label.partition(':')[0]}@{everything[label][3]}\"]" if everything[label][2] else ""
        rows.append(f"{label}{off}{f' [you used it {n}x]' if n else ''}: {p['when']}")
    os.environ["MISTIF_BLEND"] = "0"
    extra = [l for l in search(query, 12).splitlines() if re.match(r"\S+", l).group(0).rstrip(":") not in picks][:4]
    out = "Recommended for you (judge these by meaning, not by words):\n" + "\n".join(rows)
    return out + ("\n\nOther installed skills that match the words:\n" + "\n".join(extra) if extra else "")

if __name__ == "__main__":
    mode = sys.argv[1] if len(sys.argv) > 1 else ""
    if mode == "--all":
        print(json.dumps([[label, describe(entry, label)[:300]] for label, entry in sorted(collect("", "").items())]))
    elif mode == "--menu":
        print(menu(" ".join(sys.argv[2:])))
    elif mode == "--search":
        print(search(" ".join(sys.argv[2:])) or "No match.")
    elif mode == "--lookup":
        hit = find(sys.argv[2])
        if hit:
            print(f"{hit[0]}\t{hit[1]}")
    else:
        sys.exit("usage: --lookup <name> | --all | --search <text>")
