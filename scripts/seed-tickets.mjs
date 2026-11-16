#!/usr/bin/env node
// 灌一批真实工单，走完整的 AI 处理链路，并打印提效结果。
//
//   node scripts/seed-tickets.mjs [baseUrl] [email] [password]
//
// 工单内容分两类：
//   · 知识库里有的（会被自动答复）
//   · 知识库里没有的（AI 不硬答，带失败原因转人工）
// 这样能同时看到"提效"和"AI 知道自己不知道"。

const BASE = (process.argv[2] ?? process.env.NEBULA_URL ?? 'http://127.0.0.1:5188').replace(/\/$/, '')
const EMAIL = process.argv[3] ?? process.env.NEBULA_ADMIN_EMAIL ?? 'admin@nebula.local'
const PASSWORD = process.argv[4] ?? process.env.NEBULA_ADMIN_PASSWORD ?? ''

const TICKETS = [
  { customer: '李宁', channel: 'email', subject: '预付费的包年产品能退款吗？', body: '我们上周买了一年期的包年资源，现在项目停了，能退款吗？有什么时间限制？' },
  { customer: '王芳', channel: 'web', subject: '账单什么时候出？', body: '想确认一下按自然月计费的账单生成时间和结算粒度。' },
  { customer: '陈磊', channel: 'wechat', subject: 'API 提示 429 怎么办', body: '高峰期调用接口一直返回 429，怎么提升配额？' },
  { customer: '张敏', channel: 'email', subject: 'SLA 没达标怎么赔', body: '上个月我们可用性只有 99.5%，按 SLA 应该怎么赔付？' },
  { customer: '刘洋', channel: 'web', subject: '能开专票吗', body: '公司已实名认证，需要开增值税专用发票，怎么申请？多久能寄到？' },
  { customer: '赵倩', channel: 'wechat', subject: '数据会出境吗', body: '我们在上海 region，数据会不会被传输到海外？合规上怎么保证？' },
  { customer: '孙浩', channel: 'email', subject: '子账号怎么限制权限', body: '想给外包同事开子账号，只能看某个资源组，怎么配置？' },
  { customer: '周涛', channel: 'web', subject: '紧急故障怎么联系', body: '生产环境挂了，工单要等多久？有没有电话通道？' },
  { customer: '吴桐', channel: 'email', subject: '能不能定制专属模型', body: '我们想用自己的数据训练一个专属模型并私有化部署，你们支持吗？' },
  { customer: '郑楠', channel: 'wechat', subject: '能导出全部历史对话吗', body: '需要把过去两年的对话记录一次性导出做归档分析，有接口吗？' },
  { customer: '何静', channel: 'web', subject: '测试环境额度怎么申请', body: '想给测试团队单独开一个额度池，不加钱能行吗？' },
  { customer: '马超', channel: 'email', subject: '跨 region 灾备方案', body: '我们要求同城双活加异地灾备，你们有没有现成方案和报价？' },
]

async function call(method, path, body, token) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  const json = await res.json().catch(() => ({}))
  return { status: res.status, json }
}

async function main() {
  const login = await call('POST', '/api/auth/login', { email: EMAIL, password: PASSWORD })
  if (!login.json.token) {
    console.error(`登录失败：HTTP ${login.status} ${JSON.stringify(login.json)}`)
    process.exit(1)
  }
  const token = login.json.token
  console.log(`\n灌入 ${TICKETS.length} 张工单 → ${BASE}\n`)

  const results = []
  for (const [index, ticket] of TICKETS.entries()) {
    const { status, json } = await call('POST', '/api/tickets', ticket, token)
    if (status !== 201) {
      console.error(`  ✗ ${ticket.subject} → HTTP ${status} ${JSON.stringify(json)}`)
      continue
    }
    const t = json.ticket
    results.push(t)
    const label =
      t.status === 'auto_resolved'
        ? `自动答复（置信度 ${Math.round((t.aiConfidence ?? 0) * 100)}）`
        : `转人工（${t.aiError ?? `置信度 ${Math.round((t.aiConfidence ?? 0) * 100)}`}）`
    console.log(`  ${String(index + 1).padStart(2, '0')}. ${ticket.subject}`)
    console.log(`      → ${label} · ${t.aiMs}ms`)
  }

  const metrics = (await call('GET', '/api/metrics?days=14', null, token)).json
  const t = metrics.totals

  console.log('\n─────────────────────────────────────────────')
  console.log('  提效结果（全部来自刚才这批真实工单）')
  console.log('─────────────────────────────────────────────')
  console.log(`  工单数            ${t.tickets}`)
  console.log(`  AI 自动处理       ${t.autoResolved}（自动化率 ${t.automationRate}%）`)
  console.log(`  转人工待处理      ${t.backlog}`)
  console.log(`  单均 AI 耗时      ${t.avgAiMs}ms`)
  console.log(`  节省人时          ${t.savedHours} 小时（按 ${metrics.baseline.humanMinutes} 分钟/单人工基线）`)
  console.log(`  输出 token        ${t.tokensOut}`)
  console.log('─'.repeat(45))
  console.log(`\n  打开工作台看效果：${BASE}/#/console\n`)
}

main().catch((error) => {
  console.error('\n失败：', error.message)
  process.exit(1)
})
