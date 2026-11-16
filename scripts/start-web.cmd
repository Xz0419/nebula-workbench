@echo off
chcp 65001 >nul
setlocal
cd /d "%~dp0.."

set "NODE_EXE=node"
where node >nul 2>nul
if errorlevel 1 set "NODE_EXE=%USERPROFILE%\.dsh\dsh-runtimes\dsh-primary-runtime\dependencies\node\bin\node.exe"
if not exist "%NODE_EXE%" if "%NODE_EXE%"=="node" set "NODE_EXE="
if not defined NODE_EXE (
  echo [X] 没找到 node.exe
  if not defined NEBULA_NO_PAUSE pause
  exit /b 1
)

if not defined WEB_PORT set "WEB_PORT=5187"
if not defined NEBULA_API_BASE set "NEBULA_API_BASE=http://127.0.0.1:5188/api"

echo 前端静态站（前台，Ctrl+C 停止）→ http://127.0.0.1:%WEB_PORT%/
echo 后端 API: %NEBULA_API_BASE%
echo.
"%NODE_EXE%" "web\server.mjs"
if not defined NEBULA_NO_PAUSE pause
