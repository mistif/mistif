import { atom, read, update } from 'claude-code'

// Nudge: one short session section that asks Claude to check the mistif skills before software work. Models rarely
// load a skill unprompted, and this is the whole fix. On or off, kept in the mod's store. The environment variable
// MISTIF_NUDGE=off|on overrides the stored level at session start, so a test run can try both. The idea of
// a session-start reminder is inspired by superpowers' session-start hook; the wording is our own.
export const NUDGE_LEVELS = ['off', 'on'] as const
export type NudgeLevel = (typeof NUDGE_LEVELS)[number]

const nudgeLevel = atom({ plugin: 'mistif', key: 'nudgeLevel' } as const, 'on' as NudgeLevel)

export const NUDGE_TEXT =
  'For software work, check whether a mistif skill fits (interview, build, test, review, ship, design, decide) and load it with the Skill tool before you start. Skip this for plain questions and one-line asks.'

const asLevel = (v: unknown): NudgeLevel | undefined => (NUDGE_LEVELS.includes(v as NudgeLevel) ? (v as NudgeLevel) : undefined)

export async function nudgeSessionStart($: any, e: any, next: any) {
  const stored = await $.store.get('nudgeLevel').catch(() => null)
  const fromEnv = await $.env.get('MISTIF_NUDGE').catch(() => null)
  await update($, nudgeLevel, () => asLevel(String(fromEnv ?? '').trim().toLowerCase()) ?? asLevel(stored) ?? 'on')
  return next(e)
}

export async function nudgePromptCompose($: any, e: any, next: any) {
  const r = await next(e)
  return (await read($, nudgeLevel)) === 'on' ? { ...r, sections: [...r.sections, { id: 'mistif:nudge', text: NUDGE_TEXT, scope: 'session' as const }] } : r
}

/** /mistif:nudge [off|on]. No argument says where it stands. */
export async function nudgeCommand($: any, e: any, next: any) {
  if (!['nudge', 'mistif:nudge'].includes(e.command)) return next(e)
  const arg = e.args.trim().toLowerCase()
  if (arg === '') return { text: `Nudge is ${await read($, nudgeLevel)}. Use /mistif:nudge off|on.` }
  const level = asLevel(arg)
  if (!level) return { text: `Unknown level "${arg}". Use off or on.` }
  await Promise.all([update($, nudgeLevel, () => level), $.store.set('nudgeLevel', level)])
  const fromEnv = asLevel(String((await $.env.get('MISTIF_NUDGE').catch(() => null)) ?? '').trim().toLowerCase())
  return { text: `Nudge ${level}: from the next reply.${fromEnv ? ` MISTIF_NUDGE=${fromEnv} is set and wins in a new session.` : ''}` }
}
