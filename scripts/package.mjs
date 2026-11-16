#!/usr/bin/env node
// 打包成可交付的目录（前后端分离版）：
//
//   out/nebula-workbench-<version>/
//     README.md  DEPLOY.md  快速开始.txt
//     start.cmd / restart.cmd / stop.cmd
//     backend/   server/ workflow/ package.json      ← 纯 API，不托管前端
//     web/       dist/ server.mjs                    ← 静态前端，运行时下发 config.js
//     scripts/   start-hidden.ps1
//
//   node scripts/package.mjs [--zip]
//
// 交付物不依赖 node_modules：后端只用 Node 内置模块，前端是构建好的静态文件。
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(HERE, '..')
const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'))
const NAME = `${pkg.name}-${pkg.version}`
const OUT = path.join(ROOT, 'out', NAME)

const log = (...args) => console.log(...args)

function copyDir(from, to, filter = () => true) {
  fs.mkdirSync(to, { recursive: true })
  for (const entry of fs.readdirSync(from, { withFileTypes: true })) {
    if (!filter(entry)) continue
    const src = path.join(from, entry.name)
    const dest = path.join(to, entry.name)
    if (entry.isDirectory()) copyDir(src, dest, filter)
    else fs.copyFileSync(src, dest)
  }
}

function write(file, content) {
  fs.mkdirSync(path.dirname(file), { recursive: true })
  // 批处理 / PowerShell 一律 CRLF，避免 cmd 解析错乱
  const normalized = content.replace(/\r\n/g, '\n').replace(/\n/g, '\r\n')
  fs.writeFileSync(file, normalized, 'utf8')
}

/* ------------------------------------------------------------------ 清空 */

if (!fs.existsSync(path.join(ROOT, 'dist', 'index.html'))) {
  console.error('[package] 没有 dist/index.html，先构建： node ./node_modules/vite/bin/vite.js build')
  process.exit(1)
}
fs.rmSync(OUT, { recursive: true, force: true })
fs.mkdirSync(OUT, { recursive: true })

/* -------------------------------------------------------------- 后端 */

copyDir(path.join(ROOT, 'server'), path.join(OUT, 'backend', 'server'), (e) => e.isFile())
copyDir(path.join(ROOT, 'workflow'), path.join(OUT, 'backend', 'workflow'), (e) => e.isFile())

write(
  path.join(OUT, 'backend', 'package.json'),
  JSON.stringify(
    {
      name: `${pkg.name}-backend`,
      private: true,
      version: pkg.version,
      type: 'module',
      description: 'Nebula 工作台后端 API（零外部依赖：node:sqlite / node:http / node:crypto）',
      engines: { node: '>=22.5' },
      scripts: { start: 'node server/main.mjs' },
    },
    null,
    2,
  ),
)

/* -------------------------------------------------------------- 前端 */

copyDir(path.join(ROOT, 'dist'), path.join(OUT, 'web', 'dist'))
fs.copyFileSync(path.join(ROOT, 'web', 'server.mjs'), path.join(OUT, 'web', 'server.mjs'))

/* -------------------------------------------------------------- 启动脚本 */

