/**
 * 把归一化（0~1）的数值序列转成平滑的 SVG path。
 * 用 Catmull-Rom 转三次贝塞尔控制点，避免折线图的硬拐点。
 */
export function buildSmoothPath(
  values: number[],
  width = 600,
  height = 200,
  padding = 12,
): string {
  if (values.length === 0) return ''
  if (values.length === 1) {
    const value = Math.min(1, Math.max(0, values[0]))
    const y = padding + (1 - value) * (height - padding * 2)
    return `M0,${y.toFixed(2)} L${width},${y.toFixed(2)}`
  }

  const maxIndex = values.length - 1
  const points = values.map((raw, i) => {
    const v = Math.min(1, Math.max(0, raw))
    return {
      x: (i / maxIndex) * width,
      y: padding + (1 - v) * (height - padding * 2),
    }
  })

  let d = `M0,${points[0].y.toFixed(2)}`

  for (let i = 0; i < maxIndex; i++) {
    const p1 = points[i]
    const p2 = points[i + 1]
    const p0 = i > 0 ? points[i - 1] : p1
    const p3 = i + 2 <= maxIndex ? points[i + 2] : p2

    const c1x = p1.x + (p2.x - p0.x) / 6
    const c1y = p1.y + (p2.y - p0.y) / 6
    const c2x = p2.x - (p3.x - p1.x) / 6
    const c2y = p2.y - (p3.y - p1.y) / 6

    d += ` C${c1x.toFixed(2)},${c1y.toFixed(2)} ${c2x.toFixed(2)},${c2y.toFixed(2)} ${p2.x.toFixed(2)},${p2.y.toFixed(2)}`
  }

  return d
}

/** 折线下方闭合的填充区域 */
export function buildAreaPath(
  values: number[],
  width = 600,
  height = 200,
  padding = 12,
): string {
  const line = buildSmoothPath(values, width, height, padding)
  if (!line) return ''
  return `${line} L${width},${height} L0,${height} Z`
}
