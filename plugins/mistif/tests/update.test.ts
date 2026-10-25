// Tests for /mistif:update. Nothing here runs the real claude command: process.run and the file reads are stubbed.
import { describe, expect, mock, test } from 'claude-code/testing'
import type { On } from 'claude-code'
import type { Engine } from 'claude-code/testing'

const MARKET = '/home/user/.claude/plugins/marketplaces/mistif'
const installed = (v: string) => JSON.stringify({ version: 2, plugins: { 'mistif@mistif': [{ scope: 'user', version: v }] } })
const manifest = JSON.stringify({ plugins: [{ name: 'mistif', source: './plugins/mistif' }] })

// `state.installed` is what installed_plugins.json holds; `onUpdate` is what `claude plugin update` does to it.
function engine(on: On, state: { installed: string; listed: string; ran: string[]; exit?: Record<string, number>; missing?: boolean; onUpdate?: () => void }) {
  mock.env(on, { HOME: '/home/user' })
  on('fs.read', (_$, e) => {
    const path = String(e.path).split(String.fromCharCode(92)).join('/').replace(/^[A-Za-z]:/, '')
    if (path.endsWith('/plugins/installed_plugins.json')) return { value: state.installed ? installed(state.installed) : '{}' } as never
    if (path.endsWith('/plugins/known_marketplaces.json')) return { value: JSON.stringify({ mistif: { installLocation: MARKET } }) } as never
    if (path === `${MARKET}/.claude-plugin/marketplace.json`) return { value: manifest } as never
    if (path === `${MARKET}/plugins/mistif/.claude-plugin/plugin.json`) return { value: JSON.stringify({ version: state.listed }) } as never
    throw new Error(`unexpected read ${path}`)
  })
  on('process.run', (_$, e) => {
    if (state.missing) throw new Error('ENOENT')
    const line = JSON.stringify(e)
    const step = line.includes('marketplace') ? 'marketplace' : 'update'
    state.ran.push(step)
    if (step === 'update') state.onUpdate?.()
    return { value: { exitCode: state.exit?.[step] ?? 0, stdout: '', stderr: '' } } as never
  })
}
const update = ($: Engine, args = '') => $.command.run({ command: 'update', args })

describe('update', () => {
  test('already latest: both commands run, the version is unchanged, no restart is asked for', async ($, on) => {
    const s = { installed: '1.0.29', listed: '1.0.29', ran: [] as string[] }
    engine(on, s)
    const text = (await update($)).text
    expect(s.ran).toEqual(['marketplace', 'update'])
    expect(text).toContain('already the latest')
    expect(text).toContain('1.0.29')
    expect(text).not.toContain('Restart')
  })

  test('updated: says from and to, and that Claude Code must be restarted', async ($, on) => {
    const s = { installed: '1.0.29', listed: '1.0.30', ran: [] as string[], onUpdate: () => { s.installed = '1.0.30' } }
    engine(on, s)
    const text = (await update($)).text
    expect(text).toContain('from 1.0.29 to 1.0.30')
    expect(text).toContain('Restart Claude Code')
  })

  test('claude cannot be run: says so and prints the two manual commands, no throw', async ($, on) => {
    const s = { installed: '1.0.29', listed: '1.0.30', ran: [] as string[], missing: true }
    engine(on, s)
    const text = (await update($)).text
    expect(text).toContain('claude plugin marketplace update mistif')
    expect(text).toContain('claude plugin update mistif@mistif')
    expect(s.ran).toEqual([])
  })

  test('a failing command stops the run and prints the manual commands', async ($, on) => {
    const s = { installed: '1.0.29', listed: '1.0.30', ran: [] as string[], exit: { update: 1 } }
    engine(on, s)
    const text = (await update($)).text
    expect(s.ran).toEqual(['marketplace', 'update'])
    expect(text).toContain('failed')
    expect(text).toContain('claude plugin update mistif@mistif')
    expect(text).not.toContain('Updated')
  })

  test('check finds a newer version and installs nothing', async ($, on) => {
    const s = { installed: '1.0.29', listed: '1.0.30', ran: [] as string[] }
    engine(on, s)
    const text = (await update($, 'check')).text
    expect(s.ran).toEqual(['marketplace'])
    expect(text).toContain('1.0.30 is available')
  })

  test('check with nothing newer (equal, or older, or 1.0.9 vs 1.0.10) says latest', async ($, on) => {
    const s = { installed: '1.0.29', listed: '1.0.29', ran: [] as string[] }
    engine(on, s)
    expect((await update($, 'check')).text).toContain('latest')
    s.listed = '1.0.3'
    expect((await update($, 'check')).text).toContain('latest')
    s.installed = '1.0.9'
    s.listed = '1.0.10'
    expect((await update($, 'check')).text).toContain('1.0.10 is available')
  })

  test('not installed from a marketplace: nothing runs; unknown argument: nothing runs', async ($, on) => {
    const s = { installed: '', listed: '1.0.30', ran: [] as string[] }
    engine(on, s)
    expect((await update($)).text).toContain('nothing to update')
    expect((await update($, 'now')).text).toContain('Unknown argument')
    expect(s.ran).toEqual([])
  })
})
