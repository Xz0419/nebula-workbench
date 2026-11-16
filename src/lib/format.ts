import type { Range } from '../types'

/** 数值展示：固定小数位 + 千分位，保证表格纵向对齐 */
export function formatMetricValue(value: number, decimals: number): string {
  return value.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })
}

/** 12_800 → "12.8k"，用于卡片上的紧凑数字 */
export function formatCompact(value: number): string {
  if (Math.abs(value) >= 10000) return `${(value / 1000).toFixed(1)}k`
  return value.toLocaleString('en-US')
}

const SPAN_HOURS: Record<Range, number> = {
  '1h': 1,
  '24h': 24,
  '7d': 168,
}

function formatAgo(hours: number): string {
  if (hours >= 48) return `-${Math.round(hours / 24)}d`
  if (hours >= 1) return `-${Math.round(hours)}h`
  return `-${Math.max(1, Math.round(hours * 60))}m`
}

/**
 * 生成横轴标签（从过去到现在，共 count 个）。
 * 假数据没有真实时间戳，用「相对现在」的标签既稳定又不会每次渲染都变。
 */
export function makeTrendLabels(range: Range, count: number): string[] {
  const span = SPAN_HOURS[range]
  return Array.from({ length: count }, (_, index) => {
    if (index === count - 1) return '现在'
    const hours = span * (1 - index / (count - 1))
    return formatAgo(hours)
  })
}
