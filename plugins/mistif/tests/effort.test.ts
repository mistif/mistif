import { describe, expect, mock, test as baseTest } from 'claude-code/testing'
import type { On } from 'claude-code'
import type { Engine } from 'claude-code/testing'
import { namedEffort, HANDOFF_PROMPT, handoffMessage, withAttachments, endsOnQuestion, keepsEffort, benchGrade, benchReport, contextFrom, cacheColor, cacheLabel, cacheTtlOf, mostlyCached, isFollowUp, forkOutcome } from '../hooks/effort'


// Most tests below were written for the footer's buttons: they run in the minimal look unless they name another.
// The dashboard's own tests pass { layout: 'default' }.
type Opts = Parameters<typeof baseTest>[1]
const minimal = (o?: Record<string, unknown>) => ({ ...(o ?? {}), options: { hide: 'reason', ...((o?.options as object) ?? {}) } })
const test = ((name: string, a: unknown, b?: unknown) =>
  b === undefined
    ? baseTest(name, minimal() as Opts, a as never)
    : baseTest(name, minimal(a as Record<string, unknown>) as Opts, b as never)) as typeof baseTest

const BAND = {
  component: 'AbovePrompt',
  props: {
    hasSurvey: false,
    isWorking: false,
    maxRows: 10,
    bodyColumns: 100,
    scroll: { offset: 0, bodyRows: 10 },
    view: {},
  },
} as const

const USAGE = { input_tokens: 1, output_tokens: 1, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 }

/** Haiku as the judge answers this reply, and counts how often it was asked. */
function judgeSays(on: On, text: string) {
  const asked: string[] = []
  on('model.complete', (_$, e) => {
    asked.push(e.prompt)
    return { value: { isAnswered: true as const, text, usage: USAGE } }
  })
  return asked
}

/** What sits beneath the plugins in a session: the prompt goes through, the status line takes text. */
function engine(on: On, env: Record<string, string> = {}, sessionModel = 'claude-opus-5-5', said: { role: string; text: string }[] = []) {
  mock.store(on)
  mock.env(on, { EFFORTLESS_MODEL_UI: '1', ...env })
  on('prompt.submit', (_$, e) => ({ text: e.text }))
  on('ui.status', () => ({ value: undefined }))
  on('session.messages', () => ({ value: said }) as never)
  on('session.model', () => ({ value: sessionModel }))
  on('command.list', () => ({ value: [{ name: 'model' }, { name: 'effort' }, { name: 'session-handoff', source: 'user' }] as never }))
}

/** Records the slash commands the mod runs, as the person's own /model and /effort. */
function recordCommands(on: On) {
  const ran: string[] = []
  on('command.run', (_$, e) => {
    ran.push(`/${e.command} ${e.args}`)
    return { text: 'ok' }
  })
  return ran
}

/** Records the model and effort each main-conversation request was sent with. */
function recordSteps(on: On) {
  const sent: { model: string; effort: unknown }[] = []
  on('turn.step', async function* (_$, e) {
    sent.push({ model: e.model, effort: e.effort })
    return { turnId: e.turnId, index: e.index, answer: '', toolUses: [], stopReason: 'end_turn', usage: null }
  })
  return sent
}

/** One main-loop request, the engine sending `effort` as its own setting (high unless /effort set another). */
async function step($: Engine, effort: 'low' | 'medium' | 'high' | 'xhigh' | 'max' = 'high') {
  const stream = $.turn.step({ turnId: 't1', index: 0, model: 'claude-opus-5-5', effort, messageCount: 1 })
  for await (const _ of stream) {
    // drain
  }
}

/** The desktop footer: one Auto button, and the effort in use beside it. */
const FOOTER = { plugin: 'mistif', surface: 'desktop', component: 'SessionMode', props: { modes: [] } } as never

/** The band above the prompt on desktop: it draws nothing (only the terminal has rows there). */
const DESK_BAND = { plugin: 'mistif', surface: 'desktop', ...BAND } as never

/** What /mistif:hud debug says, which carries the data the hud mod reads: the minutes of cache left (60 = a fresh hour, 0 = cold,
 * null before the first response), whether Auto is on, and whether it is paused. */
const debug = async ($: Engine) => String((await $.command.run({ command: 'hud', args: 'debug' })).text)
const left = async ($: Engine) => {
  const m = (await debug($)).match(/shown ([^,]+),/)
  return m ? (m[1] === 'null' ? null : Number(m[1])) : undefined
}
const flag = async ($: Engine, name: 'auto' | 'paused') => (await debug($)).match(new RegExp(name + ': (true|false)'))?.[1] === 'true'

/** What a mounted tree draws, as text: its elements, props and strings. */
/** Nothing shows above the prompt on desktop: only the hidden hover cards, revealed by hovering the footer. */
async function noBand($: Engine, at: never) {
  const ui = await $.ui.mount(at)
  const text = await drawn(ui)
  expect(text).toContain('hover-cards')
  expect(text).not.toMatch(/"key":"(settings|setup|down|hot|cold|swamp)"/)
  await ui.unmount()
}

async function drawn(ui: { drawn: () => Promise<unknown> }): Promise<string> {
  return JSON.stringify(await ui.drawn())
}

/**
 * The band's buttons take clicks: the app draws anything in the flow under an absolutely placed art layer, so the
 * layer holding them must itself be absolute and come after the art.
 */
async function clickable(ui: { drawn: () => Promise<unknown> }, layer: string) {
  const find = (node: unknown): Record<string, unknown> | undefined => {
    if (!node || typeof node !== 'object') return undefined
    const n = node as Record<string, unknown>
    const props = (n.props ?? {}) as Record<string, unknown>
    if (n.key === layer || props.key === layer) return n
    for (const value of Object.values(n)) {
      const hit = Array.isArray(value) ? value.map(find).find(Boolean) : find(value)
      if (hit) return hit
    }
    return undefined
  }
  const node = find(await ui.drawn())
  expect(node).toBeDefined()
  const props = ((node as Record<string, unknown>).props ?? node) as Record<string, unknown>
  expect(props.position).toBe('absolute')
}

