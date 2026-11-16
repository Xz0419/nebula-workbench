import type {
  AiConfigInput,
  AiConfigInfo,
  AiConfigTestResult,
  AiRun,
  Health,
  LoginResult,
  KnowledgeDoc,
  Metrics,
  Ticket,
  TicketMessage,
  User,
} from '../types'

/**
 * 真实接口层（无 mock）。
 *
 * 前后端分离部署时，API 地址由 web 服务下发的 /config.js 在运行时注入，
 * 不需要重新构建前端就能改后端地址：
 *
 *   1. window.__NEBULA_API__      （运行时，优先）
 *   2. VITE_API_BASE_URL          （构建时）
 *   3. '/api'                     （同源兜底）
 */

const runtimeBase = typeof window !== 'undefined' ? window.__NEBULA_API__ : undefined
const BASE_URL = (runtimeBase ?? import.meta.env.VITE_API_BASE_URL ?? '/api').replace(/\/$/, '')
const TIMEOUT_MS = 20000

export class ApiError extends Error {
  readonly status: number
  readonly code: string

  constructor(message: string, status: number, code = 'unknown') {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
  }
}

interface ErrorBody {
  error?: { code?: string; message?: string }
}

async function request<T>(
  path: string,
  init: RequestInit = {},
  timeoutMs = TIMEOUT_MS,
): Promise<T> {
  const controller = new AbortController()
  const timer = window.setTimeout(() => controller.abort(), timeoutMs)

  try {
    const response = await fetch(`${BASE_URL}${path}`, {
      method: init.method ?? 'GET',
      body: init.body,
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
      },
    })


    if (!response.ok) {
      let message = `请求失败（HTTP ${response.status}）`
      let code = 'http_error'
      try {
        const body = (await response.json()) as ErrorBody
        if (body?.error?.message) message = body.error.message
        if (body?.error?.code) code = body.error.code
      } catch {
        /* 服务端没返回 JSON */
      }
      throw new ApiError(message, response.status, code)
    }

    if (response.status === 204) return undefined as unknown as T
    return (await response.json()) as T
  } catch (error) {
    if (error instanceof ApiError) throw error
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new ApiError('请求超时，请稍后重试。', 0, 'timeout')
    }
    throw new ApiError('网络异常，请检查连接后重试。', 0, 'network')
  } finally {
    window.clearTimeout(timer)
  }
}

/* ---------------- 认证 ---------------- */

export function login(credentials: { email: string; password: string }): Promise<LoginResult> {
  return request<LoginResult>('/auth/login', { method: 'POST', body: JSON.stringify(credentials) })
}

export function logout(): Promise<void> {
  return request<void>('/auth/logout', { method: 'POST' })
}

export function fetchMe(): Promise<{ user: User }> {
  return request<{ user: User }>('/auth/me')
}

/* ---------------- 工单 ---------------- */

export async function fetchTickets(status: 'all' | Ticket['status'] = 'all'): Promise<Ticket[]> {
  const result = await request<{ tickets: Ticket[] }>(`/tickets?status=${status}&limit=100`)
  return result.tickets
}

export function createTicket(body: { subject: string; body: string; customer?: string; priority: string; category?: string }): Promise<{ ticket: Ticket; run: AiRun }> {
  return request('/tickets', { method: 'POST', body: JSON.stringify(body) }, 65_000)
}

export function fetchTicket(id: string): Promise<{ ticket: Ticket; messages: TicketMessage[]; runs: AiRun[] }> {
  return request<{ ticket: Ticket; messages: TicketMessage[]; runs: AiRun[] }>(`/tickets/${encodeURIComponent(id)}`)
}

export function processTicket(id: string): Promise<{ ticket: Ticket; run: AiRun; stages: AiStageLike[] }> {
  return request(`/tickets/${encodeURIComponent(id)}/process`, { method: 'POST' }, 65_000)
}

export function approveTicket(id: string, body: { answer?: string; minutes?: number } = {}) {
  return request<{ ticket: Ticket }>(`/tickets/${encodeURIComponent(id)}/approve`, {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export function replyTicket(id: string, body: { answer: string; minutes?: number }) {
  return request<{ ticket: Ticket }>(`/tickets/${encodeURIComponent(id)}/reply`, {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export function escalateTicket(id: string) {
  return request<{ ticket: Ticket }>(`/tickets/${encodeURIComponent(id)}/escalate`, { method: 'POST' })
}

interface AiStageLike {
  name: string
  status: 'ok' | 'failed'
  ms: number
  detail: string
}

/* ---------------- 指标与 AI 配置 ---------------- */

export function fetchMetrics(days = 14): Promise<Metrics> {
  return request<Metrics>(`/metrics?days=${days}`)
}

export function fetchAiConfig(): Promise<AiConfigInfo> {
  return request<AiConfigInfo>('/ai/config')
}

export function saveAiConfig(body: AiConfigInput): Promise<{ ok: boolean; config: AiConfigInfo['config']; changed: boolean }> {
  return request('/ai/config', { method: 'POST', body: JSON.stringify(body) })
}

export function testAiConfig(body: AiConfigInput): Promise<AiConfigTestResult> {
  return request('/ai/config/test', { method: 'POST', body: JSON.stringify(body) }, 35_000)
}

export async function fetchRuns(limit = 20): Promise<AiRun[]> {
  const result = await request<{ runs: AiRun[] }>(`/ai/runs?limit=${limit}`)
  return result.runs
}

export function fetchHealth(): Promise<Health> {
  return request<Health>('/health')
}

export async function fetchKnowledge(): Promise<KnowledgeDoc[]> {
  const result = await request<{ documents: KnowledgeDoc[] }>('/knowledge')
  return result.documents
}
export function saveKnowledge(body: { id?: string; title: string; text: string; active: boolean }): Promise<{ document: KnowledgeDoc }> {
  return request('/knowledge', { method: 'POST', body: JSON.stringify(body) })
}

export interface SearchResult { id: string; title: string; text: string; score: number; coverage: number; relevant: boolean }
export async function searchKnowledge(query: string): Promise<SearchResult[]> {
  return (await request<{ documents: SearchResult[] }>('/knowledge/search', { method: 'POST', body: JSON.stringify({ query }) })).documents
}
export interface EvaluationResult { status: 'ok' | 'failed'; answer: string | null; citations: string[]; confidence: number | null; latencyMs: number; error?: string; model: string; provider: string; version: string; stages: AiRun['stages'] }
export function evaluateCase(subject: string, body: string): Promise<EvaluationResult> {
  return request('/evaluate', { method: 'POST', body: JSON.stringify({ subject, body }) }, 65_000)
}

export function addTicketNote(id: string, content: string): Promise<{ messages: TicketMessage[] }> {
  return request(`/tickets/${encodeURIComponent(id)}/notes`, { method: 'POST', body: JSON.stringify({ content }) })
}
