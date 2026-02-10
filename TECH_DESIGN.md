# 海龟汤应用技术设计

本文从整体架构、核心模块、技术选型与关键非功能需求几个维度，描述海龟汤应用的技术方案，支撑 PRD 中的玩法、持久化、AI 主持人与性能要求。

---

## 1. 整体架构概览

- **前端 Web 应用**
  - 技术栈：React / Next.js + Tailwind CSS
  - 职责：
    - 提供「选汤类型」「游戏主界面」「历史会话列表」等界面与交互。
    - 通过 HTTP / SSE 与后端交互，展示多轮问答和流式 AI 回复。
    - 管理本地轻量状态（当前会话 ID、用户匿名 ID 等）。

- **后端服务**
  - 技术栈：Node.js + Fastify / Nest.js
  - 职责：
    - 暴露 REST API 与 SSE 流式接口，处理新建会话、发送问题、拉取历史等操作。
    - 管理会话（sessions）、消息（messages）、题库（puzzles）和配图（session_images）的持久化。
    - 封装 AI 主持人调用逻辑（Prompt 管理、流式输出、重试与模型切换）。
    - 统一日志、异常与监控。

- **数据库**
  - MySQL，表结构参考 `DATABASE.md`：
    - `users`、`puzzles`、`sessions`、`messages`、`session_images`。

- **外部服务**
  - LLM / 图片生成 API（OpenAI 兼容或其他厂商）。
  - 日志与错误追踪服务（如 Sentry）。

---

## 2. 核心模块设计

### 2.1 AI 主持人模块

**职责**：

- 负责一局游戏中的：
  - 出题：根据 `puzzles` 表中选定的题目，向用户展示汤面（surface）。
  - 裁判：根据用户封闭式提问与汤底（bottom），仅以「是 / 不是 / 不重要 / 是也不是」进行回答。
  - 节奏控制：在用户表达「退出」「不玩了」「结束」等意图时，结束本局；在用户请求时揭晓汤底。

**实现要点**：

- **Prompt 管理**：
  - 固定规则部分：游戏说明、允许的回答形式、禁止直接暴露汤底。
  - 题目上下文：`surface` + `bottom`（仅作为 AI 内部参考，不直接返回）。
  - 对话上下文：当前会话的历史消息列表（剪裁到模型上下文限制内）。

- **结束意图识别**：
  - 规则 + 语义结合：
    - 关键词匹配（退出、不想玩了、结束等）。
    - 模型辅助判断：提示模型识别「想结束本局」的语义，并返回结构化标记。
  - 一旦识别到结束意图：
    - 更新 `sessions.status = 'QUIT'` 或 `REVEALED`（若已揭晓）。
    - 返回友好的结束话术，并引导用户选择「再来一局」或「返回大厅」。

- **调用流程（示意）**：
  1. 前端发送新问题 `POST /api/sessions/:id/messages`。
  2. 后端查 `session` 与 `puzzle`，拼装 Prompt 和历史对话。
  3. 调用 AI SDK（流式），在后端解析 token，提取最终回答及 answer_type。
  4. 将 AI 消息落库至 `messages` 表，并通过 SSE 推给前端。

---

### 2.2 持久化与会话管理

对照 `DATABASE.md`：

- **会话（sessions）**
  - 用于支持：
    - 历史会话列表（按 `user_id + created_at` 降序）。
    - 恢复历史对话（按 `session_id` 查消息）。
    - 统计类信息（提问次数、是否揭晓、用时）。

- **消息（messages）**
  - 每条记录一个发言：
    - `role = USER/ASSISTANT`
    - `content`：文本内容
    - `answer_type`：对 AI 消息标记为 YES/NO/IRRELEVANT/BOTH，便于前端高亮与统计。

- **题库（puzzles）**
  - 预置题目，包含：
    - `soup_type`：CLEAR / RED / BLACK（清汤 / 红汤 / 黑汤）
    - `surface` / `bottom` / `difficulty` / `tags` 等。

**持久化流程示例**：

- **新开一局**：
  1. 前端提交 `soup_type`（清汤 / 红汤·黑汤）。
  2. 后端按 `puzzles` 表中 `status = ACTIVE` 且 `soup_type` 匹配随机选一条题目。
  3. 插入 `sessions`，写入 `user_id`、`puzzle_id`、`soup_type` 等。
  4. 返回 `session_id` 与 `surface` 给前端展示。

