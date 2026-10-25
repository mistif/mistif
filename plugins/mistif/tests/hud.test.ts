// Tests for the footer row and the band above the prompt.
// The footer's words and colours are plain data (footerItems), so they are tested without a session: the test harness
// cannot hand a plugin another plugin's state, only the plugin under test. The mounted tests below cover what can be
// seen from here: the buttons, the unknown-state default and the band.
import { describe, expect, mock, test } from 'claude-code/testing'
import type { On } from 'claude-code'
import type { Engine } from 'claude-code/testing'
import { footerItems } from '../hooks/hud'
import type { FooterItem, FooterState } from '../hooks/hud'

const VIOLET = '#a79cf7'
const EMBER = '#f08a3c'
const ICE = '#7cc4ff'
const YELLOW = '#e0a33a'
const RED = '#e5534b'

const base: FooterState = { auto: true, pick: null, app: null, cache: null, model: 'sonnet', paused: false, judging: false, switched: null, advice: null, saving: null, compacting: false, modes: [] }
const items = (o: Partial<FooterState> = {}): FooterItem[] => footerItems({ ...base, ...o })
const said = (list: FooterItem[]) => list.filter((i): i is Extract<FooterItem, { text: string }> => 'text' in i)
const find = (list: FooterItem[], text: string) => said(list).find(i => i.text === text)
const picked = (effort: string) => ({ model: 'sonnet', effort, why: '', by: 'haiku' })

describe('footer: the effort word', () => {
  test('Auto on shows the effort in use, bold in the accent colour', () => {
    expect(find(items({ pick: picked('high') }), ' High ')).toEqual({ text: ' High ', color: VIOLET, bold: true })
  })

  test('the modes sit dim at the left, joined; no modes, no text there', () => {
    expect(said(items({ modes: ['plan', 'edits'] }))[0]).toEqual({ text: 'plan & edits', dim: true })
    expect(said(items())[0].text).toBe(' Auto ')
  })

  test('with nothing known yet Auto counts as on: unknown never reads as Off', () => {
    for (const auto of [undefined, null, 'x', 0]) expect(find(items({ auto }), ' Auto ')?.color).toBe(VIOLET)
    expect(find(items({ auto: undefined }), ' Off ')).toBeUndefined()
  })

  test('only a real false says Off, dim and without the accent colour', () => {
    const off = items({ auto: false, pick: picked('high') })
    expect(find(off, ' Off ')).toEqual({ text: ' Off ', dim: true })
    expect(said(off).some(i => i.color === VIOLET)).toBe(false)
  })

  test('where an effort change would rewrite the cache it says Paused, dim', () => {
    expect(find(items({ paused: true, pick: picked('high') }), ' Paused ')).toEqual({ text: ' Paused ', dim: true })
  })

  test('Haiku has no effort to name, so the footer says Auto', () => {
    expect(find(items({ model: 'haiku', pick: picked('high') }), ' Auto ')).toBeDefined()
  })

  test("the app's own effort is shown while Auto has made no pick; Auto's pick wins once it has", () => {
    expect(find(items({ app: 'xhigh', model: 'opus' }), ' XHigh ')).toBeDefined()
    expect(find(items({ app: 'xhigh', pick: picked('low') }), ' Low ')).toBeDefined()
  })

  test('every level has its word', () => {
    for (const [effort, word] of [['low', 'Low'], ['medium', 'Medium'], ['high', 'High'], ['xhigh', 'XHigh'], ['max', 'Max']]) expect(find(items({ pick: picked(effort) }), ` ${word} `)).toBeDefined()
  })

  test('an effort the footer does not know falls back to Auto rather than printing nothing', () => {
    expect(find(items({ pick: picked('weird') }), ' Auto ')).toBeDefined()
  })

  test('while the judge decides: Deciding…; just after a switch: Low → High; while compacting: Compacting…', () => {
    expect(find(items({ judging: true, pick: picked('high') }), ' Deciding… ')).toBeDefined()
    expect(find(items({ switched: { from: 'low', to: 'high' }, pick: picked('high') }), ' Low → High ')).toBeDefined()
    expect(find(items({ compacting: true, judging: true }), ' Compacting… ')).toBeDefined()
  })

  test('save mode paints the level ember, and only then', () => {
    expect(find(items({ saving: Date.now() + 1000, pick: picked('medium') }), ' Medium ')?.color).toBe(EMBER)
    expect(find(items({ saving: null, pick: picked('medium') }), ' Medium ')?.color).toBe(VIOLET)
  })
})

