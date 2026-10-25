# Units, features, bugs and legacy code

## Test-first loop

1. Write one test for one behaviour. Run it. It must fail, and the message must show the behaviour is missing (wrong value seen, function absent from the unit, not a typo or broken import).
2. Write the least code that passes. Run.
3. Tidy only on green. Repeat.

Ask before writing production code if the user only asked for tests.

## Bug reproduction

- Reproduce through the public entry the user hit, with their input.
- The red run must show the wrong output you were told about; a different failure means you reproduced something else.
- After the fix: same test green, then the full suite. To re-prove, revert only the fix (save it as a patch, `git apply -R`, run red, `git apply`). No bare stash.
- Cannot be tested (real hardware timing, third-party outage)? Say why, give a manual repro.

## Legacy code with no tests

Pin what it does now before touching it.

1. Choose the seam the change will pass through, not the whole module.
2. Feed realistic inputs from callers, logs, fixtures. Add empty, one, large.
3. Run, read the output, write it down as the expectation, odd results included.
4. Label odd ones: `current behaviour, not endorsed`.
5. Code that cuts parts out of text (prefixes, markers, separators): vary where the marker sits, its case, what surrounds it, and what non-digit or non-letter characters fall inside the cut part. Surprises hide there.
6. Prove each pin with one mutation. Then change the code; a pinned result that moves is a decision to make out loud.

## Pure functions

- Table-driven: one row per case, expectation worked out by hand.
- Property or round-trip checks where natural (decode(encode(x)) equals x, sorting twice equals sorting once). Fix and print the seed so failures replay.
- Floats: tolerance, never `==`.

```ts
test.each([
  ['', 0], ['a', 1], ['a b', 2], ['  a   b ', 2],
])('wordCount(%j) = %i', (input, want) => expect(wordCount(input)).toBe(want))
```

## Edge-case sweep (walk it per unit; say which you skipped)

| Data | Try |
|---|---|
| Any | empty, one, many, null or absent, wrong type, duplicates, very large |
| Numbers | 0, -1, off-by-one at each limit, max/min, NaN, rounding at .5 |
| Text | empty, whitespace only, unicode (accents, emoji, right-to-left), very long, embedded newline or quote |
| Dates | month end, leap day, daylight-saving change, midnight, other timezone, past and future |
| Collections | unsorted, sorted, one element, repeated keys, input mutated |
| Money | cents not floats, rounding rule, negative, zero, currency mismatch |
| Errors | does a failure leave state half-written? is the message useful? |
| Time / concurrency | retry, expiry, double submit, ordering |

## Fake or mock?

| Dependency | Use |
|---|---|
| Your own pure code | the real thing |
| Disk | temp directory per test |
| Database | in-memory or temp instance with real schema |
| Clock, randomness | injected fake clock, seeded generator |
| HTTP you own | local test server |
| HTTP you do not own | recorded fixture, one fixture per branch (success, error, malformed), full real shape |
| Paid or slow service | stub at the narrowest edge |
| Outbound call is the contract (a charge, an email) | mock, assert call shape |

Never assert that a mock exists. Test-only cleanup lives in test helpers.

## Run one test, run all

| Ecosystem | One test | Full suite |
|---|---|---|
| Node, Vitest | `npx vitest run path -t "name"` | `npx vitest run` |
| Node, Jest | `npx jest path -t "name"` | `npx jest` |
| Node built-in | `node --test path` | `node --test` |
| Python | `pytest path::name -x` | `pytest` |
| Go | `go test ./pkg -run Name` | `go test ./...` |
| .NET | `dotnet test --filter Name` | `dotnet test` |

Prefer what the repo's CI runs over this table.
