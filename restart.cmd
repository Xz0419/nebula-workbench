@echo off
chcp 65001 >nul
setlocal
cd /d "%~dp0"
set "API_PORT=5188"
set "WEB_PORT=5187"

echo.
echo ============================================================
echo    Nebula 工作台  -  重启（前端 :%WEB_PORT% / 后端 :%API_PORT%）
echo ============================================================
echo.

echo [1/3] 停止正在运行的实例
powershell -NoProfile -ExecutionPolicy Bypass -Command "foreach ($p in @(%API_PORT%, %WEB_PORT%)) { $c = Get-NetTCPConnection -LocalPort $p -State Listen -ErrorAction SilentlyContinue; if ($c) { $c.OwningProcess | Select-Object -Unique | ForEach-Object { Stop-Process -Id $_ -Force -ErrorAction SilentlyContinue; Write-Host ('  已停止端口 ' + $p) } } else { Write-Host ('  端口 ' + $p + ' 没有实例') } }"
ping -n 3 127.0.0.1 >nul

echo [2/3] 在后台重新启动两个进程
powershell -NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File "%~dp0scripts\start-hidden.ps1"
ping -n 5 127.0.0.1 >nul

echo [3/3] 检查
powershell -NoProfile -ExecutionPolicy Bypass -Command "foreach ($p in @(%API_PORT%, %WEB_PORT%)) { $c = Get-NetTCPConnection -LocalPort $p -State Listen -ErrorAction SilentlyContinue; if ($c) { Write-Host ('  [OK] 端口 ' + $p) } else { Write-Host ('  [X] 端口 ' + $p + ' 没起来，看 logs\') } }"

echo.
echo   前端   http://127.0.0.1:%WEB_PORT%/
echo   后端   http://127.0.0.1:%API_PORT%/api/health
echo.
start "" "http://127.0.0.1:%WEB_PORT%/"
if not defined NEBULA_NO_PAUSE pause
