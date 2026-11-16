import type { Metrics, Ticket } from '../../types'

export type QueueFilter = 'needs_human' | 'all'
export type ConsolePage = 'dashboard' | 'tickets' | 'knowledge' | 'evaluation' | 'settings'
export type TicketAction = 'approve' | 'escalate' | 'process' | 'reply'

export const STATUS_LABEL: Record<Ticket['status'], string> = {
  queued: '排队中',
  auto_resolved: 'AI 自动处理',
  needs_human: '待人工',
  resolved: '已解决',
}

export type StatusTone = 'neutral' | 'warning' | 'success' | 'info'

export function statusTone(status: Ticket['status']): StatusTone {
  if (status === 'needs_human') return 'warning'
  if (status === 'resolved') return 'success'
  if (status === 'auto_resolved') return 'info'
  return 'neutral'
}

export type ConfidenceTone = 'high' | 'medium' | 'low'

export function confidenceTone(value: number): ConfidenceTone {
  if (value >= 0.75) return 'high'
  if (value >= 0.6) return 'medium'
  return 'low'
}

export function timeAgo(iso: string): string {
  const value = new Date(iso).getTime()
  if (!Number.isFinite(value)) return '—'
  const minutes = Math.max(0, Math.round((Date.now() - value) / 60_000))
  if (minutes < 1) return '刚刚'
  if (minutes < 60) return `${minutes} 分钟前`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours} 小时前`
  return `${Math.round(hours / 24)} 天前`
}

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('zh-CN', { hour12: false })
}

export function formatShortDate(iso: string): string {
  const date = new Date(iso)
  if (!Number.isFinite(date.getTime())) return iso
  return `${date.getMonth() + 1}/${date.getDate()}`
}

export function pct(value: number): string {
  return `${Math.round(value)}%`
}

export function chartTone(metrics: Metrics | null): string {
  if (!metrics || metrics.totals.tickets === 0) return '尚无处理记录'
  return `近 ${metrics.windowDays} 天处理 ${metrics.totals.tickets} 张工单`
}

const SOURCE_LABELS: Record<string, string> = {
  'doc-billing-cycle': '计费周期文档',
  'doc-refund': '退款规则文档',
  'doc-quota': '配额与限流文档',
  'doc-sla': 'SLA 文档',
  'doc-data-residency': '数据驻留文档',
  'doc-invoice': '发票开具文档',
  'doc-ram': '子账号权限文档',
  'doc-support': '技术支持文档',
}

export function sourceLabel(id: string): string {
  return SOURCE_LABELS[id] ?? id
}
