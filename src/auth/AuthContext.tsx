import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import type { User } from '../types'
import { login as apiLogin } from '../lib/api'
import { clearSession, readUser, writeSession } from '../lib/session'

interface AuthValue {
  user: User | null
  pending: boolean
  error: string | null
  signIn: (email: string, password: string) => Promise<boolean>
  signOut: () => void
  clearError: () => void
}

const AuthContext = createContext<AuthValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  // 初始值同步读本地会话，避免首屏闪一下未登录状态
  const [user, setUser] = useState<User | null>(readUser)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const signIn = useCallback(async (email: string, password: string) => {
    setPending(true)
    setError(null)
    try {
      const result = await apiLogin({ email, password })
      writeSession(result)
      setUser(result.user)
      return true
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '登录失败，请重试。')
      return false
    } finally {
      setPending(false)
    }
  }, [])

  const signOut = useCallback(() => {
    clearSession()
    setUser(null)
  }, [])

  const clearError = useCallback(() => setError(null), [])

  // 多标签页同步：另一个标签退出登录时，这里也跟着退出
  useEffect(() => {
    const handleStorage = (event: StorageEvent) => {
      if (event.key !== 'nebula-user' && event.key !== null) return
      setUser(readUser())
    }
    window.addEventListener('storage', handleStorage)
    return () => window.removeEventListener('storage', handleStorage)
  }, [])

  const value = useMemo<AuthValue>(
    () => ({ user, pending, error, signIn, signOut, clearError }),
    [user, pending, error, signIn, signOut, clearError],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthValue {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth 必须在 <AuthProvider> 内使用')
  return context
}
