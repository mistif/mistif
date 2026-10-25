import { atom, read, update } from 'claude-code'
import type { EngineInterface, ModelForkResult, RenderInput } from 'claude-code'

import type { Effort, HandoffAfter, HandoffChoice, ModelKey, Pick, Spent } from '../types'

// The ladders the two sliders walk, cheapest first.
export const MODELS: { key: ModelKey; label: string; long: string; id: string }[] = [
  { key: 'haiku', label: 'Haiku', long: 'Haiku 5.5', id: 'claude-haiku-5-5' },
  { key: 'sonnet', label: 'Sonnet', long: 'Sonnet 5.5', id: 'claude-sonnet-5-5' },
  { key: 'opus', label: 'Opus', long: 'Opus 5.5', id: 'claude-opus-5-5' },
  { key: 'fable', label: 'Fable', long: 'Fable 5.1', id: 'claude-fable-5-1' },
]
export const EFFORTS: Effort[] = ['low', 'medium', 'high', 'xhigh', 'max']
// What one token costs relative to an uncached input token, the same ratios on every Claude model. Effortless (upstream)
// reports that in real Claude Code use cache reads are about 76% of a session's cost, cache writes 16% and output 8%; we
// have not re-measured that. Effort mostly changes how many tool calls a prompt makes, not what one answer writes, so all four are counted.
const WEIGHT = { input: 1, write: 1.25, read: 0.1, out: 5 }
// Changing effort between two requests keeps the prompt cache on these models only. On Fable 5.1 and older Opus
// the next request rewrote most of the cache (Effortless's measurement), which costs more than any effort can save.
export const cacheSafe = (modelId: string) => /(opus|sonnet)-5-5/.test(modelId)
const ACCENT = '#a79cf7'
const BRAND_BG = '#15121f'
const BRAND_EDGE = '#4a3f80'
const EFFORT_LABELS: Record<Effort, string> = { low: 'Low', medium: 'Medium', high: 'High', xhigh: 'XHigh', max: 'Max' }

// `isAuto` is Auto for effort: every prompt is judged and its effort applied.
const isAuto = atom({ plugin: 'mistif', key: 'isAuto' } as const, true)
const EMPTY_SPENT: Spent = { prompts: 0, requests: 0, input: 0, write: 0, read: 0, out: 0, byEffort: {}, judge: { haiku: 0, ms: 0, tokens: 0 }, moved: 0, redone: 0 }
const SWITCHED_MS = 2500
// The prompt cache lives this long after the last request read or wrote it. A response may say which lifetime its
// cache writes got (usage.cache_creation: ephemeral_1h / ephemeral_5m); until one does, 1 hour is assumed: 99% of
// the cache writes in Effortless's sample of real Claude Code use were 1 hour (upstream's figure, not re-measured here).
const CACHE_TTL = { '5m': 5 * 60_000, '1h': 60 * 60_000 } as const
const CACHE_TICK_MS = 15_000
// Under this much time left the countdown turns amber: send now, or pay to write the whole context again.
// Shown minutes at or under these turn the countdown yellow, then red: grey while there is time, yellow at 20, red at 5.
const CACHE_YELLOW_MIN = 20
const CACHE_RED_MIN = 5
const ICE = '#7cc4ff'
const YELLOW = '#e0a33a'
const RED = '#e5534b'
const pick = atom({ plugin: 'mistif', key: 'pick' } as const, null)
const isJudging = atom({ plugin: 'mistif', key: 'isJudging' } as const, false)
const appEffort = atom({ plugin: 'mistif', key: 'appEffort' } as const, null)
const model = atom({ plugin: 'mistif', key: 'model' } as const, null)
// The last change Auto made to the effort, shown for a moment as "Low → High" and then cleared.
const switched = atom({ plugin: 'mistif', key: 'switched' } as const, null)
// What the prompts Auto steered cost this session, measured, and what judging them took.
const saved = atom({ plugin: 'mistif', key: 'saved' } as const, EMPTY_SPENT)
// True while the session runs a model where Auto must not change effort (see cacheSafe).
const paused = atom({ plugin: 'mistif', key: 'paused' } as const, false)
// How long the main conversation's prompt cache stays warm, in whole minutes left: null before the first response,
// 0 once it has gone cold. Updated only when the minute changes, so the footer redraws once a minute at most.
const cacheLeft = atom({ plugin: 'mistif', key: 'cacheLeft' } as const, null)
const cacheMemo = atom({ plugin: 'mistif', key: 'cacheMemo' } as const, null)
const isCompacting = atom({ plugin: 'mistif', key: 'isCompacting' } as const, false)
// The person closed the cold band; it comes back the next time the cache goes cold.
// The test pane of /mistif:hud try pane.
// Where a handoff is: null idle, writing (the handoff turn runs), clearing (clear and resend).
const handoffStage = atom({ plugin: 'mistif', key: 'handoffStage' } as const, null)
// Why Haiku thinks a handoff would suit now, or null. It lights Handoff and says why; there is no percent threshold.
const handoffAdvice = atom({ plugin: 'mistif', key: 'handoffAdvice' } as const, null)
// The swamp band was closed at this many tokens; it comes back once the context has grown well past it.
// The handoff card above the prompt: shown from the start of a handoff, and once it lands ('done' in the
// cleared chat, 'copied'). It goes with the next message, its ✕, or HANDOFF_CARD_MS after it was set.
// 'ready': the handoff is written and the card asks whether to clear the chat; it stays until answered.
type HandoffCard = { kind: 'writing' | 'ready' | 'done' | 'copied' | 'compacting' | 'compacted'; full: boolean; at: number; seen: boolean }
// Kinds still under way: they stay until they land, with moving art. Compacting shares the card with the handoff.
const cardRunning = (kind: HandoffCard['kind']) => kind === 'writing' || kind === 'compacting'
// Kinds that landed well: the card turns green with a checkmark.
const cardLanded = (kind: HandoffCard['kind']) => kind === 'done' || kind === 'compacted'
const handoffCard = atom({ plugin: 'mistif', key: 'handoffCard' } as const, null)
const HANDOFF_CARD_MS = 2 * 60_000
async function setHandoffCard($: EngineInterface, kind: HandoffCard['kind'], full: boolean, seen = false) {
  const at = await $.clock.now()
  await update($, handoffAdvice, () => null)
  await update($, handoffCard, () => ({ kind, full, at, seen }))
  // Gone after a while even with no reply; a timer that dies with its request leaves the next reply to clear it.
  if (!cardRunning(kind) && kind !== 'ready') {
    try {
      $.clock.after(HANDOFF_CARD_MS, () => void update($, handoffCard, card => (card && card.at === at ? null : card)))
    } catch {}
  }
}

// The newest reply's text, so the warning card goes under its last block and nowhere else.
const lastAnswer = atom({ plugin: 'mistif', key: 'lastAnswer' } as const, '')
const lastTurn = atom({ plugin: 'mistif', key: 'lastTurn' } as const, null)
// The weighted tokens of the main thread's requests since the prompt; kept in lastTurn when the turn ends.
let turnCost = 0
// A usage limit is close: which window, how much is used, when it resets. Null below the line.
const hot = atom({ plugin: 'mistif', key: 'hot' } as const, null)
// Save mode: Auto picks at most medium until this time (ms), when the limit resets.
const saveUntil = atom({ plugin: 'mistif', key: 'saveUntil' } as const, null)
const DONE_ACCENT = '#7fe0a4'
const DONE_BG = '#0f1c15'
const DONE_EDGE = '#2f7a4c'
const JUDGE_SYSTEM = `You choose which Claude model and reasoning effort an agentic assistant (it reads files, runs tools and edits things, not only code) should use for the user's next message. Pick the cheapest pair that will still do the job well.

Models, cheapest first:
- haiku: quick questions, lookups, renames, small edits in one or two files, summaries, chit-chat. It can read files and run tools; pick it for any small, well-defined job.
- sonnet: normal coding, edits across a few files, explanations, writing.
- opus: hard debugging, architecture, large refactors, careful reviews.
- fable: the hardest long-horizon or research-level work.

Effort: low for quick answers, medium for normal work, high for hard problems, xhigh or max only for very hard ones.

Effort is relative to the model in use ("Current" names it): a stronger model needs less effort for the same job. Opus at medium does about what Sonnet does at high, and Fable is stronger again. So for one and the same task pick one step lower on Opus than on Sonnet, and lower still on Fable; on Sonnet, go one step higher for hard work than you would on Opus.

Judge the SCOPE and the amount of work, not whether it is code. A short message can ask for a lot: "go through my whole drive and clean it up", "review the entire repo", "migrate everything" are big, multi-step, tool-heavy jobs where mistakes are costly: never low, usually high. Low is only for answers that need no tools and no planning.

If the message answers a question in the assistant's last reply (picks an option, says which one, confirms a plan), judge only the work that answer starts, as the reply describes it, not the length of the answer and not the work done before the question: "B" can mean "build the complicated section B" (high), while "yes" or "no" to one small action ("should I archive this?", "delete the old ones too?") is low, and picking a value for one setting (a log level, a colour, a font) is low. But picking which way to build something ("option 1", "the same shapes", "B") starts that build: judge the build. Approving a whole plan or several steps takes the effort of that plan. A plain "yes", "ok" or "do it" after "Is that OK? Then I'll build X" or "Should I build X?" approves building X: judge X, not the word.

A message that pushes back on, corrects or adds to a plan or claim under discussion continues that work: keep at least the effort that work had, never drop to low for it. Thanks, praise or a closing remark with no new request is low. A question about how to do something, or about effort itself, that needs no tools is low.

If the person asks for deep thought ("think hard", "ultrathink", "be thorough"), pick at least high; if they ask for a quick answer, pick low.

If the message is a short follow-up to ongoing work ("yes", "go", "ok", "continue", or the same in any language), keep the current pair.

Reply with JSON only: {"model":"haiku|sonnet|opus|fable","effort":"low|medium|high|xhigh|max","sure":0.0-1.0 how sure you are of the effort,"why":"at most 6 words, in the user's language"}`

/** Reads `{ model, effort, why }` out of a reply, or nothing when it doesn't hold one. */
export function parseVerdict(text: string): { model: ModelKey; effort: Effort; why: string; sure?: number; handoff?: string } | undefined {
  const match = text.match(/\{[\s\S]*\}/)
  if (!match) return undefined
  let raw: unknown
  try {
    raw = JSON.parse(match[0])
  } catch {
    return undefined
  }
  if (typeof raw !== 'object' || raw === null) return undefined
  const { model, effort, why, sure, handoff } = raw as Record<string, unknown>
  const key = typeof model === 'string' ? model.toLowerCase() : ''
  const found = MODELS.find(m => key === m.key || key === m.id || key.includes(m.key))
  if (!found || !EFFORTS.includes(effort as Effort)) return undefined
  const how = typeof sure === 'number' && sure >= 0 && sure <= 1 ? { sure } : {}
  // Only a reason counts: "handoff":"" or false is no advice.
  const advice = typeof handoff === 'string' && handoff.trim() ? { handoff: handoff.trim().slice(0, 70) } : {}
  return { model: found.key, effort: effort as Effort, why: typeof why === 'string' ? why.slice(0, 60) : '', ...how, ...advice }
}

/**
 * What the judge reads besides the new message: the person's previous message and the assistant's last reply. The
 * reply is kept long and from its end, where a question with options ("A, B or C?") sits: "B" alone looks like a
 * small job, the reply says what B sets off.
 */
async function recentContext($: EngineInterface): Promise<string> {
  return contextFrom(await $.session.messages())
}

/** The context text from the conversation so far: the last user message, short, and the assistant's last reply's end. */
export function contextFrom(messages: readonly { role: string; text: string }[]): string {
  const lastUser = [...messages].reverse().find(m => m.role === 'user')
  const lastAssistant = lastAssistantText(messages)
  return [lastUser ? `user: ${lastUser.text.slice(0, 400)}` : '', lastAssistant ? `assistant: ${lastAssistant.slice(-2000)}` : '']
    .filter(Boolean)
    .join('\n')
}

