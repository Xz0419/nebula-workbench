import { describe, expect, it } from 'vitest'
import { formatCompact, formatMetricValue, makeTrendLabels } from './format'

describe('formatMetricValue', () => {
  it('按小数位补齐', () => {
    expect(formatMetricValue(0.4, 2)).toBe('0.40')
  })

  it('整数加千分位', () => {
    expect(formatMetricValue(1234, 0)).toBe('1,234')
  })

  it('按指定小数位四舍五入', () => {
    expect(formatMetricValue(1234.567, 1)).toBe('1,234.6')
  })
})

describe('formatCompact', () => {
  it('万级以上转成 k', () => {
    expect(formatCompact(12800)).toBe('12.8k')
  })

  it('万级以下保持千分位', () => {
    expect(formatCompact(9999)).toBe('9,999')
  })
})

describe('makeTrendLabels', () => {
  it('数量与请求一致，最后一个固定是「现在」', () => {
    const labels = makeTrendLabels('24h', 5)
    expect(labels).toHaveLength(5)
    expect(labels[4]).toBe('现在')
  })

  it('24 小时跨度从 -24h 开始', () => {
    expect(makeTrendLabels('24h', 5)[0]).toBe('-24h')
  })

  it('7 天跨度按天显示', () => {
    expect(makeTrendLabels('7d', 3)[0]).toBe('-7d')
  })

  it('单点只有「现在」', () => {
    expect(makeTrendLabels('1h', 1)).toEqual(['现在'])
  })
})
