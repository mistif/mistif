# Difficulty ladder: where do the mistif skills start to pay? (2026-10-25)

Plugin tested: public `mistif/mistif` 1.0.31 at `8989892`, fresh clone, `MISTIF_NUDGE=on` so the skills load. Models: Haiku 5.5 and Sonnet 5.5 (init event checked on every run, `cond_ok` true in all 184). Headless `claude -p --setting-sources project --strict-mcp-config --plugin-dir`, `CLAUDE_CODE_DISABLE_CLAUDE_MDS=1`, nothing installed in the real `~/.claude`. Harness `bench.py`, `measure.py`, `analyze.py`, `rules.py`, `effort_signal.py`; fixtures, hidden tests, mutants, the cron oracle, results and measures are in this folder. Full tables: `tables.md`, `signals/`. Nothing pushed except to the private branch `difficulty-bench`.

## Answer in six lines

1. **No crossover on quality: "never", for both models, at every level I could build.** Base Haiku and base Sonnet pass nearly every judge-free measure (hidden tests, mutants killed, planted defects found) up to the hardest tasks: 33/38 and 35/38 over all runs, mistif 34/38 and 37/38. The gaps (1 to 2 runs) are far inside the noise (about 25 percentage points with 2 runs per cell).
2. **My attempt to make base Haiku fail did not work.** I tuned fixtures upward in four rounds (see "Method") and base Haiku still passed 5-clause-to-24-clause feature specs, a bug with no failing test and a decoy, 32 hidden mutants, a 413-case cron oracle and a 14-defect review. The aim "L5 about 0-30% for base Haiku" was not reached; the suite is saturated again, now at a much higher difficulty than the first public bench. So **this benchmark cannot show that skills raise success on well-specified, self-verifiable coding work, because base models already succeed there.**
3. **Cost is where mistif loses, and it grows with level.** Mistif loads a skill more often as the task gets harder (the nudge text lets it skip trivial asks): Haiku 50% of runs at L1, 90% at L5; Sonnet 25% to 80%. Per run: Sonnet $0.102 vs $0.077 (+32%), Haiku $0.009 vs $0.008 (+12%); at L4-L5 Sonnet is +45% and +37%. Cost per success: Sonnet $0.105 vs $0.084.
4. **The one place a skill changes the outcome is the vague request, and only for Sonnet.** With a simulated user: mistif-Sonnet asked before building in 8 of 8 dialogues (base Sonnet 2/8), wrote a brief with 3.9 of 5 hidden facts (base 0.3) and an acceptance list 8/8 (base 0/8), at $0.22-0.39 per dialogue up to the first write against $0.03-0.04. Mistif-Haiku loaded a skill in 3 of 8 and still built without asking in 8 of 8, same as base Haiku (0/8). Base Sonnet asked 2/4 at L4 (facts that matter) and 0/4 at L2.
5. **Cheap difficulty signals do not predict where skills pay; "the prompt names no file or identifier" does.** On my 23 prompts the rule "no backticked identifier or file named" fires on exactly the 4 vague requests (precision 1.00, recall 1.00); the effort mod's own Haiku judgement fires on 12 of 23 (precision 0.17, recall 0.50), prompt length and hard words (refactor/race/security) 0. Caveat: all my coding briefs name files, so this separation is partly built in.
6. **Recommended nudge rule** (section at the end): drop "is it hard?" as the trigger. Fire only when the request is a build/make request that names no file, identifier or concrete spec, and only on Sonnet or stronger; stay silent for everything else.

## Method

