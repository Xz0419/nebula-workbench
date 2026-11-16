// Nebula 工作台 —— 单进程生产服务：静态前端 + JSON API。
// 零外部依赖，只用 node:http / node:sqlite / node:crypto。
//
// 定位：AI 先把工单做一遍。能答的直接答掉（auto_resolved），
// 答不了的带草稿转人工（needs_human），并把"省了多少人时"算清楚。
import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { fileURLToPath } from 'node:url'
import { config, webhookToken } from './config.mjs'
import * as db from './db.mjs'
import {
  authenticate,
  bootstrapAdmin,
  clearLoginFailures,
  createSession,
  hashPassword,
  loginAllowed,
  recordLoginFailure,
  verifyPassword,
} from './auth.mjs'
import { processTicket, AVAILABLE } from './ai.mjs'
import { callModel, PROVIDERS } from '../workflow/llm.mjs'
import { PROMPTS } from '../workflow/prompts.mjs'
import { retrieve, isRelevant } from '../workflow/corpus.mjs'

const startedAt = Date.now()
const log = (level, msg, extra = {}) => {
  const line = JSON.stringify({ t: new Date().toISOString(), level, msg, ...extra })
  if (level === 'error') console.error(line)
  else console.log(line)
}

/* ---------------------------------------------------------- AI 版本状态 */

const AI_CONFIG_FILE = path.join(config.dataDir, 'ai-config.json')

function loadAiConfig() {
  try {
    const saved = JSON.parse(fs.readFileSync(AI_CONFIG_FILE, 'utf8'))
    const provider =
      PROVIDERS[saved.provider]
        ? saved.provider
        : process.env.OPENAI_BASE_URL?.includes('deepseek')
          ? 'deepseek'
          : process.env.OPENAI_BASE_URL
            ? 'compatible'
            : 'sim'
    const preset = PROVIDERS[provider]
    const savedModel = saved.model || config.aiModel
    return {
      version: PROMPTS[saved.version] ? saved.version : config.aiVersion,
      provider,
      model:
        provider !== 'sim' && savedModel?.startsWith('sim-')
          ? preset.defaultModel
          : savedModel,
      baseUrl:
        typeof saved.baseUrl === 'string'
          ? saved.baseUrl
          : process.env.OPENAI_BASE_URL || preset.defaultBaseUrl,
      apiKey: typeof saved.apiKey === 'string' ? saved.apiKey : '',
    }
  } catch {
    const provider =
      process.env.NEBULA_AI_PROVIDER && PROVIDERS[process.env.NEBULA_AI_PROVIDER]
        ? process.env.NEBULA_AI_PROVIDER
        : process.env.OPENAI_BASE_URL?.includes('deepseek')
          ? 'deepseek'
          : process.env.OPENAI_BASE_URL
            ? 'compatible'
            : 'sim'
    const preset = PROVIDERS[provider]
    return {
      version: PROMPTS[config.aiVersion] ? config.aiVersion : 'v1',
      provider,
      model:
        provider !== 'sim' && config.aiModel?.startsWith('sim-')
          ? preset.defaultModel
          : config.aiModel || preset.defaultModel,
      baseUrl: process.env.OPENAI_BASE_URL || preset.defaultBaseUrl,
      apiKey: '',
    }
  }
}

const aiConfig = loadAiConfig()

function saveAiConfig(candidate) {
  try {
    fs.mkdirSync(config.dataDir, { recursive: true })
    fs.writeFileSync(AI_CONFIG_FILE, JSON.stringify(candidate, null, 2), 'utf8')
    try {
      fs.chmodSync(AI_CONFIG_FILE, 0o600)
    } catch {
      // Windows 上 ACL 由用户目录控制，忽略 chmod 不兼容。
    }
  } catch (error) {
    log('error', 'ai_config_save_failed', { message: error.message })
    throw new Error('AI 配置保存失败，请检查数据目录权限')
  }
}

function environmentApiKey(provider) {
  if (provider === 'deepseek') {
    return process.env.DEEPSEEK_API_KEY || process.env.OPENAI_API_KEY || ''
  }
  return process.env.OPENAI_API_KEY || ''
}

