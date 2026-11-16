import { useEffect, useRef } from 'react'

/**
 * 让元素跟随指针做轻微 3D 倾斜。
 *
 * 指针监听挂在父元素上（命中区域比子元素更大），
 * 并用 rAF 合并高频 pointermove，避免一次移动写多次样式。
 */
export function useTilt<T extends HTMLElement>(max = 5.5) {
  const ref = useRef<T>(null)

  useEffect(() => {
    const node = ref.current
    if (!node) return

    const parent = node.parentElement
    if (!parent) return

    if (!window.matchMedia('(pointer: fine)').matches) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    // 显式绑定成非空常量，闭包里就不依赖类型收窄了
    const target: T = node
    const host: HTMLElement = parent

    let frame = 0
    let dx = 0
    let dy = 0

    function apply() {
      frame = 0
      target.style.transform = `rotateX(${(-dy * max).toFixed(2)}deg) rotateY(${(dx * max * 1.35).toFixed(2)}deg)`
    }

    function handleMove(event: PointerEvent) {
      const rect = host.getBoundingClientRect()
      if (rect.width === 0 || rect.height === 0) return
      dx = (event.clientX - rect.left) / rect.width - 0.5
      dy = (event.clientY - rect.top) / rect.height - 0.5
      if (frame) return
      frame = window.requestAnimationFrame(apply)
    }

    function handleLeave() {
      if (frame) {
        window.cancelAnimationFrame(frame)
        frame = 0
      }
      target.style.transform = ''
    }

    host.addEventListener('pointermove', handleMove)
    host.addEventListener('pointerleave', handleLeave)

    return () => {
      host.removeEventListener('pointermove', handleMove)
      host.removeEventListener('pointerleave', handleLeave)
      if (frame) window.cancelAnimationFrame(frame)
    }
  }, [max])

  return ref
}
