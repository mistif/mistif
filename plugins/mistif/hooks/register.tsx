import type { Register } from 'claude-code'

import {
  effortAbovePrompt, effortClassicStart, effortCommand, effortModelSwitch, effortPromptCompose, effortSessionStart, effortSubmit, effortTurnComplete,
  effortTurnDuration, effortTurnStep, initEffort,
} from './effort'
import { agentsCommand, agentsPane, agentsSessionStart } from './agents'
import { explain, explainAbovePrompt, explainSessionStart, onEdit } from './explain'
import { leanCommand, leanPromptCompose, leanSessionStart } from './lean'
import { askCommand, askPromptSubmit, askSessionStart } from './ask'
import { updateCommand } from './update'
import { hudAbovePrompt, hudSessionMode, hudTurnComplete } from './hud'

// The loader takes one hooks module per plugin and refuses an event hooked twice, so the mods (effort, hud, lean,
// ask, agents, explain, update) are wired here: where several hook the same event, one hook
// runs them in this order, each one's `next` being the next mod's hook. The hooks themselves are exported from the
// mods' own files, because the validator only follows functions it can see by name.
export const register: Register = (on, options) => {
  initEffort(options)

  on('session.start', async ($, e, next) =>
    effortSessionStart($, e, e4 => leanSessionStart($, e4, e5 => askSessionStart($, e5, e6 => agentsSessionStart($, e6, e7 => explainSessionStart($, e7, next))))))
  on('prompt.compose', async ($, e, next) => effortPromptCompose($, e, e2 => leanPromptCompose($, e2, next)))
  on('classic.SessionStart', effortClassicStart)
  on('turn.complete', async ($, e, next) => effortTurnComplete($, e, e2 => hudTurnComplete($, e2, next)))
  on('command.run', async ($, e, next) => leanCommand($, e, e2 => askCommand($, e2, e3 => agentsCommand($, e3, e4 => updateCommand($, e4, e5 => effortCommand($, e5, next))))))
  on('prompt.submit', async ($, e, next) =>
    askPromptSubmit($, e, e2 => effortSubmit($, e2, e3 => explain($, e3, next))))
  on('classic.PostModelSwitch', effortModelSwitch)
  on('turn.step', effortTurnStep)
  on('prompt.change', explain)
  on('prompt.edit', onEdit)
  on('ui.render', { component: 'Pane', requestId: 'agents' }, agentsPane)
  on('ui.render', { component: 'TurnDuration' }, effortTurnDuration)
  on('ui.render', { component: 'SessionMode' }, hudSessionMode)
  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) =>
    effortAbovePrompt($, e, e2 => hudAbovePrompt($, e2, e3 => explainAbovePrompt($, e3, next))))
}
