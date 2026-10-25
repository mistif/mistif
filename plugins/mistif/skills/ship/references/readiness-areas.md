# Readiness areas

For each, mark pass / fail / n/a (reason) / unverified.

- **Code health**: tests, build, types and lint pass; no leftover debug code or stubs; the diff was reviewed.
- **Security**: no secrets in the change; inputs validated; access checks in place; dependency audit clean or accepted.
- **Performance**: the metric that matters is not worse than the baseline; no new unbounded work.
- **Accessibility** (user-facing only): keyboard reachable, readable contrast, names on controls.
- **Infrastructure and config**: new environment variables and settings exist in every environment; resources are sized; the deploy is repeatable.
- **Data migrations**: reversible, tested on a copy, run order known.
- **Monitoring**: the failure modes of this change show up on a dashboard or alert.
- **Docs**: the README, change list and runbook match what ships.

## Exposure steps
Hidden behind a flag, then internal users, then a small share, then everyone. For each step state: the baseline, the number that means advance, the number that means hold, the number that means back out, and how long to watch.

## After release (run only once the person says it shipped)
Error rate, latency, the key user action, queue depth, logs for new error types, and one manual pass of the main flow.

## Rollback skeleton
- Trigger: signal and number.
- Steps: the exact commands or clicks, in order.
- Who is told, and how.
- Time it takes.
- What happens to data written since the release.