- **Tasks (19 prompts + 4 personas).** A feature in a multi-file `store/` library, L1 `available()`, L2 `low_stock()`, L3 backorders (3 files), L4 atomic multi-line amend, L5 a policy document of 18 clauses (holds that expire, restock FIFO, customer limit, error-precedence rules, the invariant `reserved == sum(held)`); 24 hidden tests. B bug fix on the same code with an injected bug: L1 and L2 with the failing test shown, L3 stale total after an amend (symptom reported in the summary), L4 a `ValueError` in the nightly sweep after edits, L5 ghost reservations with no failing test, cause in `restock` and a decoy TODO in the report module; 25-28 hidden tests each. C review of a diff with planted defects: L1 3, L3 6, L5 6 (concurrency and security across 4 files), L7 14 (job queue); defects found by regex over the answer, unmatched bullets counted. D write tests for an untested module, scored by hidden mutants killed: L1 9, L3 14, L5 32 (a TTL cache with clock, file and replace seams). G a spec-only module (cron `next_run`), scored by differential agreement with a reference on 234 (L3 subset) and 413 (L5 full) generated cases. Reference solutions exist for A, B and G, and reference tests kill all mutants.
- **Levels.** L1..L5 as above; C7 is shown as "L7" (a longer review than C5). G sits at L3 and L5. C and D have only L1/L3/L5 (+C7), A and B all five.
- **Conditions and runs.** B-haiku, B-sonnet, M-haiku, M-sonnet; 2 runs per cell (G3: 2; all others 2): 38 runs per condition, 152 task runs. Plus 32 dialogues (family E: two personas at L2, two at L4, 2 runs each) with the Haiku user simulator from the earlier harness and a Sonnet fact check of the briefs. The prompt appends the "no user available, state your assumption" line to the task families but not to E.
- **Four tuning rounds** on base Haiku: the first ladder passed 30/32; then I added dict-based multi-line amend and an expiry, restock and limit policy; then a 24-test policy document with error precedence; then the cron oracle and a 14-defect review. Each round was piloted on base Haiku and then base Sonnet before the M runs; fixtures changed only before the M runs, and runs on changed fixtures were deleted and rerun.
- **Measures are facts.** Hidden tests pass/fail, mutants killed, defects matched by regex, differential agreement. No judge was used (no Opus judging was needed: the measures saturate, so there was nothing for a quality judge to separate). Sonnet checked the E briefs against 5 facts.
- **Noise.** With 2 runs per cell, a gap under about 25 percentage points of success rate is noise; pooled per level the cells hold 4 to 10 runs, so even a single run difference is 10 to 25 points.
- **Harness note.** Measuring pytest in parallel gave rare spurious collection errors; `measure.py` retries and re-measures suspicious results sequentially.

## Results

Success = all hidden tests pass / all mutants killed / all planted defects found / all oracle cases agree. Runs per cell in brackets (pooled over families).

| level | base Haiku | mistif Haiku | base Sonnet | mistif Sonnet |
|---|---|---|---|---|
| L1 | 8/8 | 8/8 | 8/8 | 8/8 |
| L2 | 4/4 | 4/4 | 4/4 | 4/4 |
| L3 | 9/10 | 10/10 | 9/10 | 10/10 |
| L4 | 4/4 | 4/4 | 4/4 | 4/4 |
| L5 | 8/10 | 8/10 | 10/10 | 10/10 |
| L7 (C7 review, 14 defects) | 0/2 (13/14 each) | 0/2 (13/14) | 0/2 (13/14) | 1/2 (13-14/14) |

The misses are: C5 review, base Haiku 0/2 and mistif Haiku 1/2 (5 of 6 defects), D5 mistif Haiku 1/2 (30 of 32 mutants), and in L3 the cron-lite oracle reached 233/234 for two runs (a bug in my first oracle for day-of-week 7, fixed and remeasured). The same defect in C7 (13 of 14) is missed by nearly every run, mistif or not. All inside the noise.

**Crossover (level where mistif beats base by more than the noise):** Haiku never, Sonnet never. **Where mistif is worse:** cost only, no quality loss measured.

| level | $ per run base Haiku / mistif | base Sonnet / mistif | skill loaded (Haiku, Sonnet) |
|---|---|---|---|
| L1 | 0.004 / 0.005 | 0.053 / 0.056 | 50%, 25% |
| L2 | 0.004 / 0.005 | 0.058 / 0.067 | 100%, 0% |
| L3 | 0.007 / 0.008 | 0.068 / 0.093 | 60%, 40% |
| L4 | 0.006 / 0.008 | 0.082 / 0.120 | 75%, 75% |
| L5 | 0.013 / 0.013 | 0.114 / 0.156 | 90%, 80% |

Skills loaded (mistif runs): Haiku build 14, review 7, test 6; Sonnet build 11, review 1, test 5. No agent was spawned in any run. Mistif Haiku was faster (55 s vs 76 s per run); not explained, probably fewer self-made test rounds.

### Family E, vague request (unprimed, nudge on for mistif; 4 dialogues per row)

