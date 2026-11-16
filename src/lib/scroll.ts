/** 滚动到页面某个区块，并尊重「减少动效」偏好 */
export function scrollToSection(id: string): void {
  const node = document.getElementById(id)
  if (!node) return

  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  node.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' })
}

export function scrollToTop(): void {
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  window.scrollTo({ top: 0, behavior: reduced ? 'auto' : 'smooth' })
}
