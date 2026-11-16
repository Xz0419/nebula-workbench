import { useState } from 'react'
import type { KnowledgeDoc } from '../../types'
import { searchKnowledge, type SearchResult } from '../../lib/api'
import { ConsoleIcon } from './ConsoleIcon'
import { formatDateTime } from './consoleUtils'

export interface KnowledgeDraft {
  id?: string
  title: string
  text: string
  active: boolean
}

interface KnowledgeViewProps {
  documents: KnowledgeDoc[] | null
  draft: KnowledgeDraft
  loading: boolean
  busy: boolean
  onDraftChange: (draft: KnowledgeDraft) => void
  onSelect: (document: KnowledgeDoc) => void
  onNew: () => void
  onSave: () => void
  onRefresh: () => void
}

export function KnowledgeView({
  documents,
  draft,
  loading,
  busy,
  onDraftChange,
  onSelect,
  onNew,
  onSave,
  onRefresh,
}: KnowledgeViewProps) {
  const [search, setSearch] = useState('')
  const [queryText, setQueryText] = useState('')
  const [results, setResults] = useState<SearchResult[] | null>(null)
  const [message, setMessage] = useState('')
  const query = search.trim().toLocaleLowerCase('zh-CN')
  const visibleDocuments =
    documents?.filter((document) => {
      if (!query) return true
      return `${document.title} ${document.text}`
        .toLocaleLowerCase('zh-CN')
        .includes(query)
    }) ?? null
  const activeCount = documents?.filter((document) => document.active).length ?? 0

  return (
    <div className="knowledge-view">
      <section className="surface knowledge-list-panel">
        <header className="knowledge-list-header">
          <div>
            <h2>知识资料</h2>
            <p>
              {documents
                ? `${documents.length} 篇资料，${activeCount} 篇参与检索`
                : '正在读取资料'}
            </p>
          </div>
          <button
            type="button"
            className="icon-button"
            onClick={onRefresh}
            disabled={loading}
            aria-label="刷新知识库"
            title="刷新"
          >
            <ConsoleIcon name="refresh" size={17} />
          </button>
        </header>

        <label className="search-field">
          <ConsoleIcon name="search" size={16} />
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="搜索资料标题或内容"
          />
        </label>

        <button className="knowledge-new" type="button" onClick={onNew}>
          <ConsoleIcon name="plus" size={16} />
          新增资料
        </button>

        <div className="document-list">
          {loading &&
            [0, 1, 2].map((item) => (
              <div className="document-row document-row--loading" key={item}>
                <span className="ticket-skeleton ticket-skeleton--title" />
                <span className="ticket-skeleton ticket-skeleton--meta" />
              </div>
            ))}

          {visibleDocuments?.map((document) => (
            <button
              type="button"
              className={`document-row${draft.id === document.id ? ' is-active' : ''}`}
              key={document.id}
              onClick={() => onSelect(document)}
            >
              <span className="document-row__icon">
                <ConsoleIcon name="knowledge" size={17} />
              </span>
              <span className="document-row__content">
                <strong>{document.title}</strong>
                <span>{formatDateTime(document.updatedAt)}</span>
              </span>
              <span className={`status-badge status-badge--${document.active ? 'success' : 'neutral'}`}>
                {document.active ? '启用' : '停用'}
              </span>
            </button>
          ))}

          {visibleDocuments?.length === 0 && (
            <div className="workspace-empty workspace-empty--compact">
              <ConsoleIcon name="knowledge" size={24} />
              <strong>{query ? '没有匹配的资料' : '还没有知识资料'}</strong>
              <span>{query ? '尝试使用其他关键词。' : '新增第一篇资料以供 AI 检索。'}</span>
            </div>
          )}
        </div>
      </section>

      <section className="surface knowledge-editor">
        <header className="knowledge-editor__header">
          <div>
            <h2>{draft.id ? '编辑资料' : '新增资料'}</h2>
            <p>启用的资料会参与后续工单的 AI 检索。</p>
          </div>
          {draft.id ? <span className="status-badge status-badge--neutral">已有资料</span> : null}
        </header>

        <div className="iteration-tools"><label className="field"><span>导入文本或 Markdown（先预览，保存后生效）</span><input type="file" accept=".txt,.md,text/plain,text/markdown" onChange={async (event) => { const file = event.target.files?.[0]; if (!file) return; if (file.size > 100000) { setMessage('文件过大，请选择 100 KB 以内的文本'); event.target.value = ''; return }; try { const text = await file.text(); if (text.length > 20000) throw new Error('内容超过 20000 字，请精简后导入'); onDraftChange({ title: file.name.replace(/\.[^.]+$/, ''), text, active: true }); setMessage('文件已载入编辑区，请检查后保存。') } catch (error) { setMessage(error instanceof Error ? error.message : '读取文件失败') } event.target.value = '' }} /></label><label className="field"><span>测试知识检索</span><input value={queryText} onChange={e => setQueryText(e.target.value)} placeholder="输入示例问题" /></label><button type="button" className="button button--secondary" disabled={!queryText.trim()} onClick={async () => { try { setResults(await searchKnowledge(queryText)); setMessage('') } catch (error) { setMessage(error instanceof Error ? error.message : '检索失败') } }}>测试检索</button>{message && <p role="status">{message}</p>}{results && <div>{results.length ? results.map(doc => <div className="iteration-result" key={doc.id}><button type="button" onClick={() => { const selected = documents?.find(item => item.id === doc.id); if (selected) onSelect(selected) }}>{doc.title}</button> · {doc.relevant ? '通过相关度闸门' : '未通过闸门'} · 覆盖率 {Math.round(doc.coverage * 100)}%</div>) : <p>没有匹配资料。</p>}</div>}</div>
        <form
          className="knowledge-form"
          onSubmit={(event) => {
            event.preventDefault()
            onSave()
          }}
        >
          <label className="field">
            <span>资料标题</span>
            <input
              required
              maxLength={200}
              value={draft.title}
              onChange={(event) => onDraftChange({ ...draft, title: event.target.value })}
              placeholder="例如：退款处理规则"
            />
          </label>

          <label className="field field--grow">
            <span>资料内容</span>
            <textarea
              required
              maxLength={20000}
              rows={16}
              value={draft.text}
              onChange={(event) => onDraftChange({ ...draft, text: event.target.value })}
              placeholder="填写 AI 可以检索和引用的完整资料内容…"
            />
            <small>{draft.text.length.toLocaleString('zh-CN')} / 20,000 字符</small>
          </label>

          <label className="checkbox-field">
            <input
              type="checkbox"
              checked={draft.active}
              onChange={(event) => onDraftChange({ ...draft, active: event.target.checked })}
            />
            <span>
              <strong>参与检索</strong>
              <small>停用后保留资料，但不会提供给 AI。</small>
            </span>
          </label>

          <div className="knowledge-form__footer">
            <span>保存前请确认资料内容准确、完整。</span>
            <div className="action-bar">
              <button className="button button--secondary" type="button" onClick={onNew}>
                清空
              </button>
              <button className="button button--primary" type="submit" disabled={busy}>
                {busy ? '正在保存…' : '保存资料'}
              </button>
            </div>
          </div>
        </form>
      </section>
    </div>
  )
}
