import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react'
import type { AnchorHTMLAttributes, ReactNode } from 'react'

/**
 * 极简 hash 路由。
 *
 * 为什么不用 react-router：项目约定运行时只有 react / react-dom。
 * 代价是只支持「精确路径匹配」，没有嵌套路由、没有 loader、没有参数路由。
 * 一旦页面超过 8 个或需要 /metrics/:id 这类参数路由，
 * 换 react-router 只需替换本文件 + 各处的 <Link>/useRouter 调用点。
 */

function splitHash(hash: string): { path: string; search: string } {
  const raw = hash.replace(/^#/, '')
  const [rawPath, rawSearch = ''] = raw.split('?')
  const path = rawPath && rawPath !== '' ? rawPath : '/'
  return {
    path: path.startsWith('/') ? path : `/${path}`,
    search: rawSearch,
  }
}

function readLocation(): { path: string; search: string } {
  return splitHash(window.location.hash)
}

interface RouterValue {
  path: string
  search: URLSearchParams
  navigate: (to: string, options?: { replace?: boolean }) => void
}

const RouterContext = createContext<RouterValue | null>(null)

export function RouterProvider({ children }: { children: ReactNode }) {
  const [location, setLocation] = useState(readLocation)

  useEffect(() => {
    const handleHashChange = () => setLocation(readLocation())
    window.addEventListener('hashchange', handleHashChange)

    // 首次进入且没有 hash 时补一个，保证地址栏可复制、刷新不丢
    if (!window.location.hash) {
      window.location.replace('#/')
    }

    return () => window.removeEventListener('hashchange', handleHashChange)
  }, [])

  const navigate = useCallback((to: string, options?: { replace?: boolean }) => {
    const target = to.startsWith('/') ? to : `/${to}`
    if (`#${target}` === window.location.hash) return
    if (options?.replace) window.location.replace(`#${target}`)
    else window.location.hash = target
  }, [])

  const value = useMemo<RouterValue>(
    () => ({
      path: location.path,
      search: new URLSearchParams(location.search),
      navigate,
    }),
    [location.path, location.search, navigate],
  )

  return <RouterContext.Provider value={value}>{children}</RouterContext.Provider>
}

export function useRouter(): RouterValue {
  const context = useContext(RouterContext)
  if (!context) throw new Error('useRouter 必须在 <RouterProvider> 内使用')
  return context
}

interface LinkProps extends Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> {
  to: string
}

/** 站内链接：保留 Ctrl/⌘ + 点击在新标签打开的原生行为 */
export function Link({ to, onClick, children, ...rest }: LinkProps) {
  const { navigate } = useRouter()

  return (
    <a
      {...rest}
      href={`#${to}`}
      onClick={(event) => {
        onClick?.(event)
        if (event.defaultPrevented) return
        if (event.button !== 0) return
        if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
        event.preventDefault()
        navigate(to)
      }}
    >
      {children}
    </a>
  )
}
