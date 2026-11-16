@echo off
chcp 65001 >nul
setlocal

echo.
echo 停止 Nebula 工作台（前端 5187 / 后端 5188）
echo.

powershell -NoProfile -ExecutionPolicy Bypass -Command "foreach ($p in @(5187, 5188)) { $c = Get-NetTCPConnection -LocalPort $p -State Listen -ErrorAction SilentlyContinue; if ($c) { $c.OwningProcess | Select-Object -Unique | ForEach-Object { Stop-Process -Id $_ -Force -ErrorAction SilentlyContinue; Write-Host ('  已停止端口 ' + $p) } } else { Write-Host ('  端口 ' + $p + ' 本来就没在运行') } }"

echo.
echo 提示：开机自启项还在，下次登录仍会启动。
echo       想彻底关掉自启，见 DEPLOY.md 的「取消开机自启」。
echo.
if not defined NEBULA_NO_PAUSE pause
