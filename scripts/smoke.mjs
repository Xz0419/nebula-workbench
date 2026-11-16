#!/usr/bin/env node
// 端到端自检：健康 / 鉴权 / 工单创建 / AI 自动处理 / 转人工 / 人工兜底 / 指标 / 静态托管
//
//   node scripts/smoke.mjs [baseUrl] [email] [password]

const BASE = (process.argv[2] ?? process.env.NEBULA_URL ?? 'http://127.0.0.1:5188').replace(/\/$/, '')
const EMAIL = process.argv[3] ?? process.env.NEBULA_ADMIN_EMAIL ?? 'admin@nebula.local'
const PASSWORD = process.argv[4] ?? process.env.NEBULA_ADMIN_PASSWORD ?? ''

let token = null
let passed = 0
const failures = []

const ok = (name, extra = '') => {
  passed++
  console.log(`  \u2713 ${name}${extra ? '  ' + extra : ''}`)
}
const fail = (name, detail) => {
  failures.push(`${name}: ${detail}`)
  console.log(`  \u2717 ${name}  → ${detail}`)
}

async function call(method, path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  const text = await res.text()
  let json
  try {
    json = text ? JSON.parse(text) : null
  } catch {
    json = { raw: text }
  }
  return { status: res.status, json, text }
}

