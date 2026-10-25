# Claude Code mods and hooks

Run: `CLAUDE_CODE_ENABLE_FUNCTION_HOOKS=1 claude plugin test .` from the mod folder. It runs every `*.test.ts` and `*.test.tsx` under it, one child process per file, and exits 1 on failure. It ran without the switch here, but set it anyway; check the mod's own tests README before concluding tests cannot run. Copy the mod's existing test style.

## Smallest working mod (checked: 2 tests pass in about 1 second)

```
demo/
  .claude-plugin/plugin.json   { "name": "demo", "version": "0.0.1", "hooks": ["./hooks/hooks.json"] }
  hooks/hooks.json             { "hooks": {}, "modules": ["./register.ts"] }
  hooks/register.ts
  tests/x.test.ts
```

```ts
// hooks/register.ts
import type { Register } from 'claude-code'
export const greet = (n: string) => (n.trim() ? `Hello, ${n.trim()}` : 'Hello, stranger')
export const register: Register = on => {
  on('command.run', async (_ctx, e) => {
    if (e.command !== 'demo') return
    return { text: greet(String(e.args ?? '')) }
  })
}
```

```ts
// tests/x.test.ts
import { expect, mock, test } from 'claude-code/testing'
import { greet } from '../hooks/register'

test('pure logic is tested as a plain function', () => {
  expect(greet('   ')).toBe('Hello, stranger')
})

test('the command answers', async ($, on) => {
  mock.store(on)
  on('session.start', (_c, e: { cwd: string }) => ({ cwd: e.cwd })) // required: mock.store does not answer it
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  const ran = await $.command.run({ command: 'demo', args: 'Ada', origin: { kind: 'plugin', name: 'test' } })
  expect((ran as { text?: string }).text).toBe('Hello, Ada')
})
```

A test body gets the engine `$` and the stub function `on`. Types: `Register`, `On` from `claude-code`; `Engine` from `claude-code/testing`. A missing stub fails loudly (`no implementation for <event>`); add `on('<event>', ...)`.

## Stubbing events

`on(event, handler)` answers one event the mod calls out to. Return `{ value }` for a result or `{ deny: 'ENOENT' }` for a refusal (a missing file is a deny).

| Event | Typical stub |
|---|---|
| `session.start` | `(_c, e) => ({ cwd: e.cwd })` |
| `command.register` | `() => ({ value: { command: 'demo' } })` |
| `ui.open` | `() => ({ value: { isPlaced: true } })` |
| `env.get` | `(_c, e) => ({ value: e.name === 'USERPROFILE' ? 'D:\\profile' : undefined })` |
| `clock.now` | `() => ({ value: 10 * 3600_000 })` |
| `fs.list` / `fs.read` / `fs.write` | from the fake disk below |
| `process.run` | `({ value: { exitCode, stdout, stderr: '' } })` |

Helpers: `mock.store(on)`, `mock.clock(on)`, `mock.env(on, { NAME: 'v' })` replace repeated stubs.

## Driving it

- `$.session.start({ cwd, surface, isInteractive })`
- `$.command.run({ command, args, origin })`
- `$.ui.mount({ plugin, component, requestId, props, surface })` returns a handle: `ui.find({ type: 'Text', text: /re/ })` (undefined when absent), `ui.press({ key })`, `ui.unmount()`. Mount syntax comes from working mods' pane tests; confirm against the mod's own.

## Fake disk (outline)

An in-memory `Map` of path to text, normalised with `p.replace(/\\/g, '/')` so either separator works; every `list`, `read`, `write` and `run` pushes a line to `calls`; `run` returns `{ exitCode, stdout }` looked up by working directory (unknown directory: exit 128). Return `d.calls` and `d.disk` so a test asserts both what the user sees and which calls were made. Reset with `d.calls.length = 0` between phases.

## Cases worth writing

- Unknown state reads as the safe default (never as Off or Allowed).
- Nothing shows, and no read or process call happens, before the user allows it: `find` is undefined and `calls` has no read of that path.
- An unreadable settings file is not overwritten.
- A write re-reads first, so a concurrent edit survives.
- Backups stay bounded.
- Each control does exactly what its label says; drawn order; thresholds as one row per case.
- Model replies stubbed; test empty, garbage and malformed replies and expect the safe default, never acceptance.
- Pure logic in hook files imported directly; mounted tests only for buttons, state changes, saved output.

## What the harness cannot do

The harness supplies only the mod under test. Another mod's state is not available, so test that part as plain data. Test data is made up (home `Sample`, project `Alpha`); no real paths, names or secrets. Keep a short tests README: one line per file.

Break-it proof: flip the condition in `register.ts`; the command test goes red (checked); restore.