function effectiveApiKey(candidate = aiConfig) {
  return candidate.apiKey || environmentApiKey(candidate.provider)
}

function publicAiConfig() {
  return {
    version: aiConfig.version,
    provider: aiConfig.provider,
    model: aiConfig.model,
    baseUrl: aiConfig.baseUrl,
    apiKeyConfigured: Boolean(effectiveApiKey()),
  }
}

function validateBaseUrl(value) {
  let url
  try {
    url = new URL(value)
  } catch {
    throw Object.assign(new Error('接口地址不是合法 URL'), { status: 400 })
  }
  if (!['http:', 'https:'].includes(url.protocol)) {
    throw Object.assign(new Error('接口地址只支持 http 或 https'), { status: 400 })
  }
  if (url.username || url.password) {
    throw Object.assign(new Error('接口地址不能包含用户名或密码'), { status: 400 })
  }
  return value.replace(/\/$/, '')
}

function resolveAiConfig(body) {
  const provider = str(body.provider)?.trim() || aiConfig.provider
  const preset = PROVIDERS[provider]
  if (!preset) throw Object.assign(new Error(`不支持的 AI 服务商 ${provider}`), { status: 400 })

  const version = str(body.version)?.trim() || aiConfig.version
  if (!PROMPTS[version]) throw Object.assign(new Error(`未知提示词版本 ${version}`), { status: 400 })

  const model =
    str(body.model)?.trim() ||
    (provider === aiConfig.provider ? aiConfig.model : preset.defaultModel)
  if (!model || model.length > 200) {
    throw Object.assign(new Error('模型名称无效'), { status: 400 })
  }
  if (provider === 'sim' && !model.startsWith('sim-')) {
    throw Object.assign(new Error('本地模拟模式只能使用 sim 开头的模型'), { status: 400 })
  }
  if (provider !== 'sim' && model.startsWith('sim-')) {
    throw Object.assign(new Error('真实模型模式需要使用实际模型名称'), { status: 400 })
  }

  let baseUrl =
    body.baseUrl !== undefined
      ? str(body.baseUrl)?.trim() ?? ''
      : provider === aiConfig.provider
        ? aiConfig.baseUrl
        : preset.defaultBaseUrl
  if (provider === 'sim') baseUrl = ''
  else {
    baseUrl = validateBaseUrl(baseUrl || preset.defaultBaseUrl)
  }

  let apiKey =
    body.apiKey === undefined
      ? provider === aiConfig.provider
        ? aiConfig.apiKey
        : ''
      : str(body.apiKey)?.trim() ?? ''
  if (body.clearApiKey === true) apiKey = ''
  if (provider !== 'sim' && !apiKey && !environmentApiKey(provider)) {
    throw Object.assign(new Error('请填写 API Key'), { status: 400 })
  }

  return { version, provider, model, baseUrl, apiKey }
}

/* ------------------------------------------------------------------ 工具 */

function sendJson(res, status, payload, extraHeaders = {}) {
  const body = JSON.stringify(payload)
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Cache-Control': 'no-store',
    ...extraHeaders,
  })
  res.end(body)
}

const sendError = (res, status, code, message, extra = {}) =>
  sendJson(res, status, { error: { code, message, ...extra } })

function readJson(req) {
  return new Promise((resolve, reject) => {
    let size = 0
    const chunks = []
    req.on('data', (chunk) => {
      size += chunk.length
      if (size > config.bodyLimit) {
        reject(Object.assign(new Error('body too large'), { status: 413 }))
        req.destroy()
        return
      }
      chunks.push(chunk)
    })
    req.on('end', () => {
      if (chunks.length === 0) return resolve({})
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')))
      } catch {
        reject(Object.assign(new Error('invalid json'), { status: 400 }))
      }
    })
    req.on('error', reject)
  })
}

// 只信任直接连接地址；反向代理转发头必须由部署环境另行配置。
const clientIp = (req) => (req.socket.remoteAddress ?? '').trim()

const isLoopback = (ip) => ip === '127.0.0.1' || ip === '::1' || ip === '::ffff:127.0.0.1'
const str = (v) => (v == null ? null : String(v))