describe('auto', () => {
  test('with the cheaper model off, effort follows the judge and the model stays the one in use', { options: { effortFloor: 'low' } } as never, async ($, on) => {
    engine(on)
    judgeSays(on, '{"model":"haiku","effort":"low","why":"simple question"}')
    const sent = recordSteps(on)

    await $.prompt.submit({ text: 'vad heter mappen?', wait: false, origin: { kind: 'composer' } })
    await step($)

    expect(sent[0]).toEqual({ model: 'claude-opus-5-5', effort: 'low' })
  })

  test('Auto switched off: the app effort goes out, not the pick the judge made while Auto was on', { options: { effortFloor: 'low' } } as never, async ($, on) => {
    engine(on)
    on('model.complete', () => ({ value: { isAnswered: true as const, text: '{"model":"opus","effort":"low","why":"tiny"}', usage: USAGE } }))
    const sent = recordSteps(on)
    await $.prompt.submit({ text: 'rename this one variable for me', wait: false, origin: { kind: 'composer' } })
    await step($, 'xhigh')
    expect(sent[0].effort).toBe('low')
    // Auto off, the app still on Extra (no change the mod could see): Extra goes out, not the judge's old low.
    await $.command.run({ command: 'hud', args: 'auto' })
    await step($, 'xhigh')
    expect(sent[1].effort).toBe('xhigh')
    await $.prompt.submit({ text: 'now plan the whole architecture', wait: false, origin: { kind: 'composer' } })
    await step($, 'xhigh')
    expect(sent[2].effort).toBe('xhigh')
  })

  test('a typed skill is judged like a prompt (told what it is); the app\'s own commands are not', async ($, on) => {
    engine(on)
    const asked: string[] = []
    on('model.complete', (_$, e) => {
      asked.push(String((e as { prompt?: string }).prompt ?? ''))
      return { value: { isAnswered: true as const, text: '{"model":"haiku","effort":"low","why":"small job"}', usage: USAGE } }
    })
    const sent = recordSteps(on)
    // /session-handoff is a user skill (see engine's command list): judged, even though it is short enough to look like a follow-up.
    await $.prompt.submit({ text: '/session-handoff', wait: false, origin: { kind: 'composer' } })
    await step($)
    expect(asked.length).toBe(1)
    expect(asked[0]).toContain('slash command that runs a skill')
    // /model is the app's own: never judged.
    await $.prompt.submit({ text: '/model', wait: false, origin: { kind: 'composer' } })
    expect(asked.length).toBe(1)
  })

  test('the judge never moves a prompt to a dearer model than the chat model, nor to Fable', async ($, on) => {
    engine(on, {}, 'claude-sonnet-5-5')
    judgeSays(on, '{"model":"opus","effort":"high","why":"hard"}')
    const sent = recordSteps(on)
    await $.prompt.submit({ text: 'debug this race condition', wait: false, origin: { kind: 'composer' } })
    for await (const _ of $.turn.step({ turnId: 't1', index: 0, model: 'claude-sonnet-5-5', effort: 'high', messageCount: 1 })) {
      // drain
    }
    expect(sent[0].model).toBe('claude-sonnet-5-5')
  })

  test('a reply that is not a verdict leaves the session as it is', async ($, on) => {
    engine(on)
    judgeSays(on, 'I think sonnet')
    const sent = recordSteps(on)

    await $.prompt.submit({ text: 'fixa buggen', wait: false, origin: { kind: 'composer' } })
    await step($)

    expect(sent[0]).toEqual({ model: 'claude-opus-5-5', effort: 'high' })
  })

  test('slash commands are not judged', async ($, on) => {
    engine(on)
    const asked = judgeSays(on, '{"model":"opus","effort":"max","why":"x"}')

    await $.prompt.submit({ text: '/clear', wait: false, origin: { kind: 'composer' } })

    expect(asked.length).toBe(0)
  })
})

describe('manual effort', () => {
  test("the app's own Effort control wins over Auto and turns it off", async ($, on) => {
    engine(on)
    judgeSays(on, '{"model":"opus","effort":"high","why":"hard"}')
    const sent = recordSteps(on)
    const drain = async (index: number, effort: 'low' | 'medium' | 'high') => {
      for await (const _ of $.turn.step({ turnId: 't1', index, model: 'claude-opus-5-5', effort, messageCount: 1 })) {
        // drain
      }
    }

    await $.prompt.submit({ text: 'hard task', wait: false, origin: { kind: 'composer' } })
    await drain(0, 'medium')
    expect(sent[0].effort).toBe('high')

    // The person picks Low in the app between two requests.
    await drain(1, 'low')
    expect(sent[1].effort).toBe('low')
    expect(await flag($, 'auto')).toBe(false)

    await drain(2, 'low')
    expect(sent[2].effort).toBe('low')
  })
})

describe('model in use', () => {
  test('a switch in the app moves the pick, and effort applies to the new model at once', { options: { effortFloor: 'low' } } as never, async ($, on) => {
    engine(on)
    judgeSays(on, '{"model":"haiku","effort":"low","why":"kort"}')
    const sent = recordSteps(on)
    mock.clock(on)
    on('classic.PostModelSwitch', () => ({}) as never)
    const switchTo = (from: string, to: string) =>
      $.classic.PostModelSwitch({ from_model: from, to_model: to, requested_model: null, source: 'picker', context_tokens: 0 } as never)

    await switchTo('claude-opus-5-5', 'claude-haiku-5-5')
    await $.prompt.submit({ text: 'ok', wait: false, origin: { kind: 'composer' } })
    // The person picks Opus in the app.
    await switchTo('claude-haiku-5-5', 'claude-opus-5-5')
    await step($, 'medium')
    expect(sent[0]).toEqual({ model: 'claude-opus-5-5', effort: 'low' })
  })
})

describe('follow-ups', () => {
  test('isFollowUp: short go-aheads yes, real requests no', () => {
    for (const t of ['go', 'ok', ' yes ', 'ok go', 'continue']) expect(isFollowUp(t)).toBe(true)
    for (const t of ['', 'rename x to count in utils', 'go through my whole drive']) expect(isFollowUp(t)).toBe(false)
  })

  test('"go" after a judged prompt keeps its effort and asks no judge', async ($, on) => {
    engine(on)
    const asked = judgeSays(on, '{"model":"opus","effort":"high","why":"hard"}')
    const sent = recordSteps(on)
    await $.prompt.submit({ text: 'granska hela routern', wait: false, origin: { kind: 'composer' } })
    await $.prompt.submit({ text: 'go', wait: false, origin: { kind: 'composer' } })
    await step($, 'medium')
    expect(asked.length).toBe(1)
    expect(sent[0].effort).toBe('high')
  })
})

