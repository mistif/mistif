// Tests for ask-first (/mistif:ask): the first-prompt detector for every class, headless, and the env override.
import { describe, expect, mock, test } from 'claude-code/testing'
import type { On } from 'claude-code'
import type { Engine } from 'claude-code/testing'
import { ASK_TEXT, ROUTE_TEXT, isVagueBuild, routeFor } from '../hooks/ask'

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

describe('route', () => {
  test('clear jobs route to one skill', () => {
    const cases: [string, string][] = [
      ['Review the latest commit (`git show HEAD`); list the real problems.', 'review'],
      ['can you do a security review of this PR', 'review'],
      ['Should we go ahead with the plan in docs/PLAN.md? Give a verdict.', 'decide'],
      ['is this a good idea: moving billing to a new vendor', 'decide'],
      ['Restyle the checkout page in index.html so it works on phones', 'design'],
      ['our dashboard is unusable on mobile, make it accessible', 'design'],
    ]
    for (const [t, want] of cases) expect(routeFor(t), t).toBe(want)
  })
  test('other work does not route', () => {
    for (const t of [
      'Add `Inventory.available(sku)` to store/inventory.py', 'fix the failing test in tests/test_pricing.py', 'write tests for durations.py',
      'We want to release version 2.1.0 today. Do a go/no-go release check.', 'implement cron.py as described in docs/CRON.md',
      'fix the login form validation bug in auth.py', 'what does this function do?', 'explain the cache layer',
    ]) expect(routeFor(t), t).toBe(null)
  })
  test('the informal ways people ask', () => {
    const cases: [string, string][] = [
      ['the shop ui looks very cheap, clean it up', 'design'],
      ['fix the spacing in the header, there is a big gap on the right', 'design'],
      ['no offense it looks bad, make it more polished', 'design'],
      ['should we use postgres or sqlite for this?', 'decide'],
      ['is it even worth doing recurring orders', 'decide'],
      ['if i commit right now will anything be wrong, can u check', 'review'],
      ['look at my checkout file and tell me any bugs', 'review'],
    ]
    for (const [t, want] of cases) expect(routeFor(t), t).toBe(want)
  })
  test('casual questions, checks, picked tools and links do not route', () => {
    for (const t of [
      'should i restart claude code?', 'okay great so should we push to netlify', 'should we write it into the config file?',
      'make sure the site runs well after the deploy', 'check if it worked', 'looks good, ship it', 'it looks great',
      'can u do a /code-review of the diff', 'use /mistif:design on the landing page', 'install frontend-design for me',
      'https://example.com/page/design/ui/make-it-look-clean',
    ]) expect(routeFor(t), t).toBe(null)
  })
  test('a clear review first prompt gets one route line, headless with MISTIF_ASK=on', async ($, on) => {
    engine(on, { MISTIF_ASK: 'on' })
    await start($, false)
    expect(await say($, 'Review the latest commit in this repository (`git show HEAD`) and list the real problems.')).toEqual([ROUTE_TEXT.review])
  })
  test('a vague build gets the ask rule, not a route', async ($, on) => {
    engine(on, { MISTIF_ASK: 'on' })
    await start($, false)
    expect(await say($, 'build me a landing page for my bakery')).toEqual([ASK_TEXT])
  })
  test('only the first prompt routes; later ones add nothing', async ($, on) => {
    engine(on)
    await start($)
    expect(await say($, 'what does this repo do?')).toEqual([])
    expect(await say($, 'the settings page looks cluttered, clean it up')).toEqual([])
    await start($)
    expect(await say($, 'fix the spacing in the header')).toEqual([ROUTE_TEXT.design])
  })
  test('routing is off with ask-first off', async ($, on) => {
    engine(on, { MISTIF_ASK: 'off' })
    await start($)
    expect(await say($, 'the settings page looks cluttered, clean it up')).toEqual([])
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