- **发送问题 / 接收回答**：
  1. 插入用户消息到 `messages`。
  2. 调用 AI，落库 AI 消息。
  3. 若识别到结束或揭晓，更新 `sessions.status`、`ended_at` 等字段。

---

### 2.3 工具与基础设施模块

对应原文的「工具类」+ PRD 非功能需求：

- **日志（Logging）**
  - 使用 `pino` 或 `winston` 做结构化日志，记录：
    - 关键业务操作（新开一局、提问、揭晓、退出）。
    - AI 请求与响应摘要（脱敏后）。
    - 异常堆栈信息。

- **异常捕获**
  - 全局错误处理中间件：
    - 捕获同步/异步错误，返回统一格式的错误响应。
    - 日志中记录 `request_id`、用户标识、接口路径与栈信息。
  - 前端配合：
    - 将错误转化为友好的提示语，而不是裸露 500 错误。

- **性能优化**
  - **SSE 实时推送**：
    - 后端暴露 `/api/sessions/:id/stream` 或类似接口，将 AI 的流式回复通过 SSE 推送给前端。
    - 减少前端轮询压力，提升交互体验。
  - **连接池 + 异步 IO**：
    - MySQL 使用连接池（如 `mysql2` / Prisma 内置连接池）。
    - Node.js 侧采用非阻塞 IO，避免长连接/流式阻塞主事件循环。

---

## 3. 技术栈选型

### 3.1 前端

- **框架**
  - React / Next.js
  - 原因：生态成熟、SSR/SSG 支持良好，方便后续 SEO 与路由组织。

- **UI 与样式**
  - Tailwind CSS
  - 理由：便于快速实现清汤 vs 红汤/黑汤 两种氛围主题，支持响应式布局。

- **数据请求**
  - Axios（或 Fetch 封装）
  - 用于调用 REST API 与处理错误统一封装。

- **本地存储**
  - LocalStorage
  - 用途：匿名 `external_id`、上一次使用的汤类型、轻量偏好配置等。

---

### 3.2 后端

- **运行时与框架**
  - Node.js 18+ / 20+ LTS
  - Fastify：高性能、插件生态好，适合轻量服务。

- **HTTP + 流式**
  - 常规接口：RESTful（如 `/api/sessions`、`/api/sessions/:id/messages`）。
  - 流式接口：SSE（Server-Sent Events），输出 AI 回复 token 流。

- **数据库访问**
  - MySQL + `mysql2`。
  - 使用连接池与索引优化（参考 `DATABASE.md` 中索引建议）。

- **AI 调用**
  - OpenAI 兼容 SDK 或厂商 SDK：
    - 封装统一 AI Client：负责超时、重试、模型切换。
    - 支持流式响应，将 token 流转发给前端 SSE 通道。

- **可观测性**
  - 日志：pino。
  - 错误追踪：Sentry（Node SDK）。

- **安全相关**
  - JWT / Passport.js（如后续接入账号体系）。
  - 入参校验：zod / joi，对用户输入长度、格式、敏感字符进行校验。
  - 限流：rate-limit 插件，防止接口被恶意刷爆。

- **部署**
  - Docker 镜像构建与部署。
  - 后续可扩展到 K8s / 容器编排，配合负载均衡与健康检查。

---

## 4. 关键非功能设计（技术视角）

- **性能**
  - 首 token 延迟控制：AI 调用设置合理超时与流式返回。
  - 数据库：
    - 为 `sessions`、`messages`、`puzzles` 关键查询添加索引。
    - 使用只读副本或缓存（如 Redis）缓解热点读压力（进阶阶段）。

- **安全**
  - 全链路 HTTPS。
  - 对敏感字段（如用户标识）做必要的加密/脱敏存储。
  - 输入校验与输出编码，防止注入和 XSS。

- **稳定性**
  - AI 调用失败重试（有限次数），失败后：
    - 返回“当前服务繁忙，请稍后重试”的降级提示。
    - 不中断现有会话的持久化与恢复能力。
  - 失败与慢请求指标上报到监控系统，便于预警。

---

> 本技术设计与 `prd.md`、`DATABASE.md` 对应：  
> - 第 1–3 章对应 PRD 第 5 章「技术栈建议」与 TECH_DESIGN 原初内容的细化。  
> - 持久化与会话结构与 `DATABASE.md` 中的表结构一一对应。  
> - 性能、安全、稳定性与 PRD 第 6 章的非功能性要求对齐。