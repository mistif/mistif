# Plan file

## Top of the file
- Goal, in a sentence.
- Architecture note: the shape of the solution in a few lines.
- Stack and versions.
- Path to the spec, and any global constraints from it.
- Inputs most likely to be overlooked: empty, huge, malformed, concurrent, unauthorised.
- Ordered task list (a checklist).
- Risks, each with a mitigation.
- Open questions.

## One task
- **Title**: an action ("Add rate limit to login").
- **Why**: one line.
- **Approach**: the decisions made, the edge cases by name, and the tests described as name / input / expected result.
- **Files**: exact paths to create or change.
- **Interfaces**: what it consumes and what it produces.
- **Depends on**: earlier tasks by number.
- **Accepted when**: observable conditions, three at most.
- **Verify**: a command someone can run, and the result to expect.

Include code only where prose cannot pin down a contract (a signature, a schema).

## Not allowed in a detailed task
"TBD", "handle edge cases" without naming them, "same as task N", and any reference to a thing the plan never defines.

## Checks before handing over
Every spec requirement appears in some task. Names (functions, files, fields) are spelled the same everywhere. No task needs something a later task creates.
