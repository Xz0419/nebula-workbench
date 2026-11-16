import { useCallback, useEffect, useRef, useState } from 'react'
import type {
  AiConfigInfo,
  AiRun,
  KnowledgeDoc,
  Metrics,
  Theme,
  Ticket,
  TicketMessage,
} from '../../types'
import {
  approveTicket,
  createTicket,
  escalateTicket,
  fetchAiConfig,
  fetchKnowledge,
  fetchMetrics,
  fetchTicket,
  fetchTickets,
  processTicket,
  replyTicket,
  saveKnowledge,
} from '../../lib/api'
import { ConsoleIcon, type ConsoleIconName } from './ConsoleIcon'
import { EvaluationView } from './EvaluationView'
import { AiConfigPanel } from './AiConfigPanel'
import { CreateTicketDialog, type TicketDraft } from './CreateTicketDialog'
import { DashboardView } from './DashboardView'
import { KnowledgeView, type KnowledgeDraft } from './KnowledgeView'
import { TicketWorkspace } from './TicketWorkspace'
import { pct, type ConsolePage, type QueueFilter, type TicketAction } from './consoleUtils'

const REFRESH_MS = 15_000
const EMPTY_KNOWLEDGE: KnowledgeDraft = {
  title: '',
  text: '',
  active: true,
}

interface ConsoleViewProps {
  theme: Theme
  onToggleTheme: () => void
}

interface TicketDetail {
  ticket: Ticket
  messages: TicketMessage[]
  runs: AiRun[]
}

const NAV_ITEMS: Array<{
  page: ConsolePage
  label: string
  icon: ConsoleIconName
}> = [
  { page: 'dashboard', label: '工作台', icon: 'dashboard' },
  { page: 'tickets', label: '工单中心', icon: 'tickets' },
  { page: 'knowledge', label: '知识库', icon: 'knowledge' },
  { page: 'evaluation', label: 'AI 评估台', icon: 'bot' },
  { page: 'settings', label: '系统设置', icon: 'settings' },
]

const PAGE_COPY: Record<ConsolePage, { title: string; description: string }> = {
  dashboard: {
    title: '工作台',
    description: '汇总处理指标、待办队列和 AI 运行状态。',
  },
  tickets: {
    title: '工单中心',
    description: '查看 AI 草稿、处理待人工工单并追踪历史记录。',
  },
  knowledge: {
    title: '知识库',
    description: '维护 AI 检索和回答时可使用的内部资料。',
  },
  evaluation: { title: 'AI 评估台', description: '运行示例案例并记录人工评价，比较模型与提示词的表现。' },
  settings: {
    title: '系统设置',
    description: '查看运行配置并管理工作台显示偏好。',
  },
}