async function main() {
  console.log(`\nNebula 工作台 · 端到端自检 → ${BASE}\n`)

  const health = await call('GET', '/api/health')
  health.status === 200 && health.json?.ok
    ? ok('健康检查', `AI ${health.json.ai.version}/${health.json.ai.model}`)
    : fail('健康检查', `HTTP ${health.status}`)

  const login = await call('POST', '/api/auth/login', { email: EMAIL, password: PASSWORD })
  if (login.status === 200 && login.json?.token) {
    token = login.json.token
    ok('登录', login.json.user.email)
  } else {
    return fail('登录', `HTTP ${login.status} ${JSON.stringify(login.json)}`)
  }

  const bad = await call('POST', '/api/auth/login', { email: EMAIL, password: 'wrong-pass' })
  bad.status === 401 ? ok('错误密码被拒') : fail('错误密码被拒', `HTTP ${bad.status}`)

  const saved = token
  token = null
  const noAuth = await call('GET', '/api/tickets')
  noAuth.status === 401 ? ok('无令牌访问被拒') : fail('无令牌访问被拒', `HTTP ${noAuth.status}`)
  token = saved

  const covered = await call('POST', '/api/tickets', {
    subject: '预付费能退款吗？',
    body: '上周买了一年期的包年资源，现在项目停了，能退款吗？有什么时间限制？',
    customer: '自检用户',
    channel: 'web',
  })
  if (covered.status === 201) {
    const t = covered.json.ticket
    t.status === 'needs_human' && t.aiAnswer
      ? ok('AI 草稿待人工确认', `置信度 ${Math.round((t.aiConfidence ?? 0) * 100)} · ${t.aiMs}ms`)
      : fail('AI 草稿待人工确认', `实际 ${t.status}（${t.aiError ?? ''}）`)
    Array.isArray(t.aiCitations) && t.aiCitations.length > 0
      ? ok('答复带知识库引用', t.aiCitations.join(','))
      : fail('答复带知识库引用', JSON.stringify(t.aiCitations))
  } else {
    fail('创建工单', `HTTP ${covered.status}`)
  }

  const uncovered = await call('POST', '/api/tickets', {
    subject: '能私有化部署吗？',
    body: '我们想把整套系统部署在自建机房，要求完全离线，报价多少？',
    customer: '自检用户',
    channel: 'email',
  })
  if (uncovered.status === 201) {
    const t = uncovered.json.ticket
    t.status === 'needs_human'
      ? ok('知识库外的问题转人工', t.aiError ?? '置信度不足')
      : fail('知识库外的问题转人工', `实际 ${t.status}`)

    const replied = await call('POST', `/api/tickets/${t.id}/reply`, {
      answer: '支持私有化部署，已安排售前与你联系。',
      minutes: 5,
    })
    replied.status === 200 && replied.json?.ticket?.status === 'resolved'
      ? ok('人工兜底答复', '耗时 5 分钟')
      : fail('人工兜底答复', `HTTP ${replied.status}`)

    const escalated = await call('POST', `/api/tickets/${t.id}/escalate`)
    escalated.status === 200 && escalated.json?.ticket?.status === 'needs_human'
      ? ok('可重新转人工')
      : fail('可重新转人工', `HTTP ${escalated.status}`)
  } else {
    fail('创建工单（知识库外）', `HTTP ${uncovered.status}`)
  }

  if (covered.status === 201) {
    const id = covered.json.ticket.id
    const approve = await call('POST', `/api/tickets/${id}/approve`, { minutes: 1 })
    approve.status === 200 && approve.json?.ticket?.status === 'resolved'
      ? ok('采纳 AI 草稿')
      : fail('采纳 AI 草稿', `HTTP ${approve.status}`)
  }

  const metrics = await call('GET', '/api/metrics?days=14')
  if (metrics.status === 200 && metrics.json?.totals) {
    const totals = metrics.json.totals
    totals.tickets > 0
      ? ok('效率指标', `${totals.tickets} 单 · 自动化率 ${totals.automationRate}%`)
      : fail('效率指标', '没有工单')
    Array.isArray(metrics.json.series) && metrics.json.series.length >= 14
      ? ok('14 天吞吐序列', `${metrics.json.series.length} 天`)
      : fail('14 天吞吐序列', `长度 ${metrics.json.series?.length}`)
    metrics.json.baseline?.humanMinutes > 0
      ? ok('人工基线可配置', `${metrics.json.baseline.humanMinutes} 分钟/单`)
      : fail('人工基线可配置', JSON.stringify(metrics.json.baseline))
  } else {
    fail('效率指标', `HTTP ${metrics.status}`)
  }

  const list = await call('GET', '/api/tickets?status=all&limit=50')
  Array.isArray(list.json?.tickets) && list.json.tickets.length >= 2
    ? ok('工单列表', `${list.json.tickets.length} 单`)
    : fail('工单列表', `HTTP ${list.status}`)

  const audit = await call('GET', '/api/audit')
  Array.isArray(audit.json?.entries) && audit.json.entries.length > 0
    ? ok('审计日志', `${audit.json.entries.length} 条`)
    : fail('审计日志', `HTTP ${audit.status}`)

  // 前后端分离：预检请求必须被放行（前端在 5187，后端在 5188）
  const preflight = await fetch(`${BASE}/api/tickets`, {
    method: 'OPTIONS',
    headers: {
      Origin: 'http://127.0.0.1:5187',
      'Access-Control-Request-Method': 'GET',
      'Access-Control-Request-Headers': 'authorization',
    },
  })
  const allowOrigin = preflight.headers.get('access-control-allow-origin')
  preflight.status === 204 && allowOrigin === 'http://127.0.0.1:5187'
    ? ok('跨源预检放行', `ACAO ${allowOrigin}`)
    : fail('跨源预检放行', `HTTP ${preflight.status} ACAO=${allowOrigin}`)

  const blocked = await fetch(`${BASE}/api/health`, {
    method: 'OPTIONS',
    headers: { Origin: 'http://evil.example' },
  })
  blocked.status === 403
    ? ok('非白名单源被拒', 'HTTP 403')
    : fail('非白名单源被拒', `HTTP ${blocked.status}`)

  // 部署形态：纯 API 时根路径应明确返回 404，而不是空响应
  const root = await call('GET', '/')
  if (health.json?.mode?.serveStatic === false) {
    root.status === 404
      ? ok('纯 API 模式（前端由 web/ 独立托管）')
      : fail('纯 API 模式', `根路径 HTTP ${root.status}`)
  } else {
    root.status === 200 && root.text.includes('<div id="root">')
      ? ok('前端已托管（单进程模式）', `${root.text.length} 字节`)
      : fail('前端已托管', `HTTP ${root.status}`)
  }

  console.log(`\n结果: ${passed} 通过, ${failures.length} 失败\n`)
  if (failures.length) {
    for (const item of failures) console.log(`  - ${item}`)
    process.exit(1)
  }
}

main().catch((error) => {
  console.error('\n自检异常:', error.message)
  process.exit(1)
})
