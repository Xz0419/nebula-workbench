# 部署指南

本文说明 Nebula 工作台的本地运行、前后端分离部署和基础运维。完整功能与环境变量说明见 [README.md](README.md)。

## 运行模式

Nebula 由三个部分组成：

1. `src/`：Vite + React 前端。
2. `server/main.mjs`：Node.js API 和 SQLite 数据访问。
3. `web/server.mjs`：生产环境前端静态文件服务。

推荐模式是前端静态站和后端 API 分开运行：

| 服务 | 默认地址 |
| --- | --- |
| 前端 | `http://127.0.0.1:5187/` |
| 后端 | `http://127.0.0.1:5188/api/` |

## 本机 Windows 部署

环境要求：Node.js 22.5+、pnpm 11。

```powershell
pnpm install --frozen-lockfile
pnpm typecheck
pnpm test
pnpm test:integration
pnpm build
.\start.cmd
```

常用脚本：

| 操作 | 命令 |
| --- | --- |
| 启动前后端 | `start.cmd` |
| 重启 | `restart.cmd` |
| 停止 | `stop.cmd` |
| 开发前端 | `pnpm dev` |
| 启动 API | `pnpm start` |
| 启动生产前端 | `pnpm start:web` |

## 前后端分离部署

### 1. 启动后端

```powershell
$env:NEBULA_HOST="0.0.0.0"
$env:NEBULA_PORT="5188"
$env:NEBULA_DATA_DIR="/srv/nebula/data"
$env:NEBULA_CORS_ORIGINS="https://support.example.com"
$env:NEBULA_AUTH_REQUIRED="1"
$env:NEBULA_ADMIN_EMAIL="admin@example.com"
$env:NEBULA_ADMIN_PASSWORD="replace-with-a-strong-password"
pnpm start
```

后端需要可写的 `NEBULA_DATA_DIR`，其中会保存 SQLite 数据库、AI 配置和 webhook 令牌。

### 2. 构建前端

```powershell
$env:VITE_API_BASE_URL="https://api.example.com/api"
pnpm build
pnpm start:web
```

生产静态服务也可以通过环境变量配置：

| 变量 | 默认值 | 说明 |
| --- | --- | --- |
| `WEB_HOST` | `127.0.0.1` | 静态站监听地址 |
| `WEB_PORT` | `5187` | 静态站端口 |
| `WEB_ROOT` | 自动检测 | `dist` 目录 |
| `NEBULA_API_BASE` | `http://127.0.0.1:5188/api` | 浏览器访问的 API 地址 |

若使用 Nginx、Caddy 或其他反向代理，应让同一个公开域名代理前端和 `/api`，并配置 HTTPS。

## 单进程模式

构建前端后，可以让 API 服务同时托管静态文件：

```powershell
$env:NEBULA_SERVE_STATIC="1"
pnpm start
```

该模式减少一个进程，但前后端不能独立扩缩容。

## AI 配置

进入 **系统设置 → AI 服务配置** 可以选择本地模拟、DeepSeek 或 OpenAI 兼容接口。

DeepSeek 示例：

- 接口地址：`https://api.deepseek.com`
- 通用模型：`deepseek-chat`
- 推理模型：`deepseek-reasoner`

建议先在界面中执行“测试连接”，确认成功后再保存。运行时配置保存在 `data/ai-config.json`，该文件可能包含 API Key，必须限制文件权限并且不得提交到版本库。

## 数据备份

SQLite 使用 WAL 模式。在线备份示例：

```powershell
node -e "const { DatabaseSync } = require('node:sqlite'); const db = new DatabaseSync('data/nebula.db'); db.exec(\"VACUUM INTO 'data/nebula-backup.db'\")"
```

恢复步骤：

1. 停止前端和后端进程。
2. 备份现有数据库文件。
3. 用恢复文件替换 `nebula.db`。
4. 删除残留的 `nebula.db-wal` 和 `nebula.db-shm`。
5. 重新启动服务并检查 `/api/health`。

## 安全清单

- 公网部署时使用 HTTPS。
- 启用 `NEBULA_AUTH_REQUIRED=1`。
- 使用强管理员密码，并在首次登录后妥善保管。
- 限制 `NEBULA_CORS_ORIGINS`，不要配置为任意来源。
- 不提交 `data/`、日志、`.env` 或 AI 配置文件。
- 在生产环境前配置日志轮转、进程守护和数据库备份。
- 当前版本未提供完整多租户隔离，不建议直接作为多组织 SaaS 使用。

## GitHub Pages

GitHub Pages 只能托管构建后的静态前端，无法运行本项目依赖 `node:sqlite` 的 API。因此仓库没有配置自动 Pages 部署。若仅用于界面预览，需要单独部署 API，并在构建前设置可访问的 `VITE_API_BASE_URL`。

## 故障排查

| 现象 | 检查项 |
| --- | --- |
| 页面可打开但数据为空 | `/config.js` 中的 API 地址是否正确 |
| 浏览器出现 CORS 错误 | 后端 `NEBULA_CORS_ORIGINS` 是否包含前端源 |
| API 启动失败 | Node.js 是否达到 22.5，数据目录是否可写 |
| 登录被拒绝 | 是否启用认证，管理员账号是否已初始化 |
| AI 请求超时 | 接口地址、API Key、网络和模型名称是否正确 |
| 自动处理始终不触发 | 是否设置 `NEBULA_AUTO_RESOLVE=1`，评分是否达到阈值 |
