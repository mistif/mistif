// Tests for the agents pane: it opens with the first running subagent, lists it, and closes after the last one ends.
import { describe, expect, mock, test } from 'claude-code/testing'
import type { On } from 'claude-code'
import type { Engine } from 'claude-code/testing'

type Agent = { id: string; description: string; type: string; status: string }

function engine(on: On, agents: { list: Agent[] }, calls: string[]) {
  const clock = mock.clock(on)
  mock.env(on, { HOME: '/home/user' })
  on('agent.list', () => ({ value: agents.list }) as never)
  on('ui.open', (_$, e) => { calls.push(`open ${(e as { id: string }).id}`); return { value: undefined } as never })
  on('ui.close', (_$, e) => { calls.push(`close ${(e as { id: string }).id}`); return { value: undefined } as never })
  on('command.register', () => ({ value: undefined }) as never)
  on('session.start', (_$, e) => ({ cwd: e.cwd }) as never)
  return clock
}
const start = ($: Engine) => $.session.start({ cwd: '.', surface: 'desktop', isInteractive: true } as never)
const pane = async ($: Engine) =>
  JSON.stringify(await (await $.ui.mount({ plugin: 'mistif', surface: 'desktop', component: 'Pane', requestId: 'agents', props: {} } as never)).drawn())

describe('agents pane', () => {
  test('with no agents it says so and stays closed', async ($, on) => {
    const calls: string[] = []
    engine(on, { list: [] }, calls)
    await start($)
    expect(await pane($)).toContain('No subagents running.')
    expect(calls).toEqual([])
  })

  test('a running agent opens the pane and is listed with its state', async ($, on) => {
    const calls: string[] = []
    const agents = { list: [{ id: 'a1', description: 'Check the tests', type: 'general-purpose', status: 'running' }] }
    const clock = engine(on, agents, calls)
    await start($)
    await clock.advance(1500)
    expect(calls).toContain('open agents')
    const text = await pane($)
    expect(text).toContain('Check the tests')
    expect(text).toContain('1 working')
  })

  test('the pane closes a while after the last agent ends, and the agent shows as done', async ($, on) => {
    const calls: string[] = []
    const agents = { list: [{ id: 'a1', description: 'Check the tests', type: 'general-purpose', status: 'running' }] as Agent[] }
    const clock = engine(on, agents, calls)
    await start($)
    await clock.advance(1500)
    agents.list = []
    await clock.advance(5000)
    expect(calls).not.toContain('close agents')
    await clock.advance(6000)
    expect(calls).toContain('close agents')
    expect(await pane($)).toContain('1 done')
  })

  test('/agents-pane opens it on demand', async ($, on) => {
    const calls: string[] = []
    engine(on, { list: [] }, calls)
    await start($)
    const res = await $.command.run({ command: 'agents-pane', args: '' })
    expect(calls).toContain('open agents')
    expect(String(res.text)).toContain('Agents pane opened')
  })
})