/** The assistant's last reply, or nothing. */
function lastAssistantText(messages: readonly { role: string; text: string }[]): string {
  return [...messages].reverse().find(m => m.role === 'assistant' && m.text.trim())?.text ?? ''
}


/** The skill or custom command a typed "/name args" runs, or nothing for the app's own commands and effortless's. */
async function typedSkill($: EngineInterface, text: string): Promise<{ name: string; description: string } | undefined> {
  const name = text.trim().slice(1).split(/\s+/)[0]
  if (!name) return undefined
  const found = (await $.command.list().catch(() => [])).find(c => c.name === name)
  if (!found || !['user', 'plugin', 'mcp'].includes(found.source) || (found.plugin === 'mistif' && /^(mistif:)?hud$/.test(name))) return undefined
  return { name, description: found.description ?? '' }
}

const LEVEL_WORD = '(low|medium|high|xhigh|x-high|extra[- ]high|max|maximum)'
const NAMED_LEVEL = new RegExp(`\\b${LEVEL_WORD}\\s+effort\\b|\\beffort(?:\\s+level)?\\s*(?:[:=]|to|at|of|on)?\\s*${LEVEL_WORD}\\b|\\bxhigh\\b`, 'gi')
const LEVEL_OF: Record<string, Effort> = { low: 'low', medium: 'medium', high: 'high', xhigh: 'xhigh', 'x-high': 'xhigh', 'extra high': 'xhigh', 'extra-high': 'xhigh', max: 'max', maximum: 'max' }

/**
 * The level a prompt asks for by name ("max effort", "effort: high", "xhigh"), or nothing. The word effort must sit
 * beside the level, so "a medium sized image" names nothing, and "don't use max effort" is a no. A named level runs
 * without the judge: effort-auto found Haiku also calls prompts that only describe hard work "named".
 */
