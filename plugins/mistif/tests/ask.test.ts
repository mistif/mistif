// Tests for ask-first (/mistif:ask): the first-prompt detector for every class, headless, and the env override.
import { describe, expect, mock, test } from 'claude-code/testing'
import type { On } from 'claude-code'
import type { Engine } from 'claude-code/testing'
import { ASK_TEXT, isVagueBuild } from '../hooks/ask'

const base = { sections: [{ id: 'intro', text: 'x', scope: 'shared' as const }] }

function engine(on: On, env: Record<string, string> = {}) {
  const store = new Map<string, unknown>()
  on('store.get', (_$, e) => ({ value: store.get(e.key) }) as never)
  on('store.set', (_$, e) => { store.set(e.key, e.value); return { value: undefined } as never })
  mock.clock(on)
  mock.env(on, { HOME: '/home/user', ...env })
  on('session.usage', () => ({ value: { cost: { usd: 1 }, context: { percent: 10 }, rateLimits: [] } }) as never)
  on('fs.read', () => ({ value: '' }) as never)
  on('fs.write', () => ({ value: undefined }) as never)
  on('session.start', (_$, e) => ({ cwd: e.cwd }) as never)
  on('prompt.compose', () => base)
  on('turn.complete', (_$, e) => ({ text: e.answer }))
  on('prompt.submit', (_$, e) => ({ text: e.text, context: e.context }))
  on('model.complete', () => ({ value: '{}' }) as never)
  on('ui.status', () => ({ value: undefined }))
  on('session.messages', () => ({ value: [] }) as never)
  on('session.model', () => ({ value: 'claude-haiku-5-5' }))
  on('command.list', () => ({ value: [{ name: 'model' }, { name: 'effort' }] as never }))
  return store
}
const start = ($: Engine, isInteractive = true) => $.session.start({ cwd: '.', surface: isInteractive ? 'terminal' : null, isInteractive } as never)
const ask = ($: Engine, args: string) => $.command.run({ command: 'ask', args })
const say = async ($: Engine, text: string) => ((await $.prompt.submit({ text, wait: false, origin: { kind: 'composer' } } as never)) as { context?: string[] }).context ?? []

describe('detector', () => {
  test('vague build requests fire', () => {
    for (const t of ['build me a habit tracker', 'I want a small site for my bakery', 'make a bot that tells me about deals', 'Can you create a recipe app for me?', 'Set up a blog.'])
      expect(isVagueBuild(t), t).toBe(true)
  })
  test('a full spec naming files, paths, code or identifiers does not', () => {
    for (const t of ['write a script `sync.py` that copies src/a to dist/a', 'create utils/date.ts exporting formatDate(d)', 'add a get_user_by_id function in db.py', 'build a CLI: ```python\nimport sys\n```'])
      expect(isVagueBuild(t), t).toBe(false)
  })
  test('a long request does not', () => {
    expect(isVagueBuild(`build me an app ${'with many words '.repeat(25)}`)).toBe(false)
  })
  test('questions, explanations, fixes and reviews do not', () => {
    for (const t of ['how does a hash map work?', 'explain what a closure is', 'fix the login bug', 'review my pull request', 'what is the best way to build a website?', 'refactor this to be shorter'])
      expect(isVagueBuild(t), t).toBe(false)
  })
})

describe('ask-first in a session', () => {
  test('auto fires on a vague first prompt for a person: one short block of context', async ($, on) => {
    engine(on)
    await start($)
    expect(await say($, 'build me a habit tracker')).toEqual([ASK_TEXT])
    expect(ASK_TEXT.split(/\s+/).length).toBeLessThan(60)
    expect((await ask($, '')).text).toContain('auto')
  })
  test('only the first prompt is checked, and a clear one adds nothing', async ($, on) => {
    engine(on)
    await start($)
    expect(await say($, 'what does this repo do?')).toEqual([])
    expect(await say($, 'build me a habit tracker')).toEqual([])
    await start($)
    expect(await say($, 'write `sync.py` that copies a to b')).toEqual([])
  })
  test('auto stays off headless; on does not; off takes it away; the level is kept', async ($, on) => {
    const store = engine(on)
    await start($, false)
    expect(await say($, 'build me a habit tracker')).toEqual([])
    await ask($, 'on')
    expect(store.get('askLevel')).toBe('on')
    await start($, false)
    expect(await say($, 'build me a habit tracker')).toEqual([ASK_TEXT])
    await ask($, 'off')
    await start($)
    expect(await say($, 'build me a habit tracker')).toEqual([])
    expect((await ask($, 'turbo')).text).toContain('Unknown level')
    expect((await ask($, '')).text).toContain('off')
  })
  test('MISTIF_ASK=on works headless', async ($, on) => {
    engine(on, { MISTIF_ASK: 'on' })
    await start($, false)
    expect(await say($, 'build me a habit tracker')).toEqual([ASK_TEXT])
  })
  test('MISTIF_ASK=off wins over a stored on', async ($, on) => {
    const store = engine(on, { MISTIF_ASK: 'off' })
    store.set('askLevel', 'on')
    await start($)
    expect(await say($, 'build me a habit tracker')).toEqual([])
  })
})