function webhookAuthorized(req) {
  const expected = Buffer.from(webhookToken())
  const provided = req.headers['x-nebula-token'] ||
    (req.headers.authorization?.startsWith('Bearer ') ? req.headers.authorization.slice(7) : '')
  const actual = Buffer.from(String(provided))
  return actual.length === expected.length && crypto.timingSafeEqual(actual, expected)
}

/* --------------------------------------------------------------- 处理函数 */

const handlers = {
  'GET /api/health': (_req, res) =>
    sendJson(res, 200, {
      ok: true,
      version: config.version,
      uptimeSec: Math.round((Date.now() - startedAt) / 1000),
      ai: { ...aiConfig, available: AVAILABLE },
      db: db.stats(),
      mode: { serveStatic: config.serveStatic, corsOrigins: config.corsOrigins },
    }),

  /* ---------------- 认证 ---------------- */

  'POST /api/auth/login': async (req, res) => {
    const body = await readJson(req)
    const email = str(body.email)?.toLowerCase()
    const password = str(body.password)
    if (!email || !password) return sendError(res, 400, 'invalid_request', '邮箱和密码不能为空')

    const ip = clientIp(req)
    const key = `${ip}|${email}`
    const gate = loginAllowed(key)
    if (!gate.allowed) {
      db.logAudit({ actor: email, action: 'login_throttled', ip })
      return sendJson(
        res,
        429,
        { error: { code: 'too_many_attempts', message: `尝试过于频繁，请 ${gate.retryAfterSec} 秒后再试` } },
        { 'Retry-After': String(gate.retryAfterSec) },
      )
    }

    const user = db.findUserByEmail(email)
    const ok = user ? verifyPassword(password, user.passwordHash) : verifyPassword(password, DUMMY_HASH) && false
    if (!ok) {
      recordLoginFailure(key)
      db.logAudit({ actor: email, action: 'login_failed', ip })
      return sendError(res, 401, 'invalid_credentials', '邮箱或密码不正确')
    }

    clearLoginFailures(key)
    const { token, expiresAt } = createSession(user, { userAgent: req.headers['user-agent'], ip })
    db.logAudit({ actor: email, action: 'login_success', ip })
    sendJson(res, 200, {
      token,
      expiresAt,
      user: { id: user.id, email: user.email, name: user.name, role: user.role },
    })
  },

  'POST /api/auth/logout': (req, res) => {
    const session = authenticate(req)
    if (session?.tokenHash) db.deleteSession(session.tokenHash)
    res.writeHead(204, { 'Cache-Control': 'no-store' }).end()
  },

  'GET /api/auth/me': (_req, res, ctx) => sendJson(res, 200, { user: ctx.user }),

  /* ---------------- 工单 ---------------- */

  'GET /api/tickets': (_req, res, ctx) =>
    sendJson(res, 200, {
      tickets: db.listTickets({
        status: ctx.url.searchParams.get('status') ?? 'all',
        limit: ctx.url.searchParams.get('limit') ?? '100',
      }),
    }),

  'GET /api/tickets/:id': (_req, res, ctx) => {
    const ticket = db.getTicket(ctx.params.id)
    if (!ticket) return sendError(res, 404, 'not_found', '工单不存在')
    sendJson(res, 200, { ticket, messages: db.listTicketMessages(ticket.id), runs: db.listAiRuns({ ticketId: ticket.id, limit: 5 }) })
  },

  /** 新工单进来：AI 立刻处理一遍 */
  'POST /api/tickets': async (req, res, ctx) => {
    const body = await readJson(req)
    const subject = str(body.subject)?.trim()
    const content = str(body.body)?.trim()
    if (!subject || !content || subject.length > 200 || content.length > 20000) return sendError(res, 400, 'invalid_request', '标题和内容不能为空，标题最多 200 字、内容最多 20000 字')
    if (!['low', 'normal', 'high'].includes(body.priority ?? 'normal')) return sendError(res, 400, 'invalid_request', '优先级无效')

    if (!['billing', 'account', 'technical', 'other'].includes(body.category ?? 'other')) return sendError(res, 400, 'invalid_request', '工单分类无效')
    const ticket = db.createTicket({
      subject,
      body: content,
      customer: str(body.customer),
      channel: str(body.channel) ?? 'web',
      priority: str(body.priority) ?? 'normal',
      category: str(body.category) ?? 'other',
      externalId: str(body.externalId),
    })

    const result = await processTicket(ticket, aiConfig)
    db.logAudit({
      actor: ctx.user?.email ?? 'api',
      action: 'ticket_created',
      detail: `${ticket.id} → ${result.ticket.status}`,
      ip: clientIp(req),
    })
    sendJson(res, 201, { ticket: result.ticket, run: result.run, stages: result.stages })
  },

  'POST /api/tickets/:id/process': async (req, res, ctx) => {
    const ticket = db.getTicket(ctx.params.id)
    if (!ticket) return sendError(res, 404, 'not_found', '工单不存在')
    if (!['queued', 'needs_human'].includes(ticket.status)) return sendError(res, 409, 'invalid_state', '已处理的工单不能直接重跑 AI，请先转人工')
    const result = await processTicket(ticket, aiConfig)
    db.logAudit({ actor: ctx.user.email, action: 'ticket_processed', detail: ticket.id, ip: clientIp(req) })
    sendJson(res, 200, { ticket: result.ticket, run: result.run, stages: result.stages })
  },

  /** 采纳 AI 草稿（可能改过文案）：AI 起草 + 人工确认，仍计入 AI 提效 */
  'POST /api/tickets/:id/approve': async (req, res, ctx) => {
    const body = await readJson(req)
    const ticket = db.getTicket(ctx.params.id)
    if (!ticket) return sendError(res, 404, 'not_found', '工单不存在')
    if (ticket.status !== 'needs_human') return sendError(res, 409, 'invalid_state', '只有待人工工单可以采纳草稿')
    if (!(str(body.answer) ?? ticket.aiAnswer)?.trim()) return sendError(res, 400, 'invalid_request', '没有可采纳的 AI 草稿')
    if (body.minutes !== undefined && (!Number.isFinite(body.minutes) || body.minutes < 0 || body.minutes > 10000)) return sendError(res, 400, 'invalid_request', '耗时无效')
    const updated = db.approveTicket({
      id: ticket.id,
      answer: str(body.answer) ?? ticket.aiAnswer,
      actor: ctx.user.email,
      minutes: body.minutes,
    })
    db.logAudit({ actor: ctx.user.email, action: 'ticket_approved', detail: ticket.id, ip: clientIp(req) })
    sendJson(res, 200, { ticket: updated })
  },

  /** 人工自己写答复：记为纯人工处理，用于效率对比 */
  'POST /api/tickets/:id/reply': async (req, res, ctx) => {
    const body = await readJson(req)
    const answer = str(body.answer)?.trim()
    if (!answer) return sendError(res, 400, 'invalid_request', 'answer 不能为空')
    const ticket = db.getTicket(ctx.params.id)
    if (!ticket) return sendError(res, 404, 'not_found', '工单不存在')
    if (ticket.status !== 'needs_human') return sendError(res, 409, 'invalid_state', '只有待人工工单可以回复')
    if (body.minutes !== undefined && (!Number.isFinite(body.minutes) || body.minutes < 0 || body.minutes > 10000)) return sendError(res, 400, 'invalid_request', '耗时无效')
    const updated = db.replyTicket({
      id: ticket.id,
      answer,
      actor: ctx.user.email,
      minutes: body.minutes,
    })
    db.logAudit({ actor: ctx.user.email, action: 'ticket_replied', detail: ticket.id, ip: clientIp(req) })
    sendJson(res, 200, { ticket: updated })
  },

  'POST /api/tickets/:id/notes': async (req, res, ctx) => {
    const ticket = db.getTicket(ctx.params.id)
    if (!ticket) return sendError(res, 404, 'not_found', '工单不存在')
    const body = await readJson(req)
    const content = typeof body.content === 'string' ? body.content.trim() : ''
    if (!content || content.length > 5000) return sendError(res, 400, 'invalid_request', '备注不能为空且不能超过 5000 字')
    db.addTicketMessage(ticket.id, 'note', content, ctx.user.email)
    db.logAudit({ actor: ctx.user.email, action: 'ticket_note', detail: ticket.id, ip: clientIp(req) })
    sendJson(res, 201, { messages: db.listTicketMessages(ticket.id) })
  },

  'POST /api/tickets/:id/escalate': (_req, res, ctx) => {
    const ticket = db.getTicket(ctx.params.id)
    if (!ticket) return sendError(res, 404, 'not_found', '工单不存在')
    if (ticket.status === 'needs_human') return sendError(res, 409, 'invalid_state', '工单已经在人工队列中')
    db.escalateTicket({ id: ticket.id })
    db.logAudit({ actor: ctx.user.email, action: 'ticket_escalated', detail: ticket.id, ip: clientIp(ctx.req) })
    sendJson(res, 200, { ticket: db.getTicket(ticket.id) })
  },

  /* ---------------- 知识资料 ---------------- */
  'GET /api/knowledge': (_req, res) => sendJson(res, 200, { documents: db.listKnowledge() }),
  'POST /api/knowledge': async (req, res, ctx) => {
    const body = await readJson(req)
    const title = typeof body.title === 'string' ? body.title.trim() : ''
    const text = typeof body.text === 'string' ? body.text.trim() : ''
    if (!title || !text || title.length > 200 || text.length > 20000) return sendError(res, 400, 'invalid_request', '标题和内容不能为空，标题最多 200 字、内容最多 20000 字')
    if (body.id && !db.getKnowledge(String(body.id))) return sendError(res, 404, 'not_found', '资料不存在')
    if (body.active !== undefined && typeof body.active !== 'boolean') return sendError(res, 400, 'invalid_request', 'active 必须为布尔值')
    const doc = db.saveKnowledge({ id: body.id ? String(body.id) : undefined, title, text, active: body.active !== false })
    db.logAudit({ actor: ctx.user.email, action: 'knowledge_saved', detail: doc.id, ip: clientIp(req) })
    sendJson(res, body.id ? 200 : 201, { document: doc })
  },

  'POST /api/knowledge/search': async (req, res) => {
    const body = await readJson(req)
    const query = typeof body.query === 'string' ? body.query.trim() : ''
    if (!query || query.length > 2000) return sendError(res, 400, 'invalid_request', '请输入不超过 2000 字的测试问题')
    const found = retrieve(query, 5, db.listKnowledge(true))
    sendJson(res, 200, { documents: found.map((doc) => ({ ...doc, relevant: isRelevant(doc) })) })
  },
  'POST /api/evaluate': async (req, res) => {
    const body = await readJson(req)
    const subject = typeof body.subject === 'string' ? body.subject.trim() : ''
    const content = typeof body.body === 'string' ? body.body.trim() : ''
    if (!subject || !content || subject.length > 200 || content.length > 20000) return sendError(res, 400, 'invalid_request', '案例标题或内容无效')
    const result = await processTicket({ id: null, subject, body: content }, { ...aiConfig, dryRun: true })
    sendJson(res, 200, { ...result, model: aiConfig.model, provider: aiConfig.provider, version: aiConfig.version })
  },

  /* ---------------- 提效指标 ---------------- */

  'GET /api/metrics': (_req, res, ctx) =>
    sendJson(res, 200, db.metrics({ days: Number(ctx.url.searchParams.get('days') ?? 14) })),

  'GET /api/ai/runs': (_req, res, ctx) =>
    sendJson(res, 200, { runs: db.listAiRuns({ limit: Number(ctx.url.searchParams.get('limit') ?? 50) }) }),

  /* ---------------- AI 版本（灰度切换提示词/模型） ---------------- */

  'GET /api/ai/config': (_req, res) =>
    sendJson(res, 200, { config: publicAiConfig(), available: AVAILABLE }),

  'POST /api/ai/config': async (req, res, ctx) => {
    const body = await readJson(req)
    let candidate
    try {
      candidate = resolveAiConfig(body)
    } catch (error) {
      return sendError(res, error.status ?? 400, 'invalid_request', error.message)
    }

    const changed =
      candidate.version !== aiConfig.version ||
      candidate.provider !== aiConfig.provider ||
      candidate.model !== aiConfig.model ||
      candidate.baseUrl !== aiConfig.baseUrl ||
      candidate.apiKey !== aiConfig.apiKey
    try { saveAiConfig(candidate) } catch (error) { return sendError(res, 500, 'config_save_failed', error.message) }
    Object.assign(aiConfig, candidate)

    if (changed) {
      db.insertDeploy({
        service: 'ai-support-agent',
        version: `${candidate.provider} / ${candidate.version} / ${candidate.model}`,
        commit: crypto
          .createHash('sha1')
          .update(`${candidate.provider}|${candidate.version}|${candidate.model}|${candidate.baseUrl}`)
          .digest('hex')
          .slice(0, 7),
        environment: 'production',
        deployedBy: ctx.user.email,
        deployedAt: new Date().toISOString(),
        source: 'ai-config',
      })
      db.logAudit({
        actor: ctx.user.email,
        action: 'ai_config_change',
        detail: `${candidate.provider}/${candidate.version}/${candidate.model}`,
      })
    }
    sendJson(res, 200, { ok: true, config: publicAiConfig(), changed })
  },

  'POST /api/ai/config/test': async (req, res) => {
    const body = await readJson(req)
    let candidate
    try {
      candidate = resolveAiConfig(body)
    } catch (error) {
      return sendError(res, error.status ?? 400, 'invalid_request', error.message)
    }

    if (candidate.provider === 'sim') {
      return sendJson(res, 200, {
        ok: true,
        message: '本地模拟服务可用',
        latencyMs: 0,
        model: candidate.model,
      })
    }

    const startedAt = Date.now()
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 30_000)
    try {
      const result = await callModel({
        prompt: '只回复 OK',
        model: candidate.model,
        signal: controller.signal,
        runtimeConfig: candidate,
      })
      if (!result.text?.trim()) throw new Error('模型返回了空内容')
      sendJson(res, 200, {
        ok: true,
        message: '连接成功，模型已返回响应',
        latencyMs: Date.now() - startedAt,
        model: candidate.model,
      })
    } catch (error) {
      const message =
        error?.name === 'AbortError'
          ? '连接超时，请检查接口地址与网络'
          : error instanceof Error
            ? error.message
            : '连接测试失败'
      sendError(res, 502, 'model_test_failed', message)
    } finally {
      clearTimeout(timer)
    }
  },

  'GET /api/deploys': (_req, res, ctx) =>
    sendJson(res, 200, { deploys: db.listDeploys({ limit: ctx.url.searchParams.get('limit') ?? '20' }) }),

  'GET /api/audit': (_req, res, ctx) =>
    sendJson(res, 200, { entries: db.listAudit({ limit: ctx.url.searchParams.get('limit') ?? '100' }) }),

  /* ---------------- CI 推送提示词版本变更 ---------------- */

  'POST /api/webhooks/deploy': async (req, res, ctx) => {
    if (!webhookAuthorized(req, ctx.url)) {
      return sendError(res, 401, 'invalid_webhook_token', '缺少或错误的 webhook 令牌')
    }
    const body = await readJson(req)
    const items = Array.isArray(body) ? body : [body]
    const saved = []
    for (const item of items) {
      const service = str(item.service) ?? 'ai-support-agent'
      const deployedAt = item.deployed_at || item.deployedAt || new Date().toISOString()
      const { deploy, created } = db.insertDeploy({
        service,
        version: str(item.version),
        commit: str(item.commit ?? item.sha),
        environment: str(item.environment ?? item.env) ?? 'production',
        deployedBy: str(item.by ?? item.actor),
        deployedAt: new Date(deployedAt).toISOString(),
        source: 'webhook',
      })
      saved.push({ ...deploy, created })
    }
    sendJson(res, 200, { ok: true, received: saved.length, deploys: saved })
  },
}