describe('named level', () => {
  test('namedEffort: a level said with the word effort, or xhigh, counts; other senses and negations do not', () => {
    expect(namedEffort('do this with max effort please')).toBe('max')
    expect(namedEffort('Effort: high, then refactor the router')).toBe('high')
    expect(namedEffort('run it at effort low')).toBe('low')
    expect(namedEffort('use extra high effort for this one')).toBe('xhigh')
    expect(namedEffort('xhigh, review the whole repo')).toBe('xhigh')
    expect(namedEffort('maximum effort on this bug')).toBe('max')
    expect(namedEffort('make a medium sized image')).toBeUndefined()
    expect(namedEffort('this needs a lot of effort, the bug is high up in the stack')).toBeUndefined()
    expect(namedEffort("don't use max effort for this")).toBeUndefined()
    expect(namedEffort('no need for high effort here')).toBeUndefined()
    expect(namedEffort('a high effort job: migrate everything')).toBe('high')
  })

  test('a prompt that names a level runs at it without asking the judge, past Max', { options: { effortFloor: 'low', effortCeiling: 'high' } } as never, async ($, on) => {
    engine(on)
    const asked = judgeSays(on, '{"model":"opus","effort":"low","why":"small"}')
    const sent = recordSteps(on)
    await $.prompt.submit({ text: 'max effort: find why the router drops messages', wait: false, origin: { kind: 'composer' } })
    await step($, 'medium')
    expect(asked.length).toBe(0)
    expect(sent[0].effort).toBe('max')
    // The next prompt without a level goes back to the judge, within Max.
    await $.prompt.submit({ text: 'now rename the helper in utils', wait: false, origin: { kind: 'composer' } })
    await step($, 'medium')
    expect(asked.length).toBe(1)
    expect(sent[1].effort).toBe('low')
  })
})

describe('cache countdown', () => {
  const answer = (on: On, cacheCreation?: Record<string, number>) =>
    on('turn.step', async function* (_$, e) {
      return {
        turnId: e.turnId,
        index: e.index,
        answer: '',
        toolUses: [],
        stopReason: 'end_turn',
        usage: { ...USAGE, ...(cacheCreation ? { cache_creation: cacheCreation } : {}) },
      } as never
    })
  // The countdown's timer starts with the session, as in the app.
  const start = async ($: Engine, on: On) => {
    on('session.start', (_$, e) => ({ cwd: e.cwd }) as never)
    on('command.register', () => ({ value: undefined }) as never)
    await $.session.start({ cwd: '.', surface: 'desktop', isInteractive: true } as never)
  }

  test('cacheTtlOf and cacheLabel', () => {
    expect(cacheTtlOf({ cache_creation: { ephemeral_1h_input_tokens: 900, ephemeral_5m_input_tokens: 0 } })).toBe('1h')
    expect(cacheTtlOf({ cache_creation: { ephemeral_1h_input_tokens: 0, ephemeral_5m_input_tokens: 10 } })).toBe('5m')
    expect(cacheTtlOf({ input_tokens: 1 })).toBeUndefined()
    expect(cacheLabel(60)).toBe('59m')
    expect(cacheLabel(1)).toBe('<1m')
    expect(cacheLabel(0)).toBe('❄ Cold')
    expect(cacheColor(60)).toBeUndefined()
    expect(cacheColor(22)).toBeUndefined()
    expect(cacheColor(21)).toBe('#e0a33a')
    expect(cacheColor(7)).toBe('#e0a33a')
    expect(cacheColor(6)).toBe('#e5534b')
    expect(cacheColor(1)).toBe('#e5534b')
    expect(cacheColor(0)).toBe('#7cc4ff')
    expect(mostlyCached({ input_tokens: 90000, cache_read_input_tokens: 10 })).toBe(false)
  })

  // The mocked clock fires the mod's 15 s timers once per tick, so every simulated minute costs real work. These tests
  // therefore advance as little as they can: the hour's countdown is shown over 10 minutes, and going cold on the
  // 5 minute lifetime. They used to walk a full hour and timed out on a loaded machine.
  test('nothing before the first response; then it counts down with no further response', async ($, on) => {
    engine(on)
    const mocked = mock.clock(on)
    answer(on, { ephemeral_1h_input_tokens: 500, ephemeral_5m_input_tokens: 0 })
    await start($, on)
    expect(await left($)).toBeNull()
    await step($)
    expect(await left($)).toBe(60)
    // No request in between: the session's own timer moves it.
    await mocked.advance(10 * 60_000)
    expect(await left($)).toBe(50)
  })

  test('when the lifetime runs out the cache is cold, and the next response warms it again', async ($, on) => {
    engine(on)
    const mocked = mock.clock(on)
    answer(on, { ephemeral_5m_input_tokens: 500 })
    await start($, on)
    await step($)
    expect(await left($)).toBe(5)
    await mocked.advance(4 * 60_000)
    expect(await left($)).toBe(1)
    await mocked.advance(60_000)
    expect(await left($)).toBe(0)
    await step($)
    expect(await left($)).toBe(5)
  })

  test('a response that does not say its lifetime is counted as 1 hour', async ($, on) => {
    engine(on)
    mock.clock(on)
    answer(on)
    await start($, on)
    await step($)
    expect(await left($)).toBe(60)
  })

  test('a response that says 5 minutes counts down 5 minutes', async ($, on) => {
    engine(on)
    const mocked = mock.clock(on)
    answer(on, { ephemeral_5m_input_tokens: 500 })
    await start($, on)
    await step($)
    expect(await left($)).toBe(5)
    await mocked.advance(6 * 60_000)
    expect(await left($)).toBe(0)
  })
})

describe('cache guard', () => {
  test('on Fable Auto neither judges nor changes the effort, and says it is paused', async ($, on) => {
    engine(on, {}, 'claude-fable-5-1')
    const asked = judgeSays(on, '{"model":"opus","effort":"low","why":"x"}')
    const sent: unknown[] = []
    on('turn.step', async function* (_$, e) {
      sent.push(e.effort)
      return { turnId: e.turnId, index: 0, answer: '', toolUses: [], stopReason: 'end_turn', usage: null }
    })
    await $.prompt.submit({ text: 'hard task', wait: false, origin: { kind: 'composer' } })
    const stream = $.turn.step({ turnId: 't1', index: 0, model: 'claude-fable-5-1', effort: 'xhigh', messageCount: 1 })
    for await (const _ of stream) {
      // drain
    }
    expect(asked.length).toBe(0)
    expect(sent).toEqual(['xhigh'])
    expect(await flag($, 'paused')).toBe(true)
  })

  test('a pick made on Opus 5.5 is not applied to a Fable request', { options: { effortFloor: 'low' } } as never, async ($, on) => {
    engine(on)
    judgeSays(on, '{"model":"opus","effort":"low","why":"x"}')
    const sent: unknown[] = []
    on('turn.step', async function* (_$, e) {
      sent.push(e.effort)
      return { turnId: e.turnId, index: 0, answer: '', toolUses: [], stopReason: 'end_turn', usage: null }
    })
    await $.prompt.submit({ text: 'hej', wait: false, origin: { kind: 'composer' } })
    for (const model of ['claude-opus-5-5', 'claude-fable-5-1']) {
      const stream = $.turn.step({ turnId: 't1', index: 0, model, effort: 'xhigh', messageCount: 1 })
      for await (const _ of stream) {
        // drain
      }
    }
    expect(sent).toEqual(['low', 'xhigh'])
  })
})

