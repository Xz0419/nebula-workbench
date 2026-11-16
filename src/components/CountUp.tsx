import { useEffect, useRef, useState } from 'react'

interface CountUpProps {
  value: number
  decimals?: number
  duration?: number
}

function format(value: number, decimals: number): string {
  if (decimals > 0) return value.toFixed(decimals)
  return Math.round(value).toLocaleString('en-US')
}

/**
 * 进入视口后从 0 滚到目标值。
 * 每帧只更新本地 state，卸载 / 不可见时取消 rAF。
 */
export function CountUp({ value, decimals = 0, duration = 1500 }: CountUpProps) {
  const ref = useRef<HTMLSpanElement>(null)
  const [display, setDisplay] = useState(() => format(0, decimals))

  useEffect(() => {
    const el = ref.current
    if (!el) return

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (!('IntersectionObserver' in window) || reduced) {
      setDisplay(format(value, decimals))
      return
    }

    let rafId = 0

    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return
        observer.disconnect()

        const start = performance.now()
        const tick = (now: number) => {
          const progress = Math.min(1, (now - start) / duration)
          const eased = 1 - (1 - progress) ** 3
          setDisplay(format(value * eased, decimals))
          if (progress < 1) rafId = window.requestAnimationFrame(tick)
          else setDisplay(format(value, decimals))
        }
        rafId = window.requestAnimationFrame(tick)
      },
      { threshold: 0.5 },
    )

    observer.observe(el)

    return () => {
      observer.disconnect()
      if (rafId) window.cancelAnimationFrame(rafId)
    }
  }, [value, decimals, duration])

  return <span ref={ref}>{display}</span>
}
