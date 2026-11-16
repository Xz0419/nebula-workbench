import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { useAuth } from '../auth/AuthContext'
import { useRouter } from '../router/router'

/**
 * 登录页。账号由服务端首次启动时创建（见 data/initial-admin.txt 或启动日志），
 * 前端不再预填任何演示口令。
 */
export function LoginView() {
  const { user, pending, error, signIn, clearError } = useAuth()
  const { navigate, search } = useRouter()

  const next = search.get('next') || '/console'

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  // 已经登录（比如手动敲地址进来）直接回目标页
  useEffect(() => {
    if (user) navigate(next, { replace: true })
  }, [user, next, navigate])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const ok = await signIn(email.trim(), password)
    if (ok) navigate(next, { replace: true })
  }

  return (
    <section className="auth">
      <div className="wrap auth__inner">
        <div className="auth__card reveal">
          <span className="eyebrow">工作台</span>
          <h1>登录 Nebula 工作台</h1>
          <p className="auth__lead">用管理员账号登录，查看 AI 处理结果与提效数据。</p>

          <form className="auth__form" onSubmit={handleSubmit} noValidate>
            <label htmlFor="login-email">邮箱</label>
            <input
              id="login-email"
              name="email"
              type="email"
              value={email}
              onChange={(event) => {
                setEmail(event.target.value)
                clearError()
              }}
              placeholder="admin@nebula.local"
              autoComplete="username"
              required
            />

            <label htmlFor="login-password">密码</label>
            <input
              id="login-password"
              name="password"
              type="password"
              value={password}
              onChange={(event) => {
                setPassword(event.target.value)
                clearError()
              }}
              placeholder="首次启动时生成的密码"
              autoComplete="current-password"
              required
            />

            {error && (
              <p className="auth__error" role="alert">
                {error}
              </p>
            )}

            <button className="btn btn--primary auth__submit" type="submit" disabled={pending}>
              {pending ? '登录中…' : '登录'}
            </button>
          </form>

          <p className="auth__hint">
            首次启动生成的账号保存在 <code>data/initial-admin.txt</code>。请妥善保管；忘记密码时请联系系统维护人员。
          </p>

        </div>
      </div>
    </section>
  )
}