export function ConsoleView({ theme, onToggleTheme }: ConsoleViewProps) {
  const [page, setPage] = useState<ConsolePage>('dashboard')
  const [tickets, setTickets] = useState<Ticket[] | null>(null)
  const [metrics, setMetrics] = useState<Metrics | null>(null)
  const [aiInfo, setAiInfo] = useState<AiConfigInfo | null>(null)
  const [filter, setFilter] = useState<QueueFilter>('needs_human')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [detail, setDetail] = useState<TicketDetail | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [replyText, setReplyText] = useState('')
  const [search, setSearch] = useState('')
  const [documents, setDocuments] = useState<KnowledgeDoc[] | null>(null)
  const [knowledgeLoading, setKnowledgeLoading] = useState(false)
  const [knowledgeDraft, setKnowledgeDraft] = useState<KnowledgeDraft>(EMPTY_KNOWLEDGE)
  const [showCreate, setShowCreate] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [lastUpdated, setLastUpdated] = useState<number | null>(null)

  const selectedRef = useRef<string | null>(null)
  selectedRef.current = selectedId

  const loadTickets = useCallback(async (mode: QueueFilter) => {
    try {
      const list = await fetchTickets(mode)
      const sorted =
        mode === 'needs_human'
          ? [...list].sort(
              (left, right) =>
                Number(Boolean(right.aiAnswer)) - Number(Boolean(left.aiAnswer)) ||
                right.createdAt.localeCompare(left.createdAt),
            )
          : list

      setTickets(sorted)
      setError(null)
      setLastUpdated(Date.now())

      if (!selectedRef.current || !sorted.some((ticket) => ticket.id === selectedRef.current)) {
        const nextId = sorted[0]?.id ?? null
        selectedRef.current = nextId
        setSelectedId(nextId)
        if (!nextId) {
          setDetail(null)
          setReplyText('')
        }
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '工单加载失败')
    }
  }, [])

  const loadDetail = useCallback(async (id: string) => {
    setDetailLoading(true)
    try {
      setDetail(await fetchTicket(id))
    } catch (cause) {
      setDetail(null)
      setError(cause instanceof Error ? cause.message : '工单详情加载失败')
    } finally {
      setDetailLoading(false)
    }
  }, [])

  const loadMetrics = useCallback(async () => {
    try {
      setMetrics(await fetchMetrics(14))
    } catch {
      // 指标是辅助信息，失败时不影响主流程。
    }
  }, [])

  const loadKnowledge = useCallback(async () => {
    setKnowledgeLoading(true)
    try {
      setDocuments(await fetchKnowledge())
      setError(null)
    } catch (cause) {
      setDocuments([])
      setError(cause instanceof Error ? cause.message : '知识库加载失败')
    } finally {
      setKnowledgeLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadTickets(filter)
    void loadMetrics()
    void fetchAiConfig()
      .then(setAiInfo)
      .catch(() => undefined)
  }, [filter, loadMetrics, loadTickets])

  useEffect(() => {
    setReplyText('')
    if (selectedId) void loadDetail(selectedId)
    else setDetail(null)
  }, [loadDetail, selectedId])

  useEffect(() => {
    const timer = window.setInterval(() => {
      void loadTickets(filter)
      void loadMetrics()
      if (selectedRef.current) void loadDetail(selectedRef.current)
    }, REFRESH_MS)
    return () => window.clearInterval(timer)
  }, [filter, loadDetail, loadMetrics, loadTickets])

  useEffect(() => {
    if (page === 'knowledge') void loadKnowledge()
  }, [loadKnowledge, page])

  function changePage(nextPage: ConsolePage) {
    setPage(nextPage)
    setError(null)
    setNotice(null)
  }

  function openTickets(nextFilter: QueueFilter) {
    setFilter(nextFilter)
    setPage('tickets')
    setError(null)
    setNotice(null)
  }

  function openTicket(id: string) {
    setSelectedId(id)
    setPage('tickets')
    setError(null)
    setNotice(null)
  }

  async function refreshCurrent() {
    setNotice(null)
    if (page === 'knowledge') {
      await loadKnowledge()
      return
    }
    await Promise.all([
      loadTickets(filter),
      loadMetrics(),
      selectedRef.current ? loadDetail(selectedRef.current) : Promise.resolve(),
    ])
  }

  async function runAction(action: TicketAction) {
    if (!detail) return
    setBusy(action)
    setError(null)
    setNotice(null)

    try {
      const id = detail.ticket.id
      if (action === 'approve') await approveTicket(id)
      else if (action === 'escalate') await escalateTicket(id)
      else if (action === 'process') await processTicket(id)
      else await replyTicket(id, { answer: replyText.trim() })

      if (action === 'reply') setReplyText('')
      await loadDetail(id)
      await Promise.all([loadTickets(filter), loadMetrics()])
      setNotice(actionNotice(action))
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '操作失败')
    } finally {
      setBusy(null)
    }
  }

  async function submitTicket(draft: TicketDraft) {
    setBusy('create')
    setError(null)
    setNotice(null)
    try {
      const result = await createTicket(draft)
      selectedRef.current = result.ticket.id
      setSelectedId(result.ticket.id)
      setFilter('all')
      setPage('tickets')
      setShowCreate(false)
      await Promise.all([loadTickets('all'), loadMetrics(), loadDetail(result.ticket.id)])
      setNotice('工单已创建，AI 处理结果已载入。')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '创建工单失败')
    } finally {
      setBusy(null)
    }
  }

  async function submitKnowledge() {
    setBusy('knowledge')
    setError(null)
    setNotice(null)
    try {
      const result = await saveKnowledge(knowledgeDraft)
      setDocuments(await fetchKnowledge())
      setKnowledgeDraft({
        id: result.document.id,
        title: result.document.title,
        text: result.document.text,
        active: result.document.active,
      })
      setNotice('知识资料已保存。')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '知识资料保存失败')
    } finally {
      setBusy(null)
    }
  }

  function resetPreferences() {
    try {
      window.localStorage.removeItem('nebula-theme')
    } finally {
      window.location.reload()
    }
  }

  const totals = metrics?.totals
  const pageCopy = PAGE_COPY[page]

  return (
    <div className="console-shell">
      <aside className="sidebar">
        <div className="brand">
          <img
            className="brand-mark"
            src={`${import.meta.env.BASE_URL}nebula-logo.svg`}
            alt=""
            aria-hidden="true"
          />
          <span className="brand-copy">
            <strong>Nebula</strong>
            <small>AI 工单工作台</small>
          </span>
        </div>

        <nav className="sidebar-nav" aria-label="主导航">
          <span className="sidebar-label">工作区</span>
          {NAV_ITEMS.map((item) => (
            <button
              type="button"
              className={`nav-item${page === item.page ? ' is-active' : ''}`}
              key={item.page}
              onClick={() => changePage(item.page)}
              aria-current={page === item.page ? 'page' : undefined}
            >
              <ConsoleIcon name={item.icon} size={18} />
              <span>{item.label}</span>
              {item.page === 'tickets' && totals?.backlog ? (
                <span className="nav-count">{totals.backlog}</span>
              ) : null}
            </button>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div className="sidebar-status">
            <span className="status-dot" />
            <span>
              <strong>系统运行中</strong>
              <small>{aiInfo ? aiInfo.config.model : 'AI 服务已连接'}</small>
            </span>
          </div>
          <div className="sidebar-version">
            <span>Nebula Console</span>
            <span>v1.0</span>
          </div>
        </div>
      </aside>

      <div className="app-frame">
        <header className="topbar">
          <div className="topbar-context">
            <span>Nebula</span>
            <ConsoleIcon name="chevron-right" size={14} />
            <strong>{pageCopy.title}</strong>
          </div>
          <div className="topbar-actions">
            <span className="sync-state">
              <span className="status-dot" />
              {lastUpdated
                ? `更新于 ${new Date(lastUpdated).toLocaleTimeString('zh-CN', { hour12: false })}`
                : '正在连接'}
            </span>
            <button
              type="button"
              className="icon-button"
              onClick={onToggleTheme}
              title={theme === 'light' ? '切换到深色主题' : '切换到浅色主题'}
              aria-label={theme === 'light' ? '切换到深色主题' : '切换到浅色主题'}
            >
              <ConsoleIcon name={theme === 'light' ? 'moon' : 'sun'} size={17} />
            </button>
          </div>
        </header>

        <main className="main-content">
          <header className="page-header">
            <div>
              <h1>{pageCopy.title}</h1>
              <p>{pageCopy.description}</p>
            </div>
            {page === 'dashboard' || page === 'tickets' ? (
              <button
                type="button"
                className="button button--primary"
                onClick={() => setShowCreate(true)}
              >
                <ConsoleIcon name="plus" size={16} />
                新建工单
              </button>
            ) : null}
          </header>

          {error ? (
            <div className="inline-message inline-message--error" role="alert">
              <span>{error}</span>
              <button type="button" onClick={() => setError(null)} aria-label="关闭错误提示">
                <ConsoleIcon name="close" size={16} />
              </button>
            </div>
          ) : null}

          {notice ? (
            <div className="inline-message inline-message--success" role="status">
              <span>{notice}</span>
              <button type="button" onClick={() => setNotice(null)} aria-label="关闭提示">
                <ConsoleIcon name="close" size={16} />
              </button>
            </div>
          ) : null}

          {page === 'dashboard' ? (
            <DashboardView
              metrics={metrics}
              aiInfo={aiInfo}
              tickets={tickets}
              onOpenTicket={openTicket}
              onOpenTickets={openTickets}
              onOpenAiSettings={() => changePage('settings')}
            />
          ) : null}

          {page === 'tickets' ? (
            <TicketWorkspace
              tickets={tickets}
              filter={filter}
              selectedId={selectedId}
              detail={detail}
              detailLoading={detailLoading}
              search={search}
              busy={busy}
              replyText={replyText}
              backlog={totals?.backlog ?? 0}
              baselineHumanMinutes={metrics?.baseline.humanMinutes ?? 8}
              onFilterChange={setFilter}
              onSearchChange={setSearch}
              onSelect={setSelectedId}
              onReplyTextChange={setReplyText}
              onRefresh={() => void refreshCurrent()}
              onAction={(action) => void runAction(action)}
              onOpenKnowledge={(id) => { void (async () => { try { const docs = await fetchKnowledge(); setDocuments(docs); const doc = docs.find(item => item.id === id); if (doc) { setKnowledgeDraft({ id: doc.id, title: doc.title, text: doc.text, active: doc.active }); setPage('knowledge') } else setError('该知识资料已不存在') } catch (cause) { setError(cause instanceof Error ? cause.message : '加载知识库失败') } })() }}
            />
          ) : null}

          {page === 'knowledge' ? (
            <KnowledgeView
              documents={documents}
              draft={knowledgeDraft}
              loading={knowledgeLoading}
              busy={busy === 'knowledge'}
              onDraftChange={setKnowledgeDraft}
              onSelect={(document) =>
                setKnowledgeDraft({
                  id: document.id,
                  title: document.title,
                  text: document.text,
                  active: document.active,
                })
              }
              onNew={() => setKnowledgeDraft(EMPTY_KNOWLEDGE)}
              onSave={() => void submitKnowledge()}
              onRefresh={() => void loadKnowledge()}
            />
          ) : null}

          {page === 'evaluation' ? <EvaluationView aiInfo={aiInfo} /> : null}

          {page === 'settings' ? (
            <SettingsPanel
              theme={theme}
              aiInfo={aiInfo}
              metrics={metrics}
              onToggleTheme={onToggleTheme}
              onAiSaved={(config) =>
                setAiInfo((current) => (current ? { ...current, config } : current))
              }
              onResetPreferences={resetPreferences}
              onRefresh={() => void refreshCurrent()}
            />
          ) : null}
        </main>
      </div>

      {showCreate ? (
        <CreateTicketDialog
          busy={busy === 'create'}
          onClose={() => setShowCreate(false)}
          onSubmit={(draft) => void submitTicket(draft)}
        />
      ) : null}
    </div>
  )
}

function SettingsPanel({
  theme,
  aiInfo,
  metrics,
  onToggleTheme,
  onAiSaved,
  onResetPreferences,
  onRefresh,
}: {
  theme: Theme
  aiInfo: AiConfigInfo | null
  metrics: Metrics | null
  onToggleTheme: () => void
  onAiSaved: (config: AiConfigInfo['config']) => void
  onResetPreferences: () => void
  onRefresh: () => void
}) {
  return (
    <div className="settings-grid">
      <section className="surface settings-card settings-card--wide settings-data-card">
        <header className="settings-card__header">
          <div>
            <h2>数据概览</h2>
            <p>当前数据库的累计运行状态。</p>
          </div>
        </header>
        <dl className="settings-stats">
          <div>
            <dt>工单总数</dt>
            <dd>{metrics?.totals.tickets ?? '—'}</dd>
          </div>
          <div>
            <dt>AI 自动处理</dt>
            <dd>{metrics?.totals.autoResolved ?? '—'}</dd>
          </div>
          <div>
            <dt>人工处理</dt>
            <dd>{metrics?.totals.handledByHuman ?? '—'}</dd>
          </div>
          <div>
            <dt>待人工积压</dt>
            <dd>{metrics?.totals.backlog ?? '—'}</dd>
          </div>
        </dl>
      </section>

      <div className="settings-columns">
        <div className="settings-left-column">
          <section className="surface settings-card settings-preferences-card">
            <header className="settings-card__header">
              <div>
                <h2>界面偏好</h2>
                <p>选择适合当前工作环境的显示主题。</p>
              </div>
            </header>
            <div className="setting-row">
              <div>
                <strong>显示主题</strong>
                <span>当前使用{theme === 'light' ? '浅色' : '深色'}主题。</span>
              </div>
              <button className="button button--secondary" type="button" onClick={onToggleTheme}>
                <ConsoleIcon name={theme === 'light' ? 'moon' : 'sun'} size={16} />
                切换为{theme === 'light' ? '深色' : '浅色'}
              </button>
            </div>
            <div className="setting-row">
              <div>
                <strong>本地偏好</strong>
                <span>清除已保存的主题设置并重新载入界面。</span>
              </div>
              <button
                className="button button--secondary"
                type="button"
                onClick={onResetPreferences}
              >
                重置偏好
              </button>
            </div>
          </section>

          <section className="surface settings-card settings-processing-card">
            <header className="settings-card__header">
              <div>
                <h2>处理参数</h2>
                <p>当前实例使用的自动化参数。</p>
              </div>
              <button className="button button--quiet" type="button" onClick={onRefresh}>
                <ConsoleIcon name="refresh" size={16} />
                刷新
              </button>
            </header>
            <dl className="settings-list">
              <div>
                <dt>自动处理阈值</dt>
                <dd>{metrics ? pct(metrics.baseline.autoResolveConfidence * 100) : '—'}</dd>
              </div>
              <div>
                <dt>人工处理基线</dt>
                <dd>{metrics ? `${metrics.baseline.humanMinutes} 分钟/单` : '—'}</dd>
              </div>
              <div>
                <dt>数据刷新</dt>
                <dd>每 15 秒自动刷新</dd>
              </div>
            </dl>
          </section>
        </div>

        <AiConfigPanel aiInfo={aiInfo} onSaved={onAiSaved} />
      </div>
    </div>
  )
}

function actionNotice(action: TicketAction): string {
  if (action === 'approve') return '已采纳 AI 草稿并解决工单。'
  if (action === 'escalate') return '工单已转回人工处理。'
  if (action === 'process') return 'AI 已重新运行，处理结果已更新。'
  return '人工答复已保存，工单已解决。'
}
