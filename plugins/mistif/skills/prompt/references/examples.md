# Before and after

For calibration only; do not copy the wording.

## Chat model
Before: `Write me something about our new feature.`
After:
```
Write a 120-word announcement for existing customers of our invoicing app about the new "recurring invoices" feature. Plain tone, no exclamation marks. Say what it does, who it helps (freelancers who bill the same client monthly) and where to find it (Settings > Billing). End with one sentence inviting replies to support@ourdomain.example.
```
Why: it names the task, length, audience, tone and the facts the model could not know.

## Coding agent
Before: `Fix the login bug.`
After:
```
In src/auth/login.ts, users with a "+" in their email cannot log in. Reproduce it with the failing case in tests/auth/login.test.ts ("plus addressing"), fix the cause in normalizeEmail(), and run `npm test -- auth`. Touch only src/auth and its tests. Stop and ask before changing the database schema or adding a dependency. Report the failing output before the fix and the passing output after.
```
Why: path anchors, a verify command, scope limits, stop points, evidence in the report.

## Image
Before: `A cool futuristic city.`
After:
```
Wide aerial view of a dense coastal city at dusk, towers of pale concrete and green terraces, a monorail curving along the shoreline, warm window lights against a deep blue sky, soft haze, shot like a 35mm film photograph.
```
Why: subject, setting, light, medium, with things that can be seen.
