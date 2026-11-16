import { useCallback, useEffect, useState } from 'react'
import type { Theme } from '../types'

const STORAGE_KEY = 'nebula-theme'

function readInitialTheme(): Theme {
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY)
    if (saved === 'dark' || saved === 'light') return saved
  } catch {
    // 隐私模式 / 禁用存储时直接回退默认值
  }
  return 'light'
}

/**
 * 深色 / 浅色主题：写回 <html data-theme>，并同步 theme-color 与 localStorage。
 */
export function useTheme() {
  const [theme, setTheme] = useState<Theme>(readInitialTheme)

  useEffect(() => {
    document.documentElement.dataset.theme = theme

    const meta = document.querySelector('meta[name="theme-color"]')
    if (meta) {
      meta.setAttribute('content', theme === 'light' ? '#f4f6f8' : '#10141c')
    }

    try {
      window.localStorage.setItem(STORAGE_KEY, theme)
    } catch {
      // 忽略存储失败
    }
  }, [theme])

  const toggle = useCallback(() => {
    setTheme((current) => (current === 'dark' ? 'light' : 'dark'))
  }, [])

  return { theme, toggle }
}
