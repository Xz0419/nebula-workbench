// 运行时配置。所有项都能用环境变量覆盖，默认值面向本机单机部署。
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { fileURLToPath } from 'node:url'

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

const dataDir = process.env.NEBULA_DATA_DIR
  ? path.resolve(process.env.NEBULA_DATA_DIR)
  : path.join(ROOT, 'data')

function num(value, fallback) {
  const n = Number(value)
  return Number.isFinite(n) ? n : fallback
}

export const config = {
  version: '1.0.0',
  root: ROOT,
  distDir: path.join(ROOT, 'dist'),
  dataDir,
  dbPath: process.env.NEBULA_DB_PATH
    ? path.resolve(process.env.NEBULA_DB_PATH)
    : path.join(dataDir, 'nebula.db'),

  host: process.env.NEBULA_HOST ?? '127.0.0.1',
  port: num(process.env.NEBULA_PORT, 5188),

  // 默认本机免登录；如需原有 API 鉴权，可显式启用。
  authRequired: process.env.NEBULA_AUTH_REQUIRED === '1',

  // 会话
  sessionTtlHours: num(process.env.NEBULA_SESSION_TTL_HOURS, 72),

  // 首次启动的管理员（首启生效）
  adminEmail: (process.env.NEBULA_ADMIN_EMAIL ?? 'admin@nebula.local').toLowerCase(),
  adminPassword: process.env.NEBULA_ADMIN_PASSWORD ?? '',
  adminName: process.env.NEBULA_ADMIN_NAME ?? '管理员',

  // AI 处理策略
  autoResolveConfidence: num(process.env.NEBULA_AUTO_CONFIDENCE, 0.6),
  humanBaselineMin: num(process.env.NEBULA_HUMAN_BASELINE_MIN, 8),
  aiVersion: process.env.NEBULA_AI_VERSION ?? 'v1',
  aiModel: process.env.NEBULA_AI_MODEL ?? process.env.OPENAI_MODEL ?? 'sim-v1',
  autoResolve: process.env.NEBULA_AUTO_RESOLVE === '1',

  // 部署形态：默认纯 API（前端由 web/ 独立托管）；设为 1 才在同一进程里发静态文件
  serveStatic: process.env.NEBULA_SERVE_STATIC === '1',

  // 前后端分离：允许跨源访问的前端地址（逗号分隔，可写 *）
  corsOrigins: (process.env.NEBULA_CORS_ORIGINS ?? 'http://127.0.0.1:5187,http://localhost:5187')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean),

  // 防护
  bodyLimit: num(process.env.NEBULA_BODY_LIMIT, 256 * 1024),
  loginMaxAttempts: num(process.env.NEBULA_LOGIN_MAX_ATTEMPTS, 8),
  loginWindowMin: num(process.env.NEBULA_LOGIN_WINDOW_MIN, 15),
}

export function ensureDataDir() {
  fs.mkdirSync(config.dataDir, { recursive: true })
}

/**
 * webhook 令牌：优先环境变量，否则首次启动生成并落盘到 data/webhook-token.txt。
 * 生产里 Alertmanager 的 receiver 支持 http_config.headers，把这个值塞进去即可。
 */
export function webhookToken() {
  if (process.env.NEBULA_WEBHOOK_TOKEN) return process.env.NEBULA_WEBHOOK_TOKEN
  ensureDataDir()
  const file = path.join(config.dataDir, 'webhook-token.txt')
  if (fs.existsSync(file)) {
    const existing = fs.readFileSync(file, 'utf8').trim()
    if (existing) return existing
  }
  const token = `nbw_${crypto.randomBytes(24).toString('base64url')}`
  fs.writeFileSync(file, token, { mode: 0o600 })
  return token
}