describe('footer', () => {
  test('auto sets the effort of the request, never runs /effort or /model', { options: { effortFloor: 'low' } } as never, async ($, on) => {
    engine(on)
    judgeSays(on, '{"model":"sonnet","effort":"low","why":"simple"}')
    const ran = recordCommands(on)
    const sent = recordSteps(on)

    await $.prompt.submit({ text: 'rename the function', wait: false, origin: { kind: 'composer' } })
    await step($, 'medium')

    expect(sent[0].effort).toBe('low')
    expect(ran).toEqual([])
  })

})

describe('review fixes', () => {
  test('a model switch that changes the engine effort is not read as you choosing, Auto stays on', { options: { effortFloor: 'low' } } as never, async ($, on) => {
    engine(on)
    judgeSays(on, '{"model":"sonnet","effort":"low","why":"simple"}')
    mock.clock(on)
    on('classic.PostModelSwitch', () => ({}) as never)
    const sent = recordSteps(on)

    await $.prompt.submit({ text: 'hej', wait: false, origin: { kind: 'composer' } })
    await step($, 'xhigh')
    expect(sent[0].effort).toBe('low')

    // The person picks another model; the engine's own effort for it is different.
    await $.classic.PostModelSwitch({
      from_model: 'claude-opus-5-5',
      to_model: 'claude-sonnet-5-5',
      requested_model: 'sonnet',
      source: 'picker',
      context_tokens: 0,
    } as never)
    await step($, 'medium')

    // Auto still decides: the request keeps the judged effort instead of the engine's 'medium'.
    expect(sent[1].effort).toBe('low')
  })

})

describe('context for the judge', () => {
  test("the assistant's last reply goes along, long and from its end, where its question sits", () => {
    const question = 'Which section should I build: A (simple), B (a complicated multi-step layout) or C?'
    const reply = 'x'.repeat(5000) + ' ' + question
    const text = contextFrom([
      { role: 'user', text: 'make me a new section' },
      { role: 'assistant', text: reply },
    ])
    expect(text).toContain(question)
    expect(text).toContain('user: make me a new section')
    expect(text.length).toBeLessThan(2500)
    expect(contextFrom([])).toBe('')
  })

  test("Haiku is handed the assistant's question and told how to judge an answer to it", async ($, on) => {
    mock.store(on)
    mock.env(on, {})
    mock.clock(on)
    on('prompt.submit', (_$, e) => ({ text: e.text }))
    on('ui.status', () => ({ value: undefined }))
    on('session.model', () => ({ value: 'claude-opus-5-5' }))
    on('session.messages', () => ({
      value: [
        { role: 'user', text: 'make me a new section' },
        { role: 'assistant', text: 'Which one: A (simple) or B (a complicated multi-step layout)?' },
      ],
    }) as never)
    const seen: { system?: string; prompt: string }[] = []
    on('model.complete', (_$, e) => {
      seen.push({ system: e.system, prompt: e.prompt })
      return { value: { isAnswered: true as const, text: '{"model":"opus","effort":"high","why":"B is big"}', usage: USAGE } }
    })
    await $.prompt.submit({ text: 'B', wait: false, origin: { kind: 'composer' } })
    expect(seen[0].prompt).toContain('B (a complicated multi-step layout)')
    expect(seen[0].system).toContain('judge only the work that answer starts')
    expect(seen[0].system).toContain('should I archive this?')
  })
})

describe('model-aware effort', () => {
  test('the judge is told which model runs and that effort is relative to it', async ($, on) => {
    engine(on, {}, 'claude-sonnet-5-5')
    mock.clock(on)
    const seen: { system?: string; prompt: string }[] = []
    on('model.complete', (_$, e) => {
      seen.push({ system: e.system, prompt: e.prompt })
      return { value: { isAnswered: true as const, text: '{"model":"sonnet","effort":"high","why":"x"}', usage: USAGE } }
    })
    await $.prompt.submit({ text: 'refactor the parser', wait: false, origin: { kind: 'composer' } })
    expect(seen[0].prompt).toContain('Current: sonnet')
    expect(seen[0].system).toContain('Opus at medium does about what Sonnet does at high')
  })

})

describe('judge benchmark', () => {
  const c = (id: string, ok: ('low' | 'medium' | 'high')[], message = 'do a thing please') =>
    ({ id, kind: 'k', current: { model: 'sonnet', effort: 'medium' }, message, ok }) as never

  test('grades an answer as right, too low, too high or missing', () => {
    expect(benchGrade(c('a', ['medium', 'high']), 'high')).toBe('hit')
    expect(benchGrade(c('a', ['medium', 'high']), 'low')).toBe('under')
    expect(benchGrade(c('a', ['low']), 'xhigh')).toBe('over')
    expect(benchGrade(c('a', ['low']), undefined)).toBe('none')
  })

  test('the report counts per judge and lists the misses', () => {
    const cases = [c('a', ['low']), c('b', ['high'])]
    const report = benchReport(cases, [
      { id: 'a', judge: 'haiku', effort: 'low', ms: 300, tokens: 10 },
      { id: 'b', judge: 'haiku', effort: 'medium', ms: 500, tokens: 10 },
    ])
    expect(report).toContain('| haiku | 50% | 1 | 0 | 0 | 500 |')
    expect(report).toContain('haiku b: said medium, wanted high')
  })

  test('/mistif:hud bench runs every case through Haiku, keeps follow-ups, and writes the report', async ($, on) => {
    engine(on)
    mock.clock(on)
    const asked = judgeSays(on, '{"model":"sonnet","effort":"low","why":"x"}')
    const cases = { cases: [c('a', ['low'], 'rename foo to bar in utils.ts'), c('f', ['medium'], 'go')] }
    on('fs.read', (_$, e) => ({ value: String(e.path).endsWith('judge-cases.json') ? JSON.stringify(cases) : '' }) as never)
    const written: Record<string, string> = {}
    on('fs.write', (_$, e) => {
      written[String(e.path)] = String(e.text)
      return { value: undefined } as never
    })
    on('session.start', (_$, e) => ({ cwd: e.cwd }) as never)
    on('command.register', () => ({ value: undefined }) as never)
    await $.session.start({ cwd: '.', surface: 'desktop', isInteractive: true } as never)
    const res = await $.command.run({ command: 'hud', args: 'bench' })
    expect(asked.length).toBe(1)
    expect(res.text).toContain('| haiku | 100% |')
    expect(res.text).toContain('| always medium |')
    expect(Object.keys(written).some(p => p.endsWith('.md'))).toBe(true)
  })
})

