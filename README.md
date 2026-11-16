<p align="center">
  <img src="public/nebula-logo.svg" width="72" height="72" alt="Nebula 工作台 Logo" />
</p>

<h1 align="center">Nebula 工作台</h1>

<p align="center">
  AI 先处理工单，人工专注确认与例外。
</p>

<p align="center">
  <a href="https://github.com/Xz0419/nebula-workbench/actions/workflows/ci.yml">
    <img src="https://github.com/Xz0419/nebula-workbench/actions/workflows/ci.yml/badge.svg" alt="CI" />
  </a>
  <img src="https://img.shields.io/badge/Node.js-%E2%89%A522.5-339933" alt="Node.js 22.5+" />
  <img src="https://img.shields.io/badge/React-18-61DAFB" alt="React 18" />
  <img src="https://img.shields.io/badge/TypeScript-5-3178C6" alt="TypeScript 5" />
  <img src="https://img.shields.io/badge/SQLite-local--first-003B57" alt="SQLite" />
</p>

## 项目简介

Nebula 工作台是一个面向客服和内部支持团队的 AI 工单演示系统。新工单进入后，系统会检索知识库、生成带引用的 AI 草稿，并根据检索质量、输出合法性和引用充分度计算规则评分。

默认模式不会自动对外发送消息：AI 生成的结果先交给人工确认，人工可以采纳草稿、修改后保存答复、添加内部备注，或将已处理工单转回人工队列。工单、知识资料、会话和处理记录均保存在本机 SQLite 数据库中。

> 本项目是单机、本地优先的实现，适合学习、原型验证和内网演示。默认配置缺少公网级多租户、任务队列、外部消息投递和完整运维能力，请勿直接暴露到公网生产环境。

## 功能特性

- **AI 工单处理**：知识检索、模型调用、JSON 校验、引用校验、规则评分和处理阶段记录。
- **人工协同**：待人工队列、AI 草稿、人工答复、内部备注、转回人工和历史记录。
- **工单检索**：按分类、优先级、状态和创建时间筛选，支持排序和全文关键字搜索。
- **知识库管理**：新建、编辑、启用或停用知识资料，支持导入 UTF-8 文本/Markdown 并测试检索结果。
- **AI 评估台**：运行内置或自定义案例，记录人工评价并比较不同模型、提示词版本的表现。评估数据仅保存在当前浏览器。
- **运行指标**：自动化处理率、待人工积压、AI 平均耗时、估算节省人时和 14 天处理吞吐。
- **模型接入**：支持本地模拟、DeepSeek 和任意 OpenAI 兼容接口，并提供连接测试。
- **审计与安全**：可选账号登录、scrypt 口令散列、登录限流、CORS 白名单、CSP 和写操作审计。

## 技术栈

| 层级 | 技术 |
| --- | --- |
| 前端 | React 18、TypeScript、Vite |
| 样式 | 原生 CSS、响应式布局、浅色/深色主题 |
| 后端 | Node.js 原生 HTTP 服务 |
| 数据库 | Node.js 内置 `node:sqlite` |
| 测试 | Vitest、Node.js Test Runner |
| 部署 | 前后端分离，或由后端单进程托管静态文件 |

后端未使用 Web 框架，运行时不依赖外部 npm 包。Node.js 版本必须不低于 **22.5**。

## 界面模块

- **工作台**：处理指标、吞吐趋势、当前队列和最近工单。
- **工单中心**：筛选与搜索、AI 草稿、引用、规则评分、人工答复和内部备注。
- **知识库**：资料维护、启停、文本导入和检索测试。
- **AI 评估台**：批量示例、自定义案例、处理步骤和人工评价。
- **系统设置**：数据概览、界面偏好、处理参数和 AI 服务配置。

## 快速开始

### 环境要求

- Node.js **22.5+**
- pnpm **11**，或使用 npm 安装依赖

### Windows 一键启动

```powershell
pnpm install --frozen-lockfile
pnpm build
.\start.cmd
```

启动后可访问：

- 控制台：<http://127.0.0.1:5187/>
- API 健康检查：<http://127.0.0.1:5188/api/health>

停止服务：

```powershell
.\stop.cmd
```

需要重启时运行 `restart.cmd`。脚本会启动一个前端静态服务和一个后端 API 进程。

### 源码开发

安装依赖并启动后端：

```powershell
pnpm install
pnpm start
```

另开一个终端，配置前端 API 地址后启动 Vite：

```powershell
$env:VITE_API_BASE_URL="http://127.0.0.1:5188/api"
$env:NEBULA_CORS_ORIGINS="http://127.0.0.1:5173"
pnpm dev
```

