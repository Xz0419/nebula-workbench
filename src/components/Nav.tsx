import { useEffect, useState } from 'react'
import { Link, useRouter } from '../router/router'
import { useAuth } from '../auth/AuthContext'
import { scrollToSection, scrollToTop } from '../lib/scroll'
import type { Theme } from '../types'

interface NavProps {
  theme: Theme
  onToggleTheme: () => void
}

const ANCHORS = [
  { id: 'features', label: '产品能力' },
  { id: 'flow', label: '处理流程' },
  { id: 'stats', label: '效果观察' },
  { id: 'cta', label: '开始使用' },
]

export function Nav({ theme, onToggleTheme }: NavProps) {
  const { path, navigate } = useRouter()
  const { user } = useAuth()

  const [stuck, setStuck] = useState(false)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const handleScroll = () => setStuck(window.scrollY > 12)
    handleScroll()
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  // 路由变了就收起移动端菜单
  useEffect(() => {
    setOpen(false)
  }, [path])

  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    const handleResize = () => {
      if (window.innerWidth > 900) setOpen(false)
    }
    window.addEventListener('keydown', handleKey)
    window.addEventListener('resize', handleResize)
    return () => {
      window.removeEventListener('keydown', handleKey)
      window.removeEventListener('resize', handleResize)
    }
  }, [])

  /**
   * 区块锚点用按钮 + scrollIntoView，而不是 href="#xxx"：
   * hash 已经被路由占用，#features 会被当成路径 /features 从而 404。
   */
  function goSection(id: string) {
    setOpen(false)
    if (path !== '/') {
      navigate('/')
      window.setTimeout(() => scrollToSection(id), 90)
      return
    }
    scrollToSection(id)
  }

  const navClass = ['nav', stuck ? 'is-stuck' : '', open ? 'menu-open' : ''].filter(Boolean).join(' ')

  return (
    <header className={navClass}>
      <div className="nav__inner">
        <Link
          className="brand"
          to="/"
          onClick={() => {
            setOpen(false)
            if (path === '/') scrollToTop()
          }}
        >
          <span className="brand__mark" aria-hidden="true" />
          <span className="brand__name">Nebula</span>
        </Link>

        <nav className="nav__links" id="navlinks" aria-label="主导航">
          {ANCHORS.map((anchor) => (
            <button
              key={anchor.id}
              type="button"
              className="nav__link"
              onClick={() => goSection(anchor.id)}
            >
              {anchor.label}
            </button>
          ))}

          <Link className="nav__link nav__link--route" to="/console">
            控制台
          </Link>
          {user ? (
            <Link className="nav__link nav__link--route" to="/settings">
              设置
            </Link>
          ) : (
            <Link className="nav__link nav__link--route" to="/login">
              登录
            </Link>
          )}
        </nav>

        <div className="nav__actions">
          <button
            className="icon-btn"
            type="button"
            onClick={onToggleTheme}
            aria-label={theme === 'light' ? '切换到深色主题' : '切换到浅色主题'}
          >
            {theme === 'light' ? (
              <svg
                width="17"
                height="17"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <circle cx="12" cy="12" r="4" />
                <path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M19.1 4.9l-1.4 1.4M6.3 17.7l-1.4 1.4" />
              </svg>
            ) : (
              <svg
                width="17"
                height="17"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M21 12.8A8.5 8.5 0 1 1 11.2 3a6.6 6.6 0 0 0 9.8 9.8z" />
              </svg>
            )}
          </button>

          {user ? (
            <>
              <Link className="btn btn--primary btn--sm" to="/console">
                控制台
              </Link>
              <Link className="btn btn--ghost btn--sm nav__secondary" to="/settings">
                设置
              </Link>
            </>
          ) : (
            <>
              <Link className="btn btn--ghost btn--sm" to="/login">
                登录
              </Link>
              <button
                className="btn btn--primary btn--sm nav__cta"
                type="button"
                onClick={() => goSection('cta')}
              >
                开始使用
              </button>
            </>
          )}

          <button
            className="icon-btn nav__burger"
            type="button"
            onClick={() => setOpen((value) => !value)}
            aria-label={open ? '关闭菜单' : '打开菜单'}
            aria-controls="navlinks"
            aria-expanded={open}
          >
            <span />
            <span />
            <span />
          </button>
        </div>
      </div>
    </header>
  )
}
