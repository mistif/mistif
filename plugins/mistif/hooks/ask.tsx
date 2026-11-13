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

// Routing: the benchmark showed the design, decide and review skills raise scores when loaded but are almost never loaded
// unprompted. When the first prompt is clearly one of those jobs, one line asks the model to load that skill. Build, test
// and ship are left alone: loading them showed no gain worth the cost. Later prompts are not routed: once the model has
// read the repository, loading the skill showed no gain (evals/runs/2026-11-11-midsession).
export type Route = 'design' | 'decide' | 'review'
const REVIEW = /\b(?:review|audit|look over|go over|check)\b[^.?!]{0,60}\b(?:commit|diff|pr|pull request|change|changes|branch|patch|code)\b|\b(?:code|security) review\b|\b(?:wrong|break|broken)\b[^.?!]{0,40}\bcheck\b|\b(?:check|look at|look over|go over|read through)\b[^.?!]{0,80}\b(?:issues|bugs|problems|wrong|bloat|vulnerabilit(?:y|ies))\b/i
const NOT_REVIEW = /\b(?:check|see) (?:if|whether|that) (?:it|this|that|they|everything) (?:worked|works|ran|runs|deployed|is (?:live|up|running))\b|\blive trading\b/i
const RELEASE = /\b(?:release|ship|deploy|publish|tag|push)\b/i
const DECIDE = /\b(?:go ahead with|worth (?:it|doing|the)|is (?:it|this|that) (?:even |really )?worth|weigh (?:up|it)|stress[- ]test|sanity[- ]check|pros and cons|trade-?offs?|is (?:this|it) a good idea|better or worse|go\/no-go|go or no-go)\b|\bshould (?:we|i)\b[^.?!]{1,60}\bor\b(?! not\b)/i
// Interface work: a UI thing plus a build or restyle verb, or a complaint or goal about how something looks.
const UI_THING = /\b(?:page|pages|website|site|landing|ui|uis|ux|gui|guis|hud|interface|layout|screen|dashboard|form|frontend|front[- ]end|css|html|styles?|styling|component|navbar|nav bar|top bar|header|footer|spacing|padding|font|fonts|colou?rs?|theme)\b/i
const UI_VERB = /\b(?:build|make(?! sure)|create|design|redesign|restyle|style|polish|clean(?:er)? (?:it |this |them )?up|make over|lay out|rework|redo|tidy|usable|accessible|unusable|hard to use|readable)\b/i
const LOOKS = /\b(?:looks?|looking)\s+(?:(?:very|so|kinda|really|super|too|more|less|much|a bit|pretty|straight)\s+)*(?:bad|cheap|ugly|off|weird|wrong|generic|cluttered|messy|plain|boring|bland|dated|outdated|amateur|poorly|unprofessional|ai slop|slop|clean|cleaner|polished|sleek|modern|professional|fancy|pretty|nicer)\b|\bmake (?:it|this|them|the \w+) (?:look|more clean|cleaner|prettier|sleeker|nicer|more modern|more polished)\b/i
// Small visual parts that a plain edit verb is enough for ("fix the spacing", "remove the top bar").
const STYLE_THING = /\b(?:spacing|padding|margins?|font|fonts|colou?rs?|theme|css|styling|layout|navbar|nav bar|top bar|header|footer|gui|guis|ui|uis)\b/i
const EDIT_VERB = /\b(?:fix|change|update|adjust|move|remove|resize|shrink|enlarge|bigger|smaller|tweak|improve|work on)\b/i
const URL = /https?:\/\/\S+/g
export const ROUTE_TEXT: Record<Route, string> = {
  design: 'This first request is interface work. Load the mistif:design skill before you start and follow it.',
  decide: 'This first request asks for a judgement on a plan or choice. Load the mistif:decide skill before you start and follow it.',
  review: 'This first request asks for a code review. Load the mistif:review skill before you start and follow it.',
}

// A prompt that already names a slash command or skill has picked its own tool.
const PICKED = /(?:^|\s)\/[a-z][\w-]*(?::[\w-]+)?\b|\bmistif:[a-z-]+|\b(?:design|review|decide)[- ]skill\b|\bfrontend-design\b/i

/** Which skill a first prompt should load, or null. Review wins over decide; a release check is not a decision. */
export function routeFor(text: string): Route | null {
  const t = text.trim()
  if (t === '' || words(t) >= 400 || PICKED.test(t)) return null
  const u = t.replace(URL, ' ')
  if (REVIEW.test(u) && !NOT_REVIEW.test(u)) return 'review'
  if (DECIDE.test(u) && !RELEASE.test(u)) return 'decide'
  if ((UI_THING.test(u) && UI_VERB.test(u)) || (STYLE_THING.test(u) && EDIT_VERB.test(u)) || LOOKS.test(u)) return 'design'
  return null
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
  const text = String(e.text ?? '')
  const fires = applies && isVagueBuild(text)
  const route = applies && !fires ? routeFor(text) : null
  await update($, askRun, (r: AskRun) => ({ ...r, prompts: 1 }))
  const add = fires ? ASK_TEXT : route ? ROUTE_TEXT[route] : null
  return next(add ? { ...e, context: [...(e.context ?? []), add] } : e)
}

/** /mistif:ask [off|auto|on]. No argument says where it stands. */
export async function askCommand($: any, e: any, next: any) {
  if (!['ask', 'mistif:ask'].includes(e.command)) return next(e)
  const arg = e.args.trim().toLowerCase()
  if (arg === '') return { text: `Ask-first is ${await read($, askLevel)}. Use /mistif:ask off|auto|on. auto: only with a person at the prompt; on: always. It also routes a clear review, decision or interface first prompt to its skill.` }
  const level = asLevel(arg)
  if (!level) return { text: `Unknown level "${arg}". Use off, auto or on.` }
  await Promise.all([update($, askLevel, () => level), $.store.set('askLevel', level)])
  const forced = asLevel(String((await $.env.get('MISTIF_ASK').catch(() => null)) ?? '').trim().toLowerCase())
  return { text: `Ask-first ${level}: applies to a session's first prompt (ask-first and skill routing).${forced ? ` MISTIF_ASK=${forced} is set and wins.` : ''}` }
}
