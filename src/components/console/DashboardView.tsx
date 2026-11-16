import type { AiConfigInfo, Metrics, Ticket } from '../../types'
import { ConsoleIcon } from './ConsoleIcon'
import {
  chartTone,
  confidenceTone,
  formatShortDate,
  pct,
  statusTone,
  STATUS_LABEL,
  timeAgo,
  type QueueFilter,
} from './consoleUtils'

interface DashboardViewProps {
  metrics: Metrics | null
  aiInfo: AiConfigInfo | null
  tickets: Ticket[] | null
  onOpenTicket: (id: string) => void
  onOpenTickets: (filter: QueueFilter) => void
  onOpenAiSettings: () => void
}

export function DashboardView({
  metrics,
  aiInfo,
  tickets,
  onOpenTicket,
  onOpenTickets,
  onOpenAiSettings,
}: DashboardViewProps) {
  const totals = metrics?.totals
  const maxCount = Math.max(
    1,
    ...(metrics?.series.map((day) => day.auto + day.human) ?? [1]),
  )
  const visibleTickets = tickets?.slice(0, 6) ?? null

  return (
    <div className="dashboard-view">
      <section className="metric-grid" aria-label="处理指标">
        <MetricCard
          label="自动化处理率"
          value={totals ? pct(totals.automationRate) : '—'}
          detail={
            totals
              ? `${totals.autoResolved} 张自动 / 共 ${totals.tickets} 张`
              : '正在读取处理数据'
          }
        />
        <MetricCard
          label="待人工处理"
          value={totals ? String(totals.backlog) : '—'}
          detail="进入人工队列的积压工单"
          emphasized={Boolean(totals?.backlog)}
        />
        <MetricCard
          label="AI 平均耗时"
          value={totals ? String(totals.avgAiMs) : '—'}
          unit={totals ? 'ms' : undefined}
          detail="包含检索、生成与校验"
        />
        <MetricCard
          label="累计节省人时"
          value={totals ? String(totals.savedHours) : '—'}
          unit={totals ? 'h' : undefined}
          detail={
            metrics
              ? `按 ${metrics.baseline.humanMinutes} 分钟/单估算`
              : '按人工处理基线估算'
          }
        />
      </section>

      <div className="dashboard-panels">
        <section className="surface chart-panel">
          <header className="panel-heading">
            <div>
              <h2>处理吞吐</h2>
              <p>{metrics ? `最近 ${metrics.windowDays} 天` : '正在读取趋势'}</p>
            </div>
            <div className="chart-legend" aria-label="图例">
              <span>
                <i className="legend-swatch legend-swatch--auto" />
                AI 自动
              </span>
              <span>
                <i className="legend-swatch legend-swatch--human" />
                人工处理
              </span>
            </div>
          </header>

          <div className="throughput-chart" aria-label="最近处理吞吐柱状图">
            {metrics ? (
              <>
                <div className="chart-scale" aria-hidden="true">
                  <span>{maxCount}</span>
                  <span>{Math.ceil(maxCount / 2)}</span>
                  <span>0</span>
                </div>
                <div className="chart-body">
                  <div className="chart-plot">
                    {metrics.series.map((day) => {
                      const total = day.auto + day.human
                      return (
                        <div
                          className="chart-column"
                          key={day.date}
                          title={`${day.date}：AI 自动 ${day.auto}，人工 ${day.human}`}
                        >
                          <div
                            className="chart-stack"
                            style={{ height: `${Math.max(total === 0 ? 0 : 5, (total / maxCount) * 100)}%` }}
                          >
                            <span
                              className="chart-segment chart-segment--human"
                              style={{ flexGrow: day.human || (total === 0 ? 0 : 0.01) }}
                            />
                            <span
                              className="chart-segment chart-segment--auto"
                              style={{ flexGrow: day.auto || (total === 0 ? 0 : 0.01) }}
                            />
                          </div>
                        </div>
                      )
                    })}
                  </div>
                  <div className="chart-labels" aria-hidden="true">
                    {metrics.series.map((day, index) => (
                      <span key={day.date}>
                        {index === 0 || index === metrics.series.length - 1 || index % 3 === 0
                          ? formatShortDate(day.date)
                          : ''}
                      </span>
                    ))}
                  </div>
                </div>
              </>
            ) : (
              <div className="panel-loading">正在加载趋势数据…</div>
            )}
          </div>

          <footer className="panel-footer">
            <span>{chartTone(metrics)}</span>
            <span>数据每 15 秒更新</span>
          </footer>
        </section>

        <section className="surface queue-summary">
          <header className="panel-heading">
            <div>
              <h2>当前队列</h2>
              <p>优先处理带 AI 草稿的工单</p>
            </div>
            <span className="queue-count">{totals?.backlog ?? '—'}</span>
          </header>

          <div className="queue-summary__body">
            <button
              className="summary-action"
              type="button"
              onClick={() => onOpenTickets('needs_human')}
            >
              <span className="summary-action__icon">
                <ConsoleIcon name="inbox" />
              </span>
              <span>
                <strong>待人工处理</strong>
                <small>查看草稿、评分和引用</small>
              </span>
              <ConsoleIcon name="chevron-right" size={16} />
            </button>
            <button
              className="summary-action"
              type="button"
              onClick={() => onOpenTickets('all')}
            >
              <span className="summary-action__icon">
                <ConsoleIcon name="tickets" />
              </span>
              <span>
                <strong>全部工单</strong>
                <small>检索历史记录与处理状态</small>
              </span>
              <ConsoleIcon name="chevron-right" size={16} />
            </button>
          </div>

          <button className="ai-config-summary" type="button" onClick={onOpenAiSettings}>
            <span>
              <small>AI 服务</small>
              <strong>
                {aiInfo
                  ? `${providerLabel(aiInfo.config.provider)} · ${aiInfo.config.model}`
                  : '正在读取配置'}
              </strong>
            </span>
            <span className="ai-config-summary__action">
              配置
              <ConsoleIcon name="chevron-right" size={14} />
            </span>
          </button>

          <dl className="system-list">
            <div>
              <dt>人工基线</dt>
              <dd>{metrics ? `${metrics.baseline.humanMinutes} 分钟/单` : '—'}</dd>
            </div>
            <div>
              <dt>自动处理阈值</dt>
              <dd>
                {metrics ? pct(metrics.baseline.autoResolveConfidence * 100) : '—'}
              </dd>
            </div>
          </dl>

        </section>
      </div>

      <section className="surface recent-panel">
        <header className="panel-heading recent-panel__head">
          <div>
            <h2>待处理工单</h2>
            <p>按 AI 草稿可用性优先排列</p>
          </div>
          <button className="button button--quiet" type="button" onClick={() => onOpenTickets('needs_human')}>
            查看全部
            <ConsoleIcon name="chevron-right" size={15} />
          </button>
        </header>

        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>工单</th>
                <th>状态</th>
                <th>提出人</th>
                <th>AI 评分</th>
                <th>更新时间</th>
                <th aria-label="操作" />
              </tr>
            </thead>
            <tbody>
              {visibleTickets === null &&
                [0, 1, 2, 3].map((item) => (
                  <tr key={item}>
                    <td colSpan={6}>
                      <span className="table-skeleton" />
                    </td>
                  </tr>
                ))}

              {visibleTickets?.map((ticket) => (
                <tr key={ticket.id}>
                  <td>
                    <button
                      type="button"
                      className="ticket-link"
                      onClick={() => onOpenTicket(ticket.id)}
                    >
                      <strong>{ticket.subject}</strong>
                      <span>{ticket.id.slice(0, 12)}</span>
                    </button>
                  </td>
                  <td>
                    <span className={`status-badge status-badge--${statusTone(ticket.status)}`}>
                      {STATUS_LABEL[ticket.status]}
                    </span>
                  </td>
                  <td>{ticket.customer || '匿名'}</td>
                  <td>
                    {typeof ticket.aiConfidence === 'number' ? (
                      <span className={`confidence confidence--${confidenceTone(ticket.aiConfidence)}`}>
                        {Math.round(ticket.aiConfidence * 100)}
                      </span>
                    ) : (
                      <span className="text-muted">—</span>
                    )}
                  </td>
                  <td className="text-muted">{timeAgo(ticket.createdAt)}</td>
                  <td className="cell-action">
                    <button
                      type="button"
                      className="icon-button icon-button--compact"
                      onClick={() => onOpenTicket(ticket.id)}
                      aria-label={`打开工单：${ticket.subject}`}
                    >
                      <ConsoleIcon name="chevron-right" size={16} />
                    </button>
                  </td>
                </tr>
              ))}

              {visibleTickets?.length === 0 && (
                <tr>
                  <td colSpan={6}>
                    <div className="table-empty">
                      <ConsoleIcon name="check" size={20} />
                      <strong>待人工队列为空</strong>
                      <span>当前没有需要人工确认的工单。</span>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}

function providerLabel(provider: AiConfigInfo['config']['provider']): string {
  if (provider === 'deepseek') return 'DeepSeek'
  if (provider === 'compatible') return '兼容接口'
  return '本地模拟'
}

function MetricCard({
  label,
  value,
  unit,
  detail,
  emphasized = false,
}: {
  label: string
  value: string
  unit?: string
  detail: string
  emphasized?: boolean
}) {
  return (
    <article className={`surface metric-card${emphasized ? ' metric-card--attention' : ''}`}>
      <span className="metric-card__label">{label}</span>
      <strong className="metric-card__value">
        {value}
        {unit ? <small>{unit}</small> : null}
      </strong>
      <span className="metric-card__detail">{detail}</span>
    </article>
  )
}
