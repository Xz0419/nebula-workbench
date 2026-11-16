// 认证：scrypt 口令散列 + 不透明会话令牌（库里只存 token 的 sha256）。
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { config, ensureDataDir } from './config.mjs'
import * as db from './db.mjs'

const SCRYPT = { N: 16384, r: 8, p: 1, keylen: 64 }

export function hashPassword(password) {
  const salt = crypto.randomBytes(16)
  const derived = crypto.scryptSync(password, salt, SCRYPT.keylen, {
    N: SCRYPT.N,
    r: SCRYPT.r,
    p: SCRYPT.p,
  })
  return [
    'scrypt',
    SCRYPT.N,
    SCRYPT.r,
    SCRYPT.p,
    salt.toString('base64url'),
    derived.toString('base64url'),
  ].join('$')
}

export function verifyPassword(password, stored) {
  try {
    const [scheme, N, r, p, saltB64, hashB64] = String(stored).split('$')
    if (scheme !== 'scrypt') return false
    const salt = Buffer.from(saltB64, 'base64url')
    const expected = Buffer.from(hashB64, 'base64url')
    const derived = crypto.scryptSync(password, salt, expected.length, {
      N: Number(N),
      r: Number(r),
      p: Number(p),
    })
    return derived.length === expected.length && crypto.timingSafeEqual(derived, expected)
  } catch {
    return false
  }
}

export const hashToken = (token) => crypto.createHash('sha256').update(token).digest('hex')

export function createSession(user, { userAgent, ip } = {}) {
  const token = crypto.randomBytes(32).toString('base64url')
  const expiresAt = new Date(Date.now() + config.sessionTtlHours * 3600_000).toISOString()
  db.insertSession({ tokenHash: hashToken(token), userId: user.id, expiresAt, userAgent, ip })
  return { token, expiresAt }
}

/** 从 Authorization: Bearer xxx 或 Cookie: nebula_token=xxx 里取会话 */
export function authenticate(req) {
  const token = readToken(req)
  if (!token) return null
  const tokenHash = hashToken(token)
  const session = db.findSession(tokenHash)
  return session ? { ...session, token, tokenHash } : null
}

export function readToken(req) {
  const header = req.headers.authorization
  if (header && header.startsWith('Bearer ')) return header.slice(7).trim()
  const cookie = req.headers.cookie
  if (cookie) {
    const match = cookie.split(';').map((c) => c.trim()).find((c) => c.startsWith('nebula_token='))
    if (match) return decodeURIComponent(match.slice('nebula_token='.length))
  }
  return null
}

/* ------------------------------------------------------ 登录限流（内存） */

const attempts = new Map()

function pruneAttempts() {
  const now = Date.now()
  for (const [key, value] of attempts) {
    if (value.resetAt <= now) attempts.delete(key)
  }
}

export function loginAllowed(key) {
  pruneAttempts()
  const entry = attempts.get(key)
  if (!entry) return { allowed: true, retryAfterSec: 0 }
  if (entry.count < config.loginMaxAttempts) return { allowed: true, retryAfterSec: 0 }
  return { allowed: false, retryAfterSec: Math.ceil((entry.resetAt - Date.now()) / 1000) }
}

export function recordLoginFailure(key) {
  const now = Date.now()
  const entry = attempts.get(key)
  if (!entry || entry.resetAt <= now) {
    attempts.set(key, { count: 1, resetAt: now + config.loginWindowMin * 60_000 })
    return
  }
  entry.count += 1
}

export function clearLoginFailures(key) {
  attempts.delete(key)
}

/* -------------------------------------------------------------- 初始化 */

/**
 * 首次启动创建管理员。没给 NEBULA_ADMIN_PASSWORD 就随机生成一个，
 * 打印到日志并在 data/initial-admin.txt 留档（登录后请删掉该文件）。
 */
export function bootstrapAdmin() {
  if (db.countUsers() > 0) return null

  const generated = !config.adminPassword
  const password = config.adminPassword || crypto.randomBytes(9).toString('base64url')
  const user = db.createUser({
    email: config.adminEmail,
    name: config.adminName,
    role: 'admin',
    passwordHash: hashPassword(password),
  })

  return { user, password, generated, credentialsFile: generated ? saveInitialCredentials(user.email, password) : null }
}

function saveInitialCredentials(email, password) {
  try {
    ensureDataDir()
    const file = path.join(config.dataDir, 'initial-admin.txt')
    fs.writeFileSync(
      file,
      [
        'Nebula 首次启动创建的管理员账号（登录后请删除本文件）',
        `邮箱: ${email}`,
        `密码: ${password}`,
        `创建时间: ${new Date().toISOString()}`,
        '',
      ].join('\n'),
      { mode: 0o600 },
    )
    return file
  } catch {
    return null
  }
}
