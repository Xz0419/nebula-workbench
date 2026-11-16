import { useAuth } from '../auth/AuthContext'
import { useRouter } from '../router/router'
import type { Theme } from '../types'

interface SettingsViewProps {
  theme: Theme
  onToggleTheme: () => void
}

const ROLE_LABEL: Record<string, string> = {
  admin: '管理员',
  viewer: '只读',
}

export function SettingsView({ theme, onToggleTheme }: SettingsViewProps) {
  const { user, signOut } = useAuth()
  const { navigate } = useRouter()

  function handleSignOut() {
    signOut()
    navigate('/', { replace: true })
  }

  function handleReset() {
    try {
      window.localStorage.clear()
    } catch {
      // 忽略
    }
    window.location.reload()
  }

  return (
    <section className="auth">
      <div className="wrap auth__inner">
        <div className="auth__card auth__card--wide reveal">
          <span className="eyebrow">账号</span>
          <h1>设置</h1>

          <dl className="settings__list">
            <div>
              <dt>昵称</dt>
              <dd>{user?.name ?? '—'}</dd>
            </div>
            <div>
              <dt>邮箱</dt>
              <dd>{user?.email ?? '—'}</dd>
            </div>
            <div>
              <dt>角色</dt>
              <dd>{user ? ROLE_LABEL[user.role] ?? user.role : '—'}</dd>
            </div>
          </dl>

          <div className="settings__row">
            <div>
              <strong>外观</strong>
              <p>当前为{theme === 'light' ? '浅色' : '深色'}主题，选择会保存在本地。</p>
            </div>
            <button className="btn btn--ghost btn--sm" type="button" onClick={onToggleTheme}>
              切换到{theme === 'light' ? '深色' : '浅色'}
            </button>
          </div>

          <div className="settings__row">
            <div>
              <strong>退出登录</strong>
              <p>会清除本地 token，并返回首页。</p>
            </div>
            <button className="btn btn--ghost btn--sm" type="button" onClick={handleSignOut}>
              退出
            </button>
          </div>

          <div className="settings__row settings__row--danger">
            <div>
              <strong>清空本地数据</strong>
              <p>删除主题、会话与所有缓存，页面会重新加载。</p>
            </div>
            <button className="btn btn--ghost btn--sm" type="button" onClick={handleReset}>
              清空
            </button>
          </div>
        </div>
      </div>
    </section>
  )
}