const DUMMY_HASH = hashPassword(crypto.randomBytes(8).toString('hex'))

/* --------------------------------------------------------------- 路由匹配 */

const routeTable = Object.entries(handlers).map(([key, handler]) => {
  const [method, pattern] = key.split(' ')
  return { method, pattern, segments: pattern.split('/').filter(Boolean), handler }
})

function matchRoute(method, pathname) {
  const parts = pathname.split('/').filter(Boolean)
  for (const route of routeTable) {
    if (route.method !== method) continue
    if (route.segments.length !== parts.length) continue
    const params = {}
    let ok = true
    for (let i = 0; i < route.segments.length; i++) {
      const seg = route.segments[i]
      if (seg.startsWith(':')) params[seg.slice(1)] = decodeURIComponent(parts[i])
      else if (seg !== parts[i]) {
        ok = false
        break
      }
    }
    if (ok) return { handler: route.handler, params }
  }
  return null
}

const PUBLIC_ROUTES = new Set(['GET /api/health', 'POST /api/auth/login', 'POST /api/auth/logout'])

/* --------------------------------------------------------------- 静态文件 */

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
}

function serveStatic(req, res, pathname) {
  let file = path.join(config.distDir, path.normalize(pathname === '/' ? '/index.html' : pathname))
  if (!file.startsWith(config.distDir)) {
    res.writeHead(403).end('Forbidden')
    return
  }
  if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    file = path.join(config.distDir, 'index.html')
    if (!fs.existsSync(file)) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end('前端未构建：先执行 vite build')
      return
    }
  }
  const stat = fs.statSync(file)
  const immutable = /[\\/]assets[\\/]/.test(file)
  res.writeHead(200, {
    'Content-Type': MIME[path.extname(file).toLowerCase()] ?? 'application/octet-stream',
    'Content-Length': stat.size,
    'Cache-Control': immutable ? 'public, max-age=31536000, immutable' : 'no-cache',
  })
  if (req.method === 'HEAD') return res.end()
  fs.createReadStream(file).pipe(res)
}