// 注意：这段 PowerShell 里不要出现反引号，统一用单行命令 + 字符串拼接
const startHidden = `# Nebula 工作台 —— 隐藏窗口启动器（前后端分离）
#   后端 API   : 5188  backend/server/main.mjs
#   前端静态站 : 5187  web/server.mjs
# 由 start.cmd / 开机自启调用。

$ErrorActionPreference = 'Stop'

$ApiPort = 5188
$WebPort = 5187
$Proj = Split-Path -Parent $PSScriptRoot
$LogDir = Join-Path $Proj 'logs'
if (-not (Test-Path $LogDir)) { New-Item -ItemType Directory -Path $LogDir -Force | Out-Null }

$NodeExe = $null
$cmd = Get-Command node -ErrorAction SilentlyContinue
if ($cmd) { $NodeExe = $cmd.Source }
if (-not $NodeExe -and $env:NEBULA_NODE -and (Test-Path $env:NEBULA_NODE)) { $NodeExe = $env:NEBULA_NODE }
if (-not $NodeExe) { exit 1 }

function Start-IfDown {
  param([int]$Port, [string]$Entry, [string]$LogName, [int]$WaitMs = 5000)

  if (Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue) { return $false }

  $base = $LogName.Substring(0, $LogName.Length - 4)
  $argList = '"' + $Entry + '"'
  Start-Process -FilePath $NodeExe -ArgumentList $argList -WorkingDirectory $Proj -WindowStyle Hidden -RedirectStandardOutput (Join-Path $LogDir $LogName) -RedirectStandardError (Join-Path $LogDir ($base + '.err.log'))

  $deadline = (Get-Date).AddMilliseconds($WaitMs)
  while ((Get-Date) -lt $deadline) {
    Start-Sleep -Milliseconds 300
    if (Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue) { break }
  }
  return $true
}

# 数据统一放在包根目录的 data/ 下
$env:NEBULA_DATA_DIR = Join-Path $Proj 'data'

$apiEntry = Join-Path $Proj (Join-Path 'backend' (Join-Path 'server' 'main.mjs'))
$api = Start-IfDown -Port $ApiPort -Entry $apiEntry -LogName 'api.log'

$env:NEBULA_API_BASE = 'http://127.0.0.1:' + $ApiPort + '/api'
$env:WEB_PORT = "$WebPort"
$webEntry = Join-Path $Proj (Join-Path 'web' 'server.mjs')
$web = Start-IfDown -Port $WebPort -Entry $webEntry -LogName 'web.log'

if ($api -or $web) {
  "$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') api=$api web=$web" |
    Out-File -FilePath (Join-Path $LogDir 'launcher.log') -Append -Encoding utf8
}
`
write(path.join(OUT, 'scripts', 'start-hidden.ps1'), startHidden)

write(
  path.join(OUT, 'start.cmd'),
  `@echo off
chcp 65001 >nul
setlocal
cd /d "%~dp0"
set "API_PORT=5188"
set "WEB_PORT=5187"

echo.
echo ============================================================
echo    Nebula 工作台  -  启动（前后端分离）
echo ============================================================
echo.
echo [1/2] 启动后端 API 与前端静态站（后台）
powershell -NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File "%~dp0scripts\\start-hidden.ps1"
ping -n 4 127.0.0.1 >nul

echo [2/2] 检查
powershell -NoProfile -ExecutionPolicy Bypass -Command "foreach ($p in @(%API_PORT%, %WEB_PORT%)) { $c = Get-NetTCPConnection -LocalPort $p -State Listen -ErrorAction SilentlyContinue; if ($c) { Write-Host ('  [OK] 端口 ' + $p) } else { Write-Host ('  [X] 端口 ' + $p + ' 没起来，看 logs') } }"
echo.
echo   前端   http://127.0.0.1:%WEB_PORT%/
echo   后端   http://127.0.0.1:%API_PORT%/api/health
echo.
echo   首次启动的管理员账号见 data\\initial-admin.txt
echo.
start "" "http://127.0.0.1:%WEB_PORT%/"
pause
`,
)

write(
  path.join(OUT, 'stop.cmd'),
  `@echo off
chcp 65001 >nul

echo 停止 Nebula 工作台（前端 5187 / 后端 5188）
echo.
powershell -NoProfile -ExecutionPolicy Bypass -Command "foreach ($p in @(5187, 5188)) { $c = Get-NetTCPConnection -LocalPort $p -State Listen -ErrorAction SilentlyContinue; if ($c) { $c.OwningProcess | Select-Object -Unique | ForEach-Object { Stop-Process -Id $_ -Force -ErrorAction SilentlyContinue; Write-Host ('  已停止端口 ' + $p) } } else { Write-Host ('  端口 ' + $p + ' 本来就没在运行') } }"
echo.
pause
`,
)

write(
  path.join(OUT, 'restart.cmd'),
  `@echo off
chcp 65001 >nul
setlocal
cd /d "%~dp0"

echo 重启 Nebula 工作台
echo.
powershell -NoProfile -ExecutionPolicy Bypass -Command "foreach ($p in @(5187, 5188)) { $c = Get-NetTCPConnection -LocalPort $p -State Listen -ErrorAction SilentlyContinue; if ($c) { $c.OwningProcess | Select-Object -Unique | ForEach-Object { Stop-Process -Id $_ -Force -ErrorAction SilentlyContinue } } }"
ping -n 3 127.0.0.1 >nul
powershell -NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File "%~dp0scripts\\start-hidden.ps1"
ping -n 5 127.0.0.1 >nul
powershell -NoProfile -ExecutionPolicy Bypass -Command "foreach ($p in @(5187, 5188)) { $c = Get-NetTCPConnection -LocalPort $p -State Listen -ErrorAction SilentlyContinue; if ($c) { Write-Host ('  [OK] 端口 ' + $p) } else { Write-Host ('  [X] 端口 ' + $p + ' 没起来') } }"
echo.
start "" "http://127.0.0.1:5187/"
pause
`,
)

