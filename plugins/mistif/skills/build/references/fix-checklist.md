# Fix checklist

## Reproduce
- Intermittent: change one thing at a time (timing, load, order, environment, stored state). Add temporary logging at the boundaries and remove it afterwards.
- Record the exact command, input and output so anyone can repeat it.

## Which layer
Work from the outside in and stop at the first layer that is wrong:
1. Input: is the data what you think it is?
2. Configuration and environment: versions, variables, paths.
3. Your code: the function that first produces a wrong value.
4. Dependencies: only after the above are ruled out.

For a regression, bisect: pick a known good commit, a known bad one, and halve the range until one commit is left (`git bisect` with a test as the judge).

## By type of failure
- **Test fails**: read the assertion, then ask whether the test or the code is wrong. Run it alone before the suite.
- **Build fails**: read the first error, not the last; later ones are often fallout.
- **Runtime error**: find the first place a value went wrong, not where it was noticed.

## Logging rules
Log the state that decides the branch, not a running commentary. Never log secrets or personal data. Remove temporary logs before committing.

## Before you call it fixed
The reproduction now passes, a new test would fail if the fix were reverted, the full suite is green, and you tried the real flow once by hand.
