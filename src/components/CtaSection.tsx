import { useState } from 'react'
import type { FormEvent } from 'react'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function CtaSection() {
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState({ ok: false, message: '无需信用卡 · 随时取消' })

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const value = email.trim()

    if (!EMAIL_RE.test(value)) {
      setStatus({ ok: false, message: '请输入有效的工作邮箱地址。' })
      return
    }

    // TODO: 接真实接口，例如 await fetch('/api/invite', { method: 'POST', body: ... })
    setStatus({ ok: true, message: `已收到，邀请链接会发送到 ${value}` })
    setEmail('')
  }

  return (
    <section className="section" id="cta" style={{ paddingTop: 0 }}>
      <div className="wrap">
        <div className="cta reveal">
          <h2>准备好让数据开口了？</h2>
          <p>免费开始，三分钟内看到第一条实时曲线。</p>

          <form className="cta__form" onSubmit={handleSubmit} noValidate>
            <label className="sr-only" htmlFor="cta-email">
              工作邮箱
            </label>
            <input
              id="cta-email"
              name="email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@company.com"
              autoComplete="email"
              required
            />
            <button className="btn btn--primary" type="submit">
              获取邀请
            </button>
          </form>

          <p className={`cta__note${status.ok ? ' ok' : ''}`} role="status">
            {status.message}
          </p>
        </div>
      </div>
    </section>
  )
}
