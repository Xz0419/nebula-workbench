import { Link, useRouter } from '../router/router'

export function NotFoundView() {
  const { path } = useRouter()

  return (
    <section className="auth">
      <div className="wrap auth__inner">
        <div className="auth__card reveal">
          <span className="eyebrow">404</span>
          <h1>这里没有东西</h1>
          <p className="auth__lead">
            找不到 <code>{path}</code> 对应的页面。
          </p>
          <div className="auth__actions">
            <Link className="btn btn--primary" to="/">
              回到首页
            </Link>
            <Link className="btn btn--ghost" to="/console">
              打开控制台
            </Link>
          </div>
        </div>
      </div>
    </section>
  )
}