describe('short answers to a question', () => {
  test('a short reply after a question goes to the judge; between two steps it keeps the effort', () => {
    const asked = 'user: tidy up\nassistant: Done. Should I archive it?'
    const told = 'user: add export\nassistant: Added the button. Next I wire it up.'
    expect(endsOnQuestion(asked)).toBe(true)
    expect(endsOnQuestion(told)).toBe(false)
    expect(endsOnQuestion('')).toBe(false)
    expect(keepsEffort('yes', asked)).toBe(false)
    expect(keepsEffort('go', told)).toBe(true)
    expect(keepsEffort('build the whole thing', told)).toBe(false)
  })

  test('"yes" to "should I archive it?" is judged, not kept', async ($, on) => {
    const said: { role: string; text: string }[] = []
    engine(on, {}, 'claude-sonnet-5-5', said)
    mock.clock(on)
    const asked = judgeSays(on, '{"model":"sonnet","effort":"high","why":"x"}')
    await $.prompt.submit({ text: 'refactor the sync engine end to end', wait: false, origin: { kind: 'composer' } })
    said.push({ role: 'assistant', text: 'Done. Should I archive the old branch?' })
    await $.prompt.submit({ text: 'yes', wait: false, origin: { kind: 'composer' } })
    expect(asked.length).toBe(2)
  })

})

describe('images', () => {
  test('the judge is told what the message carries', () => {
    expect(withAttachments('fix this', [{ type: 'image' }, { type: 'image' }])).toContain('[The message comes with 2 images to look at.]')
    expect(withAttachments('fix this')).toBe('fix this')
  })

  test('"fix this" with a screenshot is judged, not kept as a follow-up', async ($, on) => {
    engine(on, {}, 'claude-sonnet-5-5')
    mock.clock(on)
    const asked = judgeSays(on, '{"model":"sonnet","effort":"medium","why":"x"}')
    await $.prompt.submit({ text: 'refactor the sync engine end to end', wait: false, origin: { kind: 'composer' } })
    await $.prompt.submit({ text: 'fix this', wait: false, origin: { kind: 'composer' }, attachments: [{ type: 'image', mediaType: 'image/png' }] } as never)
    expect(asked.length).toBe(2)
    expect(asked[1]).toContain('1 image')
  })
})

