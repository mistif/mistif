import { atom, read } from 'claude-code'

import { LEAN_LEVELS, currentLean } from './lean'
import { pluginKey, settingsFile, writeSettings } from './settings'

// Look adapted from Effortless (MIT, HeyCubit): a dark rounded panel, art pinned to the right edge, ember colours near a limit.
const VIOLET = '#a79cf7'
const VIOLET_ART = '#7c6cf0'
const EMBER = '#f08a3c'
const BG = '#141416'
const EDGE = '#2a2a2f'
const EMBER_BG = '#1a110c'
const EMBER_EDGE = '#6a3418'

// Effortless's own state (read-only), for the footer row we draw ourselves.
const efIsAuto = atom({ plugin: 'mistif', key: 'isAuto' } as const, null)
const efPick = atom({ plugin: 'mistif', key: 'pick' } as const, null)
const efAppEffort = atom({ plugin: 'mistif', key: 'appEffort' } as const, null)
const efCacheLeft = atom({ plugin: 'mistif', key: 'cacheLeft' } as const, null)
const efModel = atom({ plugin: 'mistif', key: 'model' } as const, null)
const efPaused = atom({ plugin: 'mistif', key: 'paused' } as const, null)
const efJudging = atom({ plugin: 'mistif', key: 'isJudging' } as const, null)
const efSwitched = atom({ plugin: 'mistif', key: 'switched' } as const, null)
const efAdvice = atom({ plugin: 'mistif', key: 'handoffAdvice' } as const, null)
const efSaving = atom({ plugin: 'mistif', key: 'saveUntil' } as const, null)
const efCompacting = atom({ plugin: 'mistif', key: 'isCompacting' } as const, null)
const ICE = '#7cc4ff'
const YELLOW = '#e0a33a'
const RED = '#e5534b'
const LABELS: Record<string, string> = { low: 'Low', medium: 'Medium', high: 'High', xhigh: 'XHigh', max: 'Max' }

// The band's own numbers, counted from each finished turn: nothing is read from another plugin.
let ownTurns = 0
let ownBusy = 0
let ownCost = 0
let ownCosts: number[] = []
let ownTokens = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 }

const clock = (iso?: string) => (iso ? new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }) : '')
const span = (ms: number) => (ms >= 3_600_000 ? `${Math.floor(ms / 3_600_000)}h ${Math.floor((ms % 3_600_000) / 60_000)}m` : `${Math.floor(ms / 60_000)}m ${Math.floor((ms % 60_000) / 1000)}s`)
const big = (n: number) => (n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `${(n / 1e3).toFixed(1)}k` : String(Math.round(n)))
const usd = (n: number) => `$${n.toFixed(2)}`

// The settings card: edits the options Effortless stores in settings.json (pluginConfigs), then reloads plugins.
const EFFORTS = ['low', 'medium', 'high', 'xhigh', 'max']
const FIELDS = [
  { key: 'effortFloor', label: 'Effort floor', values: EFFORTS },
  { key: 'effortCeiling', label: 'Effort ceiling', values: EFFORTS },
  { key: 'effortBias', label: 'Lean (cheaper to smarter)', values: ['-2', '-1', '0', '1', '2'] },
  { key: 'handoffAfter', label: 'After handoff', values: ['continue', 'confirm', 'copy'] },
  { key: 'usage', label: 'Usage', values: ['full', 'lite'] },
  { key: 'contextCheck', label: 'Context check', values: ['on', 'off'] },
]
const HINTS: Record<string, string> = {
  effortFloor: 'lowest effort mistif will pick',
  effortCeiling: 'highest effort mistif will pick',
  effortBias: 'nudge every choice: -2 cheapest, 2 smartest',
  handoffAfter: 'what happens once a handoff is written',
  usage: 'lite adds one short line to the system prompt: cheap defaults',
  contextCheck: 'off: past 30% of context, no recent messages go to Haiku',
}
const AFTER: Record<string, string> = {
  continue: 'asks, then clears',
  confirm: 'asks first, always',
  copy: 'copies, keeps chat',
}
const USAGE: Record<string, string> = {
  full: 'nothing added, every skill at full depth',
  lite: 'inline or one agent, no peer review, short outputs',
}
const DEFAULTS: Record<string, string> = { effortFloor: 'medium', effortCeiling: 'max', effortBias: '0', handoffAfter: 'continue', usage: 'full', contextCheck: 'on' }
let settingsOpen = false
let settingsCard: 'effort' | 'handoff' | 'usage' | null = null
let draft: Record<string, string> = { ...DEFAULTS }
let saved: Record<string, string> = { ...DEFAULTS }

