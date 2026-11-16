import { useEffect, useState } from 'react'
import { ConsoleIcon } from './ConsoleIcon'

export interface TicketDraft {
  subject: string
  body: string
  customer: string
  priority: string
  category: string
}

interface CreateTicketDialogProps {
  busy: boolean
  onClose: () => void
  onSubmit: (draft: TicketDraft) => void
}

const EMPTY_DRAFT: TicketDraft = {
  subject: '',
  body: '',
  customer: '',
  priority: 'normal',
  category: 'other',
}

export function CreateTicketDialog({ busy, onClose, onSubmit }: CreateTicketDialogProps) {
  const [draft, setDraft] = useState<TicketDraft>(EMPTY_DRAFT)

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  return (
    <div
      className="modal-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <section
        className="ticket-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-ticket-title"
      >
        <header className="ticket-dialog__header">
          <div>
            <h2 id="create-ticket-title">新建工单</h2>
            <p>提交后系统会立即检索知识库并运行 AI。</p>
          </div>
          <button
            className="icon-button"
            type="button"
            onClick={onClose}
            aria-label="关闭新建工单"
          >
            <ConsoleIcon name="close" size={18} />
          </button>
        </header>

        <form
          className="ticket-form"
          onSubmit={(event) => {
            event.preventDefault()
            onSubmit(draft)
          }}
        >
          <label className="field">
            <span>问题标题</span>
            <input
              autoFocus
              required
              maxLength={200}
              value={draft.subject}
              onChange={(event) => setDraft({ ...draft, subject: event.target.value })}
              placeholder="用一句话概括问题"
            />
          </label>

          <label className="field">
            <span>问题详情</span>
            <textarea
              required
              maxLength={20000}
              rows={7}
              value={draft.body}
              onChange={(event) => setDraft({ ...draft, body: event.target.value })}
              placeholder="请填写问题背景、已尝试的操作和期望结果…"
            />
          </label>

          <div className="form-row">
            <label className="field">
              <span>提出人</span>
              <input
                value={draft.customer}
                onChange={(event) => setDraft({ ...draft, customer: event.target.value })}
                placeholder="可选"
              />
            </label>
            <label className="field">
              <span>优先级</span>
              <select
                value={draft.priority}
                onChange={(event) => setDraft({ ...draft, priority: event.target.value })}
              >
                <option value="normal">普通</option>
                <option value="high">高</option>
                <option value="low">低</option>
              </select>
            </label>
          </div>

          <label className="field"><span>问题分类</span><select value={draft.category} onChange={(event) => setDraft({ ...draft, category: event.target.value })}><option value="other">其他</option><option value="billing">账单与退款</option><option value="account">账号与权限</option><option value="technical">技术问题</option></select></label>
          <footer className="ticket-dialog__footer">
            <button className="button button--secondary" type="button" onClick={onClose}>
              取消
            </button>
            <button className="button button--primary" type="submit" disabled={busy}>
              {busy ? '正在创建并处理…' : '创建并运行 AI'}
            </button>
          </footer>
        </form>
      </section>
    </div>
  )
}
