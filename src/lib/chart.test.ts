import { describe, expect, it } from 'vitest'
import { buildAreaPath, buildSmoothPath } from './chart'

describe('buildSmoothPath', () => {
  it('空数组返回空字符串', () => {
    expect(buildSmoothPath([])).toBe('')
  })

  it('单个值退化成水平线', () => {
    expect(buildSmoothPath([0.5], 100, 100, 10)).toBe('M0,50.00 L100,50.00')
  })

  it('以左上角 M 命令开始', () => {
    expect(buildSmoothPath([0, 1, 0.5], 100, 100, 10).startsWith('M0,')).toBe(true)
  })

  it('n 个点之间会产生 n-1 段三次贝塞尔', () => {
    const path = buildSmoothPath([0.1, 0.5, 0.9], 100, 100, 10)
    expect(path.match(/ C/g)).toHaveLength(2)
  })

  it('超出 0~1 的数值会被夹紧而不越界', () => {
    expect(buildSmoothPath([5], 100, 100, 0)).toBe('M0,0.00 L100,0.00')
    expect(buildSmoothPath([-5], 100, 100, 0)).toBe('M0,100.00 L100,100.00')
  })
})

describe('buildAreaPath', () => {
  it('闭合到右下角与左下角', () => {
    expect(buildAreaPath([0.5], 100, 100, 0).endsWith('L100,100 L0,100 Z')).toBe(true)
  })

  it('空数组返回空字符串', () => {
    expect(buildAreaPath([])).toBe('')
  })
})
