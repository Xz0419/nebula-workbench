/** 应用级共享类型 */

export type Theme = 'dark' | 'light'
export type View = 'landing' | 'console'

/** 图标名，交给 <Icon /> 渲染 */
export type IconName = 'pulse' | 'sparkle' | 'users' | 'shield' | 'code'

export interface Feature {
  icon: IconName
  title: string
  desc: string
  wide?: boolean
}

export interface Step {
  index: string
  title: string
  desc: string
}

export interface Stat {
  value: number
  decimals: number
  suffix: string
  label: string
}

export interface KpiCard {
  label: string
  value: string
  delta: string
  trend: 'up' | 'down'
  bars: number[]
}

/** 时间范围（落地页图表用） */
export type Range = '1h' | '24h' | '7d'

/* ---------------- 账号与认证 ---------------- */

export type Role = 'admin' | 'viewer'

export interface User {
  id: string
  name: string
  email: string
  role: Role
}

export interface LoginResult {
  token: string
  user: User
}

/* ---------------- 工单与 AI 处理 ---------------- */

export type TicketStatus = 'queued' | 'auto_resolved' | 'needs_human' | 'resolved'

export interface Ticket {
  id: string
  externalId: string | null
  channel: string
  subject: string
  body: string
  customer: string | null
  priority: string
  category: string
  status: TicketStatus
  aiAnswer: string | null
  aiCitations: string[]
  aiConfidence: number | null
  aiVersion: string | null
  aiMs: number | null
  aiTokensIn: number | null
  aiTokensOut: number | null
  aiError: string | null
  humanAnswer: string | null
  handledBy: string | null
  humanMinutes: number | null
  createdAt: string
  escalatedAt: string | null
  resolvedAt: string | null
}

export interface KnowledgeDoc { id: string; title: string; text: string; active: boolean; updatedAt: string }

export interface TicketMessage { id: string; kind: string; content: string; actor: string | null; createdAt: string }

export interface AiStage {
  name: string
  status: 'ok' | 'failed'
  ms: number
  detail: string
  documents?: Array<{ id: string; title: string; text: string; score: number; coverage: number }>
}

export interface AiRun {
  id: string
  ticketId: string | null
  version: string
  model: string | null
  status: 'ok' | 'failed'
  confidence: number | null
  latencyMs: number
  tokensIn: number
  tokensOut: number
  errorStage: string | null
  error: string | null
  stages: AiStage[]
  createdAt: string
}

export interface Metrics {
  windowDays: number
  baseline: { humanMinutes: number; autoResolveConfidence: number }
  totals: {
    tickets: number
    autoResolved: number
    handledByHuman: number
    backlog: number
    automationRate: number
    avgAiMs: number
    savedMinutes: number
    savedHours: number
    humanMinutesActual: number
    tokensOut: number
  }
  series: Array<{ date: string; auto: number; human: number; total: number }>
  versionPerf: Array<{
    version: string
    runs: number
    okRate: number
    avgMs: number
    avgConfidence: number
    tokens: number
  }>
}

export type AiProviderId = 'sim' | 'deepseek' | 'compatible'

export interface AiProviderOption {
  id: AiProviderId
  label: string
  defaultBaseUrl: string
  defaultModel: string
  models: string[]
  requiresApiKey: boolean
}

export interface AiConfig {
  version: string
  provider: AiProviderId
  model: string
  baseUrl: string
  apiKeyConfigured: boolean
}

export interface AiConfigInfo {
  config: AiConfig
  available: {
    versions: string[]
    models: string[]
    providers: AiProviderOption[]
  }
}

export interface AiConfigInput {
  version: string
  provider: AiProviderId
  model: string
  baseUrl: string
  apiKey?: string
  clearApiKey?: boolean
}

export interface AiConfigTestResult {
  ok: boolean
  message: string
  latencyMs: number
  model: string
}

export interface Health {
  ok: boolean
  version: string
  uptimeSec: number
  ai: {
    version: string
    provider?: AiProviderId
    model: string
    baseUrl?: string
    apiKeyConfigured?: boolean
    available: AiConfigInfo['available']
  }
  db: { tickets: number; autoResolved: number; backlog: number; aiRuns: number; users: number; deploys: number }
}
