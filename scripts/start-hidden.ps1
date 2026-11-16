# Nebula 工作台 —— 隐藏窗口启动器（开机自启用）
#
# 前后端分离：启动两个独立进程
#   5188  server/main.mjs   后端 API（不托管前端）
#   5187  web/server.mjs    前端静态站（下发 /config.js 指向后端）
#
# 由 HKCU\Software\Microsoft\Windows\CurrentVersion\Run 调用：
#   powershell.exe -NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File "...\scripts\start-hidden.ps1"

$ErrorActionPreference = 'Stop'

$ApiPort = 5188
$WebPort = 5187
$Proj = Split-Path -Parent $PSScriptRoot
$LogDir = Join-Path $Proj 'logs'
if (-not (Test-Path $LogDir)) { New-Item -ItemType Directory -Path $LogDir -Force | Out-Null }

# --- 找 node：先 PATH，再随应用附带的运行时 ---
$NodeExe = $null
$cmd = Get-Command node -ErrorAction SilentlyContinue
if ($cmd) { $NodeExe = $cmd.Source }
if (-not $NodeExe) {
  $bundled = Join-Path $env:USERPROFILE '.dsh\dsh-runtimes\dsh-primary-runtime\dependencies\node\bin\node.exe'
  if (Test-Path $bundled) { $NodeExe = $bundled }
}
if (-not $NodeExe) { exit 1 }

function Start-IfDown {
  param(
    [int]$Port,
    [string]$Entry,
    [string]$LogName,
    [int]$WaitMs = 5000
  )

  $busy = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
  if ($busy) { return $false }

  Start-Process -FilePath $NodeExe `
    -ArgumentList @("`"$Entry`"") `
    -WorkingDirectory $Proj `
    -WindowStyle Hidden `
    -RedirectStandardOutput (Join-Path $LogDir $LogName) `
    -RedirectStandardError (Join-Path $LogDir ($LogName -replace '\.log$', '.err.log'))

  $deadline = (Get-Date).AddMilliseconds($WaitMs)
  while ((Get-Date) -lt $deadline) {
    Start-Sleep -Milliseconds 300
    if (Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue) { break }
  }
  return $true
}

$apiStarted = Start-IfDown -Port $ApiPort -Entry (Join-Path $Proj 'server\main.mjs') -LogName 'api.log'

# 前端要指向后端：通过环境变量传给 web 进程
$env:NEBULA_API_BASE = "http://127.0.0.1:$ApiPort/api"
$env:WEB_PORT = "$WebPort"
$webStarted = Start-IfDown -Port $WebPort -Entry (Join-Path $Proj 'web\server.mjs') -LogName 'web.log'

if ($apiStarted -or $webStarted) {
  "$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') api=$apiStarted web=$webStarted" |
    Out-File -FilePath (Join-Path $LogDir 'launcher.log') -Append -Encoding utf8
}
