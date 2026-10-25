# Simplify checklist

## Signals and the usual remedy
| You see | Try |
|---|---|
| deep nesting | return early; pull the inner block into a named function |
| a long function doing several jobs | split by job, keeping each part testable |
| the same logic in several places | one shared function, only if the copies truly mean the same thing |
| a flag argument that switches behaviour | two functions |
| vague names (`data`, `temp`, `handle`) | names that say what the thing is |
| dead code, unused imports and parameters | delete, after checking callers |
| comments that restate the code | delete them; keep the ones that say why |
| clever one-liners | the plain version a new reader gets at once |

## Traps
- Inlining a small helper whose name explained an idea.
- Merging two functions that look alike but change for different reasons.
- Making code shorter and harder to read.
- Changing behaviour "while you are there": error messages, ordering, rounding, timing.
- Simplifying code you do not understand or that has no tests.

## Per language
Follow the project's linter and formatter. Use the language's own idioms (comprehensions in Python, optional chaining in TypeScript, `errors.Is` in Go) only where the team already does.

## Done when
Tests pass after every step, each step is its own commit, and the diff reads better than the original to someone who has not seen either.
