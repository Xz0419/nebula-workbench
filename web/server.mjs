#!/usr/bin/env node
// 前端静态服务（前后端分离部署里的"前端"）。
//
// 只做三件事：发 dist 里的静态文件、下发 /config.js（告诉浏览器后端在哪）、SPA 回落。
// 零依赖，任何 Node 18+ 都能跑。
//
//   node web/server.mjs
//   WEB_PORT=5187 NEBULA_API_BASE=http://127.0.0.1:5188/api node web/server.mjs
//
// 环境变量：
//   WEB_PORT         监听端口，默认 5187
//   WEB_HOST         监听地址，默认 127.0.0.1
//   WEB_ROOT         静态根目录，默认自动找 ./dist 或 ../dist
//   NEBULA_API_BASE  后端 API 地址，默认 http://127.0.0.1:5188/api

import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const PORT = Number(process.env.WEB_PORT ?? 5187)
const HOST = process.env.WEB_HOST ?? '127.0.0.1'
const API_BASE = (process.env.NEBULA_API_BASE ?? 'http://127.0.0.1:5188/api').replace(/\/$/, '')

function resolveRoot() {
  if (process.env.WEB_ROOT) return path.resolve(process.env.WEB_ROOT)
  const local = path.join(HERE, 'dist') // 打包后的形状：web/dist
  if (fs.existsSync(path.join(local, 'index.html'))) return local
  const sibling = path.join(HERE, '..', 'dist') // 仓库内的形状：dist/
  return sibling
}

const ROOT = resolveRoot()

if (!fs.existsSync(path.join(ROOT, 'index.html'))) {
  console.error(`[web] 找不到前端构建产物：${path.join(ROOT, 'index.html')}`)
  console.error('[web] 先构建： node ./node_modules/vite/bin/vite.js build')
  process.exit(1)
}

const apiOrigin = (() => {
  try {
    return new URL(API_BASE).origin
  } catch {
    return API_BASE
  }
})()

const CSP = [
  "default-src 'self'",
  "img-src 'self' data:",
  "style-src 'self' 'unsafe-inline'",
  "script-src 'self'",
  `connect-src 'self' ${apiOrigin}`,
  "font-src 'self' data:",
  "base-uri 'none'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join('; ')

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

const log = (...args) => console.log(new Date().toISOString().slice(11, 19), ...args)

const server = http.createServer((req, res) => {
  const started = Date.now()
  let pathname
  try {
    pathname = decodeURIComponent(new URL(req.url, `http://${req.headers.host ?? 'localhost'}`).pathname)
  } catch {
    res.writeHead(400).end('Bad Request')
    return
  }

  res.setHeader('Content-Security-Policy', CSP)
  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.setHeader('X-Frame-Options', 'DENY')
  res.setHeader('Referrer-Policy', 'no-referrer')

  // 运行时配置：告诉前端后端在哪（改地址不用重新构建）
  if (pathname === '/config.js') {
    const body = `window.__NEBULA_API__ = ${JSON.stringify(API_BASE)};\n`
    res.writeHead(200, {
      'Content-Type': 'text/javascript; charset=utf-8',
      'Content-Length': Buffer.byteLength(body),
      'Cache-Control': 'no-store',
    })
    res.end(body)
    return
  }

  let file = path.join(ROOT, path.normalize(pathname === '/' ? '/index.html' : pathname))
  if (!file.startsWith(ROOT)) {
    res.writeHead(403).end('Forbidden')
    return
  }
  if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    file = path.join(ROOT, 'index.html') // SPA 回落（应用用 hash 路由）
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
  res.on('finish', () => {
    if (!immutable) log('GET', pathname, res.statusCode, `${Date.now() - started}ms`)
  })
})

server.on('error', (error) => {
  if (error.code === 'EADDRINUSE') {
    console.error(`[web] 端口 ${PORT} 已被占用。换端口： WEB_PORT=5186 node web/server.mjs`)
  } else {
    console.error('[web] 启动失败:', error.message)
  }
  process.exit(1)
})

server.listen(PORT, HOST, () => {
  log(`前端已启动 → http://${HOST}:${PORT}/`)
  log(`静态根目录: ${ROOT}`)
  log(`后端 API  : ${API_BASE}`)
})

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => server.close(() => process.exit(0)))
}
