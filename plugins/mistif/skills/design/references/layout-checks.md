# Layout checks

## Width sweep
1. Open the page at 1440 px and drag the width down slowly.
2. Note each width where something collides, wraps badly, overflows or gets tiny. Those are the breakpoints.
3. Check the middle band, roughly 600 to 1000 px, on purpose. It is where tablet and small laptops live and where most layouts break.
4. Take a screenshot at a narrow (about 375), a middle (about 768) and a wide width.

## Reflow rules
- Columns collapse to one in a chosen order; the main content comes first.
- Images keep their ratio and never force the page wider.
- Tables scroll inside their own box, or become stacked rows.
- Long words and URLs wrap or truncate with a reason.

## Navigation
- A short top bar with a labelled menu button, or a bottom bar of up to five destinations.
- A fixed bar leaves room for itself in the content and clears the phone's safe areas.

## Touch
Targets at least about 44 px with space between them. Anything that works on hover also works on tap.
