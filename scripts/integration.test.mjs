import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'nebula-test-'))
process.env.NEBULA_DATA_DIR = tmp
process.env.NEBULA_ADMIN_EMAIL = 'test@example.test'
process.env.NEBULA_ADMIN_PASSWORD = 'test-only-password'
process.env.NEBULA_WEBHOOK_TOKEN = 'test-webhook-token'
process.env.NEBULA_AUTO_RESOLVE = '0'
process.env.NEBULA_AUTH_REQUIRED = '1'
delete process.env.OPENAI_BASE_URL
delete process.env.OPENAI_API_KEY
delete process.env.DEEPSEEK_API_KEY
delete process.env.NEBULA_AI_PROVIDER
const db = await import('../server/db.mjs')
const { bootstrapAdmin } = await import('../server/auth.mjs')
const { createServer } = await import('../server/main.mjs')
db.openDatabase()
bootstrapAdmin()
const server = createServer()
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
const base = `http://127.0.0.1:${server.address().port}`
let token = ''
async function call(method, endpoint, body, headers = {}) {
  const res = await fetch(base + endpoint, { method, headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}), ...headers }, body: body === undefined ? undefined : JSON.stringify(body) })
  return { status: res.status, body: res.status === 204 ? null : await res.json() }
}

test('内部工单：登录、知识库、AI 草稿、人工答复和历史记录', async () => {
  assert.equal((await call('GET', '/api/tickets')).status, 401)
  const login = await call('POST', '/api/auth/login', { email: 'test@example.test', password: 'test-only-password' })
  assert.equal(login.status, 200); token = login.body.token
  const initial = await call('GET', '/api/knowledge')
  assert.ok(initial.body.documents.length >= 8)
  const doc = await call('POST', '/api/knowledge', { title: '彩虹设备保修', text: '彩虹设备保修期限是两年。', active: true })
  assert.equal(doc.status, 201)
  const created = await call('POST', '/api/tickets', { subject: '彩虹设备保修', body: '彩虹设备保修期限是多少？', customer: '测试用户', priority: 'normal' })
  assert.equal(created.status, 201)
  assert.equal(created.body.ticket.status, 'needs_human')
  assert.ok(created.body.ticket.aiCitations.includes(doc.body.document.id))
  const id = created.body.ticket.id
  const staleRevision = created.body.ticket.revision
  assert.equal((await call('POST', `/api/tickets/${id}/reply`, { answer: '保修两年。', minutes: 3 })).status, 200)
  db.saveAiResult({ ticketId: id, expectedRevision: staleRevision, answer: '过期结果', citations: [], confidence: 1, version: 'v1', ms: 1 })
  assert.equal(db.getTicket(id).humanAnswer, '保修两年。')
  assert.notEqual(db.getTicket(id).aiAnswer, '过期结果')
  assert.equal((await call('POST', `/api/tickets/${id}/process`)).status, 409)
  assert.equal((await call('POST', `/api/tickets/${id}/escalate`)).status, 200)
  assert.equal((await call('POST', `/api/tickets/${id}/escalate`)).status, 409)
  assert.equal((await call('POST', `/api/tickets/${id}/reply`, { answer: '请保留购买凭证。' })).status, 200)
  const detail = await call('GET', `/api/tickets/${id}`)
  assert.deepEqual(detail.body.messages.filter((m) => m.kind === 'reply').map((m) => m.content), ['保修两年。', '请保留购买凭证。'])
  assert.equal((await call('POST', '/api/knowledge', { ...doc.body.document, active: false })).status, 200)
  const again = await call('POST', '/api/tickets', { subject: '彩虹设备保修', body: '彩虹设备保修期限是多少？' })
  assert.equal(again.body.ticket.status, 'needs_human')
  assert.ok(!again.body.ticket.aiCitations.includes(doc.body.document.id))
})

test('评估不创建工单，知识检索与备注可以使用', async () => {
  const before = (await call('GET', '/api/metrics?days=14')).body.totals.tickets
  const search = await call('POST', '/api/knowledge/search', { query: '退款规则' })
  assert.equal(search.status, 200)
  assert.ok(search.body.documents.some((d) => d.id === 'doc-refund'))
  const evaluation = await call('POST', '/api/evaluate', { subject: '退款规则', body: '预付费退款规则是什么？' })
  assert.equal(evaluation.status, 200)
  assert.equal(evaluation.body.status, 'ok')
  assert.ok(evaluation.body.stages.find((stage) => stage.name === 'retrieve').documents.length)
  assert.equal((await call('GET', '/api/metrics?days=14')).body.totals.tickets, before)
  const ticket = await call('POST', '/api/tickets', { subject: '退款规则', body: '预付费退款规则是什么？', category: 'billing' })
  assert.equal(ticket.body.ticket.category, 'billing')
  const note = await call('POST', `/api/tickets/${ticket.body.ticket.id}/notes`, { content: '内部测试备注' })
  assert.equal(note.status, 201)
  assert.ok(note.body.messages.some((message) => message.kind === 'note' && message.content === '内部测试备注'))
})

test('webhook 必须提供正确令牌，异常输入不会造成服务错误', async () => {
  assert.equal((await call('POST', '/api/webhooks/deploy', {}, { 'x-forwarded-for': '127.0.0.1' })).status, 401)
  assert.equal((await call('POST', '/api/webhooks/deploy', {}, { 'x-nebula-token': 'x' })).status, 401)
  assert.equal((await call('POST', '/api/webhooks/deploy', {}, { 'x-nebula-token': 'test-webhook-token' })).status, 200)
  assert.equal((await call('GET', '/api/metrics?days=invalid')).status, 200)
  assert.equal((await call('POST', '/api/tickets', { subject: '', body: 'hello' })).status, 400)
})

test('AI 配置支持 DeepSeek 且不会回传 API Key', async () => {
  const initial = await call('GET', '/api/ai/config')
  assert.equal(initial.status, 200)
  assert.ok(initial.body.available.providers.some((provider) => provider.id === 'deepseek'))

  const simulation = await call('POST', '/api/ai/config/test', {
    provider: 'sim',
    version: 'v1',
    model: 'sim-v1',
    baseUrl: '',
  })
  assert.equal(simulation.status, 200)
  assert.equal(simulation.body.ok, true)

  const missingKey = await call('POST', '/api/ai/config', {
    provider: 'deepseek',
    version: 'v1',
    model: 'deepseek-chat',
    baseUrl: 'https://api.deepseek.com',
  })
  assert.equal(missingKey.status, 400)

  const saved = await call('POST', '/api/ai/config', {
    provider: 'deepseek',
    version: 'v1',
    model: 'deepseek-chat',
    baseUrl: 'https://api.deepseek.com',
    apiKey: 'sk-integration-test-secret',
  })
  assert.equal(saved.status, 200)
  assert.equal(saved.body.config.provider, 'deepseek')
  assert.equal(saved.body.config.apiKeyConfigured, true)
  assert.ok(!JSON.stringify(saved.body).includes('sk-integration-test-secret'))

  const refreshed = await call('GET', '/api/ai/config')
  assert.equal(refreshed.body.config.model, 'deepseek-chat')
  assert.ok(!JSON.stringify(refreshed.body).includes('sk-integration-test-secret'))
})

test.after(async () => {
  await new Promise((resolve) => server.close(resolve))
  db.closeDatabase()
  fs.rmSync(tmp, { recursive: true, force: true })
})
