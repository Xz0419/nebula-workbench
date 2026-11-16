import { LOGOS } from '../data/content'
import { delay } from '../lib/style'
import { scrollToSection } from '../lib/scroll'
import { DashboardPreview } from './DashboardPreview'

interface HeroProps {
  onOpenConsole: () => void
}

export function Hero({ onOpenConsole }: HeroProps) {
  return (
    <section className="hero">
      <div className="wrap">
        <span className="pill reveal">
          <span className="dot" aria-hidden="true" />v1.0 · AI 先处理一遍
        </span>

        <h1 className="hero__title reveal" style={delay(0.06)}>
          工单进来
          <br />
          <span className="grad">AI 先做一遍</span>
        </h1>

        <p className="hero__sub reveal" style={delay(0.12)}>
          能答的自动答掉，答不了的带着草稿转人工。省下多少人时，页面上直接算给你看。
        </p>

        <div className="hero__cta reveal" style={delay(0.18)}>
          <button className="btn btn--primary" type="button" onClick={onOpenConsole}>
            进入工作台
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M5 12h13M13 6l6 6-6 6" />
            </svg>
          </button>

          <button
            className="btn btn--ghost"
            type="button"
            onClick={() => scrollToSection('stats')}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M8 5.2v13.6a.8.8 0 0 0 1.22.68l10.7-6.8a.8.8 0 0 0 0-1.36L9.22 4.52A.8.8 0 0 0 8 5.2z" />
            </svg>
            看它怎么工作
          </button>
        </div>

        <div className="hero__meta reveal" style={delay(0.24)}>
          <div className="avatars" aria-hidden="true">
            <span />
            <span />
            <span />
          </div>
          <p>
            已有 <strong>12,800+</strong> 个团队在使用
          </p>
        </div>

        <DashboardPreview />

        <div className="logos reveal" style={delay(0.36)}>
          <span>Trusted by</span>
          <ul>
            {LOGOS.map((logo) => (
              <li key={logo}>{logo}</li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  )
}
