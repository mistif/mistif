# Report format

```
Verdict: approve | approve with fixes | do not merge
Summary: two lines. What the change does; the main concern, if any.

Findings (highest leverage first)
1. [blocker] <title> - <file>:<line>
   Evidence: what you saw or ran.
   Why it matters: the effect on users or the system.
   Suggested move: the simplest change that fixes it.
2. ...

Coverage
Read: <files and areas>. Ran: <tests, build, experiments>. Not examined: <what and why>.
```

## Ranks
- **blocker**: a security hole, data loss, or broken behaviour. Do not merge.
- **fix**: change it before merge.
- **suggest**: better, but fine to merge as is.
- **nit**: taste. At most a few, and only when the rest is clean.
- **note**: something the author should know, no action needed.

## Sample
```
2. [fix] Pagination missing on the orders list - api/orders.py:41
   Evidence: the query has no LIMIT; the table has 2M rows in the staging copy.
   Why it matters: one request can load the whole table and time out.
   Suggested move: add limit/offset parameters with a default of 50 and a cap of 200.
```
