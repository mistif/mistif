// Tests for what mistif changed in its copy of Effortless (the rest is covered by effort.test.ts, which is
// Effortless's own suite adapted to the new names). These run with the plugin's real defaults: no options are passed
// unless a test says so.
import { describe, expect, mock, test } from 'claude-code/testing'
import type { On } from 'claude-code'
import type { Engine } from 'claude-code/testing'
import { LITE_LINE, isFollowUp, keepsEffort, readConfig } from '../hooks/effort'

const USAGE = { input_tokens: 1, output_tokens: 1, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 }

/** What sits beneath the plugin in a session, as the original suite builds it. */
function engine(on: On, env: Record<string, string> = {}) {
  mock.store(on)
  mock.clock(on)
  mock.env(on, { EFFORTLESS_MODEL_UI: '1', ...env })
  on('session.start', (_$, e) => ({ cwd: e.cwd }) as never)
  on('prompt.submit', (_$, e) => ({ text: e.text }))
  on('ui.status', () => ({ value: undefined }))
  on('session.messages', () => ({ value: [] }) as never)
  on('session.model', () => ({ value: 'claude-opus-5-5' }))
  on('command.list', () => ({ value: [{ name: 'model' }, { name: 'effort' }] as never }))
  on('command.register', () => ({ value: undefined }) as never)
}

describe('defaults', () => {
  // The progress code that asked for task lists is deleted; this fails if anything ever adds a line to the prompt again
  test('nothing asks Claude for task lists by default', async ($, on) => {
    engine(on)
    on('prompt.context', () => ({ blocks: [] }) as never)
    await $.session.start({ cwd: '.', surface: 'desktop', isInteractive: true } as never)
    const out = (await ($ as never as { prompt: { context: (e: unknown) => Promise<{ blocks: { text: string }[] }> } }).prompt.context({ blocks: [] })) ?? { blocks: [] }
    expect(out.blocks).toEqual([])
  })

  test('the plugin writes no log file of its own, however much is drawn', async ($, on) => {
    engine(on)
    on('model.complete', () => ({ value: { isAnswered: true as const, text: '{"model":"sonnet","effort":"medium","why":"x"}', usage: USAGE } }))
    const wrote: string[] = []
    on('fs.write', (_$, e) => {
      wrote.push(String(e.path))
      return { value: undefined } as never
    })
    await $.session.start({ cwd: '.', surface: 'desktop', isInteractive: true } as never)
    for (const text of ['rename foo to bar in utils.ts', 'now explain why the tests fail']) {
      await $.prompt.submit({ text, origin: { kind: 'composer' } } as never)
      await $.ui.mount({ plugin: 'mistif', surface: 'terminal', component: 'AbovePrompt', props: { hasSurvey: false, isWorking: false, maxRows: 10, bodyColumns: 100, scroll: { offset: 0, bodyRows: 10 }, view: {} } } as never).catch(() => undefined)
    }
    expect(wrote.filter(p => /\.log$/.test(p))).toEqual([])
  })

  const FOOTER = { plugin: 'mistif', surface: 'desktop', component: 'SessionMode', props: { modes: [] } } as never
  const BAND = { plugin: 'mistif', surface: 'desktop', component: 'AbovePrompt', props: { hasSurvey: false, isWorking: false, maxRows: 10, bodyColumns: 100, scroll: { offset: 0, bodyRows: 10 }, view: {} } } as never

  test('the footer row and the band are drawn by the hud module of this same plugin', async ($, on) => {
    engine(on)
    await $.session.start({ cwd: '.', surface: 'desktop', isInteractive: true } as never)
    // With the three mods in one plugin the slots are filled in the plugin itself; before the merge nothing answered them.
    await expect($.ui.mount(FOOTER)).resolves.toBeDefined()
    await expect($.ui.mount(BAND)).resolves.toBeDefined()
  })

  test('the defaults: the chat compacts itself, effort never drops below medium, the handoff asks first', () => {
    expect(readConfig(undefined)).toEqual({ handoffSkill: '', handoffAfter: 'continue', bias: 0, floor: 'medium', ceiling: 'max', hide: ['reason'], usage: 'full', contextCheck: true })
    expect(readConfig({ hide: '' }).hide).toEqual([])
    expect(readConfig({ hide: 'timer, hot, line' }).hide).toEqual(['timer', 'line'])
  })

  test('usage is full unless it says lite exactly', () => {
    expect(readConfig({ usage: 'lite' }).usage).toBe('lite')
    for (const u of [undefined, '', 'Lite', 'low', 'full']) expect(readConfig({ usage: u }).usage).toBe('full')
  })

  test('the context check is on unless it says off exactly', () => {
    expect(readConfig({ contextCheck: 'off' }).contextCheck).toBe(false)
    for (const v of [undefined, '', 'on', 'Off', 'no']) expect(readConfig({ contextCheck: v }).contextCheck).toBe(true)
  })

  test('settings of features that are gone change nothing', () => {
    expect(readConfig({ compactWith: 'haiku', modelAuto: 'on', helpers: 'on', judge: 'other', apiKey: 'k', layout: 'default', footer: 'own', theme: 'rose' })).toEqual(readConfig(undefined))
  })
})

