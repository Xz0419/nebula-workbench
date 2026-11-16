import { useEffect, useRef } from 'react'

/**
 * 一整页只用一个 IntersectionObserver：
 * 在容器内扫描 .reveal 元素，进入视口后打上 .in（配合 CSS 过渡）。
 *
 * deps 变化（比如切换视图）时重新收集节点，这样新渲染的区块也能进场。
 */
export function useRevealGroup<T extends HTMLElement>(deps: unknown[] = []) {
  const ref = useRef<T>(null)

  useEffect(() => {
    const root = ref.current
    if (!root) return

    const nodes = Array.from(root.querySelectorAll<HTMLElement>('.reveal'))
    if (nodes.length === 0) return

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    if (!('IntersectionObserver' in window) || reduced) {
      nodes.forEach((node) => node.classList.add('in'))
      return
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return
          entry.target.classList.add('in')
          observer.unobserve(entry.target)
        })
      },
      { threshold: 0.12, rootMargin: '0px 0px -8% 0px' },
    )

    nodes.forEach((node) => observer.observe(node))

    return () => observer.disconnect()
  }, deps)

  return ref
}
