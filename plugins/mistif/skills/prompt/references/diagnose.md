# Diagnosing a failing prompt

Match the symptom, apply the repair, and name the defect in your note.

| Symptom | Likely defect | Repair |
|---|---|---|
| vague or generic output | the task is not concrete | state one operation, the audience and the result shape |
| it never seems done, or stops early | no definition of success | add a pass/fail test for "done" and a length |
| wrong format | format described loosely | state the format once, show one example |
| made-up facts or sources | nothing allows "unsure" | allow "unsure", forbid invented sources, supply the facts |
| an agent does too much | scope not bounded | list what may be touched and what may not; add stop points |
| it forgets earlier decisions | context left out | put the key facts near the top of the prompt |
| it contradicts itself | two instructions conflict | find the pair, decide which wins, delete the other |
| ignores a rule | the rule is buried | move it to the first third; say it once, positively |
| output is too long | no length given | give a number |
| inconsistent runs | too open | add an example and tighter constraints |

Read the bad output as well as the prompt: the output shows which instruction the model actually followed.
