import { useEffect, useRef } from 'react'
import type { Theme } from '../types'

interface Blob {
  /** 基准位置（0~1，相对视口） */
  x: number
  y: number
  /** 半径系数（相对短边） */
  r: number
  rgb: [number, number, number]
  speed: number
  phase: number
  ampX: number
  ampY: number
}

interface Star {
  x: number
  y: number
  r: number
  alpha: number
  speed: number
  phase: number
  vy: number
}

const BLOBS: Blob[] = [
  { x: 0.22, y: 0.16, r: 0.62, rgb: [124, 92, 255], speed: 0.00013, phase: 0.0, ampX: 0.1, ampY: 0.08 },
  { x: 0.8, y: 0.22, r: 0.5, rgb: [34, 211, 238], speed: 0.00017, phase: 2.1, ampX: 0.12, ampY: 0.07 },
  { x: 0.56, y: 0.8, r: 0.66, rgb: [255, 107, 214], speed: 0.00011, phase: 4.2, ampX: 0.09, ampY: 0.1 },
  { x: 0.14, y: 0.72, r: 0.46, rgb: [86, 120, 255], speed: 0.00019, phase: 1.0, ampX: 0.14, ampY: 0.09 },
]

/** 极光层按低分辨率渲染，靠 CSS blur 放大 —— 用面积换性能 */
const BLOB_SCALE = 0.32
const STAR_DENSITY = 14000
const STAR_MAX = 180

const STAR_COLOR: Record<Theme, string> = {
  dark: '205,218,255',
  light: '64,74,112',
}

/**
 * 背景场景：两层 canvas。
 *  - 极光：低分辨率 + CSS blur，四个缓慢漂移的径向渐变
 *  - 星尘：贴合 DPR 的高清点阵，缓慢上浮 + 闪烁 + 指针视差
 *
 * 标签页隐藏时停止 rAF；unmount 时注销全部监听（StrictMode 双调用安全）。
 */
