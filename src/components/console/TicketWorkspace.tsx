import { useState } from 'react'
import { addTicketNote } from '../../lib/api'
import type { AiRun, Ticket, TicketMessage } from '../../types'
import { ConsoleIcon } from './ConsoleIcon'
import {
  confidenceTone,
  formatDateTime,
  sourceLabel,
  statusTone,
  STATUS_LABEL,
  timeAgo,
  type QueueFilter,
  type TicketAction,
} from './consoleUtils'

interface TicketDetail {
  ticket: Ticket
  messages: TicketMessage[]
  runs: AiRun[]
}

interface TicketWorkspaceProps {
  tickets: Ticket[] | null
  filter: QueueFilter
  selectedId: string | null
  detail: TicketDetail | null
  detailLoading: boolean
  search: string
  busy: string | null
  replyText: string
  backlog: number
  baselineHumanMinutes: number
  onFilterChange: (filter: QueueFilter) => void
  onSearchChange: (value: string) => void
  onSelect: (id: string) => void
  onReplyTextChange: (value: string) => void
  onRefresh: () => void
  onAction: (action: TicketAction) => void
  onOpenKnowledge: (id: string) => void
}

export function TicketWorkspace({
  tickets,
  filter,
  selectedId,
  detail,
  detailLoading,
  search,
  busy,
  replyText,
  backlog,
  baselineHumanMinutes,
  onFilterChange,
  onSearchChange,
  onSelect,
  onReplyTextChange,
  onRefresh,
  onAction,
  onOpenKnowledge,
}: TicketWorkspaceProps) {
  const [priority, setPriority] = useState('all')
  const [category, setCategory] = useState('all')
  const [sort, setSort] = useState('newest')
  const [period, setPeriod] = useState('all')
  const [status, setStatus] = useState('all')
  const [note, setNote] = useState('')
  const [noteError, setNoteError] = useState('')
  const [noteBusy, setNoteBusy] = useState(false)
  const query = search.trim().toLocaleLowerCase('zh-CN')
  const visibleTickets =
    tickets?.filter((ticket) => {
      if (status !== 'all' && ticket.status !== status) return false
      if (period !== 'all' && Date.now() - new Date(ticket.createdAt).getTime() > Number(period) * 86400000) return false
      if (priority !== 'all' && ticket.priority !== priority) return false
      if (category !== 'all' && ticket.category !== category) return false
      if (!query) return true
      return [ticket.subject, ticket.customer, ticket.id, ticket.body]
        .filter(Boolean)
        .some((value) => value!.toLocaleLowerCase('zh-CN').includes(query))
    }).sort((a, b) => sort === 'oldest' ? a.createdAt.localeCompare(b.createdAt) : sort === 'priority' ? ({ high: 0, normal: 1, low: 2 }[a.priority] ?? 1) - ({ high: 0, normal: 1, low: 2 }[b.priority] ?? 1) || b.createdAt.localeCompare(a.createdAt) : b.createdAt.localeCompare(a.createdAt)) ?? null

  return (
    <div className="ticket-workspace">
      <aside className="surface ticket-list-panel">
        <div className="ticket-list-toolbar">
          <div className="segmented-control" role="tablist" aria-label="工单筛选">
            <button
              type="button"
              role="tab"
              aria-selected={filter === 'needs_human'}
              className={filter === 'needs_human' ? 'is-active' : ''}
              onClick={() => onFilterChange('needs_human')}
            >
              待人工
              {backlog > 0 ? <span>{backlog}</span> : null}
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={filter === 'all'}
              className={filter === 'all' ? 'is-active' : ''}
              onClick={() => onFilterChange('all')}
            >
              全部
            </button>
          </div>
          <button
            type="button"
            className="icon-button"
            onClick={onRefresh}
            disabled={Boolean(busy)}
            aria-label="刷新工单列表"
            title="刷新"
          >
            <ConsoleIcon name="refresh" size={17} />
          </button>
        </div>

        <label className="search-field">
          <ConsoleIcon name="search" size={16} />
          <input
            type="search"
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="搜索标题、提出人或工单号"
          />
        </label>

        <div className="iteration-filters"><select aria-label="按优先级筛选" value={priority} onChange={e => setPriority(e.target.value)}><option value="all">全部优先级</option><option value="high">高优先级</option><option value="normal">普通优先级</option><option value="low">低优先级</option></select><select aria-label="按分类筛选" value={category} onChange={e => setCategory(e.target.value)}><option value="all">全部分类</option><option value="billing">账单与退款</option><option value="account">账号与权限</option><option value="technical">技术问题</option><option value="other">其他</option></select><select aria-label="按状态筛选" value={status} onChange={e => setStatus(e.target.value)}><option value="all">全部状态</option><option value="needs_human">待人工</option><option value="resolved">已解决</option><option value="auto_resolved">AI 自动处理</option><option value="queued">排队中</option></select><select aria-label="按时间筛选" value={period} onChange={e => setPeriod(e.target.value)}><option value="all">全部时间</option><option value="1">近 24 小时</option><option value="7">近 7 天</option><option value="30">近 30 天</option></select><select aria-label="排序" value={sort} onChange={e => setSort(e.target.value)}><option value="newest">最新优先</option><option value="oldest">最早优先</option><option value="priority">优先级优先</option></select></div>
        <div className="ticket-list-scroll">
          {tickets === null &&
            [0, 1, 2, 3].map((item) => (
              <div className="ticket-row ticket-row--loading" key={item}>
                <span className="ticket-skeleton ticket-skeleton--title" />
                <span className="ticket-skeleton ticket-skeleton--meta" />
              </div>
            ))}

          {visibleTickets?.map((ticket) => (
            <button
              type="button"
              className={`ticket-row${ticket.id === selectedId ? ' is-active' : ''}`}
              key={ticket.id}
              onClick={() => onSelect(ticket.id)}
            >
              <span className={`ticket-state-dot ticket-state-dot--${statusTone(ticket.status)}`} />
              <span className="ticket-row__content">
                <span className="ticket-row__topline">
                  <strong>{ticket.subject}</strong>
                  {typeof ticket.aiConfidence === 'number' ? (
                    <span className={`confidence confidence--${confidenceTone(ticket.aiConfidence)}`}>
                      {Math.round(ticket.aiConfidence * 100)}
                    </span>
                  ) : null}
                </span>
                <span className="ticket-row__meta">
                  {ticket.customer || '匿名'} · {timeAgo(ticket.createdAt)}
                </span>
                <span className="ticket-row__status">{STATUS_LABEL[ticket.status]}</span>
              </span>
            </button>
          ))}

          {visibleTickets?.length === 0 && (
            <div className="workspace-empty workspace-empty--compact">
              <ConsoleIcon name="inbox" size={24} />
              <strong>{query ? '没有匹配的工单' : '队列为空'}</strong>
              <span>
                {query
                  ? '尝试更换关键词或切换到全部工单。'
                  : filter === 'needs_human'
                    ? '当前没有待人工处理的工单。'
                    : '创建第一张工单后，记录会显示在这里。'}
              </span>
            </div>
          )}
        </div>

        <footer className="ticket-list-footer">
          <span>{visibleTickets?.length ?? 0} 张工单</span>
          <span>15 秒自动刷新</span>
        </footer>
      </aside>

      <section className="surface ticket-detail-panel" aria-busy={detailLoading}>
        {!detail && !detailLoading && (
          <div className="workspace-empty workspace-empty--detail">
            <ConsoleIcon name="tickets" size={28} />
            <strong>选择一张工单</strong>
            <span>查看问题详情、AI 草稿、引用与处理记录。</span>
          </div>
        )}

        {!detail && detailLoading && (
          <div className="detail-loading">
            <span className="ticket-skeleton ticket-skeleton--heading" />
            <span className="ticket-skeleton ticket-skeleton--line" />
            <span className="ticket-skeleton ticket-skeleton--line" />
            <span className="ticket-skeleton ticket-skeleton--block" />
          </div>
        )}

        {detail && (
          <article className="ticket-detail">
            <header className="ticket-detail__header">
              <div>
                <div className="ticket-detail__eyebrow">
                  <span>{detail.ticket.id}</span>
                  <span className="meta-separator">/</span>
                  <span>{detail.ticket.channel}</span>
                </div>
                <h2>{detail.ticket.subject}</h2>
                <p>
                  {detail.ticket.customer || '匿名用户'} · {timeAgo(detail.ticket.createdAt)}
                  {detail.ticket.handledBy ? ` · 处理人 ${detail.ticket.handledBy}` : ''}
                </p>
              </div>
              <span className={`status-badge status-badge--${statusTone(detail.ticket.status)}`}>
                {STATUS_LABEL[detail.ticket.status]}
              </span>
            </header>

            <section className="ticket-body-block">
              <h3>问题描述</h3>
              <p>{detail.ticket.body}</p>
            </section>

            <dl className="ticket-info-grid">
              <div>
                <dt>优先级</dt>
                <dd>{priorityLabel(detail.ticket.priority)}</dd>
              </div>
              <div>
                <dt>问题分类</dt>
                <dd>{({ billing: '账单与退款', account: '账号与权限', technical: '技术问题', other: '其他' } as Record<string, string>)[detail.ticket.category] ?? '其他'}</dd>
              </div>
              <div>
                <dt>创建时间</dt>
                <dd>{formatDateTime(detail.ticket.createdAt)}</dd>
              </div>
              <div>
                <dt>处理时长</dt>
                <dd>
                  {detail.ticket.humanMinutes == null
                    ? '—'
                    : `${detail.ticket.humanMinutes} 分钟`}
                </dd>
              </div>
            </dl>

            {detail.ticket.aiAnswer ? (
              <section className="answer-block answer-block--ai">
                <header className="answer-block__header">
                  <div>
                    <span className="answer-label">
                      <ConsoleIcon name="bot" size={15} />
                      AI 草稿
                    </span>
                    <span className={`confidence confidence--${confidenceTone(detail.ticket.aiConfidence ?? 0)}`}>
                      规则评分 {Math.round((detail.ticket.aiConfidence ?? 0) * 100)}
                    </span>
                  </div>
                  <span className="answer-meta">
                    {detail.ticket.aiMs ?? 0} ms · {detail.ticket.aiTokensOut ?? 0} tokens ·{' '}
                    {detail.ticket.aiVersion || '—'}
                  </span>
                </header>
                <p className="answer-content">{detail.ticket.aiAnswer}</p>
                {detail.ticket.aiCitations.length > 0 && (
                  <div className="citation-list">
                    <span>检索依据</span>
                    {detail.ticket.aiCitations.map((id) => (
                      <button type="button" className="citation" key={id} onClick={() => onOpenKnowledge(id)}>{sourceLabel(id)} ↗</button>
                    ))}
                  </div>
                )}
              </section>
            ) : (
              <section className="answer-block answer-block--warning">
                <header className="answer-block__header">
                  <span className="answer-label">
                    <ConsoleIcon name="bot" size={15} />
                    AI 未生成草稿
                  </span>
                </header>
                <p className="answer-content">
                  {detail.ticket.aiError || '该工单尚未完成 AI 处理，可以手动重试。'}
                </p>
              </section>
            )}

            {detail.ticket.humanAnswer && (
              <section className="answer-block answer-block--human">
                <header className="answer-block__header">
                  <span className="answer-label">
                    <ConsoleIcon name="user" size={15} />
                    最终人工答复
                  </span>
                </header>
                <p className="answer-content">{detail.ticket.humanAnswer}</p>
              </section>
            )}

            <section className="detail-section"><h3>处理时间线</h3><div className="history-list">{[...detail.messages.map(m => ({ at: m.createdAt, key: m.id, text: `${m.kind === 'customer' ? '提交问题' : m.kind === 'note' ? '内部备注' : '人工答复'}：${m.content}` })), ...detail.runs.map(r => ({ at: r.createdAt, key: r.id, text: `AI ${r.status === 'ok' ? '生成成功' : '处理失败'} · ${r.model ?? '—'}${r.error ? ` · ${r.error}` : ''}` }))].sort((a,b) => a.at.localeCompare(b.at)).map(item => <div className="history-item" key={item.key}><p>{item.text}</p><span>{formatDateTime(item.at)}</span></div>)}</div><div className="iteration-tools"><label className="field"><span>内部备注（不会作为答复发送）</span><textarea rows={2} maxLength={5000} value={note} onChange={e => setNote(e.target.value)} /></label><button type="button" className="button button--secondary" disabled={!note.trim() || noteBusy} onClick={async () => { setNoteBusy(true); setNoteError(''); try { await addTicketNote(detail.ticket.id, note.trim()); setNote(''); onRefresh() } catch (e) { setNoteError(e instanceof Error ? e.message : '保存失败') } finally { setNoteBusy(false) } }}>保存备注</button>{noteError && <p role="alert">{noteError}</p>}</div></section>
            {detail.ticket.humanAnswer && detail.ticket.aiAnswer && <details className="detail-section"><summary>对比 AI 草稿与最终答复</summary><div className="iteration-comparison"><div><strong>AI 草稿</strong><p>{detail.ticket.aiAnswer}</p></div><div><strong>人工答复</strong><p>{detail.ticket.humanAnswer}</p></div></div></details>}
            {detail.messages.filter((message) => message.kind === 'reply').length > 0 && (
              <section className="detail-section">
                <h3>历史答复</h3>
                <div className="history-list">
                  {detail.messages
                    .filter((message) => message.kind === 'reply')
                    .map((message) => (
                      <div className="history-item" key={message.id}>
                        <p>{message.content}</p>
                        <span>
                          {message.actor || '处理人员'} · {formatDateTime(message.createdAt)}
                        </span>
                      </div>
                    ))}
                </div>
              </section>
            )}

            {detail.runs[0]?.stages?.length ? (
              <section className="detail-section">
                <h3>AI 处理链路</h3><p className="iteration-note">规则评分依据资料匹配和引用数量计算，不代表答案正确率。资料片段为运行时快照。</p>
                <ol className="stage-list">
                  {detail.runs[0].stages.map((stage, index) => (
                    <li className={stage.status === 'failed' ? 'is-failed' : ''} key={`${stage.name}-${index}`}>
                      <span className="stage-index">{index + 1}</span>
                      <span className="stage-name">{stage.name}</span>
                      <span className="stage-detail">{stage.detail}</span>
                      <span className="stage-time">{stage.ms} ms</span>
                      {stage.documents?.length ? <div className="iteration-sources">{stage.documents.map(doc => <div key={doc.id}><button type="button" onClick={() => onOpenKnowledge(doc.id)}>{doc.title} ↗</button><small>匹配分 {doc.score} · 覆盖率 {Math.round(doc.coverage * 100)}%</small><p>{doc.text}</p></div>)}</div> : null}
                    </li>
                  ))}
                </ol>
              </section>
            ) : null}

            {detail.ticket.status === 'needs_human' && (
              <section className="resolution-panel">
                <header className="resolution-panel__header">
                  <div>
                    <h3>人工处理</h3>
                    <p>修改草稿后保存，或确认无误后直接采纳。</p>
                  </div>
                  <button
                    className="button button--quiet"
                    type="button"
                    disabled={!detail.ticket.aiAnswer || Boolean(busy)}
                    onClick={() => onReplyTextChange(detail.ticket.aiAnswer ?? '')}
                  >
                    使用 AI 草稿
                  </button>
                </header>
                <textarea
                  className="reply-input"
                  value={replyText}
                  onChange={(event) => onReplyTextChange(event.target.value)}
                  placeholder="填写最终答复内容…"
                  rows={5}
                />
                <div className="action-bar action-bar--end">
                  <button
                    className="button button--secondary"
                    type="button"
                    disabled={Boolean(busy)}
                    onClick={() => onAction('process')}
                  >
                    {busy === 'process' ? '正在重跑…' : '重跑 AI'}
                  </button>
                  <button
                    className="button button--secondary"
                    type="button"
                    disabled={!detail.ticket.aiAnswer || Boolean(busy)}
                    onClick={() => onAction('approve')}
                  >
                    {busy === 'approve' ? '正在采纳…' : '直接采纳草稿'}
                  </button>
                  <button
                    className="button button--primary"
                    type="button"
                    disabled={!replyText.trim() || Boolean(busy)}
                    onClick={() => onAction('reply')}
                  >
                    {busy === 'reply' ? '正在保存…' : '保存答复并解决'}
                  </button>
                </div>
              </section>
            )}

            {detail.ticket.status !== 'needs_human' && (
              <div className="resolved-actions">
                <span>
                  {detail.ticket.status === 'auto_resolved'
                    ? `AI 自动处理，按基线估算节省约 ${baselineHumanMinutes} 分钟。`
                    : '该工单已有处理结果。'}
                </span>
                <button
                  className="button button--secondary"
                  type="button"
                  disabled={Boolean(busy)}
                  onClick={() => onAction('escalate')}
                >
                  {busy === 'escalate' ? '正在转回…' : '转回人工处理'}
                </button>
              </div>
            )}
          </article>
        )}
      </section>
    </div>
  )
}

function priorityLabel(priority: string): string {
  if (priority === 'high') return '高'
  if (priority === 'low') return '低'
  return '普通'
}
