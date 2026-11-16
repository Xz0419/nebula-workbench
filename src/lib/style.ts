import type { CSSProperties } from 'react'

/**
 * 生成进场动画的延迟：把秒数写成 CSS 变量 --d。
 * 配合 .reveal { transition-delay: var(--d, 0s) } 使用。
 */
export function delay(seconds: number): CSSProperties {
  return { '--d': `${seconds}s` } as CSSProperties
}