开发页面地址为 <http://127.0.0.1:5173/>。如果使用其他端口，请同时修改 `VITE_API_BASE_URL` 的 CORS 白名单。

### 构建与生产运行

```powershell
pnpm build
pnpm start
pnpm start:web
```

`pnpm start` 只提供 API，`pnpm start:web` 提供构建后的前端静态文件。也可以通过以下环境变量让后端在单进程中同时提供前端和 API：

```powershell
$env:NEBULA_SERVE_STATIC="1"
pnpm start
```

前端运行时 API 地址由静态服务下发的 `/config.js` 注入，不需要修改源码后重新构建。

## AI 服务配置

默认配置使用离线模拟模型 `sim-v1`，不调用外部服务，也不需要 API Key。

打开 **系统设置 → AI 服务配置** 可以切换为：

| 服务商 | 默认模型 | 默认接口 |
| --- | --- | --- |
| 本地模拟 | `sim-v1` | 无 |
| DeepSeek | `deepseek-chat` | `https://api.deepseek.com` |
| OpenAI 兼容 | `gpt-4o-mini` | `https://api.openai.com/v1` |

DeepSeek 常用模型：

- `deepseek-chat`：通用对话和工单答复。
- `deepseek-reasoner`：需要更强推理能力的复杂案例。

保存配置前建议先执行“测试连接”。保存后会立即用于新工单和 AI 重跑。运行配置保存在 `data/ai-config.json`；配置查询接口只返回密钥是否已配置，不返回密钥明文。该文件属于本地运行数据，不应提交到 Git。

## 环境变量

| 变量 | 默认值 | 说明 |
| --- | --- | --- |
| `NEBULA_HOST` | `127.0.0.1` | 后端监听地址 |
| `NEBULA_PORT` | `5188` | 后端端口 |
| `NEBULA_DATA_DIR` | `./data` | 数据、AI 配置和令牌目录 |
| `NEBULA_DB_PATH` | `data/nebula.db` | SQLite 数据库路径 |
| `NEBULA_CORS_ORIGINS` | 本机 5187 前端 | 允许访问 API 的前端源，逗号分隔 |
| `NEBULA_SERVE_STATIC` | `0` | 设为 `1` 时由后端托管 `dist` |
| `NEBULA_AUTH_REQUIRED` | `0` | 设为 `1` 时启用登录校验 |
| `NEBULA_ADMIN_EMAIL` | `admin@nebula.local` | 首次启动时创建的管理员邮箱 |
| `NEBULA_ADMIN_PASSWORD` | 自动生成 | 首次启动时创建的管理员密码 |
| `NEBULA_AUTO_RESOLVE` | `0` | 设为 `1` 时允许按阈值自动处理 |
| `NEBULA_AUTO_CONFIDENCE` | `0.6` | 自动处理阈值 |
| `NEBULA_HUMAN_BASELINE_MIN` | `8` | 人工处理基线，单位分钟/单 |
| `NEBULA_AI_VERSION` | `v1` | 默认提示词版本 |
| `NEBULA_AI_MODEL` | `sim-v1` | 默认模型 |
| `NEBULA_AI_PROVIDER` | 自动推断 | `sim`、`deepseek` 或 `compatible` |
| `OPENAI_BASE_URL` | 空 | OpenAI 兼容接口地址 |
| `OPENAI_API_KEY` | 空 | 接口密钥 |
| `DEEPSEEK_API_KEY` | 空 | DeepSeek 密钥 |
| `NEBULA_WEBHOOK_TOKEN` | 自动生成 | 部署 webhook 令牌 |

免登录模式只适合本机回环访问。需要局域网或公网访问时，应启用 `NEBULA_AUTH_REQUIRED=1`，配置 HTTPS 反向代理，并显式设置 CORS 白名单。

## 处理流程

```text
新建工单
   │
   ├─ 检索启用的知识资料
   ├─ 构建提示词并调用模型
   ├─ 校验 JSON、引用和检索结果
   ├─ 计算可解释的规则评分
   │
   ├─ 达到条件且开启自动处理 → auto_resolved
   └─ 检索不足、校验失败或人工模式 → needs_human
                                      │
                                      ├─ 采纳 AI 草稿
                                      ├─ 修改后保存人工答复
                                      └─ 添加内部备注 / 重新运行 AI
```

规则评分不是回答正确率。知识库当前使用字符 bigram 检索，结果质量取决于资料完整度和问题描述。

## 数据与安全

