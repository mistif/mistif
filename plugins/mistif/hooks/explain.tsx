import { atom, read, update } from 'claude-code'

const note = atom({ plugin: 'mistif', key: 'note' } as const, null)

const VOICE = 'The reader talks casually and is still learning Claude Code. Use everyday words, no jargon; if you must use a technical word, explain it in a few words right after.'

let current = ''
// Every skill's label and description, read once per session: a lookup is then a scan of this list, not a process.
let index: [string, string][] = []

// Same pick as the script's find(): exact name first, plugin skills before built-ins, then the shortest name that starts with what was typed.
function findIn(name: string): [string, string] | undefined {
  const cut = name.lastIndexOf(':')
  const plugin = cut < 0 ? '' : name.slice(0, cut)
  const typed = name.slice(cut + 1)
  const skill = (l: string) => l.slice(l.lastIndexOf(':') + 1)
  const pool = index.filter(([l]) => skill(l).startsWith(typed) && (!plugin || l.startsWith(`${plugin}:`)))
  pool.sort(([a], [b]) => Number(skill(a) !== typed) - Number(skill(b) !== typed) || skill(a).length - skill(b).length || (a < b ? -1 : 1))
  return pool[0]
}

// Runs the lookup script that ships with this plugin; `python` on Windows, `python3` elsewhere.
async function py($: any, ...args: string[]): Promise<string> {
  const script = `${$.plugin.root}/hooks/explain.py`
  for (const exe of ['python', 'python3']) {
    const r = await $.process.run([exe, script, ...args], { timeoutMs: 60000 }).catch(() => undefined)
    if (r && r.exitCode === 0) return r.stdout
  }
  return ''
}

// Works out the note for the /command at the start of `text`. `wait` lets typing settle first.
async function show($: any, text: string, wait: number) {
  const name = /^\/([\w:.-]+)/.exec(text)?.[1] ?? ''
  if (name === current) return
  current = name
  if (!name) {
    await update($, note, () => null)
    return
  }

  if (wait) await $.clock.sleep(wait)
  if (current !== name) return

  // the in-memory list answers at once; only before it has loaded do we ask the script (about a second)
  let hit = findIn(name)
  if (!hit && !index.length) {
    const [f, d] = (await py($, '--lookup', name)).trim().split('	')
    if (f && d) hit = [f, d]
  }
  if (!hit || current !== name) {
    if (current === name) await update($, note, () => null)
    return
  }
  const [full, desc] = hit

  const cached = await $.store.get(`plain2:${full}`)
  if (typeof cached === 'string') {
    await update($, note, () => `${full}: ${cached}`)
    return
  }

  // no plain-words line yet: show the description's first sentence now, swap in the model's line when it lands
  const first = desc.split('. ')[0]
  await update($, note, () => `${full}: ${first}`)
  const r = await $.model.complete({
    model: 'haiku',
    maxTokens: 40,
    prompt: `${VOICE}

In 12 words or fewer, say what this does for the reader, starting with a verb:
${desc}`,
  })
  if (!r.isAnswered) return
  const plain = r.text.trim()
  await $.store.set(`plain2:${full}`, plain)
  if (current === name) await update($, note, () => `${full}: ${plain}`)
}

// Writes the plain-words note for every skill ahead of time, so typing never waits on the model.
async function prefill($: any) {
  const todo: [string, string][] = []
  index = JSON.parse(await py($, '--all') || '[]') as [string, string][]
  for (const [full, desc] of index) {
    if (typeof (await $.store.get(`plain2:${full}`)) !== 'string') todo.push([full, desc])
  }
  for (let i = 0; i < todo.length; i += 12) {
    const chunk = todo.slice(i, i + 12)
    const items = chunk.map(([f, d], n) => `${n + 1}. ${f}: ${d}`).join('\n')
    const r = await $.model.complete({
      model: 'haiku',
      maxTokens: 500,
      prompt: `${VOICE}\n\nFor each numbered item, say what it does for the reader in 12 words or fewer, starting with a verb. Answer with exactly one line per item, "N. text", nothing else.\n\n${items}`,
    })
    if (!r.isAnswered) continue
    for (const line of r.text.split('\n')) {
      const m = /^(\d+)\.\s*(.+)$/.exec(line.trim())
      const item = m && chunk[Number(m[1]) - 1]
      if (item) await $.store.set(`plain2:${item[0]}`, m[2].trim())
    }
  }
}

export async function explain($: any, e: { text: string }, next: (e: any) => any) {
  await show($, e.text, 0)
  return next(e)
}

// Typing arrives as prompt.edit (before-text plus the splice). Never block or break the typing.
export function onEdit($: any, e: any, next: (e: any) => any) {
  void show($, e.text.slice(0, e.start) + e.inputText + e.text.slice(e.end), 120).catch(() => {})
  return next(e)
}

export async function explainSessionStart($: any, e: any, next: any) {
  void prefill($).catch(() => {})
  return next(e)
}


export async function explainAbovePrompt($: any, e: any, next: any) {
  // other mods share this slot: draw ours beside theirs, never instead of them
  const below = await next(e).catch(() => undefined)
  const text = await read($, note)
  if (e.props.hasSurvey || text === null) return below
  const { Box, Text } = $.ui.resolve(e)
  // a row of air under the note, so it sits a little above the band
  const mine = (
    <Box marginBottom={1}>
      <Text color="#a79cf7">{text}</Text>
    </Box>
  )
  return below ? <Box flexDirection="column">{mine}{below}</Box> : mine
}

