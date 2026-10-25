// Where Claude Code's settings.json lives and a safe way to edit one plugin's options in it (used by the hud settings card).

// ~/.claude: Windows sets USERPROFILE, not HOME.
export async function home($: any) {
  return (await $.env.get('HOME')) ?? (await $.env.get('USERPROFILE'))
}
export async function claudeDir($: any): Promise<string> {
  return (await $.env.get('CLAUDE_CONFIG_DIR')) ?? `${await home($)}/.claude`
}

// The marketplace name is read from where this plugin was loaded from, so a renamed marketplace edits the right key.
export function marketplaceOf($: any): string {
  return /[\\/](?:local-marketplaces|cache|marketplaces)[\\/]([^\\/]+)[\\/]/.exec(String($.plugin.root))?.[1] ?? 'mistif'
}
export function pluginKey($: any) {
  return `mistif@${marketplaceOf($)}`
}

export async function settingsFile($: any) {
  return `${await claudeDir($)}/settings.json`
}

// The mods API has no atomic rename, so the write is made as safe as it can be: read the file again right before
// writing (so a change made while the card was open is kept), check the result parses, rotate five backups, and say
// out loud when anything fails instead of swallowing it. `edit` changes the parsed settings and returns false when
// there is nothing to write.
export async function writeSettings($: any, edit: (s: any) => boolean): Promise<boolean> {
  const path = await settingsFile($)
  const text = String(await $.fs.read(path))
  const s = JSON.parse(text)
  if (!edit(s)) return false
  const out = JSON.stringify(s, null, 2)
  JSON.parse(out)
  const n = (Number(await $.store.get('settingsBackups').catch(() => 0)) || 0) % 5
  await $.store.set('settingsBackups', n + 1)
  await $.fs.write(`${path}.bak-mistif-${n}`, text)
  await $.fs.write(path, out)
  return true
}
