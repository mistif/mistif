export type ModelKey = 'haiku' | 'sonnet' | 'opus' | 'fable'
export type Effort = 'low' | 'medium' | 'high' | 'xhigh' | 'max'

/** What the prompts Auto steered cost, measured: tokens by kind, and per effort the prompts and their weighted cost. */
export type Spent = {
  prompts: number
  requests: number
  input: number
  write: number
  read: number
  out: number
  byEffort: Partial<Record<Effort, { prompts: number; cost: number }>>
  /** How often the judge decided, the time it took in all (ms), and its tokens. */
  judge: { haiku: number; ms: number; tokens: number }
  /** Kept so older saved tallies still read; nothing counts them any more. */
  moved: number
  redone: number
}

/** What the next turn runs with, and who decided it. */
export type Pick = {
  model: ModelKey
  effort: Effort
  /** A few words on why. */
  why: string
  /** named: the person said the level in the prompt ("max effort"). */
  by: 'haiku' | 'manual' | 'named'
  /** How sure the judge was of the effort, 0-1, when it said. */
  sure?: number
  /** Haiku only: why a handoff would suit now (a few words), when it said it would. */
  handoff?: string
}

/** What follows a handoff once the person has said to clear: carry on, or wait; or keep the chat and copy it. */
export type HandoffAfter = 'continue' | 'confirm' | 'copy'

/** A choice for a handoff: quick (a fork) or full (the person's skill), then what follows. */
export type HandoffChoice = { kind: 'quick' | 'full'; after: HandoffAfter }

/** One subagent in the agents pane. */
export type Row = {
  id: string
  description: string
  type: string
  name?: string
  status: string
  startedAt: number
  endedAt?: number
}

declare module 'claude-code' {
  interface PluginState {
    'mistif': {
      /** Auto on effort: every prompt is judged and its effort applied. */
      isAuto: boolean
      /** The last change Auto made to the effort, shown for a moment as "Low → High". */
      switched: { from: Effort; to: Effort } | null
      /** What the prompts Auto steered cost this session, measured (see Spent). */
      saved: Spent
      /** The session runs a model where an effort change rewrites the prompt cache: Auto waits. */
      paused: boolean
      /** Whole minutes the prompt cache stays warm: null before the first response, 0 once cold. the hud reads it. */
      cacheLeft: number | null
      /** What the cache countdown knows, kept here because a reload starts the module's own variables over. */
      cacheMemo: { expires: number; ttl: '5m' | '1h'; last?: number } | null
      /** A compaction is running. */
      isCompacting: boolean
      /** The fullest usage window once past 80%, or null. */
      hot: { kind: string; percent: number; resetsAt: string | null } | null
      /** Save mode until this time (ms), or null. */
      saveUntil: number | null
      /** Why Haiku thinks a handoff would suit now; null when it has no advice. the hud lights its button on it. */
      handoffAdvice: string | null
      /** Where a handoff is: null idle, writing, ready (written, asking whether to clear), or clearing and resending. */
      handoffStage: 'writing' | 'ready' | 'clearing' | null
      /** The newest reply's text. */
      lastAnswer: string
      /** What the newest reply cost: tokens weighted by price over the main thread's requests, and its time. */
      lastTurn: { cost: number; ms: number } | null
      /** The handoff or compact card above the prompt. */
      handoffCard: { kind: 'writing' | 'ready' | 'done' | 'copied' | 'compacting' | 'compacted'; full: boolean; at: number; seen: boolean } | null
      pick: Pick | null
      isJudging: boolean
      /** The effort the person last set outside the mod (the app's control, their /effort): what the app shows. */
      appEffort: string | null
      /** The model the session runs now, as the engine last reported it (start, a switch, a request). */
      model: ModelKey | null
      /** The plain-words note shown above the prompt after a /skill. */
      note: string | null
      /** Lean mode: how hard it pushes for the smallest change. */
      leanLevel: 'off' | 'lite' | 'full' | 'ultra'
      /** Nudge: whether the session asks Claude to check the mistif skills first. */
      nudgeLevel: 'off' | 'on'
      /** The subagents the agents pane lists (the newest 8). */
      agentRows: Row[]
    }
  }
}
