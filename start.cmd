@echo off
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

echo [1/2] 启动前后端两个进程（后台隐藏）
powershell -NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File "%~dp0scripts\start-hidden.ps1"
ping -n 4 127.0.0.1 >nul

echo [2/2] 检查
powershell -NoProfile -ExecutionPolicy Bypass -Command "foreach ($p in @(%API_PORT%, %WEB_PORT%)) { $c = Get-NetTCPConnection -LocalPort $p -State Listen -ErrorAction SilentlyContinue; if ($c) { Write-Host ('  [OK] 端口 ' + $p) } else { Write-Host ('  [X] 端口 ' + $p + ' 没起来，看 logs\') } }"

echo.
echo ------------------------------------------------------------
echo   前端（打开这个）  http://127.0.0.1:%WEB_PORT%/
echo   后端 API          http://127.0.0.1:%API_PORT%/api/health
echo.
echo   管理员账号：data\initial-admin.txt
echo   调试用前台启动：start-backend.cmd / start-web.cmd
echo ------------------------------------------------------------
echo.

start "" "http://127.0.0.1:%WEB_PORT%/"
if not defined NEBULA_NO_PAUSE pause
