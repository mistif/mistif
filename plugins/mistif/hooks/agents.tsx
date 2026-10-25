import { atom, read, update } from 'claude-code'

import type { Row } from '../types'

// The agents pane, written here: a side pane that lists this session's subagents
// live (what each does, its state, how long it has run). It opens with the first agent and closes after the last.
const PANE = 'agents'
const VIOLET = '#a79cf7'
const YELLOW = '#e0a33a'
const RED = '#e5534b'
const EDGE = '#2a2a2f'
const WIDTH = 30 // columns the dock asks for; the app may keep the width the person dragged it to
const CLOSE_AFTER = 8000 // ms the pane stays after the last agent ends
const TICK = 700 // ms: also the animation frame while an agent runs
const SPIN = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏']
const SCAN = 10 // cells in the little sweeping bar under a running agent
const LIVE = ['pending', 'running', 'waiting', 'idle']

const rows = atom({ plugin: 'mistif', key: 'agentRows' } as const, [] as Row[])

// a block that sweeps left to right and back, three cells wide
const sweep = (frame: number) => {
  const reach = SCAN - 3
  const p = frame % (reach * 2)
  const at = p <= reach ? p : reach * 2 - p
  return Array.from({ length: SCAN }, (_, i) => (i >= at && i < at + 3 ? '▰' : '▱')).join('')
}
const span = (ms: number) => {
  const s = Math.max(0, Math.round(ms / 1000))
  return s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${String(s % 60).padStart(2, '0')}s`
}
const tint = (status: string) =>
  status === 'running' ? VIOLET : status === 'failed' || status === 'killed' ? RED : status === 'completed' ? undefined : YELLOW

export async function agentsSessionStart($: any, e: any, next: any) {
  await $.command.register({ name: 'agents-pane', description: 'Show the live subagents pane' }).catch(() => undefined)
  let isOpen = false
  let idleSince = 0
  // the agent list is a snapshot, so poll it; the write redraws the pane only when something changed
  $.clock.every(TICK, async () => {
    const now = await $.clock.now()
    const live = await $.agent.list()
    // the pane exists only while agents work: it opens with the first one and closes a few seconds after the last
    if (live.some((a: any) => LIVE.includes(a.status))) {
      idleSince = 0
      if (!isOpen) {
        isOpen = true
        void $.ui.open({ id: PANE, title: 'Agents', columns: WIDTH })
      }
    } else if (isOpen) {
      idleSince ||= now
      if (now - idleSince > CLOSE_AFTER) {
        isOpen = false
        void $.ui.close({ id: PANE })
      }
    }
    await update($, rows, (old: Row[]) => {
      const seen = new Map(old.map(r => [r.id, r]))
      const fresh: Row[] = live.map((a: any) => {
        const was = seen.get(a.id)
        seen.delete(a.id)
        const ended = !LIVE.includes(a.status)
        return {
          id: a.id,
          description: a.description,
          type: a.type,
          name: a.name,
          status: a.status,
          startedAt: was?.startedAt ?? now,
          endedAt: ended ? (was?.endedAt ?? now) : undefined,
        }
      })
      // an agent the engine dropped is shown as done, the last 8 are kept
      for (const gone of seen.values()) fresh.push({ ...gone, status: LIVE.includes(gone.status) ? 'completed' : gone.status, endedAt: gone.endedAt ?? now })
      // while any agent is live the timers must tick, so redraw; with none live, redraw only on a change
      const same = JSON.stringify(fresh.map(r => [r.id, r.status])) === JSON.stringify(old.map(r => [r.id, r.status]))
      return same && !fresh.some(r => LIVE.includes(r.status)) ? old : fresh.slice(-8)
    })
  })
  return next(e)
}

export async function agentsCommand($: any, e: any, next: any) {
  if (!['agents-pane', 'mistif:agents-pane'].includes(e.command)) return next(e)
  await $.ui.open({ id: PANE, title: 'Agents', columns: WIDTH })
  return { text: 'Agents pane opened. It closes itself a few seconds after the last agent ends.' }
}

export async function agentsPane($: any, e: any) {
  const { Box, Text } = $.ui.resolve(e)
  const list: Row[] = await read($, rows)
  const now = await $.clock.now()
  const frame = Math.floor(now / TICK)
  const busy = list.filter(r => LIVE.includes(r.status)).length

  return (
    <Box flexDirection="column" gap={1}>
      <Text dimColor>{list.length ? `${busy} working · ${list.length - busy} done` : 'No subagents running.'}</Text>
      {[...list].reverse().map(r => (
        <Box key={r.id} flexDirection="column" paddingX={1} borderStyle="round" borderColor={LIVE.includes(r.status) ? VIOLET : EDGE}>
          <Box flexDirection="row" gap={1}>
            <Text color={tint(r.status)} bold>{r.status === 'running' ? `${SPIN[frame % SPIN.length]} ` : ''}{r.status}</Text>
            <Box flexGrow={1} />
            <Text dimColor>{span((r.endedAt ?? now) - r.startedAt)}</Text>
          </Box>
          <Text bold={LIVE.includes(r.status)} dimColor={!LIVE.includes(r.status)}>{r.description || '(no description)'}</Text>
          {r.status === 'running' ? <Text color={VIOLET}>{sweep(frame)}</Text> : null}
          <Text dimColor>{[r.type, r.name].filter(Boolean).join(' · ')}</Text>
        </Box>
      ))}
    </Box>
  )
}
