// Tests for the explain mod's hook: a typed /command becomes the plain-words note above the prompt. No model is called:
// its replies are stubbed. The lookup script it asks (explain.py) is tested in explain_script_test.py, since a test file
// here cannot start a real process.
import { describe, expect, mock, test } from 'claude-code/testing'
import type { On } from 'claude-code'
import type { Engine } from 'claude-code/testing'

describe('the note above the prompt', () => {
  const LIST = JSON.stringify([
    ['pl:alpha', 'Alpha does the alpha thing. More text.'],
    ['pl:alphabet', 'Longer.'],
  ])
  const BAND = { hasSurvey: false, isWorking: false, maxRows: 12, bodyColumns: 100, scroll: { offset: 0, bodyRows: 12 }, view: {} }

  function engine(on: On, store = new Map<string, unknown>(), asked: string[] = []) {
    on('store.get', (_$, e) => ({ value: store.get(e.key) }) as never)
    on('store.set', (_$, e) => {
      store.set(e.key, e.value)
      return { value: undefined } as never
    })
    mock.clock(on)
    mock.env(on, { HOME: '/home/user' })
    on('process.run', (_$, e) => ({ value: { exitCode: 0, stdout: JSON.stringify(e).includes('--all') ? LIST : '', stderr: '' } }) as never)
    on('model.complete', (_$, e) => {
      asked.push(String(e.prompt))
      return { value: { isAnswered: true as const, text: 'Does the alpha thing.', usage: {} } } as never
    })
    on('session.start', (_$, e) => ({ cwd: e.cwd }) as never)
    on('prompt.submit', (_$, e) => ({ text: e.text }))
    on('ui.status', () => ({ value: undefined }))
    on('session.messages', () => ({ value: [] }) as never)
    on('session.model', () => ({ value: 'claude-opus-5-5' }))
    on('command.list', () => ({ value: [{ name: 'model' }, { name: 'effort' }] as never }))
    on('command.register', () => ({ value: undefined }) as never)
    on('fs.read', () => ({ value: '' }) as never)
    on('fs.write', () => ({ value: undefined }) as never)
    on('session.usage', () => ({ value: { cost: { usd: 1 }, context: { percent: 1 }, rateLimits: [] } }) as never)
    return store
  }
  // The index is read in the background at session start; wait for it before typing.
  const start = async ($: Engine) => {
    await $.session.start({ cwd: '.', surface: 'desktop', isInteractive: true } as never)
    await new Promise(r => setTimeout(r, 100))
  }
  const shown = async ($: Engine) =>
    JSON.stringify(await (await $.ui.mount({ plugin: 'mistif', surface: 'desktop', component: 'AbovePrompt', props: BAND } as never)).drawn())
  const type = ($: Engine, text: string) => $.prompt.submit({ text, wait: false, origin: { kind: 'composer' } })

  test('a typed /command shows the skill and its saved plain-words line', async ($, on) => {
    engine(on, new Map([['plain2:pl:alpha', 'Saved line.']]))
    await start($)
    await type($, '/alpha')
    expect(await shown($)).toContain('pl:alpha: Saved line.')
  })

  test('no saved line yet: the model is asked once and its line is saved', async ($, on) => {
    const asked: string[] = []
    const store = engine(on, new Map(), asked)
    await start($)
    store.clear()
    asked.length = 0
    await type($, '/alpha')
    expect(await shown($)).toContain('pl:alpha: Does the alpha thing.')
    expect(asked.length).toBe(1)
    expect(store.get('plain2:pl:alpha')).toBe('Does the alpha thing.')
  })

  test('text that is not a /command clears the note', async ($, on) => {
    engine(on, new Map([['plain2:pl:alpha', 'Saved line.']]))
    await start($)
    await type($, '/alpha')
    await type($, 'just a question')
    expect(await shown($)).not.toContain('pl:alpha')
  })

  test('a name nothing matches shows no note', async ($, on) => {
    engine(on)
    await start($)
    await type($, '/nosuchskill')
    expect(await shown($)).not.toContain('nosuchskill')
  })
})