/* -------------------------------------------------------------- 文档 */

fs.copyFileSync(path.join(ROOT, 'README.md'), path.join(OUT, 'README.md'))
fs.copyFileSync(path.join(ROOT, 'DEPLOY.md'), path.join(OUT, 'DEPLOY.md'))

write(
  path.join(OUT, '快速开始.txt'),
  `Nebula 工作台 · AI 工单助理 —— 前后端分离交付包
====================================================

一、运行要求
  Node.js >= 22.5（后端用了内置的 node:sqlite）
  不需要 npm install，不需要联网：后端零外部依赖，前端是构建好的静态文件。

二、启动
  双击 start.cmd
    后端 API  → http://127.0.0.1:5188/api/health
    前端页面  → http://127.0.0.1:5187/
  首次启动会在 data\\initial-admin.txt 生成管理员账号，用它登录。

  停止：stop.cmd     重启：restart.cmd

三、目录结构
  backend\\server\\     后端 API（node server/main.mjs）
  backend\\workflow\\   检索 / 提示词 / 模型适配
  web\\dist\\           前端构建产物
  web\\server.mjs       前端静态服务（下发 /config.js 指向后端）
  data\\                运行数据（SQLite、AI 配置、首启密码）
  logs\\                运行日志

四、前后端分离说明
  前端和后端是两个独立进程、两个端口：
    · 前端只发静态文件，可以单独部署到 CDN / Nginx
    · 后端只发 JSON，不托管任何前端资源
    · 浏览器里的 API 地址由 web\\server.mjs 下发的 /config.js 提供
      改后端地址不用重新构建前端：改 NEBULA_API_BASE 重启即可

  跨源白名单由后端控制，默认只允许 http://127.0.0.1:5187。
  换端口 / 换域名时两边都要改：
    web\\server.mjs     NEBULA_API_BASE=http://<后端>:<端口>/api
    backend\\server      NEBULA_CORS_ORIGINS=http://<前端>:<端口>

五、接真实模型
  默认用离线的 sim 模型（确定性，便于演示与自检）。
  设置环境变量后自动走真实 OpenAI 兼容接口：
    OPENAI_BASE_URL=https://api.openai.com/v1
    OPENAI_API_KEY=sk-...

六、换知识库 / 调阈值
  backend\\workflow\\corpus.mjs   文档语料与检索
  backend\\workflow\\prompts.mjs  提示词版本
  NEBULA_AUTO_CONFIDENCE=0.6     自动答复阈值
  NEBULA_HUMAN_BASELINE_MIN=8    人工基线（算节省人时）

详细说明见 README.md 与 DEPLOY.md。
`,
)

/* -------------------------------------------------------------- 汇总 */

function countFiles(dir) {
  let n = 0
  let bytes = 0
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      const sub = countFiles(full)
      n += sub.n
      bytes += sub.bytes
    } else {
      n += 1
      bytes += fs.statSync(full).size
    }
  }
  return { n, bytes }
}

const stats = countFiles(OUT)
log(`\n[package] 输出目录: ${OUT}`)
log(`[package] 文件数: ${stats.n} · 体积: ${(stats.bytes / 1024).toFixed(0)} KB`)

if (process.argv.includes('--zip')) {
  const { execFileSync } = await import('node:child_process')
  const zipPath = path.join(ROOT, 'out', `${NAME}.zip`)
  fs.rmSync(zipPath, { force: true })
  execFileSync('powershell.exe', [
    '-NoProfile',
    '-Command',
    `Compress-Archive -Path '${OUT}' -DestinationPath '${zipPath}' -Force`,
  ])
  log(`[package] 已打 zip: ${zipPath} (${(fs.statSync(zipPath).size / 1024).toFixed(0)} KB)`)
} else {
  log('[package] 加 --zip 可直接生成压缩包')
}