describe('footer: the cache timer', () => {
  // cacheLeft is whole minutes with one added: 60 reads as 59m. Grey to 21m, yellow from 20m, red from 5m, then Cold.
  const cases: [number | null, string | null, string | undefined][] = [
    [null, null, undefined],
    [0, '❄ Cold', ICE],
    [1, '<1m', RED],
    [2, '1m', RED],
    [6, '5m', RED],
    [7, '6m', YELLOW],
    [21, '20m', YELLOW],
    [22, '21m', undefined],
    [60, '59m', undefined],
  ]
  for (const [left, text, color] of cases) {
    test(`cacheLeft ${left}: ${text ?? 'nothing'}${color ? ` in ${color}` : text ? ' in grey' : ''}`, () => {
      const timer = said(items({ cache: left })).filter(i => i.text === text)
      if (text === null) expect(said(items({ cache: left })).filter(i => /m$|Cold$/.test(i.text) && !i.text.includes(' '))).toEqual([])
      else expect(timer).toEqual([color ? { text, color } : { text, dim: true }])
    })
  }

  test('a cache value that is not a number draws nothing', () => {
    for (const cache of ['59', undefined, NaN as never, Infinity as never]) expect(said(items({ cache })).filter(i => /m$|Cold$/.test(i.text) && !i.text.includes(' '))).toEqual([])
  })
})

describe('footer: advice and buttons', () => {
  test('when Haiku advises a handoff its reason shows in ember; a long one is cut to 40 characters', () => {
    expect(find(items({ advice: 'new topic' }), 'handoff? new topic')?.color).toBe(EMBER)
    expect(said(items({ advice: 'x'.repeat(70) })).find(i => i.text.startsWith('handoff?'))?.text).toBe(`handoff? ${'x'.repeat(40)}`)
  })

  test('no advice, an empty one or a non-text one: no chip', () => {
    for (const advice of [null, '', 5 as never]) expect(said(items({ advice })).some(i => i.text.startsWith('handoff?'))).toBe(false)
  })

  test('the row keeps its order: modes, effort, the three buttons, advice, timer', () => {
    const row = items({ modes: ['plan'], pick: picked('high'), advice: 'a', cache: 30 }).map(i => ('button' in i ? `[${i.button}]` : i.text))
    expect(row).toEqual(['plan', ' High ', '[auto]', '[settings]', '[handoff]', 'handoff? a', '29m'])
  })
})

/** A session for the mounted tests. Another plugin's state reads as nothing here, as it does before that plugin has spoken. */
function session(on: On, usage: unknown = { cost: { usd: 1 }, context: { percent: 10 }, rateLimits: [] }) {
  mock.store(on)
  mock.clock(on)
  mock.env(on, { HOME: '/home/user' })
  on('session.usage', () => ({ value: usage }) as never)
  on('fs.read', () => ({ value: '' }) as never)
  on('fs.write', () => ({ value: undefined }) as never)
  on('session.start', (_$, e) => ({ cwd: e.cwd }) as never)
}
const start = ($: Engine, surface = 'desktop') => $.session.start({ cwd: '.', surface, isInteractive: true } as never)

