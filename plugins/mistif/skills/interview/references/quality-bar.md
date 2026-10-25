# Quality bar details

## Standard tool per dimension
Use what the stack already has before adding anything.
| Dimension | Typical tools |
|---|---|
| types and lint | the compiler's strict mode, ESLint, Ruff, golangci-lint |
| tests and coverage | the project's runner with its built-in coverage; changed-line coverage via diff-cover or the CI vendor's equivalent |
| security | a secrets scanner (gitleaks), a dependency audit (npm audit, pip-audit), a static scanner (Semgrep, CodeQL) |
| performance | Lighthouse or a stated benchmark, against a running URL |
| accessibility | axe-core or Lighthouse accessibility, against a running URL |
| architecture | import-boundary checkers (dependency-cruiser, import-linter) |

## Default thresholds, each with a reason
Start from measuring. If the person wants numbers now, offer these and say why:
- changed-line coverage 80%: low enough to reach, high enough that new logic is exercised;
- zero new high-severity findings: old debt is handled by the ratchet, new debt is not allowed;
- zero secrets: one leak is a rotation incident.

## Where checks run, by cost
- Seconds (types, lint, secrets): after each edit.
- Related tests and changed-line coverage: at the end of a task, about 90 seconds at most.
- Heavy checks (full suite, scanners, browser audits): at review or in CI.
Scope every check to the diff where the tool allows. Optional fast/task/full script entries mirror the file; `CONSTRAINTS.md` stays the source of truth.

## Ratchet
Record today's value of each measured metric. A change may improve it or hold it within a small stated tolerance; it may not worsen it. Updating the floor is a deliberate, reviewed edit.

## Waivers
Every waiver has an owner, a reason and an expiry date a few weeks out. Expired ones fail the check.