describe('handoff', () => {
  test('the first message carries the handoff and what to do next', () => {
    expect(handoffMessage(' the plan ', 'continue')).toBe(
      'Handoff from the previous chat:\n\nthe plan\n\nContinue with the next step. If it is marked "needs user", say what you need and wait.',
    )
    expect(handoffMessage('x', 'confirm')).toContain('then wait for me')
    // Full: the skill saved the handoff; its last words may only say so. The new chat reads what it saved first.
    const full = handoffMessage("I've saved the handoff.", 'continue', 'session-handoff')
    expect(full).toContain('it ran /session-handoff')
    expect(full).toContain('First read the handoff /session-handoff saved')
    expect(full).toContain('HANDOFF.md')
    expect(full).toContain('Continue with the next step')
  })

  test('the prompt asks for checked work, marked user steps and git as of last check', () => {
    expect(HANDOFF_PROMPT).toContain('needs user')
    expect(HANDOFF_PROMPT).toContain('as of last check')
    expect(HANDOFF_PROMPT).toContain('Never present something planned, skipped or untested as done')
    expect(HANDOFF_PROMPT).toContain('Do not use tools')
  })

  /** Starts a handoff the way the hud mod does: with the command. `keys` may hold 'handoff-full'; `after` names what follows. */
  async function handOff($: Engine, keys: string[] = [], after?: string) {
    await $.command.run({ command: 'hud', args: ['handoff', keys.includes('handoff-full') ? 'full' : '', after ?? ''].filter(Boolean).join(' ') })
  }

  /** Presses an answer on the card that asks whether to clear the chat, then lets the timer act on it. */
  async function answer($: Engine, mocked: { advance: (ms: number) => Promise<unknown> }, key: string) {
    let ask = await $.ui.mount(DESK_BAND)
    // The first-run guide comes before the card: closed here.
    if (await ask.find({ key: 'setup-close' })) {
      await ask.press({ key: 'setup-close' })
      await ask.unmount()
      ask = await $.ui.mount(DESK_BAND)
    }
    await ask.press({ key })
    await ask.unmount()
    await mocked.advance(1500)
  }

  function handoffEngine(on: On, said: { role: string; text: string }[] = []) {
    mock.store(on)
    mock.env(on, { EFFORTLESS_MODEL_UI: '1' })
    on('ui.status', () => ({ value: undefined }))
    on('session.messages', () => ({ value: said }) as never)
    on('session.model', () => ({ value: 'claude-opus-5-5' }))
    on('command.list', () => ({ value: [{ name: 'model' }, { name: 'effort' }] as never }))
    on('session.start', (_$, e) => ({ cwd: e.cwd }) as never)
    on('command.register', () => ({ value: undefined }) as never)
    const forked: string[] = []
    on('model.fork', (_$, e) => {
      forked.push(e.prompt)
      return { value: { isAnswered: true, text: 'Goal: quick.', usage: USAGE } } as never
    })
    const ran: string[] = []
    on('command.run', (_$, e) => {
      ran.push(e.command)
      return { text: 'ok' }
    })
    const submitted: string[] = []
    on('prompt.submit', (_$, e) => {
      submitted.push(e.text)
      return { text: e.text }
    })
    on('turn.complete', (_$, e) => ({ text: e.answer }))
    return { forked, ran, submitted }
  }

  test('on a cold cache, Quick is written by Haiku from the transcript, not a fork that rereads the chat', async ($, on) => {
    const { forked, submitted } = handoffEngine(on, [{ role: 'user', text: 'build the thing' }, { role: 'assistant', text: 'built it' }])
    const asked: string[] = []
    on('model.complete', (_$, e) => {
      asked.push(String(e.model))
      return { value: { isAnswered: true as const, text: `Goal: from Haiku. ${'x'.repeat(120)}`, usage: USAGE } }
    })
    const mocked = mock.clock(on)
    await $.session.start({ cwd: '.', surface: 'desktop', isInteractive: true } as never)
    await $.command.run({ command: 'hud', args: 'cold' })
    await handOff($, ['handoff-quick'])
    await mocked.advance(2500)
    expect(forked).toEqual([])
    expect(asked.some(m => m.includes('haiku'))).toBe(true)
    await answer($, mocked, 'handoff-clear')
    expect(submitted.some(t => t.includes('Goal: from Haiku'))).toBe(true)
  })

  test('with a skill set, Quick forks and Full runs the skill', { options: { handoffSkill: 'session-handoff' } } as never, async ($, on) => {
    const { forked, ran, submitted } = handoffEngine(on)
    const mocked = mock.clock(on)
    await $.session.start({ cwd: '.', surface: 'desktop', isInteractive: true } as never)
    await handOff($, ['handoff-quick'])
    await mocked.advance(2500)
    expect(forked).toEqual([HANDOFF_PROMPT])
    expect(ran).not.toContain('session-handoff')
    expect(ran).not.toContain('clear')
    await answer($, mocked, 'handoff-clear')
    expect(ran).toContain('clear')
    await handOff($, ['handoff-full'])
    await mocked.advance(1000)
    expect(ran).toContain('session-handoff')
    expect(forked).toHaveLength(1)
    // The skill's last words only say it saved the handoff: the new chat is told to read what it saved.
    await $.turn.complete({ turnId: 't2', answer: "I've saved the handoff.", durationMs: 1, isAborted: false, reason: 'answer' } as never)
    await mocked.advance(2500)
    await answer($, mocked, 'handoff-clear')
    expect(submitted.at(-1)).toContain('First read the handoff /session-handoff saved')
  })

  test("without a skill, Full is effortless's own: a turn that checks git and saves HANDOFF.md, no fork", async ($, on) => {
    const { forked, submitted } = handoffEngine(on)
    const mocked = mock.clock(on)
    await $.session.start({ cwd: '.', surface: 'desktop', isInteractive: true } as never)
    const said = await $.command.run({ command: 'hud', args: 'handoff full' })
    expect(said.text).toContain('saves HANDOFF.md')
    await mocked.advance(2500)
    expect(forked).toEqual([])
    expect(submitted.some(t => t.includes('Rewrite HANDOFF.md'))).toBe(true)
  })

  test('Keep chat & copy copies the handoff and clears nothing', async ($, on) => {
    const { ran, submitted } = handoffEngine(on)
    const copied: string[] = []
    on('ui.copy', (_$, e) => {
      copied.push(e.text)
      return { value: { isCopied: true } } as never
    })
    const mocked = mock.clock(on)
    await $.session.start({ cwd: '.', surface: 'desktop', isInteractive: true } as never)
    await handOff($, [], 'copy')
    await mocked.advance(2500)
    expect(copied).toHaveLength(1)
    expect(copied[0]).toContain('Goal: quick.')
    expect(copied[0]).toContain('Continue with the next step.')
    expect(ran).not.toContain('clear')
    expect(submitted).toEqual([])
  })

  test('a handoff card shows above the prompt, not under the reply: handing off, then landed, gone after the next message', async ($, on) => {
    handoffEngine(on)
    on('ui.copy', () => ({ value: { isCopied: true } }) as never)
    on('ui.render', { component: 'AssistantMessage' }, (h, e) => {
      const { Text } = h.ui.resolve(e)
      return Text({ children: e.props.text } as never) as never
    })
    const mocked = mock.clock(on)
    await $.session.start({ cwd: '.', surface: 'desktop', isInteractive: true } as never)
    const reply = (text: string) =>
      ({ plugin: 'mistif', surface: 'desktop', component: 'AssistantMessage', props: { text, isFirstOfReply: true } }) as never
    await $.turn.complete({ turnId: 't1', answer: 'Last reply.', durationMs: 1, isAborted: false, reason: 'answer' } as never)
    await handOff($, [], 'copy')
    const under = await $.ui.mount(reply('Last reply.'))
    expect(await under.find({ key: 'reply-handoff' })).toBeUndefined()
    await under.unmount()
    const during = await $.ui.mount(DESK_BAND)
    expect(await drawn(during)).toContain('Handing off')
    await during.unmount()
    await mocked.advance(2500)
    const landed = await $.ui.mount(DESK_BAND)
    expect(await drawn(landed)).toContain('Handoff copied')
    expect(await landed.find({ key: 'card-close' })).toBeDefined()
    await landed.unmount()
    await $.prompt.submit({ text: 'next', wait: false, origin: { kind: 'composer' } })
    await $.turn.complete({ turnId: 't2', answer: 'Next reply.', durationMs: 1, isAborted: false, reason: 'answer' } as never)
    // The card is gone: the band draws whatever else it has, or nothing.
    const after = await $.ui.mount(DESK_BAND).catch(() => null)
    expect(after ? await after.find({ key: 'reply-handoff' }) : undefined).toBeUndefined()
    await after?.unmount()
  })

  test('a written handoff clears nothing until you answer; Keep chat & copy leaves the chat alone', async ($, on) => {
    const { ran, submitted } = handoffEngine(on)
    const copied: string[] = []
    on('ui.copy', (_$, e) => {
      copied.push(e.text)
      return { value: { isCopied: true } } as never
    })
    const mocked = mock.clock(on)
    await $.session.start({ cwd: '.', surface: 'desktop', isInteractive: true } as never)
    await handOff($)
    await mocked.advance(60_000)
    expect(ran).not.toContain('clear')
    expect(submitted).toEqual([])
    expect(copied).toEqual([])
    await answer($, mocked, 'handoff-keep')
    expect(ran).not.toContain('clear')
    expect(submitted).toEqual([])
    expect(copied[0]).toContain('Goal: quick.')
  })

  test('Not now drops the written handoff: nothing cleared, nothing copied, and a new handoff can start', async ($, on) => {
    const { ran, forked } = handoffEngine(on)
    const copied: string[] = []
    on('ui.copy', (_$, e) => {
      copied.push(e.text)
      return { value: { isCopied: true } } as never
    })
    const mocked = mock.clock(on)
    await $.session.start({ cwd: '.', surface: 'desktop', isInteractive: true } as never)
    await handOff($)
    await mocked.advance(2500)
    await answer($, mocked, 'card-close')
    expect(ran).not.toContain('clear')
    expect(copied).toEqual([])
    await handOff($)
    await mocked.advance(2500)
    expect(forked).toHaveLength(2)
  })

  test('/mistif:hud handoff on the terminal asks too, and y clears', async ($, on) => {
    const { ran, submitted } = handoffEngine(on)
    const mocked = mock.clock(on)
    await $.session.start({ cwd: '.', surface: 'terminal', isInteractive: true } as never)
    const res = await $.command.run({ command: 'hud', args: 'handoff' })
    expect(res.text).toContain('Asks, then clears chat')
    await mocked.advance(2500)
    expect(ran).not.toContain('clear')
    const ask = await $.ui.mount({ plugin: 'mistif', surface: 'terminal', ...BAND } as never)
    expect(await drawn(ask)).toContain('Handoff ready')
    await ask.press({ key: 'handoff-clear' })
    await ask.unmount()
    await mocked.advance(1500)
    expect(ran).toContain('clear')
    expect(submitted.at(-1)).toContain('Goal: quick.')
  })

  test('if the clipboard refuses, the handoff goes in the prompt box', async ($, on) => {
    const { ran } = handoffEngine(on)
    on('ui.copy', () => ({ value: { isCopied: false, reason: 'no clipboard' } }) as never)
    const filled: string[] = []
    on('prompt.fill', (_$, e) => {
      filled.push(e.text)
      return { isFilled: true, text: e.text } as never
    })
    on('ui.toast', () => ({ value: undefined }) as never)
    const mocked = mock.clock(on)
    await $.session.start({ cwd: '.', surface: 'desktop', isInteractive: true } as never)
    await handOff($, [], 'copy')
    await mocked.advance(2500)
    expect(filled.join('')).toContain('Goal: quick.')
    expect(ran).not.toContain('clear')
  })

  test('the handoff is written by a fork: no turn in the chat, then cleared and sent', async ($, on) => {
    mock.store(on)
    mock.env(on, { EFFORTLESS_MODEL_UI: '1' })
    on('ui.status', () => ({ value: undefined }))
    on('session.messages', () => ({ value: [] }) as never)
    on('session.model', () => ({ value: 'claude-opus-5-5' }))
    on('command.list', () => ({ value: [{ name: 'model' }, { name: 'effort' }] as never }))
    on('session.start', (_$, e) => ({ cwd: e.cwd }) as never)
    on('command.register', () => ({ value: undefined }) as never)
    const forked: string[] = []
    on('model.fork', (_$, e) => {
      forked.push(e.prompt)
      return { value: { isAnswered: true, text: 'Goal: fork it. Next: ship.', usage: USAGE } } as never
    })
    const ran: string[] = []
    on('command.run', (_$, e) => {
      ran.push(e.command)
      return { text: 'ok' }
    })
    const submitted: string[] = []
    on('prompt.submit', (_$, e) => {
      submitted.push(e.text)
      return { text: e.text }
    })
    const mocked = mock.clock(on)
    await $.session.start({ cwd: '.', surface: 'desktop', isInteractive: true } as never)
    await handOff($)
    await mocked.advance(1000)
    expect(forked).toEqual([HANDOFF_PROMPT])
    expect(submitted).not.toContain(HANDOFF_PROMPT)
    await mocked.advance(1500)
    expect(ran).not.toContain('clear')
    await answer($, mocked, 'handoff-clear')
    expect(ran).toContain('clear')
    expect(submitted.at(-1)).toContain('Goal: fork it. Next: ship.')
  })

  test('without a fork (no reply yet, or it failed) the handoff is written as a turn, then cleared and sent', async ($, on) => {
    // engine() without its prompt.submit, so this test can see what the mod sends.
    mock.store(on)
    mock.env(on, { EFFORTLESS_MODEL_UI: '1' })
    on('ui.status', () => ({ value: undefined }))
    on('session.messages', () => ({ value: [] }) as never)
    on('session.model', () => ({ value: 'claude-opus-5-5' }))
    on('command.list', () => ({ value: [{ name: 'model' }, { name: 'effort' }] as never }))
    on('session.start', (_$, e) => ({ cwd: e.cwd }) as never)
    on('command.register', () => ({ value: undefined }) as never)
    const ran: string[] = []
    on('command.run', (_$, e) => {
      ran.push(e.command)
      return { text: 'ok' }
    })
    const submitted: string[] = []
    on('prompt.submit', (_$, e) => {
      submitted.push(e.text)
      return { text: e.text }
    })
    on('turn.complete', (_$, e) => ({ text: e.answer }))
    const mocked = mock.clock(on)
    await $.session.start({ cwd: '.', surface: 'desktop', isInteractive: true } as never)
    await handOff($)
    await mocked.advance(1000)
    expect(submitted.at(-1)).toBe(HANDOFF_PROMPT)
    await $.turn.complete({ turnId: 't9', answer: 'Goal: ship it. Next: tests.', durationMs: 1, isAborted: false, reason: 'answer' } as never)
    await mocked.advance(1500)
    expect(ran).not.toContain('clear')
    await answer($, mocked, 'handoff-clear')
    expect(ran).toContain('clear')
    expect(submitted.at(-1)).toContain('Goal: ship it. Next: tests.')
    expect(submitted.at(-1)).toContain('Continue with the next step.')
  })

  test('a fork that writes nothing says why: in a toast and in /mistif:hud debug, and the turn takes over', async ($, on) => {
    mock.store(on)
    mock.env(on, { EFFORTLESS_MODEL_UI: '1' })
    on('ui.status', () => ({ value: undefined }))
    on('session.messages', () => ({ value: [] }) as never)
    on('session.model', () => ({ value: 'claude-opus-5-5' }))
    on('command.list', () => ({ value: [{ name: 'model' }, { name: 'effort' }] as never }))
    on('session.start', (_$, e) => ({ cwd: e.cwd }) as never)
    on('command.register', () => ({ value: undefined }) as never)
    on('model.fork', () => ({ value: { isAnswered: false, reason: 'api-error', status: 529, error: 'overloaded', usage: USAGE } }) as never)
    on('command.run', () => ({ text: 'ok' }))
    const submitted: string[] = []
    on('prompt.submit', (_$, e) => {
      submitted.push(e.text)
      return { text: e.text }
    })
    const toasts: string[] = []
    on('ui.toast', (_$, e) => {
      toasts.push(String((e as { text?: string }).text ?? e))
      return { value: undefined } as never
    })
    const mocked = mock.clock(on)
    await $.session.start({ cwd: '.', surface: 'desktop', isInteractive: true } as never)
    await handOff($)
    await mocked.advance(1000)
    expect(submitted.at(-1)).toBe(HANDOFF_PROMPT)
    expect(toasts.join(' ')).toContain('api-error 529 overloaded')
    const debug = String((await $.command.run({ command: 'hud', args: 'debug' })).text)
    expect(debug).toContain('last fork: api-error 529 overloaded')
  })

  test('the fork outcome names the reason, or what an answer cost', () => {
    expect(forkOutcome({ isAnswered: false, reason: 'nothing-to-fork' }, 0)).toBe('nothing-to-fork (0.0s)')
    expect(forkOutcome({ isAnswered: false, reason: 'aborted', usage: USAGE }, 2500)).toBe('aborted (2.5s)')
    expect(forkOutcome({ isAnswered: false, reason: 'api-error', status: null, error: 'unknown', usage: USAGE }, 0)).toBe('api-error no response unknown (0.0s)')
    expect(forkOutcome(new Error('refused from a timer'), 100)).toBe('threw: refused from a timer (0.1s)')
    const usage = { input_tokens: 10, output_tokens: 700, cache_read_input_tokens: 90, cache_creation_input_tokens: 0 }
    expect(forkOutcome({ isAnswered: true, text: 'Goal', usage }, 4000)).toBe('answered, 700 out, 90% cached (4.0s)')
    expect(forkOutcome({ isAnswered: true, text: '  ', usage }, 0)).toBe('answered with blank text (0.0s)')
  })
})