export function namedEffort(text: string): Effort | undefined {
  for (const m of text.matchAll(NAMED_LEVEL)) {
    const before = text.slice(Math.max(0, m.index - 20), m.index).toLowerCase()
    if (/\b(not|no|don'?t|never|without|instead of)\b/.test(before)) continue
    return LEVEL_OF[(m[1] ?? m[2] ?? 'xhigh').toLowerCase().replace(/\s+/, ' ')]
  }
  return undefined
}

/** A short follow-up such as "go", "ok", "yes", "continue": two words and a dozen characters at most. */
export function isFollowUp(text: string): boolean {
  const t = text.trim()
  return t.length > 0 && t.length <= 12 && t.split(/\s+/).length <= 2
}

/**
 * Whether the assistant's last reply ended on a question ("Should I archive it?", "A, B or C?"). A short message
 * after one answers it, and the answer can start a small or a big job, so it goes to the judge instead of keeping
 * the effort.
 */
export function endsOnQuestion(context: string): boolean {
  const reply = context.split('\nassistant: ').pop() ?? ''
  return context.includes('assistant: ') && reply.slice(-400).includes('?')
}

/** The message as the judge reads it: images and files it carries are named, since the judge sees only text. */
export function withAttachments(text: string, attachments?: readonly { type: string }[]): string {
  if (!attachments?.length) return text
  const counts = new Map<string, number>()
  for (const a of attachments) counts.set(a.type, (counts.get(a.type) ?? 0) + 1)
  const said = [...counts].map(([type, n]) => `${n} ${type}${n > 1 ? 's' : ''}`).join(', ')
  return `${text}

[The message comes with ${said} to look at.]`
}

/** The message as the judge reads it when it was typed while a task was still running. */
export function withMidTurn(text: string, effort: Effort): string {
  return `${text}

[Sent while the assistant was still working on the last task at ${effort} effort. If it adds to, corrects or steers that task, keep ${effort}; judge it on its own only if it is a separate new request.]`
}
// A lower verdict for a message typed mid-turn, applied when that turn ends (see prompt.submit).
let heldPick: Pick | null = null

/** A short follow-up that keeps the current effort: "go" between two steps, not an answer to a question. */
export function keepsEffort(message: string, context: string): boolean {
  return isFollowUp(message) && !endsOnQuestion(context)
}

type Judged = { verdict?: Pick; tokens: number }

/** The plugin's settings, cleaned to the shape the code reads. */
export type JudgeConfig = {
  /** A skill or slash command that writes the handoff instead of the built-in prompt, e.g. "session-handoff". */
  handoffSkill: string
  /** What follows the handoff: clear and carry on, clear and wait, or keep the chat and copy the handoff. The handoff
   *  bar opens on the choice made last; this is the first one. */
  handoffAfter: HandoffAfter
  /** The effort slider, -2 (cheaper) to 2 (smarter): tips the judge's close calls that way. */
  bias: number
  /** Auto never goes below this effort. */
  floor: Effort
  /** Auto never goes above this effort. */
  ceiling: Effort
  /** What the person switched off: the footer's handoff button and any of the alert bands. */
  hide: Hideable[]
  /** Full adds nothing; Lite adds LITE_LINE to the system prompt so the skills take their short path. */
  usage: 'full' | 'lite'
  /** On (the default): past about 30% of the context a small model reads a few messages to suggest a fresh chat. Off: no such call. */
  contextCheck: boolean
}

/** The one line Lite adds. Skills look for the words "Lite usage". */
export const LITE_LINE =
  'Lite usage: work inline or with one agent max, no peer review, short outputs, no fan-out unless asked; read only the skill file, not its references, unless stuck.'

/** The parts of effortless a person can switch off: the footer's (setup) and the progress bar's (setup, settings).
 * The context (swamp), running-low (hot) and cold-cache alerts can be switched off for good in Customize; the judge-down
 * alert always shows. Each alert also has its own ✕. */
export const HIDEABLE = ['timer', 'reason', 'line'] as const
export type Hideable = (typeof HIDEABLE)[number]
// What the app passed to register, so settings kept in the store can be laid over it at session start.
let pluginOptions: Record<string, unknown> = {}
let config: JudgeConfig = {
  handoffSkill: '',
  handoffAfter: 'continue',
  bias: 0,
  floor: 'medium',
  ceiling: 'max',
  hide: ['reason'],
  usage: 'full',
  contextCheck: true,
}

/** The settings as the engine hands them over (defaults filled in), cleaned to the shape the judge reads. */
export function readConfig(options: unknown): JudgeConfig {
  const o = (options ?? {}) as Record<string, unknown>
  const str = (v: unknown) => (typeof v === 'string' ? v.trim() : '')
  return {
    handoffSkill: str(o.handoffSkill).replace(/^\//, ''),
    handoffAfter: (['confirm', 'copy'] as const).find(a => a === str(o.handoffAfter)) ?? 'continue',
    bias: Math.max(-2, Math.min(2, Math.round(Number(str(o.effortBias)) || 0))),
    floor: EFFORTS.includes(str(o.effortFloor) as Effort) ? (str(o.effortFloor) as Effort) : 'medium',
    ceiling: EFFORTS.includes(str(o.effortCeiling) as Effort) ? (str(o.effortCeiling) as Effort) : 'max',
    // The judge's line is off until switched on; an empty string saved from the panel means everything shows.
    hide: (o.hide === undefined ? 'reason' : str(o.hide))
      .split(',')
      .map(part => part.trim())
      .filter((part): part is Hideable => (HIDEABLE as readonly string[]).includes(part)),
    usage: str(o.usage) === 'lite' ? 'lite' : 'full',
    contextCheck: str(o.contextCheck) !== 'off',
  }
}

/** The text the judge reads: the current pair, the last turns and the next message. */
function judgeQuestion(prompt: string, current: Pick | null, context: string): string {
  return [
    current ? `Current: ${current.model} / ${current.effort}` : 'Current: none',
    context ? `Recent conversation:\n${context}` : '',
    `Next message:\n${prompt.slice(0, 2000)}`,
  ]
    .filter(Boolean)
    .join('\n\n')
}

/** Haiku through the session's own login judges every prompt. Never throws. */
async function judge($: EngineInterface, prompt: string, current: Pick | null): Promise<Judged> {
  return askHaiku($, prompt, current, await recentContext($).catch(() => ''))
}

/** Haiku through the session's own login: the judge that needs no key, and the fallback for the others. */
async function askHaiku($: EngineInterface, prompt: string, current: Pick | null, context: string): Promise<Judged> {
  const used = lastContext && lastContext.window ? `Context used: ${Math.round(lastContext.percent)}% of the window` : ''
  const asked = [judgeQuestion(prompt, current, context), used].filter(Boolean).join('\n\n')
  const ask = (model: string) => $.model.complete({ model, system: JUDGE_SYSTEM, prompt: asked, maxTokens: 160, effort: 'low', timeoutMs: 6000 })
  // Haiku 5.5 by name: Claude Code builds that predate it map the plain alias to an older, pricier Haiku.
  // Where 5.5 does not answer, the alias stands in.
  let r = await ask(COMPACT_MODEL)
  if (!r.isAnswered) r = await ask('haiku')
  const verdict = r.isAnswered ? parseVerdict(r.text) : undefined
  const tokens = r.isAnswered && r.usage ? r.usage.input_tokens + r.usage.output_tokens : 0
  return { verdict: verdict && { ...verdict, by: 'haiku' }, tokens }
}

// Whether a fresh chat would now serve better than carrying on: Haiku's call, whatever judge picks the effort. It runs
// from HANDOFF_CHECK_FROM percent of context, every HANDOFF_CHECK_EVERY messages, so it costs a cent now and then. It
// reads more than the effort judge: what the chat was for, the trail of topics, the last turns, the context and the cache.
const HANDOFF_CHECK_FROM = 30
const HANDOFF_CHECK_EVERY = 2
const HANDOFF_SYSTEM = `You decide whether the person should hand off now: start a fresh chat that carries over a short summary, instead of carrying on in this one. You are shown what the chat was for, the trail of what the person asked, the last turns, the next message, how full the context is and whether the cache is cold.

Say yes only for a clear reason: the task just finished and the next message is something else, the topic has changed so the old context is dead weight, the chat keeps going in circles on the same problem, or a long chat now holds so much unrelated history that a clean start would be sharper. A normal next step of the same work is never a reason, a long chat by itself is not one, and neither is a high context share when the work is going well. When unsure, say no: a wrong yes costs the person more than a missed one.

Reply with JSON only: {"handoff":"reason of at most 8 words, in the person's language"} for yes, or {"handoff":null} for no.`

/** What the handoff check reads: the chat's purpose, a trail of the person's messages, the last reply's end. */
export function handoffEvidence(messages: readonly { role: string; text: string }[], next: string, percent: number, cold: boolean): string {
  const asked = messages.filter(m => m.role === 'user' && m.text.trim())
  const first = asked[0]?.text.slice(0, 500) ?? ''
  const trail = asked.slice(-8, -1).map(m => `- ${m.text.slice(0, 160).replace(/\s+/g, ' ')}`)
  const reply = lastAssistantText(messages).slice(-700)
  return [
    first ? `What the chat was for (first message):\n${first}` : '',
    trail.length ? `Trail of earlier messages:\n${trail.join('\n')}` : '',
    reply ? `The assistant's last reply (its end):\n${reply}` : '',
    `Next message:\n${next.slice(0, 600)}`,
    `Context used: ${Math.round(percent)}% of the window; ${asked.length} messages so far; the cache is ${cold ? 'cold' : 'warm'}.`,
  ]
    .filter(Boolean)
    .join('\n\n')
}

/** Reads Haiku's answer: a reason, or null for no (anything unreadable is no). */
export function parseHandoffAnswer(text: string): string | null {
  const match = text.match(/\{[\s\S]*\}/)
  if (!match) return null
  try {
    const { handoff } = JSON.parse(match[0]) as { handoff?: unknown }
    return typeof handoff === 'string' && handoff.trim() ? handoff.trim().slice(0, 70) : null
  } catch {
    return null
  }
}

let promptsSinceHandoffCheck = 0
/** Called with each message the person sends. Sets or clears the advice; never throws, never holds the message. */
async function checkHandoff($: EngineInterface, next: string) {
  if (!config.contextCheck) return
  const percent = lastContext?.percent ?? 0
  if (percent < HANDOFF_CHECK_FROM) {
    promptsSinceHandoffCheck = 0
    if ((await read($, handoffAdvice)) !== null) {
      await update($, handoffAdvice, () => null)
      $.ui.invalidate('ui.render')
    }
    return
  }
  promptsSinceHandoffCheck++
  if (promptsSinceHandoffCheck < HANDOFF_CHECK_EVERY) return
  promptsSinceHandoffCheck = 0
  try {
    const evidence = handoffEvidence(await $.session.messages(), next, percent, (await cacheMinutes($)) === 0 && cacheExpires > 0)
    const ask = (model: string) => $.model.complete({ model, system: HANDOFF_SYSTEM, prompt: evidence, maxTokens: 60, effort: 'low', timeoutMs: 8000 })
    let r = await ask(COMPACT_MODEL)
    if (!r.isAnswered) r = await ask('haiku')
    if (!r.isAnswered) return
    const reason = parseHandoffAnswer(r.text)
    void proof($, `handoff check at ${Math.round(percent)}%: ${reason ?? 'no'}`)
    if (reason !== (await read($, handoffAdvice))) {
      await update($, handoffAdvice, () => reason)
      $.ui.invalidate('ui.render')
    }
  } catch {
    // A failed check changes nothing.
  }
}

// The judge benchmark (/mistif:hud bench): labelled prompts in bench/judge-cases.json, each run through the same
// pipeline a real prompt takes (a short follow-up keeps the current effort, anything else goes to a judge).
export type BenchCase = { id: string; kind: string; holdout?: boolean; current: Pick; context?: string; message: string; ok: Effort[] }
export type BenchAnswer = { id: string; judge: string; effort?: Effort; by?: string; why?: string; sure?: number; model?: ModelKey; ms: number; tokens: number }

/** Where an answer lands against the labels: right, too low (risks quality), too high (wastes), or no answer. */
export function benchGrade(c: BenchCase, effort: Effort | undefined): 'hit' | 'under' | 'over' | 'none' {
  if (!effort) return 'none'
  if (c.ok.includes(effort)) return 'hit'
  const rank = EFFORTS.indexOf(effort)
  return rank < Math.min(...c.ok.map(e => EFFORTS.indexOf(e))) ? 'under' : 'over'
}

/** The benchmark's table: per judge the share it got right, how it missed, and how fast it was; then per kind. */
export function benchReport(cases: BenchCase[], answers: BenchAnswer[]): string {
  const byId = new Map(cases.map(c => [c.id, c]))
  const judges = [...new Set(answers.map(a => a.judge))]
  const kinds = [...new Set(cases.map(c => c.kind))]
  const pct = (n: number, of: number) => (of ? `${Math.round((n / of) * 100)}%` : '-')
  const median = (xs: number[]) => {
    const s = [...xs].sort((a, b) => a - b)
    return s.length ? s[Math.floor(s.length / 2)] : 0
  }
  const lines = ['| Judge | Right | Too low | Too high | No answer | Median ms |', '| --- | --- | --- | --- | --- | --- |']
  for (const j of judges) {
    const mine = answers.filter(a => a.judge === j)
    const g = mine.map(a => benchGrade(byId.get(a.id)!, a.effort))
    const n = (k: string) => g.filter(x => x === k).length
    const asked = mine.filter(a => a.ms > 0).map(a => a.ms)
    lines.push(`| ${j} | ${pct(n('hit'), g.length)} | ${n('under')} | ${n('over')} | ${n('none')} | ${asked.length ? median(asked) : '-'} |`)
  }
  // The held-out cases were never tuned against: the honest score. The rest shaped the judge prompts.
  const sets = [
    ['tuned on', cases.filter(c => !c.holdout)],
    ['held out', cases.filter(c => c.holdout)],
  ] as const
  lines.push('', `| Set (cases) | ${judges.join(' | ')} |`, `| --- | ${judges.map(() => '---').join(' | ')} |`)
  for (const [name, set] of sets) {
    if (!set.length) continue
    const ids = set.map(c => c.id)
    const cells = judges.map(j => {
      const mine = answers.filter(a => a.judge === j && ids.includes(a.id))
      return pct(mine.filter(a => benchGrade(byId.get(a.id)!, a.effort) === 'hit').length, mine.length)
    })
    lines.push(`| ${name} (${set.length}) | ${cells.join(' | ')} |`)
  }
  lines.push('', `| Kind (cases) | ${judges.join(' | ')} |`, `| --- | ${judges.map(() => '---').join(' | ')} |`)
  for (const k of kinds) {
    const ids = cases.filter(c => c.kind === k).map(c => c.id)
    const cells = judges.map(j => {
      const mine = answers.filter(a => a.judge === j && ids.includes(a.id))
      return pct(mine.filter(a => benchGrade(byId.get(a.id)!, a.effort) === 'hit').length, mine.length)
    })
    lines.push(`| ${k} (${ids.length}) | ${cells.join(' | ')} |`)
  }
  // Does "unsure" predict a miss? The Smarter lean and the cheaper-model guard both act on it, so it is measured here.
  const judged = judges.filter(j => !j.startsWith('always'))
  const sureLines = ['', '| Judge | Sure when right | Sure when wrong | Misses under 65% sure | Misses under 85% sure | Answers under 65% | Answers under 85% |', '| --- | --- | --- | --- | --- | --- | --- |']
  for (const j of judged) {
    const mine = answers.filter(a => a.judge === j && a.effort && typeof a.sure === 'number')
    if (!mine.length) continue
    const wrong = mine.filter(a => benchGrade(byId.get(a.id)!, a.effort) !== 'hit')
    const right = mine.filter(a => benchGrade(byId.get(a.id)!, a.effort) === 'hit')
    const avg = (xs: BenchAnswer[]) => (xs.length ? `${Math.round((xs.reduce((t, a) => t + a.sure!, 0) / xs.length) * 100)}%` : '-')
    const under = (xs: BenchAnswer[], t: number) => xs.filter(a => a.sure! < t).length
    sureLines.push(`| ${j} (${mine.length} with a score) | ${avg(right)} | ${avg(wrong)} | ${under(wrong, 0.65)} of ${wrong.length} | ${under(wrong, 0.85)} of ${wrong.length} | ${under(mine, 0.65)} | ${under(mine, 0.85)} |`)
  }
  const pickLines = ['', '| Judge | Haiku | Sonnet | Opus | Other |', '| --- | --- | --- | --- | --- |']
  for (const j of judged) {
    const mine = answers.filter(a => a.judge === j && a.model)
    if (!mine.length) continue
    const n = (k: string) => mine.filter(a => a.model === k).length
    pickLines.push(`| ${j} | ${n('haiku')} | ${n('sonnet')} | ${n('opus')} | ${mine.length - n('haiku') - n('sonnet') - n('opus')} |`)
  }
  lines.push(...(sureLines.length > 3 ? sureLines : []), ...(pickLines.length > 3 ? pickLines : []))
  const misses = answers
    .filter(a => !a.judge.startsWith('always') && benchGrade(byId.get(a.id)!, a.effort) !== 'hit')
    .map(a => `- ${a.judge}${a.by && a.by !== a.judge ? ` (via ${a.by})` : ''} ${a.id}: said ${a.effort ?? 'nothing'}${a.why ? ` (${a.why})` : ''}, wanted ${byId.get(a.id)!.ok.join('/')}: "${byId.get(a.id)!.message.slice(0, 60)}"`)
  return [...lines, '', 'Misses:', ...(misses.length ? misses : ['- none'])].join('\n')
}

/** Runs every case through each available judge, a few at a time, and returns the answers. */
async function runBench($: EngineInterface, cases: BenchCase[]): Promise<BenchAnswer[]> {
  const judges: [string, (c: BenchCase) => Promise<Judged | undefined>][] = [
    ['haiku', c => askHaiku($, c.message, c.current, c.context ?? '')],
  ]
  const answers: BenchAnswer[] = []
  // Baselines: what a fixed effort would score on the same labels.
  for (const fixed of ['medium', 'high'] as Effort[])
    for (const c of cases) answers.push({ id: c.id, judge: `always ${fixed}`, effort: fixed, ms: 0, tokens: 0 })
  const jobs = judges.flatMap(([name, ask]) => cases.map(c => ({ name, ask, c })))
  let next = 0
  const worker = async () => {
    while (next < jobs.length) {
      const { name, ask, c } = jobs[next++]
      // The mod never asks a judge about a short follow-up: it keeps the current effort.
      if (keepsEffort(c.message, c.context ?? '')) {
        answers.push({ id: c.id, judge: name, effort: c.current.effort, ms: 0, tokens: 0 })
        continue
      }
      const started = await $.clock.now()
      const got = await ask(c).catch(() => undefined)
      answers.push({ id: c.id, judge: name, effort: got?.verdict?.effort, by: got?.verdict?.by, why: got?.verdict?.why, sure: got?.verdict?.sure, model: got?.verdict?.model, ms: (await $.clock.now()) - started, tokens: got?.tokens ?? 0 })
    }
  }
  await Promise.all([worker(), worker(), worker(), worker()])
  return answers
}

function keyOf(id: string): ModelKey | undefined {
  return MODELS.find(m => id.includes(m.key))?.key
}

/** Records the model the session now runs; the pick follows it, so the band never shows a stale one. */
async function modelIs($: EngineInterface, id: string) {
  const pause = !cacheSafe(id) && keyOf(id) !== 'haiku'
  if (pause !== (await read($, paused))) await update($, paused, () => pause)
  const key = keyOf(id)
  if (!key || key === (await read($, model))) return
  await update($, model, () => key)
  // The engine's effort can differ per model, so a change across a switch is not the person's doing;
  // and a model turned down earlier may be suggested again.
  engineEffort = undefined
  const current = await read($, pick)
  if (current && current.model !== key) await choose($, { ...current, model: key })
}

async function sessionModel($: EngineInterface): Promise<ModelKey> {
  const id = await $.session.model()
  return MODELS.find(m => id.includes(m.key))?.key ?? 'sonnet'
}


// Proof log: every verdict, /effort and request effort, written to EFFORTLESS_LOG, or to
// %TEMP%/mistif-proof.log while the mod is loaded from a dev-mods folder. Off otherwise.
const proofLines: string[] = []
// An environment variable does not change while the session runs, so each one is asked for once. The
// engine wants the name spelled out in every $.env.get call, hence one small getter per variable.
type EnvAsk = Promise<string | undefined> | undefined
let askLog: EnvAsk
let askTemp: EnvAsk
let askTmpdir: EnvAsk
let askUserProfile: EnvAsk
let askHome: EnvAsk
function envLog($: EngineInterface) {
  return (askLog = askLog ?? $.env.get('EFFORTLESS_LOG'))
}
function envTemp($: EngineInterface) {
  return (askTemp = askTemp ?? $.env.get('TEMP'))
}
function envTmpdir($: EngineInterface) {
  return (askTmpdir = askTmpdir ?? $.env.get('TMPDIR'))
}
function envUserProfile($: EngineInterface) {
  return (askUserProfile = askUserProfile ?? $.env.get('USERPROFILE'))
}
function envHome($: EngineInterface) {
  return (askHome = askHome ?? $.env.get('HOME'))
}

async function proofPath($: EngineInterface): Promise<string | undefined> {
  const named = await envLog($)
  if (named) return named
  if (!$.plugin.root.replace(/\\/g, '/').includes('/dev-mods/')) return undefined
  const tmp = (await envTemp($)) ?? (await envTmpdir($)) ?? '/tmp'
  return `${tmp}/mistif-proof.log`
}
async function proof($: EngineInterface, line: string) {
  const path = await proofPath($).catch(() => undefined)
  if (!path) return
  proofLines.push(`${new Date().toISOString()} ${line}`)
  await $.fs.write(path, proofLines.slice(-200).join('\n') + '\n').catch(() => undefined)
}

// The effort the engine itself last asked for on the main loop (the app's setting; this mod only
// rewrites the request, never the setting). It changing means the person set it (the app's Effort
// control, their own /effort): that wins and Auto goes off.
let engineEffort: string | undefined
// The pick was carried over from the last chat (the store), not made in this one: the app's effort may overrule it.
let pickCarried = false
// The last main-chat request, for /mistif:hud debug: what the app asked for and what the mod sent instead, if anything.
let lastRequest: { index: number; appModel: string; appEffort: unknown; model: string; effort: unknown; at: number } | null = null
/**
 * The tally in its current shape. A hot reload keeps the state an older version wrote ({ requests, actual,
 * baseline } before 0.2.0), so every read goes through this.
 */
export function asSpent(t: unknown): Spent {
  const v = (t ?? {}) as Partial<Spent>
  const num = (x: unknown) => (typeof x === 'number' && Number.isFinite(x) ? x : 0)
  const judged = (v.judge ?? {}) as Partial<Spent['judge']>
  return {
    prompts: num(v.prompts),
    requests: num(v.requests),
    input: num(v.input),
    write: num(v.write),
    read: num(v.read),
    out: num(v.out),
    byEffort: v.byEffort && typeof v.byEffort === 'object' ? v.byEffort : {},
    judge: { haiku: num(judged.haiku), ms: num(judged.ms), tokens: num(judged.tokens) },
    moved: num(v.moved),
    redone: num(v.redone),
    helpers: {
      runs: v.helpers?.runs && typeof v.helpers.runs === 'object' ? v.helpers.runs : {},
      requests: num(v.helpers?.requests),
      cost: num(v.helpers?.cost),
    },
  }
}

/** A request's tokens weighted by price, in input-token terms (see WEIGHT). */
export function weighted(usage: { input_tokens?: number; output_tokens?: number; cache_read_input_tokens?: number | null; cache_creation_input_tokens?: number | null }): number {
  return (
    (usage.input_tokens ?? 0) * WEIGHT.input +
    (usage.cache_creation_input_tokens ?? 0) * WEIGHT.write +
    (usage.cache_read_input_tokens ?? 0) * WEIGHT.read +
    (usage.output_tokens ?? 0) * WEIGHT.out
  )
}

/** Adds one request Auto steered: every kind of token it used, under the effort it ran at. */
async function tally(
  $: EngineInterface,
  effort: Effort,
  usage: { input_tokens: number; output_tokens: number; cache_read_input_tokens?: number | null; cache_creation_input_tokens?: number | null },
) {
  const cached = usage.cache_read_input_tokens ?? 0
  const write = usage.cache_creation_input_tokens ?? 0
  const cost = usage.input_tokens * WEIGHT.input + write * WEIGHT.write + cached * WEIGHT.read + usage.output_tokens * WEIGHT.out
  await update($, saved, old => {
    const t = asSpent(old)
    const bucket = t.byEffort[effort] ?? { prompts: 0, cost: 0 }
    return {
      ...t,
      requests: t.requests + 1,
      input: t.input + usage.input_tokens,
      write: t.write + write,
      read: t.read + cached,
      out: t.out + usage.output_tokens,
      byEffort: { ...t.byEffort, [effort]: { ...bucket, cost: bucket.cost + cost } },
    }
  })
}

/** Counts one prompt Auto judged: under its effort, and what the judge took. */
async function countPrompt($: EngineInterface, effort: Effort | undefined, by: Pick['by'] | undefined, ms: number, judgeTokens: number) {
  await update($, saved, old => {
    const t = asSpent(old)
    const judged = {
      haiku: t.judge.haiku + (by === 'haiku' ? 1 : 0),
      ms: t.judge.ms + ms,
      tokens: t.judge.tokens + judgeTokens,
    }
    if (!effort) return { ...t, judge: judged }
    const bucket = t.byEffort[effort] ?? { prompts: 0, cost: 0 }
    return { ...t, judge: judged, prompts: t.prompts + 1, byEffort: { ...t.byEffort, [effort]: { ...bucket, prompts: bucket.prompts + 1 } } }
  })
}

/** The cache lifetime a response's writes got, when it says; nothing when it wrote nothing or does not say. */
export function cacheTtlOf(usage: unknown): keyof typeof CACHE_TTL | undefined {
  const c = (usage as { cache_creation?: { ephemeral_1h_input_tokens?: number; ephemeral_5m_input_tokens?: number } } | null)
    ?.cache_creation
  if ((c?.ephemeral_1h_input_tokens ?? 0) > 0) return '1h'
  if ((c?.ephemeral_5m_input_tokens ?? 0) > 0) return '5m'
  return undefined
}

/** Most of the prompt came from the cache: it was still warm. */
export function mostlyCached(usage: unknown): boolean {
  const u = (usage ?? {}) as { input_tokens?: number; cache_read_input_tokens?: number; cache_creation_input_tokens?: number }
  const read_ = u.cache_read_input_tokens ?? 0
  const all = read_ + (u.input_tokens ?? 0) + (u.cache_creation_input_tokens ?? 0)
  return all > 0 && read_ / all > 0.5
}

/** Save mode on or off: Auto stays at medium or below until the limit resets. The hot band's button and
 *  /mistif:hud save. Says what it did. */
async function toggleSave($: EngineInterface): Promise<string> {
  const saving = (await read($, saveUntil)) !== null
  const heat = await read($, hot)
  const until = heat?.resetsAt ? new Date(heat.resetsAt).getTime() : (await $.clock.now()) + 5 * 3600_000
  await update($, saveUntil, () => (saving ? null : until))
  return saving ? 'save mode off' : 'save mode on, Auto stays at medium or below until the limit resets'
}

/** The countdown's colour for whole minutes left (rounded up, as cacheMinutes gives): none (grey), yellow or red. */
export function cacheColor(minutesLeft: number): string | undefined {
  const shown = minutesLeft - 1
  if (minutesLeft <= 0) return ICE
  if (shown > CACHE_YELLOW_MIN) return undefined
  return shown <= CACHE_RED_MIN ? RED : YELLOW
}

/** The footer's words for the time left: "58m", "<1m", or "Cold". */
export function cacheLabel(minutesLeft: number): string {
  if (minutesLeft <= 0) return '❄ Cold'
  if (minutesLeft === 1) return '<1m'
  return `${minutesLeft - 1}m`
}

let cacheTtl: keyof typeof CACHE_TTL = '1h'
let cacheExpires = 0
/** The countdown's variables live in the module, and a reload (an update, a plugin switch) starts the module over: the
 * chat's cache did not go cold for that, so the countdown is read back from the session's state before the band draws
 * (it showed "Cold" after every reload). */
let cacheRestored = false
async function restoreCache($: EngineInterface) {
  if (cacheRestored) return
  cacheRestored = true
  const memo = await read($, cacheMemo)
  if (!memo || cacheExpires !== 0 || memo.expires <= 0) {
    // Nothing to go on: a "Cold" left in the shared state by the copy before is not this chat's cache.
    if (cacheExpires === 0 && !coldForced && (await read($, cacheLeft)) === 0) await update($, cacheLeft, () => null)
    return
  }
  cacheExpires = memo.expires
  cacheTtl = memo.ttl
  lastResponseAt = memo.last
}
function rememberCache($: EngineInterface) {
  return update($, cacheMemo, () => ({ expires: cacheExpires, ttl: cacheTtl, last: lastResponseAt }))
}
/** Reads the context figures (and the usage limits) the handoff advice and save mode need. No model call. */
// A usage window this full shows the running-hot band.
const HOT_PERCENT = 80
/** The fullest of the 5-hour and weekly windows, once one passes HOT_PERCENT. Save mode ends with its window. */
async function checkHot($: EngineInterface, limits: readonly { kind: string; percentUsed: number; resetsAt?: string }[]) {
  const windows = limits.filter(l => l.kind === 'five_hour' || l.kind === 'seven_day')
  const top = windows.sort((a, b) => b.percentUsed - a.percentUsed)[0]
  const next = top && top.percentUsed >= HOT_PERCENT ? { kind: top.kind, percent: top.percentUsed, resetsAt: top.resetsAt ?? null } : null
  const was = await read($, hot)
  if (JSON.stringify(next) !== JSON.stringify(was)) {
    await update($, hot, () => next)
    $.ui.invalidate('ui.render')
  }
  const until = await read($, saveUntil)
  if (until !== null && (await $.clock.now()) >= until) await update($, saveUntil, () => null)
}

/**
 * The effort slider tips close calls only: a verdict the judge was unsure of moves one step toward cheaper or smarter.
 * The outer stops count more calls as close. A sure verdict, or one without a confidence, stays as it is.
 */
export function tipped(effort: Effort, sure: number | undefined, bias: number): Effort {
  if (!bias || sure === undefined || sure >= (Math.abs(bias) === 1 ? 0.65 : 0.85)) return effort
  const i = Math.max(0, Math.min(EFFORTS.length - 1, EFFORTS.indexOf(effort) + Math.sign(bias)))
  return EFFORTS[i]
}

/** Floor and ceiling from the settings: what Auto picks stays between them. */
export function bounded(effort: Effort, floor: Effort, ceiling: Effort): Effort {
  const lo = EFFORTS.indexOf(floor)
  const hi = Math.max(lo, EFFORTS.indexOf(ceiling))
  return EFFORTS[Math.max(lo, Math.min(hi, EFFORTS.indexOf(effort)))]
}

/** Save mode caps what Auto picks at medium; a higher pick comes down to it. */
export function capped(effort: Effort, saving: boolean): Effort {
  return saving && EFFORTS.indexOf(effort) > EFFORTS.indexOf('medium') ? 'medium' : effort
}

// A main-conversation turn is running: set when a prompt is sent and at each request, cleared when the turn ends (an
// aborted one too). The swamp band and card wait for it: Compact or Handoff mid-turn would cut the reply off. A turn
// with no request for TURN_STALE_MS counts as over, so a missed end never hides the band for good.
let turnBusyAt: number | undefined
const TURN_STALE_MS = 10 * 60_000
async function setTurnBusy($: EngineInterface, busy: boolean) {
  const was = turnBusyAt !== undefined
  turnBusyAt = busy ? Date.now() : undefined
  if (was !== busy) $.ui.invalidate('ui.render')
}

/** A context share to draw the bars with instead of the real one, from ~/.claude/effortless-preview.json
 * ({"contextPercent": 45}), so how a level looks can be checked on screen without filling a chat. No file, no change. */
async function checkContext($: EngineInterface) {
  const { context, rateLimits } = await $.session.usage()
  const tokens = context.tokens ?? 0
  // The app may leave the percent out (or give 0) while it has the tokens and the window: work it out then.
  const percent = context.percent || (context.window ? (tokens / context.window) * 100 : 0)
  lastContext = { tokens, window: context.window ?? 0, percent }
  await checkHot($, rateLimits ?? [])
}

// Redraws still owed after a chat was opened again: the app may draw the band before it is ready for one, so the
// session's 1 s timer asks again a few times (see redrawSoon).
let redrawsOwed = 0
// When the redraws were asked for: once the band has been drawn after that, none are owed any more. Each redraw
// rebuilds the band and restarts its animations, so asking blindly 4 more times reset the cold band's spin 4 times.
let redrawAskedAt = 0
function redrawSoon(times = 5) {
  redrawsOwed = Math.max(redrawsOwed, times)
  redrawAskedAt = Date.now()
}

async function showCache($: EngineInterface) {
  // No response seen by this copy yet (it loaded mid-chat, after a plugin switch or reload): a 0 left in the shared
  // state by an earlier copy is not this chat's cache, so the countdown goes blank until the next response.
  if (cacheExpires === 0) {
    if (!coldForced && (await read($, cacheLeft)) !== null) {
      await update($, cacheLeft, () => null)
      $.ui.invalidate('ui.render')
    }
    return
  }
  const minutes = await cacheMinutes($)
  const was = await read($, cacheLeft)
  if (minutes === was) return
  await update($, cacheLeft, () => minutes)
  // Going cold or warm adds or removes the band above the prompt; the desktop app redraws that site only when asked.
  if ((minutes === 0) !== (was === 0)) $.ui.invalidate('ui.render')
}

/** Minutes left, rounded up, so "1" means under a minute and 0 means cold. */
async function cacheMinutes($: EngineInterface): Promise<number> {
  const left = cacheExpires - (await $.clock.now())
  return left <= 0 ? 0 : Math.ceil(left / 60_000)
}

/** A response came back: the cache is warm again for its whole lifetime, and the countdown restarts. */
let usageLogged = false
let lastResponseAt: number | undefined
// Main-conversation replies this copy has seen, for /mistif:hud debug.
let repliesSeen = 0
async function cacheTouched($: EngineInterface, usage: unknown) {
  const now = await $.clock.now()
  repliesSeen++
  if (!usageLogged) {
    usageLogged = true
    void proof($, `first response usage: ${JSON.stringify(usage)}`)
  }
  // When the response does not say, the cache tells by itself: read back after more than 5 minutes means 1 hour.
  const ttl = cacheTtlOf(usage) ?? (lastResponseAt !== undefined && now - lastResponseAt > CACHE_TTL['5m'] && mostlyCached(usage) ? '1h' : undefined)
  lastResponseAt = now
  coldForced = false
  // A reply that wrote only a short 5-minute tail still reads the rest from the 1-hour cache: once 1h is seen, a
  // 5m reading never pulls the countdown back down (that showed "Cold" while the cache was warm).
  if (ttl && ttl !== cacheTtl && !(ttl === '5m' && cacheTtl === '1h' && mostlyCached(usage))) {
    cacheTtl = ttl
    void proof($, `cache lifetime ${ttl}`)
  }
  cacheExpires = now + CACHE_TTL[cacheTtl]
  await rememberCache($)
  await showCache($)
}

// The handoff: one click writes a handoff, clears the chat and sends the handoff into it as the first message.
// The quick handoff is written by a fork, which has no tools: it says what the chat last saw and marks what it cannot
// check. The full handoff (the person's own skill) is the one that inspects git and saves files.
export const HANDOFF_PROMPT = [
  'Write a handoff so this work can continue in a fresh chat that has no other context.',
  '',
  'Start with the project, its folder and the branch. Then:',
  '- Goal: one or two lines.',
  '- Done: what changed, with file paths, and how each change was checked. Never present something planned, skipped or untested as done.',
  '- Not done: what is half done, and the concrete blocker (a failed check, a missing approval, an open question).',
  '- Git: local changes, local commits, pushed commits and open PRs, as last seen in this chat. You cannot check now, so say "as of last check".',
  '- Next steps in priority order. Make the first one runnable: a file path, a command or a specific decision. Mark every step that needs the user with "needs user".',
  '- To resume: the start command, the preview URL, and the limits on what is allowed (what needs the user\'s approval, test vs production).',
  '- Do not redo: decisions made and why, approaches that failed.',
  '- Side threads and docs: any other topic, doc, link or file the user raised in this chat, even if unrelated to the project. One line each: its absolute path or link, and its state. So nothing they mentioned is lost.',
  '',
  'Give only the final state of anything that changed during the chat. Point to specs, plans and files instead of ' +
    'copying them. Leave out what is finished and no longer matters. Never include secrets, environment values or raw ' +
    'logs. Write in the language the user writes in. Short bullets, at most about 40 lines. Do not use tools. Reply ' +
    'with the handoff only, no preamble or farewell.',
].join('\n')

/** The full handoff when no skill of the person's is picked: a turn that may check git and save the handoff, then
 * replies with it. Slower than the quick fork, and it leaves HANDOFF.md in the project for the next chat to read. */
export const HANDOFF_FULL_PROMPT = [
  'Write a handoff so this work can continue in a fresh chat that has no other context. You may use tools for this.',
  '',
  '1. Check the real state: git status, the last few commits, whether the branch is pushed, open PRs if gh is set up.',
  '2. Rewrite HANDOFF.md in the project root from scratch (keep it under 80 lines): branch and open PRs, what is half done,',
  '   next steps with the first one runnable, what only the user can do, and pointers to specs, plans and files.',
  '   Never put secrets or environment values in it.',
  '3. Reply with the handoff itself, in the same shape:',
  '',
  HANDOFF_PROMPT.split('\n').slice(2).join('\n').replace('Do not use tools. ', ''),
].join('\n')

/** The first message of the fresh chat: the handoff, then what to do with it. */
export function handoffMessage(handoff: string, after: HandoffAfter, skill?: string): string {
  const ask =
    after === 'confirm'
      ? 'Read this, say in two lines where things stand and what is next, then wait for me.'
      : 'Continue with the next step. If it is marked "needs user", say what you need and wait.'
  // A full handoff is the person's own skill: it saves the handoff (a file, memories), and its last words in the chat
  // are often only a note that it did. The new chat is told to read what the skill saved before anything else.
  if (skill)
    return (
      `Handoff from the previous chat: it ran /${skill}, which saved the handoff. Its last words there:\n\n${handoff.trim()}\n\n` +
      `First read the handoff /${skill} saved: the files named above, or HANDOFF.md in the project if none is named. ${ask}`
    )
  return `Handoff from the previous chat:\n\n${handoff.trim()}\n\n${ask}`
}

// The handoff's text once its turn has ended, waiting for the chat to go idle so it can be cleared and resent.
let handoffText: string | undefined
let handoffDriving = false

/** Starts a handoff: asks for it (built-in prompt or the person's own skill); the rest follows when it is written. */
// A handoff asked for and not begun: begun from the session's timer, where a prompt may be sent (a command or a press
// may hold the turn, and the app refuses a prompt sent from there).
let handoffQueued = false
// Quick: a fork with the built-in prompt, seconds. Full: the person's own skill as a turn, which may check and save.
let handoffFull = false
// What follows this handoff once it is written (HandoffAfter).
let handoffThen: HandoffAfter = 'continue'

async function startHandoff($: EngineInterface, full = false, after: HandoffAfter = config.handoffAfter) {
  if ((await read($, handoffStage)) !== null) return
  await update($, handoffStage, () => 'writing')
  handoffFull = full
  handoffThen = after
  handoffQueued = true
  await setHandoffCard($, 'writing', handoffFull)
}

/** What the handoff does, by the choice: who writes it, then what follows. */
export function handoffWhat(choice: HandoffChoice, skill: string): { by: string; then: string } {
  const by = choice.kind === 'full' ? (skill ? `/${skill}, slower` : 'Checks git and saves HANDOFF.md, slower') : 'Done in seconds'
  const then =
    choice.after === 'copy'
      ? 'Copied, chat stays.'
      : choice.after === 'confirm'
          ? 'Asks, then clears chat and waits.'
          : 'Asks, then clears chat and carries on.'
  return { by, then }
}

/** What a handoff fork came to, in a few words for /mistif:hud debug: its reason when it wrote nothing. */
export function forkOutcome(result: unknown, ms: number): string {
  const took = `${(ms / 1000).toFixed(1)}s`
  if (result instanceof Error) return `threw: ${result.message.slice(0, 120)} (${took})`
  const r = result as ModelForkResult | undefined
  if (!r || typeof r !== 'object' || !('isAnswered' in r)) return `threw: ${String(result).slice(0, 120)} (${took})`
  if (r.isAnswered) {
    const u = r.usage
    const input = u.input_tokens + u.cache_read_input_tokens + u.cache_creation_input_tokens
    const cached = input ? Math.round((u.cache_read_input_tokens / input) * 100) : 0
    return r.text.trim() ? `answered, ${u.output_tokens} out, ${cached}% cached (${took})` : `answered with blank text (${took})`
  }
  if (r.reason === 'api-error') return `api-error ${r.status ?? 'no response'} ${r.error} (${took})`
  return `${r.reason} (${took})`
}

/** Writes the handoff: quick by a fork with the built-in prompt, full by the person's own skill as a turn. Runs from the timer. */
async function writeHandoff($: EngineInterface) {
  if (!handoffQueued) return
  handoffQueued = false
  try {
    if (handoffFull) {
      // The person's skill, or the built-in full prompt as a turn: either way its reply is the handoff.
      if (config.handoffSkill) await $.command.run({ command: config.handoffSkill, args: '' })
      else await $.prompt.submit({ text: HANDOFF_FULL_PROMPT })
      return
    }
    // A cold cache: a fork would reread the whole chat at full price and write it to the cache again (it costs a large share of
    // a usage window). Haiku writes it from the transcript instead, at a fraction of the price.
    const now = await $.clock.now().catch(() => Date.now())
    if ((await read($, cacheLeft)) === 0 || (cacheExpires > 0 && now >= cacheExpires)) {
      const messages = await $.session.messages().catch(() => [])
      const got = messages.length ? await haikuHandoff($, messages).catch(() => null) : null
      await $.store.set('lastFork', { at: Date.now(), outcome: got ? 'cold cache: written by Haiku' : 'cold cache: Haiku failed, forked' }).catch(() => undefined)
      if (got) {
        handoffText = got
        return
      }
    }
    // The built-in handoff is written by a fork: the same model over this chat as it stands, its start read from the
    // prompt cache, no tools and no turn in the chat. Much quicker than a turn that may go exploring first.
    const startedAt = Date.now()
    const forked = await $.model.fork({ prompt: HANDOFF_PROMPT }).catch((error: unknown) => error)
    const outcome = forkOutcome(forked, Date.now() - startedAt)
    // Kept in the store: before a chat's first message the mod's session may start afresh, and its variables with it.
    await $.store.set('lastFork', { at: Date.now(), outcome }).catch(() => undefined)
    const answered = forked as ModelForkResult
    if (answered?.isAnswered && answered.text.trim()) {
      handoffText = answered.text
      return
    }
    // Nothing to fork (no reply yet) or the fork failed: write it as a turn, as before, and say why.
    if (!outcome.startsWith('nothing-to-fork')) $.ui.toast(`mistif: the fork wrote no handoff (${outcome}); writing it as a turn`)
    await $.prompt.submit({ text: HANDOFF_PROMPT })
  } catch (error) {
    await update($, handoffStage, () => null)
    $.ui.toast(`mistif: handoff failed: ${(error instanceof Error ? error.message : String(error)).slice(0, 140)}`)
  }
}

// A written handoff waits here for the person to say what happens to the chat: nothing is cleared before that. Their
// answer is taken up from the session's timer, like the writing: a press may hold the turn, where a prompt is refused.
let handoffReady: string | undefined
let handoffAnswer: 'clear' | 'keep' | undefined

/** The chat stays: the handoff goes to the clipboard, ready to paste into another chat. Should the clipboard refuse, it
 * goes in the prompt box instead, to cut from there. */
async function copyHandoff($: EngineInterface, text: string) {
  const message = handoffMessage(text, 'continue', handoffFull ? config.handoffSkill : undefined)
  const copied = await $.ui.copy({ text: message }).catch(() => ({ isCopied: false as const }))
  // Under the reply already there, so the next reply takes it away.
  await setHandoffCard($, 'copied', handoffFull, true)
  if (copied.isCopied) $.ui.toast('mistif: handoff copied. Paste it into a new chat.')
  else {
    await $.prompt.fill({ text: message, mode: 'replace' })
    $.ui.toast('mistif: the clipboard refused, so the handoff is in the prompt box')
  }
}

/** The answer to "clear this chat?": clear and carry on, keep the chat and copy, or not now (the handoff is dropped). */
async function answerHandoff($: EngineInterface, answer: 'clear' | 'keep' | 'cancel') {
  if (handoffReady === undefined) return
  if (answer !== 'cancel') {
    handoffAnswer = answer
    return
  }
  handoffReady = undefined
  await update($, handoffCard, () => null)
  await update($, handoffStage, () => null)
  $.ui.invalidate('ui.render')
}

/** Acts on the answer: clears the chat and sends the handoff into it, or copies it and leaves the chat alone. */
async function settleHandoff($: EngineInterface) {
  const text = handoffReady
  const answer = handoffAnswer
  if (text === undefined || !answer || handoffDriving) return
  handoffReady = handoffAnswer = undefined
  handoffDriving = true
  try {
    if (answer === 'keep') return await copyHandoff($, text)
    await update($, handoffStage, () => 'clearing')
    await $.command.run({ command: 'clear', args: '' })
    // Under the first reply of the cleared chat, gone with the one after it.
    await setHandoffCard($, 'done', handoffFull)
    await $.prompt.submit({ text: handoffMessage(text, handoffThen, handoffFull ? config.handoffSkill : undefined) })
  } catch (error) {
    await update($, handoffCard, () => null)
    $.ui.toast(`mistif: handoff failed: ${(error instanceof Error ? error.message : String(error)).slice(0, 140)}`)
  } finally {
    handoffDriving = false
    await update($, handoffStage, () => null)
  }
}

/** Runs from the session's timer, when nothing waits on it: writes a queued handoff, holds it and asks, then acts on the
 * answer. The chat is cleared by the answer, never by the writing. */
export async function finishHandoff($: EngineInterface) {
  await writeHandoff($)
  await settleHandoff($)
  if (handoffText === undefined || handoffDriving) return
  const text = handoffText
  handoffText = undefined
  if (handoffThen === 'copy') {
    handoffDriving = true
    try {
      await copyHandoff($, text)
    } catch (error) {
      $.ui.toast(`mistif: handoff failed: ${(error instanceof Error ? error.message : String(error)).slice(0, 140)}`)
    } finally {
      handoffDriving = false
      await update($, handoffStage, () => null)
    }
    return
  }
  handoffReady = text
  handoffAnswer = undefined
  await update($, handoffStage, () => 'ready')
  await setHandoffCard($, 'ready', handoffFull)
  $.ui.invalidate('ui.render')
}

/** 1234 -> "1.2k", 87 -> "87". */
function tokens(n: number): string {
  const v = Math.abs(n)
  const text = v >= 1000 ? `${(v / 1000).toFixed(1)}k` : String(v)
  return n < 0 ? `-${text}` : text
}

const share = (part: number, whole: number) => `${Math.round((part / whole) * 100)} %`

/**
 * What /mistif:hud stats answers: what the prompts Auto steered cost, measured, split by kind and by effort,
 * and what the judge took. No "saved" figure: what a prompt would have cost at another effort is not known,
 * since effort mostly changes how many tool calls it makes. Cost is in tokens weighted as priced (WEIGHT).
 */
export function savedText(raw: Spent): string {
  const t = asSpent(raw)
  const judged = t.judge.haiku
  const helperRuns = EFFORTS.reduce((n, e) => n + (t.helpers.runs[e] ?? 0), 0)
  if (t.prompts === 0 && judged === 0 && t.moved === 0 && helperRuns === 0) return 'nothing measured yet'
  const input = t.input * WEIGHT.input
  const write = t.write * WEIGHT.write
  const cached = t.read * WEIGHT.read
  const out = t.out * WEIGHT.out
  const total = input + write + cached + out
  const lines = [
    `${t.prompts} prompts, ${t.requests} requests, cost about ${tokens(Math.round(total))} tokens weighted by price` +
      (total > 0 ? ` (cache reads ${share(cached, total)}, cache writes ${share(write, total)}, output ${share(out, total)})` : ''),
  ]
  const per = EFFORTS.filter(e => t.byEffort[e]?.prompts).map(e => {
    const b = t.byEffort[e]!
    return `${EFFORT_LABELS[e]} ${b.prompts}, average ${tokens(Math.round(b.cost / b.prompts))}`
  })
  if (per.length) lines.push(`Per prompt: ${per.join('; ')}`)
  if (t.moved) {
    lines.push(`Cheaper model: ${t.moved} prompt${t.moved === 1 ? '' : 's'} moved down, ${t.redone} redone (${share(t.redone, t.moved)})`)
  }
  if (helperRuns) {
    const per = EFFORTS.filter(e => t.helpers.runs[e]).map(e => `${EFFORT_LABELS[e]} ${t.helpers.runs[e]}`)
    lines.push(`Helpers: ${helperRuns} subagent${helperRuns === 1 ? '' : 's'} (${per.join(', ')}), ${t.helpers.requests} requests, cost about ${tokens(Math.round(t.helpers.cost))} tokens`)
  }
  if (judged) {
    lines.push(`Judge: Haiku ${t.judge.haiku} times, average ${Math.round(t.judge.ms / judged)} ms, ${tokens(t.judge.tokens)} tokens in all`)
  }
  return lines.join('\n')
}

async function toggleAutoEffort($: EngineInterface) {
  const turnOn = !(await read($, isAuto))
  await update($, isAuto, () => turnOn)
  await $.store.set('isAuto', turnOn)
}

async function choose($: EngineInterface, next: Pick | null) {
  pickCarried = false
  const before = await read($, pick)
  await Promise.all([update($, pick, () => next), $.store.set('pick', next)])
  // A change Auto made is shown as "Low → High" for a moment, so the switch is seen.
  if (next && next.by !== 'manual' && before && before.model !== 'haiku' && before.effort !== next.effort) {
    const change = { from: before.effort, to: next.effort }
    await update($, switched, () => change)
    $.clock.after(SWITCHED_MS, () => void update($, switched, () => null))
  }
}

/** Everything a redraw needs, read together: the reads go out at once instead of one after the other. */
// The context figures from the last usage check, for the cache tooltip.
let lastContext: { tokens: number; window: number; percent: number } | null = null

async function snap($: EngineInterface) {
  const [auto, current, judging, shownByApp, modelNow, switchedNow, pausedNow, cacheNow, compacting] = await Promise.all([
    read($, isAuto),
    read($, pick),
    read($, isJudging),
    read($, appEffort),
    read($, model),
    read($, switched),
    read($, paused),
    read($, cacheLeft),
    read($, isCompacting),
  ])
  return { auto, current, judging, shownByApp, modelNow, switchedNow, pausedNow, cacheNow, compacting }
}
type Snap = Awaited<ReturnType<typeof snap>>

/** The effort to show: yours or the judge's, else what the app itself runs with; none on Haiku. */
function effortOf(v: Snap, inUse: ModelKey): Effort | undefined {
  if (inUse === 'haiku') return undefined
  if (v.current) return v.current.effort
  return EFFORTS.includes(v.shownByApp as Effort) ? (v.shownByApp as Effort) : undefined
}

// When this module loaded, for the render log's "first draw" line.
let loadedAt = Date.now()
let firstDrawLogged = false
let drawsTimed = 0
let sessionStarted = 0
// When the app's SessionStart came and what it said, for /mistif:hud debug: a cold band that shows late is either a
// late signal or a redraw the app did not take.
let classicStart: { at: number; said: string } | null = null
// /mistif:hud cold shows the band whatever the chat's size, until the next response (a test of the band itself).
let coldForced = false
let handoffTimer: { cancel: () => void } | undefined
const HANDOFF_POLL_MS = 1000
// Until when each model's prompt cache is warm for this chat: set by every main response on it.
const warmUntil: Partial<Record<ModelKey, number>> = {}
// On the mod's clock, the same one the cache countdown runs on.
function markWarm(modelId: string, usage: unknown, now: number) {
  const key = keyOf(modelId)
  if (key) warmUntil[key] = now + CACHE_TTL[cacheTtlOf(usage) ?? '5m']
}
/** A bar on the terminal: the title and words, and the controls on a row of their own that wraps at 80 columns. */
function terminalPanel($: EngineInterface, e: RenderInput<'AbovePrompt'>, key: string, title: string, words: string, controls: unknown[]) {
  const { Box, Text } = $.ui.resolve(e)
  return (
    <Box key={key} flexDirection="column" paddingX={1} backgroundColor={BRAND_BG} borderStyle="round" borderColor={BRAND_EDGE}>
      <Text color={ACCENT} bold wrap="truncate">{title}</Text>
      <Text key={`${key}-what`} dimColor wrap="truncate">{words}</Text>
      <Box key={`${key}-actions`} flexDirection="row" flexWrap="wrap" justifyContent="flex-end" columnGap={1} alignItems="center">
        {controls}
      </Box>
    </Box>
  )
}

/** The two answers to "clear this chat?" (the card's ✕ is the third: not now). */
function handoffAskButtons($: EngineInterface, Button: (props: Record<string, unknown>) => unknown, term: boolean) {
  return [
    <Button key="handoff-keep" hotkey={term ? 'k' : undefined} label="Keep chat & copy" onPress={() => answerHandoff($, 'keep')} />,
    <Button key="handoff-clear" variant="primary" hotkey={term ? 'y' : undefined} autoFocus label={handoffThen === 'confirm' ? 'Clear & wait' : 'Clear & carry on'} onPress={() => answerHandoff($, 'clear')} />,
  ]
}

/** The handoff or compact card: words, and for "ready" the two answers. Green once it has landed. */
function handoffCardTree($: EngineInterface, e: RenderInput<'AssistantMessage'> | RenderInput<'AbovePrompt'>, fresh: HandoffCard, onDismiss?: () => unknown) {
  const { Box, Text, Button } = $.ui.resolve(e)
  const by = fresh.full ? 'Full' : 'Quick'
  const words = {
    writing: ['✦ Handing off…', `${by} handoff being written. ${fresh.full ? 'Your skill takes a little while.' : 'A few seconds.'}`],
    ready: ['✦ Handoff ready', 'Clear this chat and carry on in a new one? This chat stays in /resume.'],
    done: ['✦ Handoff complete', 'Carried on from the last chat. The old one is cleared.'],
    copied: ['✦ Handoff copied', 'Paste it into a new chat. This one stays.'],
    compacting: ['✦ Compacting…', 'The chat is being summed up. Takes a minute or so.'],
    compacted: ['✦ Compact complete', 'The chat is summed up; the next message reads far less.'],
  }[fresh.kind]
  const landed = cardLanded(fresh.kind)
  return (
    <Box key="reply-handoff" flexDirection="row" alignItems="center" gap={1} paddingX={1} backgroundColor={landed ? DONE_BG : BRAND_BG} borderStyle="round" borderColor={landed ? DONE_EDGE : BRAND_EDGE}>
      <Box key="reply-handoff-words" flexDirection="column" flexGrow={1} flexShrink={1} minWidth={0}>
        <Text color={landed ? DONE_ACCENT : ACCENT} bold wrap="truncate">{words[0]}</Text>
        <Text wrap="truncate">{words[1]}</Text>
      </Box>
      {fresh.kind === 'ready' ? <Box key="reply-handoff-ask" flexShrink={0} flexDirection="row" gap={1}>{handoffAskButtons($, Button, false)}</Box> : null}
      {onDismiss ? <Button key="card-close" plain role="dismiss" label="✕" onPress={onDismiss} /> : null}
    </Box>
  )
}

/** The session's timers. A reload starts the module over, maybe with no session start (the countdown froze on "Cold"),
 * so the band's first draw starts them too. A session start always starts them: a timer started inside a request may
 * end with it. */
let timersFrom: 'start' | 'draw' | null = null
function startTimers($: EngineInterface, from: 'start' | 'draw') {
  if (timersFrom === 'start' || (timersFrom === 'draw' && from === 'draw')) return
  timersFrom = from
  // The cache countdown's clock. A timer started inside a request ends with that request, so it lives here.
  $.clock.every(CACHE_TICK_MS, () => void showCache($).catch(() => undefined))
  $.clock.every(CACHE_TICK_MS, () => void checkContext($).catch(() => undefined))
  // Read the usage at once too, so the context ring is there from the start rather than a tick later.
  void checkContext($).catch(() => undefined)
  // A written handoff is cleared and resent from here: a hook the turn waits on may not run commands.
  handoffTimer?.cancel()
  handoffTimer = $.clock.every(HANDOFF_POLL_MS, () => {
    // Right after a start the app may not have the usage yet: ask each second until it has.
    if (!lastContext || !lastContext.window) void checkContext($).catch(() => undefined)
    void finishHandoff($).catch(() => undefined)
  })
}

// /reload-plugins loads the module again without a session start, so the first draw starts the timers too.
let loadChecked = false
async function afterLoad($: EngineInterface) {
  if (loadChecked) return
  loadChecked = true
  startTimers($, 'draw')
}
async function homeDir($: EngineInterface) {
  return ((await envUserProfile($)) ?? (await envHome($))) || undefined
}
/** How long "Compact complete" stays above the prompt when nothing else clears it. */
const COMPACT_CARD_MS = 20_000
/** A handoff's or compact's card for the band above the prompt: while it runs, and once landed until the next message
 * is sent, the ✕ is pressed or its time has passed (COMPACT_CARD_MS, HANDOFF_CARD_MS). */
async function compactCard($: EngineInterface, working = false) {
  const card = await read($, handoffCard)
  if (!card || cardRunning(card.kind) || card.kind === 'ready') return card
  const keep = card.kind === 'compacted' ? COMPACT_CARD_MS : HANDOFF_CARD_MS
  if (working || (card.kind === 'compacted' && card.seen) || (await $.clock.now()) - card.at >= keep) return null
  return card
}

/** The lowest effort a helper gets: medium, or the person's Min when higher, never above their Max. A helper's answer
 * goes back to the chat unchecked, and at low it miscounted where medium did not (Effortless's helper benchmark). */
export function helperFloor(floor: Effort, ceiling: Effort): Effort {
  const i = Math.min(Math.max(EFFORTS.indexOf(floor), EFFORTS.indexOf('medium')), EFFORTS.indexOf(ceiling))
  return EFFORTS[i]
}

// Haiku 5.5, named exactly, writes the quick handoff from the transcript when the chat's cache has gone cold, and
// serves the judge. Claude Code's own compaction is left alone.
const COMPACT_MODEL = 'claude-haiku-5-5'
/** The transcript's most text sent to Haiku: about 600k tokens, inside its window with room for the summary. */
const COMPACT_MAX_CHARS = 2_400_000
/** The transcript as plain text for the summarizer: each message, its tool calls and their results, the long ones cut. */
// The last messages go to Haiku nearly whole: the work in progress (the code just written, the error just seen) lives
// in their tool calls and results, and a 400-character cut lost it mid-task.
export const COMPACT_TAIL = 6
const COMPACT_TAIL_CHARS = 20_000
export function compactTranscript(messages: readonly { role: string; text: string; toolUses?: readonly { tool: string; input: unknown; text?: string }[]; toolResults?: readonly { text?: string }[] }[], toolChars = 2000, tailChars = COMPACT_TAIL_CHARS): string {
  const cut = (s: string, n: number) => (s.length > n ? `${s.slice(0, n)} …[${s.length - n} more characters]` : s)
  const tailFrom = messages.length - COMPACT_TAIL
  return messages
    .map((m, i) => {
      const inTail = i >= tailFrom
      const inputChars = inTail ? tailChars : 400
      const resultChars = inTail ? tailChars : toolChars
      const lines = [`${m.role === 'user' ? 'USER' : 'CLAUDE'}: ${m.text}`.trimEnd()]
      for (const t of m.toolUses ?? []) {
        lines.push(`  [${t.tool} ${cut(JSON.stringify(t.input ?? {}), inputChars)}]`)
        if (t.text) lines.push(`  → ${cut(t.text, resultChars)}`)
      }
      if (!m.toolUses?.length) for (const r of m.toolResults ?? []) if (r.text) lines.push(`  → ${cut(r.text, resultChars)}`)
      return lines.join('\n')
    })
    .join('\n\n')
}

/** The quick handoff written by Haiku from the transcript, for a chat whose cache went cold; null when it fails. */
async function haikuHandoff($: EngineInterface, messages: Parameters<typeof compactTranscript>[0]): Promise<string | null> {
  let transcript = compactTranscript(messages)
  if (transcript.length > COMPACT_MAX_CHARS) transcript = compactTranscript(messages, 300, 4000)
  if (transcript.length > COMPACT_MAX_CHARS) return null
  const r = await $.model.complete({
    model: COMPACT_MODEL,
    system: 'You read a conversation between a user and Claude Code, an AI coding agent, and write the handoff the user asks for.',
    prompt: `${transcript}\n\n---\n${HANDOFF_PROMPT}`,
    maxTokens: 4000,
    effort: 'medium',
    timeoutMs: 120_000,
  })
  return r.isAnswered && r.text.trim().length > 100 ? r.text.trim() : null
}

export async function effortSessionStart($: any, e: any, next: any) {
  sessionStarted = Date.now()
  const [storedAuto, storedPick] = await Promise.all([$.store.get('isAuto').catch(() => null), $.store.get('pick').catch(() => null) as Promise<Pick | null>])
  await Promise.all([
    update($, isAuto, () => (typeof storedAuto === 'boolean' ? storedAuto : true)),
    // Auto off means the effort you chose should still be the one in force.
    storedAuto === false && storedPick && EFFORTS.includes(storedPick.effort) ? update($, pick, () => storedPick).then(() => { pickCarried = true }) : null,
  ])
  // The command file lists /mistif:hud before the session starts; registering it here makes plain /mistif:hud the
  // mod's own command afterwards, instead of the file run as a skill.
  void $.command.register({ name: 'hud', description: 'mistif: handoff, auto, stats, bench, debug.' }).catch(() => undefined)
  void afterLoad($).catch(() => undefined)
  startTimers($, 'start')
  void $.session.model().then(m => modelIs($, m)).catch(() => undefined)
  return next(e)
}

// A chat opened again later (resume, fork): the mod starts afresh and has seen no response, so the countdown would
// stay blank on a cache long cold. The app says how long ago the last response was, and whether the cache has
// likely lapsed: the countdown starts from there.
export async function effortClassicStart($: any, e: any, next: any) {
  const result = await next(e)
  const r = e as { source?: string; seconds_since_last_response?: number; prompt_cache_likely_expired?: boolean }
  classicStart = { at: Date.now(), said: `${r.source ?? '?'}, ${r.seconds_since_last_response ?? '?'}s since reply, expired ${r.prompt_cache_likely_expired ?? '?'}` }
  if ((r.source === 'resume' || r.source === 'fork') && typeof r.seconds_since_last_response === 'number' && cacheExpires === 0) {
    const now = await $.clock.now()
    lastResponseAt = now - r.seconds_since_last_response * 1000
    const left = lastResponseAt + CACHE_TTL[cacheTtl]
    cacheExpires = r.prompt_cache_likely_expired || left <= now ? now - 1 : left
    await rememberCache($)
    await checkContext($).catch(() => undefined)
    await showCache($).catch(() => undefined)
    // The app opens the chat and draws its band while this runs; a redraw asked now can land before the band is
    // there, and the next came only with the 15 s cache tick. Ask again over the next seconds.
    $.ui.invalidate('ui.render')
    redrawSoon()
  }
  return result
}

// The handoff turn ended: keep its text; the session's timer clears the chat and sends it.
export async function effortTurnComplete($: any, e: any, next: any) {
  const result = await next(e)
  if (!e.agentId) await setTurnBusy($, false)
  // A lower verdict for a message typed during the turn takes over now, if Auto is still on.
  if (!e.agentId && heldPick) {
    const held = heldPick
    heldPick = null
    if (await read($, isAuto)) await choose($, held)
  }
  // The newest reply's text: its last block carries the warning card (see AssistantMessage).
  if (!e.agentId && e.reason === 'answer') await update($, lastAnswer, () => e.answer.trim())
  if (!e.agentId && turnCost > 0) await update($, lastTurn, () => ({ cost: turnCost, ms: e.durationMs ?? 0 }))
  // A landed handoff card stays under the first reply after it, and goes with the next.
  if (!e.agentId) {
    await update($, handoffCard, card => (!card || cardRunning(card.kind) || card.kind === 'ready' ? card : card.seen ? null : { ...card, seen: true }))
  }
  if (!e.agentId && (await read($, handoffStage)) === 'writing') {
    if (e.reason === 'answer' && e.answer.trim()) handoffText = e.answer
    else {
      await update($, handoffStage, () => null)
      $.ui.toast('mistif: the handoff was not written, nothing was cleared')
    }
  }
  return result
}

// /mistif:hud is a command file in the plugin (commands/hud.md), so the app lists it before the session has
// started; this hook answers it, and the file's text never reaches the model. Both spellings the app may use.
export async function effortCommand($: any, e: any, next: any) {
  if (!['hud', 'mistif:hud', 'effortless', 'effortless:effortless'].includes(e.command)) return next(e)
  const arg = e.args.trim().toLowerCase()
  if (arg === 'auto') {
    await toggleAutoEffort($)
    return { text: (await read($, isAuto)) ? 'Auto on: effort is picked for every prompt.' : 'Auto off: the effort is yours.' }
  }
  if (arg === 'save') return { text: await toggleSave($) }
  if (arg === 'handoff' || arg.startsWith('handoff ')) {
    // /mistif:hud handoff [full] [continue|confirm|copy]: quick or full, and what follows (the setting, unless named).
    const words = arg.split(' ').slice(1)
    const full = words.includes('full')
    const after = (['continue', 'confirm', 'copy'] as const).find(a => words.includes(a)) ?? config.handoffAfter
    await startHandoff($, full, after)
    const what = handoffWhat({ kind: full ? 'full' : 'quick', after }, config.handoffSkill)
    return { text: `Writing the ${full ? 'full' : 'quick'} handoff. ${what.by}. ${what.then}` }
  }
  if (arg === 'debug') {
    const ago = (t: number) => (t ? `${Math.round((Date.now() - t) / 1000)}s ago` : 'never')
    const lastFork = (await $.store.get('lastFork').catch(() => null)) as { at: number; outcome: string } | null
    return {
      text: [
        `session.start ${ago(sessionStarted)}`,
        `app SessionStart: ${classicStart ? `${ago(classicStart.at)} (${classicStart.said})` : 'never'}`,
        `cache: ${cacheExpires === 0 ? 'not started' : `${await cacheMinutes($)} min left`}, shown ${await read($, cacheLeft)}, ttl ${cacheTtl}, last reply ${lastResponseAt ? ago(lastResponseAt) : 'none seen'}, replies seen ${repliesSeen}`,
        `auto: ${await read($, isAuto)}, paused: ${await read($, paused)}`,
        `handoff: ${await read($, handoffStage)}`,
        `last fork: ${lastFork ? `${lastFork.outcome}, ${ago(lastFork.at)}` : 'none'}`,
        lastRequest
          ? `last request: app asked ${lastRequest.appModel} at ${lastRequest.appEffort ?? 'none'}, sent ${lastRequest.model} at ${lastRequest.effort ?? 'none'}${lastRequest.model === lastRequest.appModel && lastRequest.effort === lastRequest.appEffort ? ' (unchanged)' : ' (changed by mistif)'}, ${ago(lastRequest.at)}`
          : 'last request: none yet',
      ].join(' | '),
    }
  }
  if (arg === 'bench' || arg === 'bench mine') {
    // mine: the person's own labelled prompts, kept outside the repo (they are personal), in ~/.claude/mistif-bench-mine.json
    const file = arg === 'bench mine' ? `${await homeDir($)}/.claude/mistif-bench-mine.json` : `${$.plugin.root}/bench/judge-cases.json`
    const cases = (JSON.parse(await $.fs.read(file)) as { cases: BenchCase[] }).cases
    const answers = await runBench($, cases)
    const report = benchReport(cases, answers)
    const stamp = new Date(await $.clock.now()).toISOString().slice(0, 16).replace(/[:T]/g, '-')
    const out = `mistif-bench-${stamp}`
    await $.fs.write(`${out}.json`, JSON.stringify({ cases: cases.length, answers }, null, 2))
    await $.fs.write(`${out}.md`, report)
    return { text: `${report}

Saved to ${out}.md and .json` }
  }
  if (arg === 'cold') {
    coldForced = true
    cacheExpires = await $.clock.now()
    await update($, cacheLeft, () => 0)
    $.ui.invalidate('ui.render')
    return { text: 'The cache shows as cold now (a test). Compact is in the footer. The next response restarts the countdown.' }
  }
  if (arg === 'stats' || arg === 'saved') return { text: `Auto, this session:\n${savedText(await read($, saved))}` }
  return { text: 'Use /mistif:hud auto, save, handoff, handoff full, stats, bench, bench mine or debug.' }
}

export async function effortSubmit($: any, e: any, next: any) {
  await setTurnBusy($, true)
  turnCost = 0
  // A landed handoff's card goes once the next message is sent.
  const card = await read($, handoffCard)
  if (card && (card.kind === 'done' || card.kind === 'copied')) await update($, handoffCard, () => null)
  const byPerson = e.origin.kind === 'composer' || e.origin.kind === 'bridge' || e.origin.kind === 'sdk'
  // The handoff check runs for every message the person types, whatever the effort judge is doing (or whether Auto is on).
  if (byPerson && !e.text.trim().startsWith('/') && !isFollowUp(e.text)) void checkHandoff($, e.text).catch(() => undefined)
  const wantsEffort = await read($, isAuto)
  // A typed slash command is judged only when it is a skill or a custom command (what the person added); the app's own
  // (/compact, /clear, /model) and effortless's never are. The judge is told what the command is, since its name alone says little.
  const slash = e.text.trim().startsWith('/')
  const skill = slash && byPerson ? await typedSkill($, e.text) : undefined
  if (!byPerson || (slash && !skill) || !wantsEffort) return next(e)
  // On a model where an effort change rewrites the cache, Auto waits instead of judging.
  const modelId = await $.session.model()
  await modelIs($, modelId)
  if (!cacheSafe(modelId) && keyOf(modelId) !== 'haiku') return next(e)
  // "go", "ok", "yes" between two steps of work keep the effort Auto already chose; no judge is asked.
  const before = await read($, pick)
  // A message with an image is never a bare follow-up: "fix this" plus a screenshot is new work.
  // Typed while a turn ran (e.turnId), it often steers that task: the judge is told, so it can keep the effort.
  const midTurn = e.turnId !== undefined && before !== null
  const said = skill ? `${e.text}

[This is a slash command that runs a skill: ${skill.description || skill.name}. Judge the work the skill will do.]` : e.text
  const shown = midTurn ? withMidTurn(withAttachments(said, e.attachments), before.effort) : withAttachments(said, e.attachments)
  if (wantsEffort && before && before.by !== 'manual' && !e.attachments?.length && !slash && isFollowUp(e.text) && keepsEffort(e.text, await recentContext($).catch(() => ''))) {
    await countPrompt($, before.effort, undefined, 0, 0)
    void proof($, `follow-up "${e.text.trim()}": keeping ${before.effort}`)
    return next(e)
  }
  // "max effort", "effort: low": the person said the level, so it runs, past Min, Max and save mode, and no judge is asked.
  const named = wantsEffort && !slash ? namedEffort(e.text) : undefined
  if (named) {
    const inUse = await sessionModel($)
    const applied: Pick = { model: inUse, effort: named, why: 'you asked for it', by: 'named' }
    const running = await read($, pick)
    if (midTurn && running && EFFORTS.indexOf(named) < EFFORTS.indexOf(running.effort)) heldPick = applied
    else {
      heldPick = null
      await choose($, applied)
    }
    await countPrompt($, inUse !== 'haiku' ? named : undefined, 'named', 0, 0)
    void proof($, `named level ${named} in "${e.text.slice(0, 50)}": no judge`)
    $.ui.invalidate('ui.render')
    return next(e)
  }

  $.ui.invalidate('ui.render')
  await update($, isJudging, () => true)
  try {
    const inUse = await sessionModel($)
    const startedAt = Date.now()
    const { verdict, tokens: judgeTokens } = await judge($, shown, {
      model: inUse,
      effort: (await read($, pick))?.effort ?? 'medium',
      why: '',
      by: 'manual',
    })
    const ms = Date.now() - startedAt
    await countPrompt($, wantsEffort && inUse !== 'haiku' ? verdict?.effort : undefined, verdict?.by, ms, judgeTokens)
    void proof(
      $,
      verdict
        ? `judged by ${verdict.by} in ${ms} ms: ${verdict.model}/${verdict.effort} (${verdict.why}) for "${e.text.slice(0, 50)}"`
        : `no verdict after ${ms} ms for "${e.text.slice(0, 50)}"`,
    )
    $.ui.invalidate('ui.render')
    if (verdict) {
      // Effort follows the verdict at once, when Auto is on for effort. The model stays: switching it
      // reloads the context, so with Auto on for model it is only suggested.
      if (wantsEffort) {
        const saving = (await read($, saveUntil)) !== null
        const leaned = bounded(tipped(verdict.effort, verdict.sure, config.bias), config.floor, config.ceiling)
        const effort = capped(leaned, saving)
        const why = effort !== leaned ? 'save mode' : leaned !== verdict.effort ? 'your settings' : verdict.why
        const applied: Pick = { ...verdict, model: inUse, effort, why }
        // Mid-turn, a lower verdict would cut the running task's effort for its remaining steps: it waits for the
        // turn to end (the queued message may run as a turn of its own). A higher one helps the task, so it applies.
        const running = await read($, pick)
        if (midTurn && running && EFFORTS.indexOf(effort) < EFFORTS.indexOf(running.effort)) {
          heldPick = applied
          void proof($, `typed mid-turn: ${effort} waits, the running turn keeps ${running.effort}`)
        } else {
          heldPick = null
          await choose($, applied)
        }
      }
    }
  } finally {
    await update($, isJudging, () => false)
  }
  return next(e)
}

// A switch from anywhere (the app's picker, /model, a fallback) moves the pick at once.
export async function effortModelSwitch($: any, e: any, next: any) {
  const result = await next(e)
  await modelIs($, e.to_model)
  return result
}

export async function* effortTurnStep($: any, e: any, next: any) {
  // Every main-conversation response, whatever its effort, keeps the cache warm for its lifetime from now.
  const send = async function* (request: typeof e) {
    if (e.agentId === undefined) lastRequest = { index: e.index, appModel: e.model, appEffort: e.effort, model: request.model, effort: request.effort, at: Date.now() }
    const answer = yield* next(request)
    // Inside the hook ($ calls after it returns are refused), and never allowed to break the request.
    if (e.agentId === undefined && answer?.usage) markWarm(request.model, answer.usage, await $.clock.now().catch(() => Date.now()))
    // A prompt run on a cheaper model leaves the chat's own cache as it was: only the chat's model restarts the countdown.
    if (e.agentId === undefined && answer?.usage && request.model === e.model) await cacheTouched($, answer.usage).catch(() => undefined)
    if (e.agentId === undefined && answer?.usage) turnCost += weighted(answer.usage)
    return answer
  }
  if (e.agentId === undefined) await setTurnBusy($, true)
  if (e.agentId === undefined) await modelIs($, e.model)
  if (e.agentId === undefined && typeof e.effort === 'string') {
    const seen = e.effort
    const isFirst = engineEffort === undefined
    const isByPerson = !isFirst && seen !== engineEffort
    engineEffort = seen
    // The first effort seen is the app's setting; a change the mod did not make is the person's.
    if (isFirst || isByPerson) await update($, appEffort, () => seen)
    // A new chat with Auto off starts from the pick kept from the last chat; the effort the app is on now is the
    // person's (they may have set it before this first prompt), so it wins. A pick made in this chat stays.
    const takesApp = isFirst && pickCarried && !(await read($, isAuto)) && (await read($, pick))?.effort !== seen
    if (isByPerson || takesApp) {
      await update($, isAuto, () => false)
      await $.store.set('isAuto', false)
      await choose($, { model: await sessionModel($), effort: seen, why: 'your pick in the app', by: 'manual' })
      void proof($, `request ${e.index}: you set effort ${seen} yourself, Auto off`)
      // The app has no event for its effort picker: this is the first request after the pick, so say it plainly.
      $.ui.toast(`mistif: Auto is off. You picked ${EFFORT_LABELS[seen as Effort] ?? seen}; turn Auto on to hand it back.`)
      return yield* send(e)
    }
  }
  const p = await read($, pick)
  // Haiku takes no effort: decided by the model this request names, never by a stored pick.
  if (!p || keyOf(e.model) === 'haiku' || !cacheSafe(e.model)) return yield* send(e)
  // Auto off: the app's own effort goes out. A pick the judge made while Auto was on is not the person's choice, and
  // with the app already on the effort they want, the mod would never see a change to give way to.
  if (p.by !== 'manual' && !(await read($, isAuto))) return yield* send(e)
  // A subagent of a turn Auto picked for (Helpers off, or no verdict for it) runs at that turn's effort, no extra
  // judge call, but never below medium: a helper's answer goes back unchecked (see helperFloor). A subagent whose
  // definition sets its own effort cannot be told apart from one that inherits it, so it follows the turn too.
  if (e.agentId !== undefined) {
    if (p.by === 'manual') return yield* send(e)
    const floor = helperFloor(config.floor, config.ceiling)
    const effort = EFFORTS.indexOf(p.effort) < EFFORTS.indexOf(floor) ? floor : p.effort
    if (e.index === 0) void proof($, `subagent ${e.agentId} (${e.model}): effort ${e.effort ?? 'none'} -> ${effort}, the turn's`)
    return yield* send({ ...e, effort })
  }
  if (e.agentId === undefined) void proof($, `request ${e.index} (${e.model}): effort ${e.effort ?? 'none'} -> ${p.effort}`)
  const result = yield* send({ ...e, effort: p.effort })
  // Only requests Auto steered count.
  if (e.agentId === undefined && p.by !== 'manual' && result.usage) {
    await tally($, p.effort, result.usage)
    void proof(
      $,
      `response ${e.index} at ${p.effort}: ${result.usage.output_tokens} out, ${result.usage.cache_read_input_tokens ?? 0} cache read, ${result.usage.cache_creation_input_tokens ?? 0} cache write`,
    )
  }
  return result
}

// The terminal's line under each reply ("Baked 3s") in the brand's colours, with the effort and the cache. The
// desktop draws no such line; the bands above the prompt warn there (a card under the reply repeated them, removed).
export async function effortTurnDuration($: any, e: any, next: any) {
  if (config.hide.includes('line')) return next(e)
  const { Box, Text } = $.ui.resolve(e)
  const v = await snap($)
  const effortNow = effortOf(v, v.modelNow ?? 'sonnet')
  const took = Math.max(1, Math.round(e.props.durationMs / 1000))
  return (
    <Box key="turn-line" flexDirection="row" gap={1}>
      <Text dimColor>{`${e.props.word} ${took < 60 ? `${took}s` : `${Math.floor(took / 60)}m ${took % 60}s`}`}</Text>
      <Text color={ACCENT}>{`✦ ${effortNow ? EFFORT_LABELS[effortNow] : 'Auto'}`}</Text>
      {v.cacheNow === null ? null : (
        <Text dimColor={cacheColor(v.cacheNow) === undefined} color={cacheColor(v.cacheNow)}>{`· ${v.cacheNow <= 0 ? 'cache cold' : `cache ${cacheLabel(v.cacheNow)}`}`}</Text>
      )}
    </Box>
  )
}

// Above the prompt: the card for a handoff or compact (it asks before the chat is cleared, then says it is done).
// Everything else on screen is the hud mod's.
export async function effortAbovePrompt($: any, e: any, next: any) {
  // A reload starts the module over: the timers and the cache countdown come back from here.
  void afterLoad($).catch(() => undefined)
  await restoreCache($).catch(() => undefined)
  if (e.props.hasSurvey) return next(e)
  const card = await compactCard($, !!e.props.isWorking)
  if (!card) return next(e)
  if (e.surface === 'terminal') {
    if (card.kind !== 'ready') return next(e)
    const { Button } = $.ui.resolve(e)
    return terminalPanel($, e, 'handoff-ready', '⇥ Handoff ready', 'Clear this chat and carry on in a new one? It stays in /resume.', [
      ...handoffAskButtons($, Button, true),
      <Button key="handoff-later" plain hotkey="n" label="Not now" onPress={() => answerHandoff($, 'cancel')} />,
    ])
  }
  return handoffCardTree($, e, card,
    card.kind === 'ready'
      ? () => answerHandoff($, 'cancel')
      : !cardRunning(card.kind) ? () => update($, handoffCard, c => (c && !cardRunning(c.kind) ? null : c)) : undefined)
}

/** Lite: one session-scoped section at the end of the system prompt, added once. Full: nothing is added. */
export async function effortPromptCompose($: any, e: any, next: any) {
  const r = await next(e)
  if (config.usage !== 'lite') return r
  return { ...r, sections: [...r.sections, { id: 'mistif:usage', text: LITE_LINE, scope: 'session' as const }] }
}

/** Per-load setup of this mod: what its register did before its hooks. */
export function initEffort(options: unknown): void {
  loadedAt = Date.now()
  firstDrawLogged = false
  drawsTimed = 0
  config = readConfig(options)
  pluginOptions = options
}
