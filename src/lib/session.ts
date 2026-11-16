import type { LoginResult, User } from '../types'

/**
 * 会话持久化：token 与用户信息分开存，便于只刷新其中一项。
 * 所有操作都包了 try/catch —— 隐私模式下 localStorage 会直接抛错。
 */

const TOKEN_KEY = 'nebula-token'
const USER_KEY = 'nebula-user'

export function getToken(): string | null {
  try {
    return window.localStorage.getItem(TOKEN_KEY)
  } catch {
    return null
  }
}

export function readUser(): User | null {
  try {
    const raw = window.localStorage.getItem(USER_KEY)
    if (!raw) return null
    return JSON.parse(raw) as User
  } catch {
    return null
  }
}

export function writeSession(result: LoginResult): void {
  try {
    window.localStorage.setItem(TOKEN_KEY, result.token)
    window.localStorage.setItem(USER_KEY, JSON.stringify(result.user))
  } catch {
    // 存不进去就退化成内存态，本次会话仍然可用
  }
}

export function clearSession(): void {
  try {
    window.localStorage.removeItem(TOKEN_KEY)
    window.localStorage.removeItem(USER_KEY)
  } catch {
    // 忽略
  }
}