const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'no-referrer',
  'Permissions-Policy': 'geolocation=(), camera=(), microphone=()',
  'Content-Security-Policy':
    "default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self'; font-src 'self' data:; base-uri 'none'; form-action 'self'; frame-ancestors 'none'",
}

/* --------------------------------------------------------------- 跨源（CORS） */

/**
 * 前后端分离后前端在另一个源上，必须显式放行。
 * 只放行白名单里的源；用 Authorization 头传令牌，因此不需要 allow-credentials。
 */
function applyCors(req, res) {
  const origin = req.headers.origin
  if (!origin) return false

  const allowAll = config.corsOrigins.includes('*')
  if (!allowAll && !config.corsOrigins.includes(origin)) return false

  res.setHeader('Access-Control-Allow-Origin', allowAll ? '*' : origin)
  res.setHeader('Vary', 'Origin')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Nebula-Token')
  res.setHeader('Access-Control-Max-Age', '600')
  return true
}

/* ------------------------------------------------------------------ 服务器 */

export function createServer() {
  return http.createServer(async (req, res) => {
    const started = Date.now()
    for (const [k, v] of Object.entries(SECURITY_HEADERS)) res.setHeader(k, v)

    const corsAllowed = applyCors(req, res)
    if (req.method === 'OPTIONS') {
      res.writeHead(corsAllowed ? 204 : 403, { 'Content-Length': '0' }).end()
      return
    }

    let url
    try {
      url = new URL(req.url, `http://${req.headers.host ?? 'localhost'}`)
    } catch {
      return sendError(res, 400, 'bad_request', '非法 URL')
    }
    let pathname
    try { pathname = decodeURIComponent(url.pathname) } catch { return sendError(res, 400, 'bad_request', '非法 URL 编码') }

    if (pathname.startsWith('/api/')) {
      const matched = matchRoute(req.method, pathname)
      if (!matched) return sendError(res, 404, 'not_found', '接口不存在')

      const ctx = { url, params: matched.params, req, session: null, user: null }
      const isPublic = PUBLIC_ROUTES.has(`${req.method} ${pathname}`) || pathname.startsWith('/api/webhooks/')
      if (!isPublic && !config.authRequired) {
        // 免登录模式仅允许回环连接、回环 Host 及明确允许的浏览器来源。
        const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, '')
        const origin = req.headers.origin
        const allowedOrigin = !origin || config.corsOrigins.filter((item) => item !== '*').includes(origin) || origin === url.origin
        if (!isLoopback(clientIp(req)) || !['127.0.0.1', 'localhost', '::1'].includes(host) || !allowedOrigin) {
          return sendError(res, 403, 'local_only', '免登录模式仅允许本机访问')
        }
        ctx.user = { id: 'local', email: 'local@nebula', name: '本机用户', role: 'admin' }
      } else if (!isPublic) {
        const session = authenticate(req)
        if (!session) {
          log('warn', 'unauthorized', { path: pathname, ip: clientIp(req) })
          return sendError(res, 401, 'unauthorized', '登录已过期，请重新登录')
        }
        ctx.session = session
        ctx.user = session.user
      }

      if (ctx.user?.role === 'viewer' && req.method !== 'GET') return sendError(res, 403, 'forbidden', '当前账号没有修改权限')
      try {
        await matched.handler(req, res, ctx)
      } catch (error) {
        if (error.code === 'ERR_SQLITE_ERROR' && error.message?.includes('UNIQUE constraint failed: tickets.external_id')) return sendError(res, 409, 'duplicate_external_id', '外部工单号已存在')
        if (error.status && error.status < 500) {
          return sendError(res, error.status, 'bad_request', error.message)
        }
        log('error', 'handler_failed', { path: pathname, message: error.message, stack: error.stack })
        if (!res.headersSent) sendError(res, 500, 'internal_error', '服务器内部错误')
      }
      if (pathname !== '/api/health') {
        log('info', 'api', {
          method: req.method,
          path: pathname,
          status: res.statusCode,
          ms: Date.now() - started,
          ip: clientIp(req),
          user: ctx.user?.email ?? 'anon',
        })
      }
      return
    }

    if (!config.serveStatic) {
      return sendError(res, 404, 'static_disabled', '本服务只提供 API；前端由 web/ 下的静态服务托管')
    }
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      return sendError(res, 405, 'method_not_allowed', '只支持 GET')
    }
    serveStatic(req, res, pathname)
  })
}

