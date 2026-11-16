import { useEffect, useState } from 'react'
import { evaluateCase, type EvaluationResult } from '../../lib/api'
import type { AiConfigInfo } from '../../types'

const CASES = [
  { id: 'refund', subject: '退款规则', body: '预付费产品购买后七天内可以退款吗？' },
  { id: 'invoice', subject: '发票开具', body: '企业账号如何申请增值税专用发票？' },
  { id: 'quota', subject: '配额与限流', body: '接口超过配额返回 429 应如何处理？' },
  { id: 'billing', subject: '计费周期', body: '账单什么时候生成，按量资源如何结算？' },
  { id: 'outside', subject: '火星基地物流', body: '什么时候能够配送至火星基地？' },
]
type Row = { id: string; subject: string; result: EvaluationResult; rating: string; at: string }
const STORAGE = 'nebula-evaluation-history-v1'
function readHistory(): Row[] { try { const value: unknown = JSON.parse(localStorage.getItem(STORAGE) || '[]'); return Array.isArray(value) ? value.slice(0, 100) : [] } catch { return [] } }
export function EvaluationView({ aiInfo }: { aiInfo: AiConfigInfo | null }) {
  const [rows, setRows] = useState<Row[]>(readHistory)
  const [running, setRunning] = useState(false)
  const [progress, setProgress] = useState('')
  const [error, setError] = useState('')
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  useEffect(() => { try { localStorage.setItem(STORAGE, JSON.stringify(rows.slice(0, 100))) } catch { setError('本地空间不足，评估记录未能保存。') } }, [rows])
  async function run(cases: typeof CASES) {
    setRunning(true); setError('')
    try {
      for (const [index, item] of cases.entries()) {
        setProgress(`正在运行 ${index + 1} / ${cases.length}：${item.subject}`)
        const result = await evaluateCase(item.subject, item.body)
        setRows(previous => [{ id: `${Date.now()}-${item.id}-${index}`, subject: item.subject, result, rating: '', at: new Date().toISOString() }, ...previous].slice(0, 100))
      }
    } catch (cause) { setError(cause instanceof Error ? cause.message : '运行失败') }
    finally { setRunning(false); setProgress('') }
  }
  return <div className="surface iteration-evaluation"><div className="iteration-eval-head"><div><h2>案例评估</h2><p>运行不会创建工单。使用当前知识库和模型；真实模型调用可能产生费用。结果与人工评价保存在当前浏览器。</p><p>当前：{aiInfo?.config.provider ?? '—'} / {aiInfo?.config.model ?? '—'} / {aiInfo?.config.version ?? '—'}</p></div><button className="button button--primary" disabled={running} onClick={() => void run(CASES)}>{running ? '运行中…' : '运行 5 个示例'}</button></div>
    <form className="iteration-eval-form" onSubmit={e => { e.preventDefault(); void run([{ id: 'custom', subject, body }]) }}><label className="field"><span>自定义问题标题</span><input required maxLength={200} value={subject} onChange={e => setSubject(e.target.value)} /></label><label className="field"><span>问题详情</span><textarea required maxLength={20000} rows={3} value={body} onChange={e => setBody(e.target.value)} /></label><button className="button button--secondary" disabled={running}>运行自定义案例</button></form>
    {progress && <p role="status">{progress}</p>}{error && <p role="alert">{error}</p>}
    <div className="iteration-eval-list"><h3>历史结果（最多 100 条）</h3>{!rows.length && <p>尚无评估结果。先运行示例或输入自定义问题。</p>}{rows.map(row => <article className="iteration-eval-row" key={row.id}><div><strong>{row.subject}</strong><span>{row.result.status === 'ok' ? '生成成功' : '转人工'} · {row.result.model} / {row.result.version} · {row.result.latencyMs} ms · {new Date(row.at).toLocaleString('zh-CN')}</span><p>{row.result.answer || row.result.error}</p><small>引用：{row.result.citations.join('、') || '无'} · 规则评分：{row.result.confidence == null ? '—' : Math.round(row.result.confidence * 100)}（非正确率）</small><details><summary>查看处理步骤</summary>{row.result.stages.map((s, i) => <p key={i}>{s.name} · {s.status === 'ok' ? '成功' : '失败'} · {s.ms} ms · {s.detail}</p>)}</details></div><label>人工评价<select value={row.rating} onChange={e => setRows(previous => previous.map(item => item.id === row.id ? { ...item, rating: e.target.value } : item))}><option value="">未评价</option><option value="good">可用</option><option value="edit">需修改</option><option value="bad">不可用</option></select></label></article>)}</div>
  </div>
}