describe('footer: mounted', () => {
  test('before the other plugin has spoken the row is Auto, the three buttons, and no timer', async ($, on) => {
    session(on)
    await start($)
    const ui = await $.ui.mount({ plugin: 'mistif', surface: 'desktop', component: 'SessionMode', props: { modes: [] } } as never)
    const text = JSON.stringify(await ui.drawn())
    expect(text).toContain(' Auto ')
    expect(text).not.toContain(' Off ')
    for (const key of ['auto', 'settings', 'handoff']) expect(text).toContain(`"key":"${key}"`)
  })

  test('the power button runs the Auto command, the handoff button the handoff command', async ($, on) => {
    session(on)
    const ran: string[] = []
    on('command.run', (_$, e) => {
      ran.push(`${e.command} ${e.args}`.trim())
      return { text: 'ok' }
    })
    await start($)
    const ui = await $.ui.mount({ plugin: 'mistif', surface: 'desktop', component: 'SessionMode', props: { modes: [] } } as never)
    await ui.press({ key: 'auto' })
    await ui.press({ key: 'handoff' })
    expect(ran).toEqual(['mistif:hud auto', 'mistif:hud handoff'])
  })

  test('the settings button opens the settings card above the prompt', async ($, on) => {
    session(on)
    await start($)
    const foot = await $.ui.mount({ plugin: 'mistif', surface: 'desktop', component: 'SessionMode', props: { modes: [] } } as never)
    await foot.press({ key: 'settings' })
    const band = await $.ui.mount({ plugin: 'mistif', surface: 'desktop', component: 'AbovePrompt', props: BAND } as never)
    const overview = JSON.stringify(await band.drawn())
    expect(overview).toContain('"key":"part-effort"')
    expect(overview).toContain('"key":"part-handoff"')
    expect(overview).toContain('"key":"part-usage"')
    expect(overview).not.toContain('Effort floor')
  })

  test('a card opens its own settings and Back returns to the cards', async ($, on) => {
    session(on)
    await start($)
    const foot = await $.ui.mount({ plugin: 'mistif', surface: 'desktop', component: 'SessionMode', props: { modes: [] } } as never)
    await foot.press({ key: 'settings' })
    const band = await $.ui.mount({ plugin: 'mistif', surface: 'desktop', component: 'AbovePrompt', props: BAND } as never)
    await band.press({ key: 'part-effort' })
    const detail = JSON.stringify(await band.drawn())
    expect(detail).toContain('Effort floor')
    expect(detail).toContain('"key":"back"')
    await band.press({ key: 'back' })
    expect(JSON.stringify(await band.drawn())).toContain('"key":"part-effort"')
  })

  describe('saving the settings', () => {
    // A session whose settings.json is `disk`: reads see the current value, writes are recorded.
    const withDisk = (on: On, disk: { text: string }, writes: [string, string][]) => {
      mock.store(on)
      mock.clock(on)
      mock.env(on, { HOME: '/home/user' })
      on('session.usage', () => ({ value: { cost: { usd: 1 }, context: { percent: 10 }, rateLimits: [] } }) as never)
      on('fs.read', () => ({ value: disk.text }) as never)
      on('fs.write', (_$, e) => {
        writes.push([e.path, e.text])
        return { value: undefined } as never
      })
      on('command.run', () => ({ text: 'ok' }) as never)
      on('session.start', (_$, e) => ({ cwd: e.cwd }) as never)
    }
    const openAndPick = async ($: Engine) => {
      await start($)
      const foot = await $.ui.mount({ plugin: 'mistif', surface: 'desktop', component: 'SessionMode', props: { modes: [] } } as never)
      await foot.press({ key: 'settings' })
      const band = await $.ui.mount({ plugin: 'mistif', surface: 'desktop', component: 'AbovePrompt', props: BAND } as never)
      await band.press({ key: 'part-effort' })
      await band.press({ key: 'effortFloor-high' })
      return band
    }

    test('it reads the file again before writing, so a change made meanwhile is kept', async ($, on) => {
      const disk = { text: JSON.stringify({ model: 'x' }) }
      const writes: [string, string][] = []
      withDisk(on, disk, writes)
      const band = await openAndPick($)
      disk.text = JSON.stringify({ model: 'x', added: 'later' })
      await band.press({ key: 'save' })
      const written = writes.find(([p]) => p.endsWith('settings.json'))
      expect(written).toBeTruthy()
      const s = JSON.parse(written![1])
      expect(s.added).toBe('later')
      expect(s.pluginConfigs['mistif@mistif'].options.effortFloor).toBe('high')
    })

    test('a settings.json it cannot parse is not overwritten, and the card says why', async ($, on) => {
      const disk = { text: '{not json' }
      const writes: [string, string][] = []
      withDisk(on, disk, writes)
      const band = await openAndPick($)
      expect(JSON.stringify(await band.drawn())).toContain("can't read settings.json")
      await band.press({ key: 'save' })
      expect(writes.some(([p]) => p.endsWith('settings.json'))).toBe(false)
    })

    test('Usage: picking Lite and saving writes the option, and nothing else changes', async ($, on) => {
      const disk = { text: JSON.stringify({ model: 'x' }) }
      const writes: [string, string][] = []
      withDisk(on, disk, writes)
      await start($)
      const foot = await $.ui.mount({ plugin: 'mistif', surface: 'desktop', component: 'SessionMode', props: { modes: [] } } as never)
      await foot.press({ key: 'settings' })
      const band = await $.ui.mount({ plugin: 'mistif', surface: 'desktop', component: 'AbovePrompt', props: BAND } as never)
      await band.press({ key: 'part-usage' })
      expect(JSON.stringify(await band.drawn())).toContain('"key":"usage-lite"')
      await band.press({ key: 'usage-lite' })
      await band.press({ key: 'save' })
      const written = writes.find(([p]) => p.endsWith('settings.json'))
      expect(JSON.parse(written![1]).pluginConfigs['mistif@mistif'].options).toEqual({ usage: 'lite' })
    })

    test('Usage survives a restart: the card reads Lite back from settings.json', async ($, on) => {
      const disk = { text: JSON.stringify({ pluginConfigs: { 'mistif@mistif': { options: { usage: 'lite' } } } }) }
      withDisk(on, disk, [])
      await start($)
      const foot = await $.ui.mount({ plugin: 'mistif', surface: 'desktop', component: 'SessionMode', props: { modes: [] } } as never)
      await foot.press({ key: 'settings' })
      const band = await $.ui.mount({ plugin: 'mistif', surface: 'desktop', component: 'AbovePrompt', props: BAND } as never)
      expect(JSON.stringify(await band.drawn())).toContain('lite · inline or one agent')
    })

    test('each save keeps its own backup, five in a ring', async ($, on) => {
      const disk = { text: JSON.stringify({ model: 'x' }) }
      const writes: [string, string][] = []
      withDisk(on, disk, writes)
      const band = await openAndPick($)
      await band.press({ key: 'save' })
      const backups = writes.map(([p]) => p).filter(p => p.includes('.bak-mistif-'))
      expect(backups.length).toBe(1)
      expect(backups[0]).toMatch(/\.bak-mistif-[0-4]$/)
    })
  })

  test('the footer is a desktop thing: the terminal gets nothing from it', async ($, on) => {
    session(on)
    await start($, 'terminal')
    const ui = await $.ui.mount({ plugin: 'mistif', surface: 'terminal', component: 'SessionMode', props: { modes: [] } } as never).catch(() => null)
    expect(ui === null || !JSON.stringify(await ui.drawn()).includes('"key":"auto"')).toBe(true)
  })
})

