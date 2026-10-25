// Tests for the skill nudge (/mistif:nudge) and its MISTIF_NUDGE override.
import { describe, expect, mock, test } from 'claude-code/testing'
import type { On } from 'claude-code'
import type { Engine } from 'claude-code/testing'
import { NUDGE_TEXT } from '../hooks/nudge'

const input = { model: 'claude-opus-5-5', promptModel: 'claude-opus-5-5', surfaces: [], tools: [], outputStyle: null, traits: [] } as never
const base = { sections: [{ id: 'intro', text: 'x', scope: 'shared' as const }] }

function engine(on: On, env: Record<string, string> = {}) {
  const store = new Map<string, unknown>()
  on('store.get', (_$, e) => ({ value: store.get(e.key) }) as never)
  on('store.set', (_$, e) => {
    store.set(e.key, e.value)
    return { value: undefined } as never
  })
  mock.clock(on)
  mock.env(on, { HOME: '/home/user', ...env })
  on('session.usage', () => ({ value: { cost: { usd: 1 }, context: { percent: 10 }, rateLimits: [] } }) as never)
  on('fs.read', () => ({ value: '' }) as never)
  on('fs.write', () => ({ value: undefined }) as never)
  on('session.start', (_$, e) => ({ cwd: e.cwd }) as never)
  on('prompt.compose', () => base)
  on('turn.complete', (_$, e) => ({ text: e.answer }))
  return store
}
const start = ($: Engine) => $.session.start({ cwd: '.', surface: 'desktop', isInteractive: true } as never)
const ids = async ($: Engine) => (await $.prompt.compose(input)).sections.map(s => s.id)
const nudge = ($: Engine, args: string) => $.command.run({ command: 'nudge', args })

describe('nudge', () => {
  test('off by default: no section is added', async ($, on) => {
    engine(on)
    await start($)
    expect(await ids($)).toEqual(['intro'])
  })

  test('on adds one short session section, and the level is kept for the next session', async ($, on) => {
    const store = engine(on)
    await start($)
    await nudge($, 'on')
    expect(store.get('nudgeLevel')).toBe('on')
    await start($)
    const sections = (await $.prompt.compose(input)).sections
    expect(sections.map(s => s.id)).toEqual(['intro', 'mistif:nudge'])
    expect(sections[1]).toMatchObject({ text: NUDGE_TEXT, scope: 'session' })
    expect(NUDGE_TEXT.split(/\s+/).length).toBeLessThanOrEqual(40)
  })

  test('off takes the section away, and the level is kept for the next session', async ($, on) => {
    const store = engine(on)
    await start($)
    await nudge($, 'on')
    expect(await ids($)).toContain('mistif:nudge')
    expect((await nudge($, 'off')).text).toContain('off')
    expect(await ids($)).toEqual(['intro'])
    expect(store.get('nudgeLevel')).toBe('off')
    await start($)
    expect(await ids($)).toEqual(['intro'])
  })

  test('MISTIF_NUDGE=on turns it on with nothing stored', async ($, on) => {
    engine(on, { MISTIF_NUDGE: 'on' })
    await start($)
    expect(await ids($)).toContain('mistif:nudge')
  })

  test('MISTIF_NUDGE wins over the stored level', async ($, on) => {
    const store = engine(on, { MISTIF_NUDGE: 'off' })
    store.set('nudgeLevel', 'on')
    await start($)
    expect(await ids($)).toEqual(['intro'])
  })

  test('an unknown level, in the command or the variable or the store, changes nothing', async ($, on) => {
    const store = engine(on, { MISTIF_NUDGE: 'loud' })
    store.set('nudgeLevel', 'bogus')
    await start($)
    expect(await ids($)).toEqual(['intro'])
    expect((await nudge($, 'loud')).text).toContain('Unknown level')
    expect(await ids($)).toEqual(['intro'])
    expect((await nudge($, '')).text).toContain('off')
  })
})
