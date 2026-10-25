// Tests for lean mode (/mistif:lean) and the band's own numbers.
import { describe, expect, mock, test } from 'claude-code/testing'
import type { On } from 'claude-code'
import type { Engine } from 'claude-code/testing'
import { LEAN_LEVELS, leanText } from '../hooks/lean'

const input = { model: 'claude-opus-5-5', promptModel: 'claude-opus-5-5', surfaces: [], tools: [], outputStyle: null, traits: [] } as never
const base = { sections: [{ id: 'intro', text: 'x', scope: 'shared' as const }] }
const USAGE = { cost: { usd: 1 }, context: { percent: 10 }, rateLimits: [] }

function engine(on: On, reads: string[] = []) {
  const store = new Map<string, unknown>()
  on('store.get', (_$, e) => ({ value: store.get(e.key) }) as never)
  on('store.set', (_$, e) => {
    store.set(e.key, e.value)
    return { value: undefined } as never
  })
  mock.clock(on)
  mock.env(on, { HOME: '/home/user', MISTIF_NUDGE: 'off' })
  on('session.usage', () => ({ value: USAGE }) as never)
  on('fs.read', (_$, e) => { reads.push(String(e.path)); return { value: '' } as never })
  on('fs.write', () => ({ value: undefined }) as never)
  on('session.start', (_$, e) => ({ cwd: e.cwd }) as never)
  on('prompt.compose', () => base)
  on('turn.complete', (_$, e) => ({ text: e.answer }))
  return store
}
const start = ($: Engine) => $.session.start({ cwd: '.', surface: 'desktop', isInteractive: true } as never)
const ids = async ($: Engine) => (await $.prompt.compose(input)).sections.map(s => s.id)
const lean = ($: Engine, args: string) => $.command.run({ command: 'lean', args })

describe('lean mode', () => {
  test('off by default: nothing is added to the system prompt', async ($, on) => {
    engine(on)
    await start($)
    expect(await ids($)).toEqual(['intro'])
    expect((await lean($, '')).text).toContain('off')
  })

  test('each level adds one session section, and off takes it away', async ($, on) => {
    engine(on)
    await start($)
    for (const level of ['lite', 'full', 'ultra'] as const) {
      await lean($, level)
      const sections = (await $.prompt.compose(input)).sections
      expect(sections.map(s => s.id)).toEqual(['intro', 'mistif:lean'])
      expect(sections[1]).toMatchObject({ text: leanText(level), scope: 'session' })
    }
    await lean($, 'off')
    expect(await ids($)).toEqual(['intro'])
  })

  test('the levels differ: lite offers, full applies, ultra questions the request', () => {
    expect(leanText('off')).toBe('')
    expect(leanText('lite')).toContain('name it in one line')
    expect(leanText('ultra')).toContain('question the request')
    expect(new Set(LEAN_LEVELS.map(leanText)).size).toBe(4)
    expect(leanText('full').length).toBeLessThan(1700)
  })

  test('an unknown level changes nothing and says so', async ($, on) => {
    engine(on)
    await start($)
    await lean($, 'full')
    expect((await lean($, 'turbo')).text).toContain('Unknown level')
    expect(await ids($)).toContain('mistif:lean')
  })

  test('the level is kept for the next session', async ($, on) => {
    const store = engine(on)
    await start($)
    await lean($, 'ultra')
    expect(store.get('leanLevel')).toBe('ultra')
    await start($)
    expect(await ids($)).toContain('mistif:lean')
  })

  test('a stored value that is not a level reads as off', async ($, on) => {
    const store = engine(on)
    store.set('leanLevel', 'bogus')
    await start($)
    expect(await ids($)).toEqual(['intro'])
  })
})

describe('the band: its own level buttons and numbers', () => {
  const BAND = { hasSurvey: false, isWorking: false, maxRows: 12, bodyColumns: 100, scroll: { offset: 0, bodyRows: 12 }, view: {} }
  const mount = ($: Engine) => $.ui.mount({ plugin: 'mistif', surface: 'desktop', component: 'AbovePrompt', props: BAND } as never)

  test('the level buttons run /lean', async ($, on) => {
    engine(on)
    const ran: string[] = []
    on('command.run', (_$, e) => { ran.push(`${e.command} ${e.args}`); return { text: '' } as never })
    await start($)
    const ui = await mount($)
    await ui.press({ key: 'level-ultra' })
    expect(ran).toEqual(['mistif:lean ultra'])
  })

  test('Review and Audit go to mistif:review, never to another plugin', async ($, on) => {
    engine(on)
    const ran: string[] = []
    on('command.run', (_$, e) => { ran.push(e.command); return { text: '' } as never })
    await start($)
    const ui = await mount($)
    await ui.press({ key: 'review' })
    await ui.press({ key: 'audit' })
    expect(ran).toEqual(['mistif:review', 'mistif:review'])
  })

  test('tokens are counted from finished turns, subagents included', async ($, on) => {
    engine(on)
    await start($)
    const u = (n: number) => ({ input_tokens: n, output_tokens: n, cache_read_input_tokens: n, cache_creation_input_tokens: n })
    await $.turn.complete({ answer: 'a', usage: u(1000), durationMs: 5000 } as never)
    await $.turn.complete({ answer: 'a', usage: u(500), durationMs: 1000, agentId: 'a1' } as never)
    const text = JSON.stringify(await (await mount($)).drawn())
    expect(text).toContain('6.0k')
    expect(text).toContain('1 turn')
  })

  test('nothing is read from another plugin: no ponytail files', async ($, on) => {
    const read: string[] = []
    engine(on, read)
    await start($)
    await mount($)
    expect(read.filter(p => p.includes('ponytail'))).toEqual([])
  })
})