const BAND = { hasSurvey: false, isWorking: false, maxRows: 12, bodyColumns: 100, scroll: { offset: 0, bodyRows: 12 }, view: {} }
const limits = (week: number, five: number) => ({
  cost: { usd: 42.9 },
  context: { percent: 18 },
  rateLimits: [{ kind: 'seven_day', percentUsed: week, resetsAt: '2026-10-23T03:00:00' }, { kind: 'five_hour', percentUsed: five, resetsAt: '2026-10-22T23:00:00' }],
})

describe('the band above the prompt', () => {
  const band = async ($: Engine, on: On, week: number, five = 20) => {
    session(on, limits(week, five))
    await start($)
    const ui = await $.ui.mount({ plugin: 'mistif', surface: 'desktop', component: 'AbovePrompt', props: BAND } as never)
    return JSON.stringify(await ui.drawn())
  }

  test('shows the cost, the context and the limits', async ($, on) => {
    const text = await band($, on, 40)
    expect(text).toContain('$42.90')
    expect(text).toContain('week 40%')
    expect(text).toContain('context 18%')
  })

  test('at 80% of the week the band turns ember', async ($, on) => {
    const text = await band($, on, 80)
    expect(text).toContain('#1a110c')
    expect(text).toContain('#6a3418')
  })

  test('at 80% of the five hours it turns ember too', async ($, on) => {
    expect(await band($, on, 10, 80)).toContain('#1a110c')
  })

  test('just under 80% it stays calm', async ($, on) => {
    const text = await band($, on, 79, 79)
    expect(text).not.toContain('#1a110c')
    expect(text).not.toContain('#6a3418')
    expect(text).toContain('#2a2a2f')
  })

  test('with a survey showing it draws nothing of its own', async ($, on) => {
    session(on, limits(40, 20))
    await start($)
    const ui = await $.ui.mount({ plugin: 'mistif', surface: 'desktop', component: 'AbovePrompt', props: { ...BAND, hasSurvey: true } } as never).catch(() => null)
    expect(ui === null || !JSON.stringify(await ui.drawn()).includes('$42.90')).toBe(true)
  })

  test('little room: a plain line instead of the panel', async ($, on) => {
    session(on, limits(40, 20))
    await start($)
    const ui = await $.ui.mount({ plugin: 'mistif', surface: 'desktop', component: 'AbovePrompt', props: { ...BAND, maxRows: 4 } } as never)
    const text = JSON.stringify(await ui.drawn())
    expect(text).toContain('$42.90')
    expect(text).not.toContain('"borderStyle":"round"')
  })
})
