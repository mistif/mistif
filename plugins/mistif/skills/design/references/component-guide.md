# Component guide

## Layout of files
```
components/
  OrderList/
    OrderList.tsx        presentation
    useOrders.ts         data loading
    OrderList.test.tsx
```
Follow the project's own structure if it has one.

## State ladder
Use the first that works:
1. local state in the component;
2. lift to the nearest common parent;
3. context for values many levels down;
4. the URL for anything shareable (filters, tabs, page);
5. a cache library for server data;
6. a global store, last.

## Accessibility basics
- Use the native element (`button`, `a`, `label`, `dialog`) before building one from a `div`.
- Every input has a visible label.
- Headings go in order without skipping levels.
- A dialog traps focus, restores it on close, and closes on Escape.
- Icon-only buttons have an accessible name.

## Every data view needs
| State | Shows |
|---|---|
| loading | a placeholder shaped like the content |
| empty | what is missing and what to do |
| error | what failed and a retry |
| success | the data, with realistic sample content in development |
| no permission (if relevant) | why and who to ask |

An optimistic update shows the new value at once and puts the old one back, with a message, if the call fails.

## Before you call it done
Console clean; keyboard-only pass; all states reached; checked at 320, 768, 1024 and 1440 px; both themes; an automated accessibility audit clean.
