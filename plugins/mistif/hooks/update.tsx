import { claudeDir, marketplaceOf } from './settings'

// /mistif:update: runs the normal plugin update commands when typed, and nothing else. No timer, no background check,
// nothing sent by this module; the only network traffic is what `claude plugin marketplace update` does itself.
// `check` refreshes the marketplace listing and compares versions without installing.
const STEP_MS = 60000

const num = (v: string) => v.split(/[.+-]/).map(p => parseInt(p, 10) || 0)
function isNewer(a: string, b: string): boolean {
  const [x, y] = [num(a), num(b)]
  for (let i = 0; i < Math.max(x.length, y.length); i++) {
    if ((x[i] ?? 0) !== (y[i] ?? 0)) return (x[i] ?? 0) > (y[i] ?? 0)
  }
  return false
}

async function readJson($: any, path: string): Promise<any> {
  try {
    return JSON.parse(String(await $.fs.read(path)))
  } catch {
    return undefined
  }
}

async function installedVersion($: any, dir: string, key: string): Promise<string | undefined> {
  const list = (await readJson($, `${dir}/plugins/installed_plugins.json`))?.plugins?.[key]
  const v = Array.isArray(list) ? list.find((p: any) => p?.scope === 'user')?.version ?? list[0]?.version : undefined
  return typeof v === 'string' && v ? v : undefined
}

// The version the marketplace cache now lists: marketplace.json names the plugin's folder, plugin.json holds the version.
async function listedVersion($: any, dir: string, market: string): Promise<string | undefined> {
  const where = (await readJson($, `${dir}/plugins/known_marketplaces.json`))?.[market]?.installLocation
  const root = String(where ?? `${dir}/plugins/marketplaces/${market}`).split(String.fromCharCode(92)).join('/')
  const entry = (await readJson($, `${root}/.claude-plugin/marketplace.json`))?.plugins?.find((p: any) => p?.name === 'mistif')
  const folder = typeof entry?.source === 'string' ? entry.source : './plugins/mistif'
  const v = (await readJson($, `${root}/${folder.replace(/^\.\//, '')}/.claude-plugin/plugin.json`))?.version
  return typeof v === 'string' && v ? v : undefined
}

// Runs `claude plugin ...`; undefined when it cannot be run, else the exit code.
async function claude($: any, ...args: string[]): Promise<number | undefined> {
  const r = await $.process.run(['claude', 'plugin', ...args], { timeoutMs: STEP_MS }).catch(() => undefined)
  return r && typeof r.exitCode === 'number' ? r.exitCode : undefined
}

const manual = (market: string) => `Run these in a terminal instead:\n  claude plugin marketplace update ${market}\n  claude plugin update mistif@${market}`

/** /mistif:update [check]. No argument updates; check only looks. */
export async function updateCommand($: any, e: any, next: any) {
  if (!['update', 'mistif:update'].includes(e.command)) return next(e)
  const arg = e.args.trim().toLowerCase()
  if (arg !== '' && arg !== 'check') return { text: `Unknown argument "${arg}". Use /mistif:update or /mistif:update check.` }
  try {
    const market = marketplaceOf($)
    const key = `mistif@${market}`
    const dir = await claudeDir($)
    const before = await installedVersion($, dir, key)
    if (!before) return { text: `${key} is not installed from a marketplace here, so there is nothing to update.` }
    if ((await claude($, 'marketplace', 'update', market)) !== 0) return { text: `Could not refresh the marketplace (is claude on your PATH, and are you online?). ${manual(market)}` }
    if (arg === 'check') {
      const listed = await listedVersion($, dir, market)
      if (!listed) return { text: `Installed ${before}. Could not read the version the marketplace lists.` }
      return { text: isNewer(listed, before) ? `Installed ${before}, ${listed} is available. Run /mistif:update to install it.` : `mistif ${before} is the latest version.` }
    }
    if ((await claude($, 'update', key)) !== 0) return { text: `The update command failed. ${manual(market)}` }
    const after = await installedVersion($, dir, key)
    if (!after || after === before) return { text: `mistif ${before} is already the latest version.` }
    return { text: `Updated mistif from ${before} to ${after}. Restart Claude Code to load it.` }
  } catch {
    return { text: `Could not update. ${manual('mistif')}` }
  }
}
