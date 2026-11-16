import { useEffect } from 'react'
import type { ReactNode } from 'react'
import { useAuth } from './AuthContext'
import { useRouter } from '../router/router'

/**
 * 路由守卫：未登录时记录来路并跳到登录页，登录成功后原路返回。
 */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const { path, navigate } = useRouter()

  useEffect(() => {
    if (user) return
    navigate(`/login?next=${encodeURIComponent(path)}`, { replace: true })
  }, [user, path, navigate])

  if (!user) {
    return (
      <div className="gate">
        <span className="gate__spinner" aria-hidden="true" />
        <p>正在跳转到登录页…</p>
      </div>
    )
  }

  return <>{children}</>
}
