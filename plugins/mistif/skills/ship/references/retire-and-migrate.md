# Retire and migrate

## Notice skeleton
```
What is being retired and why
Replacement and how to move (link to the guide)
Dates: advisory from ..., compulsory (if any) from ..., removal no earlier than ...
Who to ask
```

## Order
1. Measure who uses it today.
2. Confirm the replacement works for each use.
3. Announce.
4. Move consumers one at a time, checking behaviour after each.
5. Watch usage fall to zero.
6. Delete code, tests, config, docs and notices in one change.

## Changing a stored data shape: three releases
1. **Add**: create the new column, table or field beside the old. Code still reads and writes the old one.
2. **Move**: write to both; backfill old rows in small throttled batches; switch reads to the new one; let it run until you trust it.
3. **Remove**: in a later release, once nothing refers to the old shape, drop it.

Each migration ships with a down path, and the down path is run at least once on a copy. Running anything on real data needs the person's yes.
