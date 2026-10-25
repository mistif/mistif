# Services, CLIs, data code, infrastructure

## API or service boundary

Two layers: a contract check of the surface, and integration through the real handler.

| Axis | Cases |
|---|---|
| Success | status, response shape, headers that matter |
| Validation | missing field, wrong type, too long, extra field |
| Auth | no credentials 401, wrong role 403, someone else's record 403 or 404 |
| Not found | unknown id, deleted id |
| Conflict | duplicate create, stale update |
| Upstream | dependency errors, times out, replies with malformed body |
| Idempotence | same request twice, double submit |

Boundary options, in order of preference: real thing in a temp area; faithful fake (in-memory store, local test server on a random port); recorded fixture, one per branch. Fake only what is slow, paid or outside your control. Each test creates its own data and ports; no shared rows.

Temp database: create a fresh schema or file per test (or per file, with a rollback per test), run the real migrations against it, drop it after. Never point a test at a shared or live database.

Assert on the stored result after the call as well as the response (the row exists, the email queued once).

## CLI or shell script

Run it as a process, in a temp directory, with input you control. Assert exit code, stdout and stderr separately, and what changed on disk.

```ts
import { spawnSync } from 'node:child_process'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const dir = mkdtempSync(join(tmpdir(), 'cli-'))
const r = spawnSync('node', ['bin/tool.js', '--bad'], { cwd: dir, encoding: 'utf8' })
expect(r.status).toBe(2)
expect(r.stderr).toMatch(/unknown option/)
expect(r.stdout).toBe('')
```

```sh
out=$(mktemp -d); ./script.sh "$out" missing.txt; echo "exit=$?"
```

Cover: bad arguments, missing file, empty input, re-running (second run changes nothing, or says so), output when piped. Do not assert that the script text contains a line.

## Data and ML code

Assert invariants, not exact numbers, when output is stochastic.

- Shape, dtype, value range, no NaN or infinity.
- Rows kept or accounted for (in = out + dropped, with the dropped count checked).
- No train/test leakage: the sets share no ids.
- Determinism: same seed, same output.
- Transformation logic on a tiny hand-checkable dataset (3 to 5 rows, expected output written by hand).
- Empty and single-row input.
- Metrics: a perfect and a worst-case prediction give the known extremes.

No model calls, no large data files. Generate small frames inline.

```python
def test_split_has_no_overlap():
    train, test = split(make_rows(20), seed=7)
    assert not set(train.id) & set(test.id)
    assert len(train) + len(test) == 20
```

## Infrastructure and config

Do not unit-test file text. Validate and dry-run, and assert on what the tool resolves.

| Kind | Check |
|---|---|
| Terraform | `terraform validate`, `terraform plan` against a scratch or local backend, assert on the plan JSON |
| Kubernetes | `kubectl apply --dry-run=client` or `kubeconform` |
| Docker | `docker build` in a scratch tag, then run a smoke command |
| CI file | the CI tool's lint (`actionlint`, etc.) |
| JSON or YAML config | schema validation, then load it with the real loader |

Plan or dry-run only. Never apply to a live environment, never use real credentials.

## Never touch

Live paid APIs, real accounts, real personal data, real databases, migrations on real data, writes outside a temp area. If the only way to prove it is live, say so and stop.
