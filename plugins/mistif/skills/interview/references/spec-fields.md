# Spec fields

## Capability map (only for bundled requests)
A table or list, agreed before any spec is written:
- a stable id for each capability, chosen once and never renamed;
- the single responsibility of each;
- what it depends on; the graph must have no cycles;
- the build order that follows from it.
Each id gets its own spec file, written in dependency order.

## Fields of a spec
1. **Objective**: who it is for and what success looks like.
2. **Stack**: languages, frameworks and their versions.
3. **Commands**: the exact runnable commands for build, test, lint and dev.
4. **Layout**: where code, tests and config live.
5. **Style**: one real snippet from the project that shows the conventions. Prefer it to a paragraph of rules.
6. **Testing**: what kinds of tests, where, and what they must cover.
7. **Boundaries** in three tiers: always do, ask first, never do.
8. **Done when**: a list of checks that can be run or observed.
9. **Open questions**: what is still unknown and who decides.

## Vague to measurable
| Said | Becomes |
|---|---|
| "fast" | page ready in under 2 s on the slowest supported device, measured by the named tool |
| "secure login" | passwords hashed, sessions expire after the stated time, the listed attacks are rejected by tests |
| "works offline" | the listed screens load and save with the network off, and sync within a stated time after reconnecting |
| "easy to use" | a new user finishes the main task unaided in under a stated time |

Confirm each target with the person before it goes in.
