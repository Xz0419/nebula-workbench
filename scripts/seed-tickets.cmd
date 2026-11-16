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

"%NODE_EXE%" "scripts\seed-tickets.mjs" %*
if not defined NEBULA_NO_PAUSE pause