| level | cond | asked before build | built without asking | facts of 5 in brief | acceptance list | skill loaded | $/dialogue to first write |
|---|---|---|---|---|---|---|---|
| L2 | base Haiku | 0/4 | 4/4 | 0.0 | 0/4 | 0/4 | 0.014 |
| L2 | mistif Haiku | 0/4 | 4/4 | 0.0 | 0/4 | 1/4 | 0.016 |
| L2 | base Sonnet | 0/4 | 4/4 | 0.2 | 0/4 | 0/4 | 0.027 |
| L2 | **mistif Sonnet** | **4/4** | 0/4 | **3.5** | **4/4** | 4/4 | 0.217 |
| L4 | base Haiku | 0/4 | 4/4 | 0.0 | 0/4 | 0/4 | 0.014 |
| L4 | mistif Haiku | 0/4 | 4/4 | 0.2 | 0/4 | 2/4 | 0.019 |
| L4 | base Sonnet | 2/4 | 2/4 | 0.5 | 0/4 | 0/4 | 0.044 |
| L4 | **mistif Sonnet** | **4/4** | 0/4 | **4.2** | **4/4** | 4/4 | 0.394 |

Mistif Sonnet asks even at L2, where the missing facts hardly matter (a plant-watering page, a recipe page): asking is not scaled to the stakes, so at L2 it spends about 8x the money for a brief on a request base Sonnet would have answered with sensible defaults. At L4 (clinic scheduling with health data, payroll) base Sonnet asks half the time by itself and mistif's brief has 4.2 of 5 facts against 0.5. Mistif Haiku does not ask in either case, even when it loads a skill (the earlier bench saw the same: priming helped, the nudge alone did not).

## Recommended rule for a smart nudge

Evidence: skills did not change success on any of 19 well-specified tasks, they changed behaviour on 4 vague requests. So the trigger should detect "missing facts", not "hard".

| signal (checked on my 23 prompts) | fires | precision | recall |
|---|---|---|---|
| effort mod verdict high/xhigh/max or opus/fable (Haiku judge, `Current: none`, 2 samples) | 12/23 | 0.17 | 0.50 |
| prompt over 120 words | 2/23 | 0.00 | 0.00 |
| words refactor/migrate/race/security/thread/invariant | 2/23 | 0.00 | 0.00 |
| **no backticked identifier and no file or path named** | 4/23 | **1.00** | **1.00** |
| same, and under 60 words | 4/23 | 1.00 | 1.00 |

(The positive class is family E, the only prompts where a skill moved a measure; the effort judge's verdicts are in `signals/effort_judge.json`. It rates coding tasks high and the vague clinic and payroll requests medium or high, so difficulty is the wrong axis.)

Rule: **fire the nudge on the first prompt of a session only if (a) it asks to build, make, write or set up something (verbs, not questions), (b) it names no file, path, backticked identifier or code block, (c) it is under about 60 words, and (d) the session model is Sonnet or stronger.** Otherwise stay silent. Optionally add the effort mod's verdict only as a tie-breaker (high effort and a vague prompt: fire; low effort: stay off). For Haiku do not rely on the nudge: it loads a skill but did not ask in 0/8; keep any Haiku interview behind an explicit prime ("use the interview skill").

What this saves: the nudge cost (+32% on Sonnet, +12% on Haiku, up to +45% at L4) buys nothing on the 19 coding, bug, review and test tasks here; with the rule it would not fire on any of them. What it risks: the 4/23 precision and recall are on my own prompts, where every coding brief names files by construction, so real-world precision will be lower; real users also write vague-looking prompts that need no questions (the L2 case above).

## Limits

- **Saturation is the main limit.** I did not reach tasks where base models fail, so I cannot say whether skills help there; a harder ladder needs much larger tasks (many files, hours of work) or tasks that cannot be verified by the model's own tests. This run says only: up to a 28-test feature, a 24-clause policy, a 14-defect review and 32 mutants, skills add no measurable success.
- 2 runs per cell; gaps under 25 points are noise. E has 4 dialogues per cell and 2 personas per level; the Sonnet vs Haiku difference there is large (8/8 against 0/8) but rests on 4 personas.
- Review defects are matched by regex over the answer (a loose match can credit a mention). The Haiku effort judgement is my replay of the mod's `JUDGE_SYSTEM` prompt, not the mod itself running in a session.
- Fixtures and hidden tests are my own; none comes from a real project. Superpowers was not run (the extra condition was optional and the main result needed no comparison).

## Cost

Task runs $10.4 (152 runs, 32 dialogues, mistif Sonnet dialogues dominate at about $3 of that), simulator $0.02, effort-signal replays $0.01, Sonnet fact checks about $0.1: **about $10.5 of the $35 cap.** No Opus judge. A rerun on the final build with this harness is about $9 for the task matrix plus about $3 for the dialogues.
