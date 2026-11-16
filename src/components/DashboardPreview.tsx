import { buildAreaPath, buildSmoothPath } from '../lib/chart'
import { delay } from '../lib/style'
import { KPIS, TREND_SERIES } from '../data/content'
import { useTilt } from '../hooks/useTilt'

/**
 * 首屏的「产品窗口」：纯展示用假数据，带指针 3D 倾斜。
 * 真实数据请用 ConsoleView，那里的数据走 mockApi。
 */
export function DashboardPreview() {
  const tiltRef = useTilt<HTMLDivElement>(5.5)
  const linePath = buildSmoothPath(TREND_SERIES, 600, 200, 12)
  const areaPath = buildAreaPath(TREND_SERIES, 600, 200, 12)

  return (
    <div className="mock-wrap reveal" style={delay(0.3)}>
      <div className="mock" ref={tiltRef}>
        <div className="mock__inner">
          <div className="chrome">
            <span className="dots" aria-hidden="true">
              <i />
              <i />
              <i />
            </span>
            <span className="chrome__url">nebula.app/console/overview</span>
            <span className="chrome__live">
              <i aria-hidden="true" />实时
            </span>
          </div>

          <div className="dash">
            <div className="dash__row">
              {KPIS.map((kpi) => (
                <div className="kpi" key={kpi.label}>
                  <span>{kpi.label}</span>
                  <b>
                    {kpi.value}{' '}
                    <em className={kpi.trend === 'down' ? 'down' : undefined}>{kpi.delta}</em>
                  </b>
                  <div className="spark" aria-hidden="true">
                    {kpi.bars.map((bar, index) => (
                      <i key={index} style={{ height: `${Math.round(bar * 100)}%` }} />
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <div className="dash__main">
              <div className="card-m">
                <div className="card-m__head">
                  <h4>请求趋势 · 近 24 小时</h4>
                  <div className="legend">
                    <span>
                      <i style={{ background: '#7c5cff' }} aria-hidden="true" />
                      P50
                    </span>
                    <span>
                      <i style={{ background: '#22d3ee' }} aria-hidden="true" />
                      P99
                    </span>
                  </div>
                </div>

                <svg
                  className="chart__svg"
                  viewBox="0 0 600 200"
                  preserveAspectRatio="none"
                  aria-hidden="true"
                  focusable="false"
                >
                  <defs>
                    <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#7c5cff" stopOpacity="0.4" />
                      <stop offset="100%" stopColor="#7c5cff" stopOpacity="0" />
                    </linearGradient>
                    <linearGradient id="lineGrad" x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0%" stopColor="#7c5cff" />
                      <stop offset="55%" stopColor="#22d3ee" />
                      <stop offset="100%" stopColor="#ff6bd6" />
                    </linearGradient>
                  </defs>

                  <g className="chart__grid">
                    <line x1="0" y1="50" x2="600" y2="50" />
                    <line x1="0" y1="100" x2="600" y2="100" />
                    <line x1="0" y1="150" x2="600" y2="150" />
                  </g>

                  <path className="chart__area" fill="url(#areaGrad)" d={areaPath} />
                  <path
                    className="chart__line"
                    pathLength={1}
                    fill="none"
                    stroke="url(#lineGrad)"
                    strokeWidth={2.5}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    vectorEffect="non-scaling-stroke"
                    d={linePath}
                  />
                </svg>
              </div>

              <div className="card-m">
                <div className="card-m__head">
                  <h4>洞察来源</h4>
                </div>
                <div className="rows">
                  <div className="row">
                    <span className="row__dot" aria-hidden="true" />
                    <span className="row__name">事件流</span>
                    <span className="row__bar">
                      <i style={{ width: '82%' }} />
                    </span>
                    <span className="row__val">82%</span>
                  </div>
                  <div className="row">
                    <span className="row__dot" aria-hidden="true" />
                    <span className="row__name">日志</span>
                    <span className="row__bar">
                      <i style={{ width: '54%' }} />
                    </span>
                    <span className="row__val">54%</span>
                  </div>
                  <div className="row">
                    <span className="row__dot" aria-hidden="true" />
                    <span className="row__name">数据库</span>
                    <span className="row__bar">
                      <i style={{ width: '31%' }} />
                    </span>
                    <span className="row__val">31%</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
