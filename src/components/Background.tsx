import { useScene } from '../hooks/useScene'
import type { Theme } from '../types'

/**
 * 固定定位的背景场景：渐变底 + 极光 canvas + 星尘 canvas。
 * 三层都是 pointer-events:none，不参与布局与交互。
 */
export function Background({ theme }: { theme: Theme }) {
  const { auroraRef, starsRef } = useScene(theme)

  return (
    <div className="scene" aria-hidden="true">
      <div className="scene__grad" />
      <canvas id="aurora" ref={auroraRef} />
      <canvas id="stars" ref={starsRef} />
    </div>
  )
}