export function useScene(theme: Theme) {
  const auroraRef = useRef<HTMLCanvasElement>(null)
  const starsRef = useRef<HTMLCanvasElement>(null)
  const themeRef = useRef<Theme>(theme)

  useEffect(() => {
    themeRef.current = theme
  }, [theme])

  useEffect(() => {
    const aurora = auroraRef.current
    const stars = starsRef.current
    if (!aurora || !stars) return

    const actx = aurora.getContext('2d')
    const sctx = stars.getContext('2d')
    if (!actx || !sctx) return

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const finePointer = window.matchMedia('(pointer: fine)').matches

    let auroraW = 0
    let auroraH = 0
    let stageW = 0
    let stageH = 0
    let starList: Star[] = []

    // 指针视差：目标值 -tx/-ty，缓动到 -px/-py
    let targetX = 0
    let targetY = 0
    let offsetX = 0
    let offsetY = 0

    let rafId = 0
    let resizeId = 0
    let running = false

    function sizeAurora() {
      if (!aurora || !actx) return
      auroraW = Math.max(2, Math.round(window.innerWidth * BLOB_SCALE))
      auroraH = Math.max(2, Math.round(window.innerHeight * BLOB_SCALE))
      aurora.width = auroraW
      aurora.height = auroraH
    }

    function sizeStars() {
      if (!stars || !sctx) return
      const dpr = Math.min(2, window.devicePixelRatio || 1)
      stageW = stars.clientWidth || window.innerWidth
      stageH = stars.clientHeight || window.innerHeight
      stars.width = Math.round(stageW * dpr)
      stars.height = Math.round(stageH * dpr)
      sctx.setTransform(dpr, 0, 0, dpr, 0, 0)

      const count = Math.min(STAR_MAX, Math.round((stageW * stageH) / STAR_DENSITY))
      starList = Array.from({ length: count }, () => ({
        x: Math.random() * stageW,
        y: Math.random() * stageH,
        r: Math.random() * 1.3 + 0.35,
        alpha: Math.random() * 0.45 + 0.12,
        speed: Math.random() * 0.7 + 0.25,
        phase: Math.random() * Math.PI * 2,
        vy: -(Math.random() * 0.1 + 0.02),
      }))
    }

    function drawAurora(time: number) {
      if (!actx) return
      actx.clearRect(0, 0, auroraW, auroraH)
      actx.globalCompositeOperation = 'lighter'

      for (let i = 0; i < BLOBS.length; i++) {
        const blob = BLOBS[i]
        const cx = (blob.x + Math.sin(time * blob.speed + blob.phase) * blob.ampX) * auroraW
        const cy = (blob.y + Math.cos(time * blob.speed * 1.3 + blob.phase) * blob.ampY) * auroraH
        const radius = blob.r * Math.min(auroraW, auroraH) * 1.2
        if (radius <= 0) continue

        const [r, g, b] = blob.rgb
        const gradient = actx.createRadialGradient(cx, cy, 0, cx, cy, radius)
        gradient.addColorStop(0, `rgba(${r},${g},${b},0.55)`)
        gradient.addColorStop(0.45, `rgba(${r},${g},${b},0.16)`)
        gradient.addColorStop(1, `rgba(${r},${g},${b},0)`)

        actx.fillStyle = gradient
        actx.beginPath()
        actx.arc(cx, cy, radius, 0, Math.PI * 2)
        actx.fill()
      }

      actx.globalCompositeOperation = 'source-over'
    }

    function drawStars(time: number) {
      if (!sctx) return
      sctx.clearRect(0, 0, stageW, stageH)
      const color = STAR_COLOR[themeRef.current]

      for (let i = 0; i < starList.length; i++) {
        const star = starList[i]
        star.y += star.vy
        if (star.y < -3) {
          star.y = stageH + 3
          star.x = Math.random() * stageW
        }

        const twinkle = 0.55 + 0.45 * Math.sin(time * 0.001 * star.speed + star.phase)
        const alpha = star.alpha * twinkle
        if (alpha <= 0.01) continue

        const depth = star.r / 1.7
        sctx.beginPath()
        sctx.arc(star.x + offsetX * depth, star.y + offsetY * depth, star.r, 0, Math.PI * 2)
        sctx.fillStyle = `rgba(${color},${alpha.toFixed(3)})`
        sctx.fill()
      }
    }

    function frame(time: number) {
      if (!running) return
      rafId = window.requestAnimationFrame(frame)
      offsetX += (targetX - offsetX) * 0.06
      offsetY += (targetY - offsetY) * 0.06
      drawAurora(time)
      drawStars(time)
    }

    function start() {
      if (running) return
      running = true
      rafId = window.requestAnimationFrame(frame)
    }

    function stop() {
      running = false
      if (rafId) {
        window.cancelAnimationFrame(rafId)
        rafId = 0
      }
    }

    function paintOnce() {
      drawAurora(0)
      drawStars(0)
    }

    function handleResize() {
      if (resizeId) return
      resizeId = window.requestAnimationFrame(() => {
        resizeId = 0
        sizeAurora()
        sizeStars()
        if (reduced) paintOnce()
      })
    }

    function handleVisibility() {
      if (reduced) return
      if (document.hidden) stop()
      else start()
    }

    function handlePointerMove(event: PointerEvent) {
      targetX = (event.clientX / window.innerWidth - 0.5) * 26
      targetY = (event.clientY / window.innerHeight - 0.5) * 20
    }

    sizeAurora()
    sizeStars()
    if (reduced) paintOnce()
    else start()

    document.addEventListener('visibilitychange', handleVisibility)
    window.addEventListener('resize', handleResize)
    if (finePointer) {
      window.addEventListener('pointermove', handlePointerMove, { passive: true })
    }

    return () => {
      stop()
      if (resizeId) window.cancelAnimationFrame(resizeId)
      document.removeEventListener('visibilitychange', handleVisibility)
      window.removeEventListener('resize', handleResize)
      window.removeEventListener('pointermove', handlePointerMove)
    }
  }, [])

  return { auroraRef, starsRef }
}
