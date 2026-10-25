# Performance procedure

## What to measure first
| Symptom | First measurement |
|---|---|
| slow page load | a lab report (Lighthouse) or a trace: time to first byte, largest content, blocking scripts |
| slow interaction | a recorded profile of the click: long tasks, layout work, re-renders |
| slow API | server timing split into queries, external calls and compute |
| slow query | the database's query plan, row counts, index use |
| high memory | heap snapshots before and after the action, repeated |
| slow build or test | per-step timings |

## Common bottlenecks
- Work repeated per item: a query in a loop, a re-render per row.
- Work that does not need to happen yet: loading everything up front.
- Big payloads: unminified or uncompressed assets, oversized images, unbounded responses.
- Waiting in series what could run together.
- Missing or unused indexes.

## Measuring
Same command, same data, same machine state. Say warm or cold. Repeat enough times that the spread is clear, and compare the median. A gain smaller than the spread is noise.

## Keep or revert
| Result | Do |
|---|---|
| clearly better than noise, tests green | keep |
| within noise | revert; record as "neutral" |
| better but a test fails or needed work was dropped | revert |

## Ledger
A short table: change, metric before, metric after, kept or reverted. It stops the same dead experiment from being tried twice.

## Cautions
- An index speeds reads and slows writes; check the plan uses it.
- A cache needs an invalidation rule and a size limit before it ships.
- Bigger connection or thread pools can hurt; change one and measure.

## Guards
Finish by proposing a check on the same metric: a budget in CI, a benchmark with a threshold, or a monitoring alert.