export function start() {
  db.openDatabase()

  const bootstrap = config.authRequired ? bootstrapAdmin() : null
  if (bootstrap) {
    log('info', 'admin_created', { email: bootstrap.user.email, generated: bootstrap.generated })
    if (bootstrap.generated) {
      console.log('')
      console.log('============================================================')
      console.log('  首次启动，已创建管理员账号（请立刻保存并修改密码）')
      console.log(`    邮箱: ${bootstrap.user.email}`)
      console.log(`    密码: ${bootstrap.password}`)
      if (bootstrap.credentialsFile) console.log(`    同时写入: ${bootstrap.credentialsFile}`)
      console.log('============================================================')
      console.log('')
    }
  }

  const token = webhookToken()
  log('info', 'webhook_token_ready', { file: path.join(config.dataDir, 'webhook-token.txt'), prefix: token.slice(0, 8) + '…' })

  const server = createServer()
  server.listen(config.port, config.host, () => {
    log('info', 'listening', {
      url: `http://${config.host}:${config.port}/`,
      db: config.dbPath,
      ai: `${aiConfig.version}/${aiConfig.model}`,
      version: config.version,
    })
    console.log(`\n  Nebula 工作台已启动 → http://${config.host}:${config.port}/`)
    console.log(`  AI: ${aiConfig.version} / ${aiConfig.model} · 自动处理阈值 ${config.autoResolveConfidence}\n`)
  })

  server.on('error', (error) => {
    if (error.code === 'EADDRINUSE') {
      log('error', 'port_in_use', { port: config.port })
      console.error(`端口 ${config.port} 已被占用。用 NEBULA_PORT=5189 换端口，或先停掉旧实例。`)
    } else {
      log('error', 'server_error', { message: error.message })
    }
    process.exit(1)
  })

  const purge = setInterval(() => {
    try {
      const n = db.purgeExpiredSessions()
      if (n > 0) log('info', 'sessions_purged', { count: n })
    } catch (error) {
      log('error', 'purge_failed', { message: error.message })
    }
  }, 6 * 3600_000)
  purge.unref()

  const shutdown = (signal) => {
    log('info', 'shutdown', { signal })
    server.close(() => {
      db.closeDatabase()
      process.exit(0)
    })
    setTimeout(() => process.exit(0), 3000).unref()
  }
  process.on('SIGINT', () => shutdown('SIGINT'))
  process.on('SIGTERM', () => shutdown('SIGTERM'))
  process.on('unhandledRejection', (reason) => log('error', 'unhandled_rejection', { message: String(reason) }))

  return server
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (isMain) start()