describe('a chat opened again', () => {
  const start = async ($: Engine, on: On) => {
    on('session.start', (_$, e) => ({ cwd: e.cwd }) as never)
    on('command.register', () => ({ value: undefined }) as never)
    on('classic.SessionStart', () => ({}) as never)
    await $.session.start({ cwd: '.', surface: 'desktop', isInteractive: true } as never)
  }

  test('two hours after its last response: the cache shows cold at once', async ($, on) => {
    engine(on)
    on('session.usage', () => ({ value: { context: { tokens: 200_000, window: 1_000_000, percent: 20 } } }) as never)
    mock.clock(on)
    await start($, on)
    await $.classic.SessionStart({ source: 'resume', seconds_since_last_response: 7200, prompt_cache_likely_expired: true } as never)
    expect(await left($)).toBe(0)
  })

  test('ten minutes after: the countdown goes on from where it was', async ($, on) => {
    engine(on)
    mock.clock(on)
    await start($, on)
    await $.classic.SessionStart({ source: 'resume', seconds_since_last_response: 600, prompt_cache_likely_expired: false } as never)
    expect([50, 51]).toContain(await left($))
  })
})

describe('a message typed while a turn runs', () => {
  /** The judge answers with whatever `says.effort` holds at the time. */
  function judgeSaysNow(on: On, says: { effort: string }) {
    const asked: string[] = []
    on('model.complete', (_$, e) => {
      asked.push(e.prompt)
      return { value: { isAnswered: true as const, text: `{"model":"opus","effort":"${says.effort}","why":"x"}`, usage: USAGE } }
    })
    return asked
  }
  /** One request of turn `turnId` at request `index`. */
  async function stepOf($: Engine, turnId: string, index: number) {
    for await (const _ of $.turn.step({ turnId, index, model: 'claude-opus-5-5', effort: 'high', messageCount: 1 })) {
      // drain
    }
  }

  test('a lower verdict never lowers the running turn; it takes the next one', { options: { effortFloor: 'low' } } as never, async ($, on) => {
    engine(on)
    const says = { effort: 'high' }
    const asked = judgeSaysNow(on, says)
    const sent = recordSteps(on)
    mock.clock(on)
    on('turn.complete', () => ({ text: '' }) as never)

    await $.prompt.submit({ text: 'refactor the whole auth module across the app', wait: false, origin: { kind: 'composer' } })
    await stepOf($, 't1', 0)
    says.effort = 'low'
    await $.prompt.submit({ text: 'also rename the helper you made', wait: false, turnId: 't1', origin: { kind: 'composer' } } as never)
    await stepOf($, 't1', 1)
    await $.turn.complete({ turnId: 't1', answer: '', durationMs: 1, isAborted: false, reason: 'completed' } as never)
    await stepOf($, 't2', 0)

    expect(asked.length).toBe(2)
    // The judge is told the message came in while the task ran.
    expect(asked[1]).toContain('still working')
    expect(sent.map(s => s.effort)).toEqual(['high', 'high', 'low'])
  })

  test('a higher verdict raises the running turn at once', { options: { effortFloor: 'low' } } as never, async ($, on) => {
    engine(on)
    const says = { effort: 'low' }
    judgeSaysNow(on, says)
    const sent = recordSteps(on)

    await $.prompt.submit({ text: 'fix the typo in the readme', wait: false, origin: { kind: 'composer' } })
    await stepOf($, 't1', 0)
    says.effort = 'high'
    await $.prompt.submit({ text: 'actually go through every doc and fix them all', wait: false, turnId: 't1', origin: { kind: 'composer' } } as never)
    await stepOf($, 't1', 1)

    expect(sent.map(s => s.effort)).toEqual(['low', 'high'])
  })

  test('Auto switched off or on mid-turn leaves the running turn at its effort', async ($, on) => {
    engine(on)
    const says = { effort: 'high' }
    judgeSaysNow(on, says)
    const sent = recordSteps(on)
    const auto = () => $.command.run({ command: 'hud', args: 'auto' })

    await $.prompt.submit({ text: 'refactor the whole auth module across the app', wait: false, origin: { kind: 'composer' } })
    await stepOf($, 't1', 0)
    expect(String((await auto()).text)).toContain('Auto off')
    await stepOf($, 't1', 1)
    expect(String((await auto()).text)).toContain('Auto on')
    await stepOf($, 't1', 2)

    expect(sent.map(s => s.effort)).toEqual(['high', 'high', 'high'])
  })
})
