# UI and browser

## Pick the level

| Question | Level |
|---|---|
| Does this component show X for state Y, react to a click or key? | Component test |
| Does a form validate, a list filter, a modal close? | Component test |
| Does navigation, redirect, layout, scrolling or a multi-page flow work? | Real browser |
| Only the few flows the product cannot lose (sign-up, checkout) | Real browser, kept few |

Component tests first. They are faster and fail with a clearer message.

## Component tests

Find elements the way a user does: by role and accessible name or label, never by class, id or position.

```tsx
render(<Signup />)
await user.type(screen.getByLabelText('Email'), 'not-an-email')
await user.click(screen.getByRole('button', { name: 'Create account' }))
expect(screen.getByRole('alert')).toHaveTextContent(/valid email/i)
expect(onSubmit).not.toHaveBeenCalled()
```

- Assert what the user sees or what was sent, not component state.
- Test the states: empty, loading, error, long text, many items.
- Absence is an assertion: `queryByRole(...)` is null.
- Await async UI with `findBy...` or `waitFor`, not a sleep.
- Controlled and prop-driven parts: re-render with new props (a limit reached, a list shortened) and check the control follows. Also send the events it should ignore (other keys, a click on a disabled control), not only the one it handles.

## Accessibility assertions

Cheap and worth having: every control has an accessible name; form fields have labels; focus lands somewhere sensible after open and close (modal gets focus, returns on close); the main flow works with the keyboard alone; an automated check (`axe`) on the main states shows no serious violations. Say that automated checks catch only part of the problems.

## Real browser

Use the Playwright CLI if the user has it (its `--help` lists the commands), or the Playwright MCP tools, for exploring a page, recording a flow, generating a test, running it and attaching to debug a failing run. Do not restate the commands here. Habits that matter whichever you use:

1. Explore the flow by hand first and note the roles and labels the page offers.
2. Write the test with semantic locators (`getByRole`, `getByLabel`, `getByText`), then add assertions. A recorded flow with no assertions proves nothing.
3. Wait for a condition (an element visible, a response received, a URL reached), never a fixed delay.
4. Run headless and without opening the HTML report, so the run ends by itself; read the failure output and trace.
5. Each test starts from clean state and creates its own data.
6. Signed-in state: reuse a saved storage state made against a test account on a test environment. Keep the file out of version control. Never use a real person's login, never put a password in a test.
7. Run against a local or staging build. Do not click through real payments or send real email.

## Screenshots

A screenshot is evidence in the report, not the assertion, unless the repo already has reviewed visual baselines. Take one only for a visual claim assertions cannot carry (a layout bug reported by eye, a before/after of a regression). Keep it small and name it.

## Phone width

For anything layout-dependent, run once at 390 px wide (set the viewport to 390 x 844). Assert the thing that matters: no horizontal scroll (`document.documentElement.scrollWidth <= clientWidth`), the main action visible and reachable, nothing overlapping. Look at a real 390 px frame, not just a resized desktop window.

## Prove it

Component and browser tests get the same break-it proof as any other: remove the handler, flip the condition, rename the label. If the test stays green, it is not testing the user's view.
