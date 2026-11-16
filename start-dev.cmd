@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion
cd /d "%~dp0"

echo.
echo ============================================================
echo    Nebula Console  ·  开发服务器启动器
echo ============================================================
echo.

where node >nul 2>nul
if errorlevel 1 goto NO_NODE
where npm  >nul 2>nul
if errorlevel 1 goto NO_NPM

for /f "delims=" %%v in ('node -v') do set "NODE_VER=%%v"
echo [OK] 检测到 Node !NODE_VER!
echo.

if not exist "node_modules" (
  echo [1/2] 首次运行，安装依赖（1~3 分钟，不要关窗口）
  echo.
  call npm install
  if errorlevel 1 goto INSTALL_FAIL
  echo.
  echo [OK] 依赖安装完成
  echo.
) else (
  echo [1/2] 依赖已存在，跳过安装
  echo.
)

echo [2/2] 启动 Vite
echo.
echo ------------------------------------------------------------
echo   浏览器打开这个地址（不是 localhost）：
echo.
echo       http://127.0.0.1:5173/
echo.
echo   这个窗口不要关，关掉服务就停了。
echo   演示账号：demo@nebula.app  /  nebula2025
echo ------------------------------------------------------------
echo.

call npm run dev

echo.
echo [i] Vite 已退出。上面最后 10 行就是原因，整段复制给我。
echo.
pause
exit /b 0

:NO_NODE
echo [X] 没找到 node.exe
echo.
echo     原因：这台机器没装 Node.js，或者装了但没进 PATH。
echo     解决：装 Node.js 20 LTS  https://nodejs.org/
echo           装完关掉所有 cmd 窗口重开，再双击本文件。
echo.
pause
exit /b 1

:NO_NPM
echo [X] 检测到 node 但没有 npm，说明 Node 安装不完整。
echo     建议卸载后重新安装 Node.js 20 LTS。
echo.
pause
exit /b 1

:INSTALL_FAIL
echo.
echo [X] npm install 失败。常见原因：
echo     1) 网络或代理拉不到包
echo        换镜像:  npm config set registry https://registry.npmmirror.com
echo     2) Node 版本过低（npm 需要 Node 18 以上）
echo.
echo     把上面滚动的报错整段复制给我。
echo.
pause
exit /b 1