describe('your own bench cases', () => {
  test('/mistif:hud bench mine reads ~/.claude/mistif-bench-mine.json, never a file inside the repo', async ($, on) => {
    engine(on, { HOME: '/home/user' })
    const read: string[] = []
    on('fs.read', (_$, e) => {
      read.push(String(e.path))
      return { value: JSON.stringify({ cases: [{ id: 'a', kind: 'k', current: { model: 'sonnet', effort: 'medium' }, message: 'rename a var', ok: ['low', 'medium'] }] }) } as never
    })
    on('fs.write', () => ({ value: undefined }) as never)
    on('model.complete', () => ({ value: { isAnswered: true as const, text: '{"model":"sonnet","effort":"low","why":"x"}', usage: USAGE } }))
    await $.session.start({ cwd: '.', surface: 'desktop', isInteractive: true } as never)
    const res = await $.command.run({ command: 'hud', args: 'bench mine' })
    expect(read.some(p => p.replaceAll('\\', '/').endsWith('/home/user/.claude/mistif-bench-mine.json'))).toBe(true)
    expect(res.text).toContain('| haiku | 100% |')
  })

  test('the plain /mistif:hud bench still reads the cases that ship with the plugin', async ($, on) => {
    engine(on)
    const read: string[] = []
    on('fs.read', (_$, e) => {
      read.push(String(e.path).replace(/\\/g, '/'))
      return { value: JSON.stringify({ cases: [{ id: 'a', kind: 'k', current: { model: 'sonnet', effort: 'medium' }, message: 'rename a var', ok: ['low'] }] }) } as never
    })
    on('fs.write', () => ({ value: undefined }) as never)
    on('model.complete', () => ({ value: { isAnswered: true as const, text: '{"model":"sonnet","effort":"low","why":"x"}', usage: USAGE } }))
    await $.session.start({ cwd: '.', surface: 'desktop', isInteractive: true } as never)
    await $.command.run({ command: 'hud', args: 'bench' })
    expect(read.some(p => p.endsWith('/bench/judge-cases.json'))).toBe(true)
    expect(read.some(p => p.includes('mistif-bench-mine'))).toBe(false)
  })
})

describe('short messages, in the way you write them', () => {
  const after = (reply: string) => `user: something\nassistant: ${reply}`
  test('a bare acknowledgement between two steps keeps the effort, with no judge', () => {
    for (const t of ['yes', 'ok', 'okay', 'go', 'do it', 'continue', 'thanks', 'yep', 'sure']) expect(keepsEffort(t, after('Done with step 1.'))).toBe(true)
  })
  test('a short answer to a question goes to the judge: the answer can start a big job', () => {
    for (const t of ['yes', 'ok', 'do it', 'A']) expect(keepsEffort(t, after('Should I start stage 1?'))).toBe(false)
  })
  test('anything that says what to do is a request, however short', () => {
    for (const t of ['yes lets start with stage 1', 'also fix the footer', 'rename it to mistif', 'move to stage 2', 'what is 59m', 'okay so lets test it'])
      expect(isFollowUp(t)).toBe(false)
  })
})

describe('context check', () => {
  // At 50% of the context, a chat message makes the handoff check ask a small model; contextCheck off makes no such call.
  async function asked($: Engine, on: On) {
    engine(on)
    on('session.usage', () => ({ value: { context: { tokens: 500_000, window: 1_000_000, percent: 50 }, cost: { usd: 0 }, rateLimits: [] } }) as never)
    const systems: string[] = []
    on('model.complete', (_$, e) => {
      systems.push(String(e.system))
      return { value: { isAnswered: true as const, text: '{"handoff":null}', usage: USAGE } }
    })
    await $.session.start({ cwd: '.', surface: 'desktop', isInteractive: true } as never)
    for (const text of ['now plan the whole architecture', 'and write the migration for it']) {
      await $.prompt.submit({ text, wait: false, origin: { kind: 'composer' } })
    }
    return systems.filter(s => s.includes('hand off now'))
  }

  test('on by default: past 30% the check asks a model', async ($, on) => {
    expect((await asked($, on)).length).toBeGreaterThan(0)
  })

  test('off: no message text is sent for the check', { options: { contextCheck: 'off' } }, async ($, on) => {
    expect(await asked($, on)).toEqual([])
  })
})

describe('Lite usage', () => {
  const base = { sections: [{ id: 'intro', text: 'x', scope: 'shared' as const }] }
  const input = { model: 'claude-opus-5-5', promptModel: 'claude-opus-5-5', surfaces: [], tools: [], outputStyle: null, traits: [] } as never
  const sectionsOf = async ($: Engine) => (await $.prompt.compose(input)).sections

  test('Full (the default) adds nothing to the system prompt', async ($, on) => {
    engine(on, { MISTIF_NUDGE: 'off' })
    on('prompt.compose', () => base)
    await $.session.start({ cwd: '.', surface: 'desktop', isInteractive: true } as never)
    expect((await sectionsOf($)).map(s => s.id)).toEqual(['intro'])
  })

  test('Lite adds one short session section at the end, and only that', { options: { usage: 'lite' } }, async ($, on) => {
    engine(on, { MISTIF_NUDGE: 'off' })
    on('prompt.compose', () => base)
    await $.session.start({ cwd: '.', surface: 'desktop', isInteractive: true } as never)
    const sections = await sectionsOf($)
    expect(sections.map(s => s.id)).toEqual(['intro', 'mistif:usage'])
    expect(sections[1]).toMatchObject({ text: LITE_LINE, scope: 'session' })
    expect(LITE_LINE).toContain('Lite usage')
    expect(LITE_LINE.length).toBeLessThan(200)
  })
})