- `data/nebula.db`、WAL 文件、日志、AI 配置和 webhook 令牌均被 `.gitignore` 排除。
- 首次启动会导入虚构示例知识库；正式使用前应替换或停用。
- AI 配置保存在本机文件中，保存接口不会反查或返回 API Key 明文。
- 所有写操作会写入审计日志，但本机免登录模式不能替代身份认证。
- 当前答复只保存在系统内，不会自动发送到邮件、企业微信或其他渠道。

备份 SQLite 时应使用数据库在线备份或 `VACUUM INTO`，不要只复制正在写入的主数据库文件。

## API 概览

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| `GET` | `/api/health` | 健康检查、版本和数据库状态 |
| `GET` | `/api/tickets` | 工单列表 |
| `POST` | `/api/tickets` | 创建工单并运行 AI |
| `GET` | `/api/tickets/:id` | 工单详情、会话和 AI 运行记录 |
| `POST` | `/api/tickets/:id/process` | 重新运行 AI |
| `POST` | `/api/tickets/:id/approve` | 采纳 AI 草稿 |
| `POST` | `/api/tickets/:id/reply` | 保存人工答复 |
| `POST` | `/api/tickets/:id/notes` | 添加内部备注 |
| `POST` | `/api/tickets/:id/escalate` | 转回人工处理 |
| `GET` | `/api/knowledge` | 知识资料列表 |
| `POST` | `/api/knowledge` | 新增或修改知识资料 |
| `POST` | `/api/knowledge/search` | 测试知识检索 |
| `POST` | `/api/evaluate` | 运行不带工单副作用的 AI 评估 |
| `GET` | `/api/metrics` | 效率指标和时间序列 |
| `GET` | `/api/ai/config` | 获取脱敏后的 AI 配置 |
| `POST` | `/api/ai/config` | 保存 AI 配置 |
| `POST` | `/api/ai/config/test` | 测试模型连接 |
| `GET` | `/api/audit` | 审计日志 |
| `GET` | `/api/deploys` | 部署记录 |
| `POST` | `/api/webhooks/deploy` | 接收部署事件，需要令牌 |

启用认证后，除健康检查、登录和 webhook 外的 API 需要 Bearer Token。

## 项目结构

```text
.
├─ src/
│  ├─ components/console/     # 工作台页面与业务组件
│  ├─ lib/                    # API、格式化和图表工具
│  ├─ styles/                 # 全局样式与控制台样式
│  └─ types.ts                # 前端共享类型
├─ server/
│  ├─ main.mjs                # HTTP 服务、路由和鉴权
│  ├─ ai.mjs                  # AI 处理链路
│  ├─ db.mjs                  # SQLite 数据访问
│  └─ config.mjs              # 运行时配置
├─ workflow/
│  ├─ corpus.mjs              # 知识检索
│  ├─ llm.mjs                 # 模型适配器
│  └─ prompts.mjs             # 提示词版本
├─ web/server.mjs             # 前端静态服务
├─ scripts/                   # 测试、自检、种子和打包脚本
├─ public/                    # Logo 和 favicon
└─ data/                      # 本地运行数据，不提交到 Git
```

## 测试

```powershell
pnpm typecheck
pnpm test
pnpm test:integration
pnpm build
```

可选自检需要正在运行的后端和管理员凭据：

```powershell
pnpm smoke http://127.0.0.1:5188 <email> <password>
```

集成测试使用临时数据库，不会修改项目的 `data/` 目录。

## 部署说明

推荐将前端静态文件和 API 分开部署：

1. 在前端构建环境中设置 `VITE_API_BASE_URL`，或在静态服务下发的 `/config.js` 中设置 `window.__NEBULA_API__`。
2. 将 `NEBULA_CORS_ORIGINS` 设置为实际前端域名。
3. 对外部署时启用认证，并在反向代理层配置 HTTPS、访问日志和请求限制。
4. 使用持久化卷保存 `data/`，不要将数据库放进无状态容器镜像。

GitHub Pages 只能托管静态前端，无法运行本项目依赖 SQLite 的 API，因此不能作为完整可用的部署方案。

## 已知边界

- 默认没有完整的多租户和 RBAC。
- 没有外部消息投递或后台任务队列。
- 自动处理状态不等于答复已经对外发送。
- 模拟模型只用于离线演示，不代表真实模型质量。
- 当前没有声明开源许可证；在获得仓库所有者许可前，不应默认用于再分发或商业项目。

## 贡献

提交改动前请至少运行类型检查、测试和构建。涉及数据库结构、AI 配置或权限边界时，请在 Pull Request 中说明迁移方式、回滚方式和安全影响。
