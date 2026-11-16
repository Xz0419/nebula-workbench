// 数据层：node:sqlite（Node 22.5+ 内置，零外部依赖）、WAL、外键、幂等写入。
import { DatabaseSync } from 'node:sqlite'
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { config, ensureDataDir } from './config.mjs'
import { DOCS } from '../workflow/corpus.mjs'

export const nowIso = () => new Date().toISOString()
const newId = (prefix) => `${prefix}_${crypto.randomBytes(9).toString('base64url')}`
const safeJson = (text) => {
  try {
    return JSON.parse(text)
  } catch {
    return {}
  }
}

let db = null

const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id            TEXT PRIMARY KEY,
  email         TEXT NOT NULL UNIQUE,
  name          TEXT NOT NULL,
  role          TEXT NOT NULL DEFAULT 'admin',
  password_hash TEXT NOT NULL,
  created_at    TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  user_agent TEXT,
  ip         TEXT
);
CREATE INDEX IF NOT EXISTS ix_sessions_expires ON sessions(expires_at);

-- 工单：AI 先处理一遍，能答的直接答掉，答不了的带草稿转人工
CREATE TABLE IF NOT EXISTS tickets (
  id                TEXT PRIMARY KEY,
  external_id       TEXT,
  channel           TEXT NOT NULL DEFAULT 'web',
  subject           TEXT NOT NULL,
  body              TEXT NOT NULL,
  customer          TEXT,
  priority          TEXT NOT NULL DEFAULT 'normal',
  status            TEXT NOT NULL DEFAULT 'queued',
  ai_answer         TEXT,
  ai_citations      TEXT,
  ai_confidence     REAL,
  ai_version        TEXT,
  ai_ms             INTEGER,
  ai_tokens_in      INTEGER DEFAULT 0,
  ai_tokens_out     INTEGER DEFAULT 0,
  ai_error          TEXT,
  human_answer      TEXT,
  handled_by        TEXT,
  human_minutes     INTEGER,
  created_at        TEXT NOT NULL,
  escalated_at      TEXT,
  resolved_at       TEXT
);
CREATE INDEX IF NOT EXISTS ix_tickets_status  ON tickets(status, created_at DESC);
CREATE INDEX IF NOT EXISTS ix_tickets_created ON tickets(created_at DESC);
-- 外部工单号去重：只在真的给了 external_id 时生效（NULL 不算重复）
DROP INDEX IF EXISTS ux_tickets_ext;
CREATE UNIQUE INDEX IF NOT EXISTS ux_tickets_ext ON tickets(external_id) WHERE external_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS knowledge_docs (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  text TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 1,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS app_metadata (key TEXT PRIMARY KEY, value TEXT NOT NULL);

CREATE TABLE IF NOT EXISTS ticket_messages (
  id TEXT PRIMARY KEY,
  ticket_id TEXT NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  content TEXT NOT NULL,
  actor TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS ix_ticket_messages ON ticket_messages(ticket_id, created_at);

-- 每次 AI 运行的遥测（用于按版本比较效率与成本）
CREATE TABLE IF NOT EXISTS ai_runs (
  id          TEXT PRIMARY KEY,
  ticket_id   TEXT,
  version     TEXT NOT NULL,
  model       TEXT,
  status      TEXT NOT NULL,
  confidence  REAL,
  latency_ms  INTEGER NOT NULL,
  tokens_in   INTEGER NOT NULL DEFAULT 0,
  tokens_out  INTEGER NOT NULL DEFAULT 0,
  error_stage TEXT,
  error       TEXT,
  stages      TEXT NOT NULL DEFAULT '[]',
  created_at  TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS ix_runs_created ON ai_runs(created_at DESC);
CREATE INDEX IF NOT EXISTS ix_runs_version ON ai_runs(version, created_at DESC);

-- 提示词 / 模型版本变更（谁把 AI 改慢了改差了，能追）
CREATE TABLE IF NOT EXISTS deploys (
  id           TEXT PRIMARY KEY,
  source       TEXT NOT NULL DEFAULT 'webhook',
  service      TEXT NOT NULL,
  environment  TEXT NOT NULL DEFAULT 'production',
  version      TEXT,
  commit_sha   TEXT,
  ref          TEXT,
  url          TEXT,
  deployed_by  TEXT,
  deployed_at  TEXT NOT NULL,
  received_at  TEXT NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_deploys_dedupe ON deploys(service, ifnull(commit_sha,''), deployed_at);

CREATE TABLE IF NOT EXISTS audit_log (
  id     TEXT PRIMARY KEY,
  at     TEXT NOT NULL,
  actor  TEXT,
  action TEXT NOT NULL,
  detail TEXT,
  ip     TEXT
);
CREATE INDEX IF NOT EXISTS ix_audit_at ON audit_log(at DESC);
`

export function openDatabase() {
  if (db) return db
  ensureDataDir()
  fs.mkdirSync(path.dirname(config.dbPath), { recursive: true })
  db = new DatabaseSync(config.dbPath)
  db.exec('PRAGMA journal_mode = WAL')
  db.exec('PRAGMA synchronous = NORMAL')
  db.exec('PRAGMA foreign_keys = ON')
  db.exec('PRAGMA busy_timeout = 5000')
  db.exec(SCHEMA)
  if (!db.prepare('PRAGMA table_info(tickets)').all().some((column) => column.name === 'category')) db.exec("ALTER TABLE tickets ADD COLUMN category TEXT NOT NULL DEFAULT 'other'")
  if (!db.prepare('PRAGMA table_info(tickets)').all().some((column) => column.name === 'revision')) db.exec('ALTER TABLE tickets ADD COLUMN revision INTEGER NOT NULL DEFAULT 0')
  if (!db.prepare("SELECT value FROM app_metadata WHERE key = 'knowledge_seeded'").get()) {
    db.exec('BEGIN')
    try {
      const insert = db.prepare('INSERT OR IGNORE INTO knowledge_docs (id, title, text, active, updated_at) VALUES (?, ?, ?, 1, ?)')
      for (const doc of DOCS) insert.run(doc.id, doc.title, doc.text, nowIso())
      db.prepare("INSERT INTO app_metadata (key, value) VALUES ('knowledge_seeded', '1')").run()
      db.exec('COMMIT')
    } catch (error) { db.exec('ROLLBACK'); throw error }
  }
  // 为已有数据补齐历史记录；重复启动不会重复写入。
  db.exec(`INSERT INTO ticket_messages (id, ticket_id, kind, content, actor, created_at)
    SELECT 'legacy_' || id, id, 'reply', human_answer, handled_by, COALESCE(resolved_at, created_at)
    FROM tickets WHERE human_answer IS NOT NULL AND NOT EXISTS
      (SELECT 1 FROM ticket_messages m WHERE m.ticket_id = tickets.id AND m.kind = 'reply')`)
  return db
}

export function closeDatabase() {
  if (!db) return
  db.close()
  db = null
}

/* ------------------------------------------------------------------ 映射 */

const mapUser = (r) => r && { id: r.id, email: r.email, name: r.name, role: r.role, createdAt: r.created_at }

const mapTicket = (r) =>
  r && {
    id: r.id,
    revision: r.revision,
    externalId: r.external_id,
    channel: r.channel,
    subject: r.subject,
    body: r.body,
    customer: r.customer,
    priority: r.priority,
    category: r.category,
    status: r.status,
    aiAnswer: r.ai_answer,
    aiCitations: r.ai_citations ? safeJson(r.ai_citations) : [],
    aiConfidence: r.ai_confidence,
    aiVersion: r.ai_version,
    aiMs: r.ai_ms,
    aiTokensIn: r.ai_tokens_in,
    aiTokensOut: r.ai_tokens_out,
    aiError: r.ai_error,
    humanAnswer: r.human_answer,
    handledBy: r.handled_by,
    humanMinutes: r.human_minutes,
    createdAt: r.created_at,
    escalatedAt: r.escalated_at,
    resolvedAt: r.resolved_at,
  }

const mapRun = (r) =>
  r && {
    id: r.id,
    ticketId: r.ticket_id,
    version: r.version,
    model: r.model,
    status: r.status,
    confidence: r.confidence,
    latencyMs: r.latency_ms,
    tokensIn: r.tokens_in,
    tokensOut: r.tokens_out,
    errorStage: r.error_stage,
    error: r.error,
    stages: safeJson(r.stages),
    createdAt: r.created_at,
  }

/* ------------------------------------------------------------------ 用户 */

export function countUsers() {
  return db.prepare('SELECT count(*) AS n FROM users').get().n
}

export function createUser({ email, name, role = 'admin', passwordHash }) {
  const id = newId('usr')
  db.prepare(
    'INSERT INTO users (id, email, name, role, password_hash, created_at) VALUES (?, ?, ?, ?, ?, ?)',
  ).run(id, email.toLowerCase(), name, role, passwordHash, nowIso())
  return mapUser(db.prepare('SELECT * FROM users WHERE id = ?').get(id))
}

export function findUserByEmail(email) {
  const row = db.prepare('SELECT * FROM users WHERE email = ?').get(String(email).toLowerCase())
  return row && { ...mapUser(row), passwordHash: row.password_hash }
}

export function findUserById(id) {
  return mapUser(db.prepare('SELECT * FROM users WHERE id = ?').get(id))
}

/* ------------------------------------------------------------------ 会话 */

export function insertSession({ tokenHash, userId, expiresAt, userAgent, ip }) {
  db.prepare(
    'INSERT INTO sessions (token_hash, user_id, created_at, expires_at, user_agent, ip) VALUES (?, ?, ?, ?, ?, ?)',
  ).run(tokenHash, userId, nowIso(), expiresAt, userAgent ?? null, ip ?? null)
}

export function findSession(tokenHash) {
  const row = db
    .prepare(
      `SELECT s.expires_at, u.id, u.email, u.name, u.role
         FROM sessions s JOIN users u ON u.id = s.user_id
        WHERE s.token_hash = ?`,
    )
    .get(tokenHash)
  if (!row) return null
  if (new Date(row.expires_at).getTime() <= Date.now()) {
    deleteSession(tokenHash)
    return null
  }
  return {
    user: { id: row.id, email: row.email, name: row.name, role: row.role },
    expiresAt: row.expires_at,
  }
}

export function deleteSession(tokenHash) {
  db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(tokenHash)
}

export function purgeExpiredSessions() {
  return db.prepare('DELETE FROM sessions WHERE expires_at <= ?').run(nowIso()).changes
}

/* ------------------------------------------------------------------ 知识库 */
export function listKnowledge(activeOnly = false) {
  return db.prepare(`SELECT id, title, text, active, updated_at AS updatedAt FROM knowledge_docs ${activeOnly ? 'WHERE active = 1' : ''} ORDER BY updated_at DESC`).all().map((doc) => ({ ...doc, active: Boolean(doc.active) }))
}
export function saveKnowledge({ id, title, text, active = true }) {
  const key = id || newId('doc')
  db.prepare(`INSERT INTO knowledge_docs (id, title, text, active, updated_at) VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET title = excluded.title, text = excluded.text, active = excluded.active, updated_at = excluded.updated_at`).run(key, title, text, active ? 1 : 0, nowIso())
  return listKnowledge().find((doc) => doc.id === key)
}
export function getKnowledge(id) { return listKnowledge().find((doc) => doc.id === id) }

/* ------------------------------------------------------------------ 工单 */

export function listTicketMessages(ticketId) {
  return db.prepare('SELECT id, kind, content, actor, created_at AS createdAt FROM ticket_messages WHERE ticket_id = ? ORDER BY created_at, rowid').all(ticketId)
}
export function addTicketMessage(ticketId, kind, content, actor) {
  db.prepare('INSERT INTO ticket_messages (id, ticket_id, kind, content, actor, created_at) VALUES (?, ?, ?, ?, ?, ?)')
    .run(newId('msg'), ticketId, kind, content, actor ?? null, nowIso())
}

export function createTicket(ticket) {
  const id = newId('tkt')
  db.prepare(
    `INSERT INTO tickets (id, external_id, channel, subject, body, customer, priority, category, status, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'queued', ?)`,
  ).run(
    id,
    ticket.externalId ?? null,
    ticket.channel ?? 'web',
    ticket.subject,
    ticket.body,
    ticket.customer ?? null,
    ticket.priority ?? 'normal',
    ticket.category ?? 'other',
    nowIso(),
  )
  addTicketMessage(id, 'customer', ticket.body, ticket.customer)
  return getTicket(id)
}

export function getTicket(id) {
  return mapTicket(db.prepare('SELECT * FROM tickets WHERE id = ?').get(id))
}

export function listTickets({ status = 'all', limit = 100 } = {}) {
  const lim = Math.min(Math.max(Number(limit) || 100, 1), 500)
  const rows =
    status === 'all'
      ? db.prepare('SELECT * FROM tickets ORDER BY created_at DESC LIMIT ?').all(lim)
      : db.prepare('SELECT * FROM tickets WHERE status = ? ORDER BY created_at DESC LIMIT ?').all(status, lim)
  return rows.map(mapTicket)
}

export function saveAiResult({ ticketId, expectedRevision, answer, citations, confidence, version, ms, tokensIn, tokensOut }) {
  db.prepare(
    `UPDATE tickets
        SET revision = revision + 1, ai_answer = ?, ai_citations = ?, ai_confidence = ?, ai_version = ?, ai_ms = ?,
            ai_tokens_in = ?, ai_tokens_out = ?, ai_error = NULL,
            status = CASE WHEN ? >= ? THEN 'auto_resolved' ELSE 'needs_human' END,
            escalated_at = CASE WHEN ? >= ? THEN NULL ELSE ? END,
            resolved_at = CASE WHEN ? >= ? THEN ? ELSE NULL END
      WHERE id = ? AND revision = ? AND status IN ('queued', 'needs_human') AND human_answer IS NULL`,
  ).run(
    answer,
    JSON.stringify(citations ?? []),
    confidence,
    version,
    ms,
    tokensIn ?? 0,
    tokensOut ?? 0,
    confidence,
    config.autoResolve ? config.autoResolveConfidence : 2,
    confidence,
    config.autoResolve ? config.autoResolveConfidence : 2,
    nowIso(),
    confidence,
    config.autoResolve ? config.autoResolveConfidence : 2,
    nowIso(),
    ticketId,
    expectedRevision,
  )
  return getTicket(ticketId)
}

export function markAiFailure({ ticketId, expectedRevision, error, version, ms }) {
  db.prepare(
    `UPDATE tickets
        SET revision = revision + 1, ai_error = ?, ai_answer = NULL, ai_citations = NULL, ai_confidence = NULL, ai_version = ?, ai_ms = ?, status = 'needs_human', escalated_at = ?, resolved_at = NULL
      WHERE id = ? AND revision = ? AND status IN ('queued', 'needs_human') AND human_answer IS NULL`,
  ).run(error, version, ms, nowIso(), ticketId, expectedRevision)
  return getTicket(ticketId)
}

/** 人工采纳 AI 草稿（可能改过文案）：记为"AI 起草 + 人工确认"，仍算 AI 提效 */
export function approveTicket({ id, answer, actor, minutes }) {
  const ticket = getTicket(id)
  if (!ticket) return null
  db.prepare(
    `UPDATE tickets
        SET revision = revision + 1, human_answer = ?, handled_by = ?, human_minutes = ?,
            status = 'resolved', resolved_at = ?
      WHERE id = ?`,
  ).run(answer ?? ticket.aiAnswer, actor, minutes ?? null, nowIso(), id)
  addTicketMessage(id, 'reply', answer ?? ticket.aiAnswer, actor)
  return getTicket(id)
}

/** 人工自己写答复：记为纯人工处理，用于对比效率 */
export function replyTicket({ id, answer, actor, minutes }) {
  const ticket = getTicket(id)
  if (!ticket) return null
  db.prepare(
    `UPDATE tickets
        SET revision = revision + 1, human_answer = ?, handled_by = ?, human_minutes = ?, status = 'resolved', resolved_at = ?
      WHERE id = ?`,
  ).run(answer, actor, minutes ?? null, nowIso(), id)
  addTicketMessage(id, 'reply', answer, actor)
  return getTicket(id)
}

export function escalateTicket({ id }) {
  return db
    .prepare(
      "UPDATE tickets SET revision = revision + 1, status = 'needs_human', human_answer = NULL, handled_by = NULL, human_minutes = NULL, resolved_at = NULL, escalated_at = COALESCE(escalated_at, ?) WHERE id = ?",
    )
    .run(nowIso(), id).changes
}

/* -------------------------------------------------------------- AI 运行 */

export function insertAiRun(run) {
  const id = run.id ?? newId('run')
  db.prepare(
    `INSERT INTO ai_runs (id, ticket_id, version, model, status, confidence, latency_ms, tokens_in, tokens_out,
                          error_stage, error, stages, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    id,
    run.ticketId ?? null,
    run.version ?? 'unknown',
    run.model ?? null,
    run.status === 'ok' ? 'ok' : 'failed',
    run.confidence ?? null,
    Number(run.latencyMs) || 0,
    Number(run.tokensIn) || 0,
    Number(run.tokensOut) || 0,
    run.errorStage ?? null,
    run.error ?? null,
    JSON.stringify(run.stages ?? []),
    nowIso(),
  )
  return mapRun(db.prepare('SELECT * FROM ai_runs WHERE id = ?').get(id))
}

export function listAiRuns({ limit = 50, ticketId } = {}) {
  limit = Math.min(500, Math.max(1, Math.floor(Number(limit) || 50)))
  const rows = ticketId
    ? db.prepare('SELECT * FROM ai_runs WHERE ticket_id = ? ORDER BY created_at DESC LIMIT ?').all(ticketId, limit)
    : db.prepare('SELECT * FROM ai_runs ORDER BY created_at DESC LIMIT ?').all(limit)
  return rows.map(mapRun)
}

/* ---------------------------------------------------------- 提效指标 */

const pct = (part, total) => (total > 0 ? Number(((part / total) * 100).toFixed(1)) : 0)

function sinceIso(days) {
  return new Date(Date.now() - days * 86400_000).toISOString()
}

/**
 * 效率指标。全部来自真实工单与真实 AI 运行记录。
 * "节省人时"用可配置的人工基线（默认 8 分钟/单），这是**假设值**，界面上要标注。
 */
export function metrics({ days = 14 } = {}) {
  days = Number.isFinite(days) ? Math.min(365, Math.max(1, Math.floor(days))) : 14
  const from = sinceIso(days)
  const all = db
    .prepare('SELECT * FROM tickets WHERE created_at >= ? ORDER BY created_at')
    .all(from)
    .map(mapTicket)

  const total = all.length
  const autoResolved = all.filter((t) => t.status === 'auto_resolved').length
  const handledByHuman = all.filter((t) => t.status === 'resolved' && t.humanAnswer).length
  const backlog = all.filter((t) => t.status === 'needs_human' || t.status === 'queued').length

  const aiLatencies = all.map((t) => t.aiMs).filter((v) => typeof v === 'number' && v > 0)
  const avgAiMs = aiLatencies.length
    ? Math.round(aiLatencies.reduce((a, b) => a + b, 0) / aiLatencies.length)
    : 0

  const humanMinutesActual = all
    .filter((t) => t.status === 'resolved' && typeof t.humanMinutes === 'number')
    .reduce((sum, t) => sum + t.humanMinutes, 0)

  const savedMinutes = autoResolved * config.humanBaselineMin
  const tokensOut = all.reduce((sum, t) => sum + (t.aiTokensOut ?? 0), 0)

  // 每日吞吐：自动处理 vs 人工处理
  const seriesMap = new Map()
  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(Date.now() - i * 86400_000).toISOString().slice(0, 10)
    seriesMap.set(date, { date, auto: 0, human: 0, total: 0 })
  }
  for (const ticket of all) {
    const date = ticket.createdAt.slice(0, 10)
    const bucket = seriesMap.get(date)
    if (!bucket) continue
    bucket.total += 1
    if (ticket.status === 'auto_resolved') bucket.auto += 1
    else if (ticket.status === 'resolved' && ticket.humanAnswer) bucket.human += 1
  }

  // 按 AI 版本看效率（换提示词之后是变好还是变差）
  const versionRows = db
    .prepare(
      `SELECT version, count(*) AS runs, avg(latency_ms) AS avg_ms, avg(confidence) AS avg_conf,
              sum(tokens_out) AS tokens, sum(CASE WHEN status = 'ok' THEN 1 ELSE 0 END) AS ok_runs
         FROM ai_runs WHERE created_at >= ? GROUP BY version ORDER BY runs DESC`,
    )
    .all(from)

  const versionPerf = versionRows.map((row) => ({
    version: row.version,
    runs: row.runs,
    okRate: pct(row.ok_runs, row.runs),
    avgMs: Math.round(row.avg_ms ?? 0),
    avgConfidence: Number((row.avg_conf ?? 0).toFixed(2)),
    tokens: row.tokens ?? 0,
  }))

  return {
    windowDays: days,
    baseline: { humanMinutes: config.humanBaselineMin, autoResolveConfidence: config.autoResolveConfidence },
    totals: {
      tickets: total,
      autoResolved,
      handledByHuman,
      backlog,
      automationRate: pct(autoResolved, total),
      avgAiMs,
      savedMinutes,
      savedHours: Number((savedMinutes / 60).toFixed(1)),
      humanMinutesActual,
      tokensOut,
    },
    series: [...seriesMap.values()],
    versionPerf,
  }
}

/* ------------------------------------------------------------------ 变更 */

export function insertDeploy(d) {
  // 去重：同一 service + commit 在 ±2 分钟内视为同一次发布（CI 重试时间戳会抖动）
  const at = new Date(d.deployedAt).getTime()
  if (d.commit) {
    const near = db
      .prepare(
        `SELECT * FROM deploys
          WHERE service = ? AND ifnull(commit_sha,'') = ? AND deployed_at BETWEEN ? AND ?
          ORDER BY deployed_at DESC LIMIT 1`,
      )
      .get(d.service, d.commit, new Date(at - 120_000).toISOString(), new Date(at + 120_000).toISOString())
    if (near) {
      return {
        deploy: {
          id: near.id,
          service: near.service,
          version: near.version,
          commit: near.commit_sha,
          deployedAt: near.deployed_at,
        },
        created: false,
      }
    }
  }

  const id = newId('dpl')
  db.prepare(
    `INSERT INTO deploys (id, source, service, environment, version, commit_sha, ref, url, deployed_by, deployed_at, received_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    id,
    d.source ?? 'webhook',
    d.service,
    d.environment ?? 'production',
    d.version ?? null,
    d.commit ?? null,
    d.ref ?? null,
    d.url ?? null,
    d.deployedBy ?? null,
    d.deployedAt,
    nowIso(),
  )
  const row = db.prepare('SELECT * FROM deploys WHERE id = ?').get(id)
  return {
    deploy: {
      id: row.id,
      service: row.service,
      version: row.version,
      commit: row.commit_sha,
      deployedAt: row.deployed_at,
    },
    created: true,
  }
}

export function listDeploys({ limit = 20 } = {}) {
  return db
    .prepare('SELECT * FROM deploys ORDER BY deployed_at DESC LIMIT ?')
    .all(Math.min(Math.max(Number(limit) || 20, 1), 200))
    .map((r) => ({
      id: r.id,
      service: r.service,
      version: r.version,
      commit: r.commit_sha,
      deployedAt: r.deployed_at,
    }))
}

/* ------------------------------------------------------------------ 审计 */

export function logAudit({ actor, action, detail, ip }) {
  db.prepare('INSERT INTO audit_log (id, at, actor, action, detail, ip) VALUES (?, ?, ?, ?, ?, ?)').run(
    newId('aud'),
    nowIso(),
    actor ?? null,
    action,
    detail ?? null,
    ip ?? null,
  )
}

export function listAudit({ limit = 100 } = {}) {
  return db
    .prepare('SELECT at, actor, action, detail FROM audit_log ORDER BY at DESC LIMIT ?')
    .all(Math.min(Math.max(Number(limit) || 100, 1), 500))
}

export function stats() {
  const row = db
    .prepare(
      `SELECT
         (SELECT count(*) FROM tickets) AS tickets,
         (SELECT count(*) FROM tickets WHERE status = 'auto_resolved') AS auto,
         (SELECT count(*) FROM tickets WHERE status IN ('needs_human','queued')) AS backlog,
         (SELECT count(*) FROM ai_runs) AS runs,
         (SELECT count(*) FROM users) AS users,
         (SELECT count(*) FROM deploys) AS deploys`,
    )
    .get()
  return {
    tickets: row.tickets,
    autoResolved: row.auto,
    backlog: row.backlog,
    aiRuns: row.runs,
    users: row.users,
    deploys: row.deploys,
  }
}