// Set when settings.json cannot be read or parsed: the card says so and Save stays off, so the panel never shows
// defaults as if they were what is on disk.
let cfgError = ''

async function loadCfg($: any) {
  cfgError = ''
  try {
    const s = JSON.parse(String(await $.fs.read(await settingsFile($))))
    saved = { ...DEFAULTS, ...(s.pluginConfigs?.[pluginKey($)]?.options ?? {}) }
  } catch (e: any) {
    saved = { ...DEFAULTS }
    cfgError = `can't read settings.json (${String(e?.message ?? e).slice(0, 60)})`
  }
  draft = { ...saved }
}

async function saveCfg($: any) {
  try {
    await writeSettings($, s => {
      const opts = (((s.pluginConfigs ??= {})[pluginKey($)] ??= {}).options ??= {})
      for (const [k, v] of Object.entries(draft)) if (v !== saved[k]) opts[k] = v
      return true
    })
  } catch (e: any) {
    cfgError = `not saved: ${String(e?.message ?? e).slice(0, 80)}`
    $.ui.toast(`mistif settings ${cfgError}`)
    $.ui.invalidate('ui.render')
    return
  }
  cfgError = ''
  settingsOpen = false
  $.ui.toast('mistif settings saved, reloading plugins')
  await $.command.run({ command: 'reload-plugins', args: '--force' } as never).catch(() => undefined)
  $.ui.invalidate('ui.render')
}

