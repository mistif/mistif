import { atom, read, update } from 'claude-code'

// Ask-first: a local check (no model call) on the first prompt of a session. If it asks to build something and names no
// file, path, code or identifier, in under 60 words, one short rule is attached to that prompt for the model: ask before building.
// It exists because the benchmark showed skills changed the outcome only on vague requests, and Haiku asks only when the
// rule is put in front of it directly. Levels: off, auto (default; a person at the prompt), on (also headless). The
// environment variable MISTIF_ASK=on|off|auto overrides the saved level, so an eval can pick one.
export const ASK_LEVELS = ['off', 'auto', 'on'] as const
export type AskLevel = (typeof ASK_LEVELS)[number]
export type AskRun = { interactive: boolean; prompts: number }
const FRESH: AskRun = { interactive: true, prompts: 0 }

const askLevel = atom({ plugin: 'mistif', key: 'askLevel' } as const, 'auto' as AskLevel)
const askRun = atom({ plugin: 'mistif', key: 'askRun' } as const, FRESH as AskRun)

export const MAX_WORDS = 60
export const ASK_TEXT =
  'The first request does not say what to build, for whom, or what done means. Ask the person one question at a time (five at most), then give a one-paragraph brief and a "done means" list. Write no code before that. Use mistif:interview if you can.'

const BUILD = /\b(build|make|create|write|set up|setup|develop|design|code|generate|put together|whip up|spin up|come up with)\b/i
const WANT = /\b(i|we)\s*(?:want|need|would like|'d like|d like|am looking for|'m looking for)\b/i
const NOT_BUILD = /\b(fix|debug|refactor|review|explain|summari[sz]e|translate|rename|delete|remove|upgrade|migrate|deploy|install|error|exception|traceback|stack trace)\b/i
const QUESTION = /^(?:what|why|how|where|when|who|which|is|are|does|do|did|should|could|would|can)\b(?!.*\b(?:you|u)\b.*\b(?:build|make|create|write|set up|setup|develop|generate)\b)/i
// A file, path, extension, backticks, a code fence, or an identifier (camelCase, snake_case, dotted name).
const NAMED = /`|\/\/|[\w.-]+[\/][\w.-]+|\b\w+\.(?:[a-z]{1,5})\b(?<!\be\.g)(?<!\bi\.e)|\b[a-z]+[A-Z]\w*|\b[a-z0-9]+_[a-z0-9_]+\b|\b[A-Z][a-z]+[A-Z]\w*|\b[\w-]+\(\)/

// Framework names that look like a file name.
const FRAMEWORK = /\b(?:next|node|vue|nuxt|three|express|d3|p5|alpine|ember|backbone|socket|chart|react|angular)\.(?:js|io)\b/gi
const words = (s: string) => s.trim().split(/\s+/).filter(Boolean).length

/** Whether a first prompt is a short build request that names nothing concrete. A plain function; tests call it directly. */
export function isVagueBuild(text: string): boolean {
  const t = text.trim()
  if (t === '' || words(t) >= MAX_WORDS || NAMED.test(t.replace(FRAMEWORK, '')) || NOT_BUILD.test(t)) return false
  if (QUESTION.test(t)) return false
  return BUILD.test(t) || WANT.test(t)
}

const asLevel = (v: unknown): AskLevel | undefined => (ASK_LEVELS.includes(v as AskLevel) ? (v as AskLevel) : undefined)

export async function askSessionStart($: any, e: any, next: any) {
  const stored = await $.store.get('askLevel').catch(() => null)
  const forced = await $.env.get('MISTIF_ASK').catch(() => null)
  const level = asLevel(String(forced ?? '').trim().toLowerCase()) ?? asLevel(stored) ?? 'auto'
  await Promise.all([update($, askLevel, () => level), update($, askRun, () => ({ ...FRESH, interactive: e.isInteractive !== false }))])
  return next(e)
}

/** Checks the session's first prompt (a slash command is not one). When it fires, the rule goes down with the prompt as one
 * context block: the model sees it, the person does not, and it works headless, where the system prompt is built before the prompt exists. */
export async function askPromptSubmit($: any, e: any, next: any) {
  if (e.command) return next(e)
  const [level, run] = await Promise.all([read($, askLevel), read($, askRun)])
  if (run.prompts > 0) return next(e)
  const applies = level === 'on' || (level === 'auto' && run.interactive)
  const fires = applies && isVagueBuild(String(e.text ?? ''))
  await update($, askRun, (r: AskRun) => ({ ...r, prompts: 1 }))
  return next(fires ? { ...e, context: [...(e.context ?? []), ASK_TEXT] } : e)
}

/** /mistif:ask [off|auto|on]. No argument says where it stands. */
export async function askCommand($: any, e: any, next: any) {
  if (!['ask', 'mistif:ask'].includes(e.command)) return next(e)
  const arg = e.args.trim().toLowerCase()
  if (arg === '') return { text: `Ask-first is ${await read($, askLevel)}. Use /mistif:ask off|auto|on. auto: only with a person at the prompt; on: always.` }
  const level = asLevel(arg)
  if (!level) return { text: `Unknown level "${arg}". Use off, auto or on.` }
  await Promise.all([update($, askLevel, () => level), $.store.set('askLevel', level)])
  const forced = asLevel(String((await $.env.get('MISTIF_ASK').catch(() => null)) ?? '').trim().toLowerCase())
  return { text: `Ask-first ${level}: applies to a session's first prompt.${forced ? ` MISTIF_ASK=${forced} is set and wins.` : ''}` }
}
