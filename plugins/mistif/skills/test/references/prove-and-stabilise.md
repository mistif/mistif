# Prove, stabilise, speed up

## Break-it recipes

Use the smallest edit that should turn the test red. One mutation per distinct behaviour that matters; not everything.

| Logic under test | Mutation |
|---|---|
| Condition | invert it (`if (x)` to `if (!x)`), or swap `&&` and `\|\|` |
| Guard or validation | delete the check, or return early |
| Boundary | `<` to `<=`, `n - 1` to `n` |
| Error path | remove the `throw` or the catch, or return success |
| State write | skip the write, write the old value, drop the re-read |
| Ordering | reverse a sort, swap two steps |
| Default | change the fallback value |
| Filter / query | drop one clause |

## Safe restore

1. Before the break: copy the file (`cp f f.orig`) or confirm `git diff --quiet`.
2. Apply the break. Run. Expect red, with a message about the right thing.
3. Restore: `git checkout -- f` (only if the file had no uncommitted work) or `mv f.orig f`.
4. Run green. Run `git diff` and confirm it shows only the intended test changes.

Never a bare `git stash` (shared across worktrees), never `reset --hard`. Unsafe to break (live system, spends money, writes outside a temp area)? Build a controlled fake of the broken behaviour, show the test fails against it, and say so.

## When a mutation survives

Stays green means one of:

- The test never reaches that line: wrong input, wrong branch. Fix the input.
- The assertion is too loose (`toBeDefined`, `length > 0`). Tighten to the exact literal.
- The code is dead or redundant. Say so; suggest removal.
- Another test already covers it. Delete the weaker one, or keep both and say why.

Fix the test, rerun the mutation. If you cannot make it fail, delete it and say so.

## Flaky tests

1. Reproduce: run it 20 to 50 times alone, then inside the suite, then in shuffled order. Note clock, seed, and failures per run. One odd red is a symptom, not a diagnosis.
2. Find the class.

| Cause | Fix |
|---|---|
| Real clock, sleeps, timezone | fake clock, pin timezone, wait on a condition |
| Order dependence | each test builds its own state |
| Shared file, port, row, env var, cache | per-test temp directory, random port, unique ids, restore env |
| Network | stub or local server |
| Unawaited work | await everything, fail on unhandled rejection |
| Unseeded randomness | seed it, print the seed |
| CI resource limits | smaller fixtures, fewer parallel workers |
| Browser locator or timing | semantic locator, wait for state not delay |

3. Never raise the timeout, add automatic retries, delete the test for being red, or call the suite fixed because the second run was green.
4. Cannot fix now? Quarantine visibly and tell the user, and keep it from blocking others. Note format:

```
SKIPPED (flaky): checkout total updates
since: 2026-10-24   suspected: shared cart row between files   owner: ask user
```

## Slow suites

Measure first: `vitest run --reporter=verbose`, `jest --verbose`, `pytest --durations=15`, `go test -v`. Cut the biggest costs: real sleeps, expensive setup that is safe to share, tests at too high a level, needless disk or network. Re-prove anything you rewrote; report measured before/after durations.

## Report sample

```
Added: tests/cart.test.ts, 7 tests (totals, discount cap, empty cart, rounding).
Ran: npx vitest run tests/cart.test.ts -> 7 pass. npx vitest run -> 212 pass, 0 fail, 0 skipped.
Break-it: flipped discount cap `<=` to `<` -> "caps at 50%" red; restored, green, git diff clean.
Not tested: payment provider (needs live service). Suite was already green.
Next: add a currency-mismatch case once the rule is decided.
```