// Cost per turn as small bars; the newest bar is the brightest.
function bars(values: number[]): string {
  const v = values.slice(-20)
  const max = Math.max(...v, 0.0001)
  const w = 3
  const gap = 2
  const rects = v
    .map((x, i) => {
      const h = Math.max(2, Math.round((22 * x) / max))
      const last = i === v.length - 1
      return `<rect x="${i * (w + gap)}" y="${22 - h}" width="${w}" height="${h}" rx="1" fill="${last ? '#c9bdff' : VIOLET_ART}" opacity="${last ? 1 : 0.7}"/>`
    })
    .join('')
  const width = Math.max(1, v.length * (w + gap))
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="22" viewBox="0 0 ${width} 22">${rects}</svg>`
}

// The wash and sparkles on the right edge, in the same shape as Effortless's: transparent on the left, warm or violet on the right.
const art = (hot: boolean) => {
  const a = hot ? '#b8461b' : VIOLET_ART
  const b = hot ? '#f08a3c' : '#b3a6ff'
  return `<svg xmlns="http://www.w3.org/2000/svg" width="440" height="64" viewBox="0 0 360 30" preserveAspectRatio="xMaxYMid slice"><style>.s{fill:#fff;animation:t 4s ease-in-out infinite}@keyframes t{0%,100%{opacity:.15}50%{opacity:.85}}</style><defs><linearGradient id="g" x1="0" x2="1"><stop offset=".43" stop-color="${a}" stop-opacity="0"/><stop offset=".62" stop-color="${a}" stop-opacity=".16"/><stop offset=".85" stop-color="${b}" stop-opacity=".3"/><stop offset="1" stop-color="${b}" stop-opacity=".44"/></linearGradient></defs><rect width="360" height="30" fill="url(#g)"/><circle class="s" cx="300" cy="9" r="1"/><circle class="s" cx="326" cy="20" r="1.2" style="animation-delay:1.3s"/><circle class="s" cx="344" cy="8" r=".9" style="animation-delay:2.4s"/></svg>`
}

// What the footer row says, as plain data: the other plugin's numbers in, a list of words and buttons out.
export type FooterState = { auto: unknown; pick: any; app: unknown; cache: unknown; model: unknown; paused: unknown; judging: unknown; switched: any; advice: unknown; saving: unknown; compacting: unknown; modes: string[] }
export type FooterItem = { text: string; color?: string; bold?: boolean; dim?: boolean } | { button: 'auto' | 'settings' | 'handoff'; label: string }
export function footerItems(s: FooterState): FooterItem[] {
  // Auto counts as on until the other plugin says otherwise: unknown must never read as Off.
  const on = s.auto !== false
  const level = String(s.pick?.effort ?? s.app ?? '')
  const shown = s.model === 'haiku' ? '' : LABELS[level] ?? ''
  const label = s.compacting ? 'Compacting…' : s.judging ? 'Deciding…' : s.switched ? `${LABELS[s.switched.from]} → ${LABELS[s.switched.to]}` : shown || 'Auto'
  const left = typeof s.cache === 'number' && Number.isFinite(s.cache) ? s.cache : null
  const cacheColor = left === null ? undefined : left <= 0 ? ICE : left - 1 <= 5 ? RED : left - 1 <= 20 ? YELLOW : undefined
  const cacheText = left === null ? '' : left <= 0 ? '❄ Cold' : left === 1 ? '<1m' : `${left - 1}m`
  const items: FooterItem[] = []
  if (s.modes.length > 0) items.push({ text: s.modes.join(' & '), dim: true })
  items.push(on && s.paused ? { text: ' Paused ', dim: true } : on ? { text: ` ${label} `, color: s.saving ? EMBER : VIOLET, bold: true } : { text: ' Off ', dim: true })
  items.push({ button: 'auto', label: ' ⏻ ' }, { button: 'settings', label: ' ⚙︎ ' }, { button: 'handoff', label: ' ⇥ ' })
  if (typeof s.advice === 'string' && s.advice) items.push({ text: `handoff? ${s.advice.slice(0, 40)}`, color: EMBER })
  if (cacheText) items.push(cacheColor ? { text: cacheText, color: cacheColor } : { text: cacheText, dim: true })
  return items
}

export async function hudTurnComplete($: any, e: any, next: any) {
  const u = e.usage
  if (u) {
    // A subagent's tokens count; its cost is already in the session cost the main turn reads.
    ownTokens = {
      input: ownTokens.input + (u.input_tokens ?? 0),
      output: ownTokens.output + (u.output_tokens ?? 0),
      cacheRead: ownTokens.cacheRead + (u.cache_read_input_tokens ?? 0),
      cacheWrite: ownTokens.cacheWrite + (u.cache_creation_input_tokens ?? 0),
    }
  }
  if (e.agentId === undefined) {
    const usage = await $.session.usage().catch(() => undefined)
    const cost = usage?.cost?.usd
    if (typeof cost === 'number') {
      // A total below the last one means the ledger started over: that total is the turn.
      ownCosts = [...ownCosts, cost >= ownCost ? cost - ownCost : cost].slice(-20)
      ownCost = cost
    }
    ownBusy += e.durationMs ?? 0
    ownTurns += 1
    $.ui.invalidate('ui.render')
  }
  return next(e)
}

// The footer row under the prompt, drawn by us in Effortless's place (its own footer is switched off in the
// installed copy): modes, effort, power, settings, handoff, cache timer. The numbers still come from Effortless.
export async function hudSessionMode($: any, e: any, next: any) {
  if (e.surface !== 'desktop') return next(e)
  const [auto, pick, app, cache, model, paused, judging, switched, advice, saving, compacting] = await Promise.all([
    read($, efIsAuto as any).catch(() => null),
    read($, efPick as any).catch(() => null),
    read($, efAppEffort as any).catch(() => null),
    read($, efCacheLeft as any).catch(() => null),
    read($, efModel as any).catch(() => null),
    read($, efPaused as any).catch(() => null),
    read($, efJudging as any).catch(() => null),
    read($, efSwitched as any).catch(() => null),
    read($, efAdvice as any).catch(() => null),
    read($, efSaving as any).catch(() => null),
    read($, efCompacting as any).catch(() => null),
  ]) as any[]
  const { Box, Text, Button } = $.ui.resolve(e) as any
  const modes: string[] = Array.isArray((e.props as any)?.modes) ? (e.props as any).modes : []
  const run = (command: string, args = '') => async () => {
    await $.command.run({ command, args }).catch(() => undefined)
    $.ui.invalidate('ui.render')
  }
  const press: Record<string, () => unknown> = {
    auto: run('mistif:hud', 'auto'),
    settings: async () => { await loadCfg($); settingsCard = null; settingsOpen = true; $.ui.invalidate('ui.render') },
    handoff: run('mistif:hud', 'handoff'),
  }
  const items = footerItems({ auto, pick, app, cache, model, paused, judging, switched, advice, saving, compacting, modes })
  return (
    <Box flexDirection="row" gap={1} alignItems="center">
      {items.map((it, i) =>
        'button' in it ? (
          <Button key={it.button} plain dimColor label={it.label} onPress={press[it.button]} />
        ) : (
          <Text key={`t${i}`} color={it.color} bold={it.bold} dimColor={it.dim}>{it.text}</Text>
        ),
      )}
    </Box>
  )
}

export async function hudAbovePrompt($: any, e: any, next: any) {
  // other mods share this slot: draw ours beside theirs, never instead of them
  const below = await next(e).catch(() => undefined)
  if (e.props.hasSurvey) return below

  const level = await currentLean($)
  const usage = await $.session.usage().catch(() => undefined)
  const week = usage?.rateLimits?.find((r: any) => r.kind === 'seven_day')
  const five = usage?.rateLimits?.find((r: any) => r.kind === 'five_hour')
  const warm = (p?: number) => (p ?? 0) >= 80
  const hot = warm(week?.percentUsed) || warm(five?.percentUsed)

  const costs = ownCosts
  const turns = ownTurns
  const total = usage?.cost?.usd ?? ownCost
  const t = ownTokens
  const tokens = t.input + t.output + t.cacheRead + t.cacheWrite
  const busy = ownBusy
  const ctx = Math.round(usage?.context?.percent ?? 0)
  const turnWord = `${turns} ${turns === 1 ? 'turn' : 'turns'}`

  const { Box, Text, Button, Svg } = $.ui.resolve(e) as any
  const run = (command: string, args = '') => async () => {
    await $.command.run({ command, args }).catch(() => undefined)
    $.ui.invalidate('ui.render')
  }
  const room = typeof e.props.maxRows === 'number' ? e.props.maxRows : 12

  // No Svg on this surface (a terminal) or little room: a plain line, so nothing breaks there.
  if (!Svg || room < 7) {
    return (
      <Box flexDirection="column">
        <Box flexDirection="row" gap={2} paddingX={1}>
          <Text color={VIOLET} bold>{usd(total)}</Text>
          <Text dimColor>{turnWord}</Text>
          <Text color={warm(week?.percentUsed) ? EMBER : VIOLET}>{week ? `week ${Math.round(week.percentUsed)}%` : ''}</Text>
          <Text dimColor>context {ctx}%</Text>
        </Box>
        {below}
      </Box>
    )
  }

  const stack = (node: any) => (below ? <Box flexDirection="column">{node}{below}</Box> : node)

  if (settingsOpen) {
    const roomy = room >= 10
    const airy = room >= 6
    const dirty = FIELDS.some(f => draft[f.key] !== saved[f.key])
    const bad = EFFORTS.indexOf(draft.effortFloor) > EFFORTS.indexOf(draft.effortCeiling)
    const lean = Number(draft.effortBias)
    const leanWord = lean === 0 ? 'balanced' : `${lean < 0 ? 'cheaper' : 'smarter'} by ${Math.abs(lean)}`
    const canSave = dirty && !bad && !cfgError.startsWith("can't read")
    const open = (to: typeof settingsCard) => () => { settingsCard = to; $.ui.invalidate('ui.render') }
    const PARTS = [
      { id: 'effort' as const, title: 'Effort', about: 'How hard Claude thinks. Auto stays between the floor and the ceiling.', keys: ['effortFloor', 'effortCeiling', 'effortBias'], summary: `${draft.effortFloor} to ${draft.effortCeiling} · ${leanWord}` },
      { id: 'handoff' as const, title: 'Handoff', about: 'What happens once a handoff is written, and whether a few recent messages go to Haiku past 30% of context to suggest a fresh chat.', keys: ['handoffAfter', 'contextCheck'], summary: `${AFTER[draft.handoffAfter]} · check ${draft.contextCheck}` },
      { id: 'usage' as const, title: 'Usage', about: 'Full runs every skill in depth. Lite adds one short line so Claude works inline, skips peer review and keeps answers short.', keys: ['usage'], summary: `${draft.usage} · ${USAGE[draft.usage] ?? USAGE.full}` },
    ]
    const part = PARTS.find(x => x.id === settingsCard)
    return stack(
      <Box key="hud-settings" flexDirection="column" gap={airy ? 1 : 0} paddingX={2} paddingY={airy ? 1 : 0} borderStyle="round" borderColor={VIOLET}>
        <Box flexDirection="row" alignItems="center" gap={2}>
          {part ? <Button key="back" label="← Back" variant="secondary" onPress={open(null)} /> : <Text color={VIOLET} bold>Settings</Text>}
          <Text color={part ? VIOLET : undefined} bold={Boolean(part)} dimColor={!part}>{part ? part.title : 'mistif'}</Text>
          <Box flexGrow={1} />
          <Text color={bad || cfgError ? RED : dirty ? YELLOW : undefined} dimColor={!bad && !dirty && !cfgError}>
            {cfgError ? `● ${cfgError}` : bad ? '● floor is above ceiling, fix it to save' : dirty ? '● unsaved changes' : '✓ saved'}
          </Text>
          <Button key="reset" label="Reset" plain dimColor onPress={() => { draft = { ...DEFAULTS }; $.ui.invalidate('ui.render') }} />
          <Button key="save" label="Save" {...(canSave ? { variant: 'primary' as const } : { plain: true as const, dimColor: true })} onPress={async () => { if (canSave) await saveCfg($) }} />
          <Button key="close" label="✕" plain onPress={() => { settingsOpen = false; settingsCard = null; $.ui.invalidate('ui.render') }} />
        </Box>
        {part ? (
          <Box flexDirection="column" gap={airy ? 1 : 0}>
            {roomy ? <Text dimColor>{part.about}</Text> : null}
            {FIELDS.filter(f => part.keys.includes(f.key)).map(f => (
              <Box key={f.key} flexDirection="row" alignItems="center" gap={1}>
                <Box width={15} flexShrink={0}><Text dimColor>{f.label.split(' (')[0]}</Text></Box>
                {f.values.map(v => {
                  const picked = draft[f.key] === v
                  return picked
                    ? <Button key={`${f.key}-${v}`} label={v} variant="secondary" onPress={() => { draft[f.key] = v; $.ui.invalidate('ui.render') }} />
                    : <Button key={`${f.key}-${v}`} label={v} plain dimColor onPress={() => { draft[f.key] = v; $.ui.invalidate('ui.render') }} />
                })}
                {roomy ? <Text dimColor>  {HINTS[f.key]}</Text> : null}
              </Box>
            ))}
          </Box>
        ) : (
          <Box flexDirection="column" gap={airy ? 1 : 0}>
            {PARTS.map(x => (
              <Box key={x.id} flexDirection="row" alignItems="center" gap={2}>
                <Button key={`part-${x.id}`} variant="secondary" onPress={open(x.id)}><Text color={VIOLET} bold>{x.title}</Text></Button>
                <Text dimColor>{x.summary}</Text>
                <Box flexGrow={1} />
                <Text color={VIOLET}>›</Text>
              </Box>
            ))}
          </Box>
        )}
      </Box>,
    )
  }

  const mine = (
    <Box key="hud" position="relative" flexDirection="column" paddingX={1} overflow="hidden" backgroundColor={hot ? EMBER_BG : undefined} borderStyle="round" borderColor={hot ? EMBER_EDGE : EDGE}>
      <Box key="art" position="absolute" top={-1} right={0} bottom={-1}>
        <Svg source={art(hot)} alt="" width={440} height={64} />
      </Box>
      <Box flexDirection="row" alignItems="center" gap={1}>
        {LEAN_LEVELS.map(l => (
          <Button
            key={`level-${l}`}
            label={l}
            {...(l === level ? { variant: 'primary' as const } : { plain: true as const, dimColor: true })}
            onPress={run('mistif:lean', l)}
          />
        ))}
        {hot ? <Text color={EMBER} bold>  ✦ running hot</Text> : null}
        <Box flexGrow={1} />
        <Button key="review" label="Review" plain onPress={run('mistif:review')} />
        <Button key="audit" label="Audit" plain onPress={run('mistif:review', 'audit: the whole project, what is unused, duplicated or more than the job needs')} />
      </Box>
      <Box flexDirection="row" gap={4} paddingTop={1}>
        <Box key="cost" flexDirection="row" gap={2} flexShrink={0}>
          <Box flexDirection="column">
            <Text dimColor>cost</Text>
            <Text size="heading" weight="bold">{usd(total)}</Text>
            <Text dimColor>{costs.length ? `last ${usd(costs[costs.length - 1])} · ⌀ ${usd(total / Math.max(1, turns))}` : `⌀ ${usd(total / Math.max(1, turns))}`}</Text>
          </Box>
          {costs.length > 1 ? <Svg source={bars(costs)} alt="cost per turn" width={Math.min(costs.length, 20) * 5} height={22} /> : null}
        </Box>
        <Box key="tokens" flexDirection="column" flexShrink={0}>
          <Text dimColor>tokens</Text>
          <Text size="heading" weight="bold">{tokens ? big(tokens) : '–'}</Text>
          <Text dimColor>{tokens ? `${big(t.output)} out · ${turnWord}` : turnWord}</Text>
        </Box>
        <Box key="time" flexDirection="column" flexShrink={0}>
          <Text dimColor>agent time</Text>
          <Text size="heading" weight="bold">{span(busy)}</Text>
          <Text dimColor>{`⌀ ${span(busy / Math.max(1, turns))} / turn`}</Text>
        </Box>
        <Box key="limits" flexDirection="column" flexShrink={0}>
          <Text dimColor>limits</Text>
          <Text size="heading" weight="bold" color={warm(week?.percentUsed) ? EMBER : VIOLET}>
            {week ? `week ${Math.round(week.percentUsed)}%` : 'no limit data'}
          </Text>
          <Text dimColor>
            {[week?.resetsAt ? `resets ${clock(week.resetsAt)}` : '', five ? `5h ${Math.round(five.percentUsed)}%` : '', `context ${ctx}%`].filter(Boolean).join(' · ')}
          </Text>
        </Box>
      </Box>
    </Box>
  )
  return below ? (
    <Box flexDirection="column">
      {mine}
      {below}
    </Box>
  ) : (
    mine
  )
}

