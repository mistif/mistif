import { atom, read, update } from 'claude-code'

// Lean mode: the smallest complete change, reuse before writing, a short reply. One level (off, lite, full, ultra),
// kept in the mod's store, added to the system prompt as one session section while it is on. It follows the structure
// and ideas of ponytail (Dietrich Gebert, MIT), reworded; no code or text is copied.
export const LEAN_LEVELS = ['off', 'lite', 'full', 'ultra'] as const
export type LeanLevel = (typeof LEAN_LEVELS)[number]

const leanLevel = atom({ plugin: 'mistif', key: 'leanLevel' } as const, 'off' as LeanLevel)

const CORE = [
  'Lean mode: aim for the smallest change that fully does the job, and keep your reply short.',
  'Before editing, read what you will touch and list every place the edit will touch or depend on: callers, tests, fixtures, configuration, exported names. Also note who could be hurt (data lost or exposed, callers that break). Stay inside that list.',
  'To choose how, take the first option that works: leave it out and say so in a line; reuse what the project already has; use the language or platform built-ins; use a package that is already installed; write one clear line; only then write new code, and as little of it as works. Do not add a dependency for a few lines, or a wrapper, switch or hook for a need nobody has stated.',
  'Finish the task properly: repair whatever your edit breaks (callers, tests, fixtures) in the same change. For a bug, search for every caller, then fix the cause once, where it lives. Code that you move keeps its checks and error handling. New branching, parsing, money or security logic gets one small test. Mark a known shortcut with a comment: `TODO(lean): <limit>; <when to revisit>`.',
  'Do not weaken input validation at trust boundaries, error handling that protects data, security or accessibility.',
  'End with one or two lines: what you left out, what you did not verify, and any danger the reader should know about.',
]
const LEVEL_LINE: Record<Exclude<LeanLevel, 'off'>, string> = {
  lite: 'Level lite: build what was asked. If a smaller way exists, name it in one line and let the person choose.',
  full: 'Level full: apply the above.',
  ultra: 'Level ultra: apply the above and first question the request: say which parts the need does not justify and propose dropping them before you build.',
}

/** The one section added to the system prompt at a level; empty at off. */
export function leanText(level: LeanLevel): string {
  return level === 'off' ? '' : `${CORE.join('\n')}\n${LEVEL_LINE[level]}`
}

const asLevel = (v: unknown): LeanLevel => (LEAN_LEVELS.includes(v as LeanLevel) ? (v as LeanLevel) : 'off')

export async function leanSessionStart($: any, e: any, next: any) {
  const stored = await $.store.get('leanLevel').catch(() => null)
  await update($, leanLevel, () => asLevel(stored))
  return next(e)
}

export async function leanPromptCompose($: any, e: any, next: any) {
  const r = await next(e)
  const text = leanText(asLevel(await read($, leanLevel)))
  return text ? { ...r, sections: [...r.sections, { id: 'mistif:lean', text, scope: 'session' as const }] } : r
}

/** /mistif:lean [off|lite|full|ultra]. No argument says where it stands. */
export async function leanCommand($: any, e: any, next: any) {
  if (!['lean', 'mistif:lean'].includes(e.command)) return next(e)
  const arg = e.args.trim().toLowerCase()
  if (arg === '') return { text: `Lean mode is ${asLevel(await read($, leanLevel))}. Use /mistif:lean off|lite|full|ultra.` }
  if (!LEAN_LEVELS.includes(arg as LeanLevel)) return { text: `Unknown level "${arg}". Use off, lite, full or ultra.` }
  await Promise.all([update($, leanLevel, () => arg as LeanLevel), $.store.set('leanLevel', arg)])
  $.ui.invalidate('ui.render')
  return { text: arg === 'off' ? 'Lean mode off.' : `Lean mode ${arg}: from the next reply.` }
}

export async function currentLean($: any): Promise<LeanLevel> {
  return asLevel(await read($, leanLevel))
}
