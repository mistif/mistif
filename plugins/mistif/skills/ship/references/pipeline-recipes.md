# Pipeline recipes

## Shape
```
on pull request: lint + types (fast) -> unit tests -> build -> audit -> optional end-to-end
on merge to default: all of the above -> deploy to staging -> smoke test
on approval: deploy to production -> health watch -> auto-rollback or one-step rollback
```

## Rules of thumb
- Cheapest checks first, so failures come back in seconds.
- Run independent jobs in parallel; share the install step through a cache keyed on the lockfile.
- Pin tool and action versions.
- Give production deploys their own environment with required approvers.
- Keep secrets in the platform's store, scoped to the environment that needs them.
- Make the required checks a branch rule, not a habit.

## Slow pipeline ladder
1. Cache dependencies and build output.
2. Split the test suite and run the parts in parallel.
3. Run only the tests related to the diff on pull requests; run everything on merge.
4. Move rarely useful heavy jobs to a nightly run.

## Failing pipeline
Read the first failing step. Reproduce locally with the same command. Fix the cause. If a test is flaky, tell the person and quarantine it with an owner and a date; do not just rerun until green.
