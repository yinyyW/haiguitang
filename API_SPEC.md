# 海龟汤应用 API 规格说明（API_SPEC）

面向前端（React/Next）与未来自动化客户端的 **HTTP / SSE** 接口定义，覆盖：
- 会话创建、历史列表、恢复对话
- 单轮提问与 AI 标准回答（是/不是/不重要/是也不是）
- 揭晓汤底、退出会话
- （后续）会话配图生成与查询

---

## 目录

- [0. 约定](#0-约定)
  - [0.1 基础约定](#01-基础约定)
  - [0.2 鉴权（MVP）](#02-鉴权mvp)
  - [0.3 枚举定义](#03-枚举定义)
  - [0.4 统一错误格式](#04-统一错误格式)
- [1. 用户相关](#1-用户相关)
  - [1.1 获取当前用户信息](#11-获取当前用户信息)
- [2. 会话 Sessions](#2-会话-sessions)
  - [2.1 新开一局（创建会话）](#21-新开一局创建会话)
  - [2.2 获取历史会话列表](#22-获取历史会话列表)
  - [2.3 获取会话详情（用于恢复入口）](#23-获取会话详情用于恢复入口)
  - [2.4 退出本局](#24-退出本局)
  - [2.5 揭晓汤底](#25-揭晓汤底)
- [3. 消息 Messages（问答）](#3-消息-messages问答)
  - [3.1 拉取会话消息（恢复对话）](#31-拉取会话消息恢复对话)
  - [3.2 提交问题（非流式）](#32-提交问题非流式)
  - [3.3 提交问题（流式 SSE）](#33-提交问题流式-sse)
- [4. 会话配图（V1.1 / 可选）](#4-会话配图v11--可选)
  - [4.1 触发生成会话配图](#41-触发生成会话配图)
  - [4.2 查询会话配图列表](#42-查询会话配图列表)
- [5. 运营/管理接口（可选）](#5-运营管理接口可选)
- [6. 安全与一致性建议（实现约束）](#6-安全与一致性建议实现约束)

## 0. 约定

### 0.1 基础约定
- **统一前缀**：`/api`
- **默认返回**：`application/json; charset=utf-8`
- **时间字段**：ISO 8601 字符串（如 `2026-02-10T12:34:56.789Z`）
- **ID 类型**：数据库是 BIGINT，但 API **统一用字符串返回**（避免 JS number 精度问题）

### 0.2 鉴权（MVP）
MVP 使用匿名标识头（对应 `users.external_id`）：

- Header：`X-External-Id: <匿名设备ID或用户ID>`

后端处理建议：
- 如果 `X-External-Id` 不存在或为空：返回 401
- 如果 `users` 中找不到该 external_id：自动创建用户（MVP 体验更顺滑）

> 后续接入 JWT 时，可保留 `X-External-Id` 作为兼容或废弃。

### 0.3 枚举定义
- **SoupType**：`CLEAR | RED | BLACK`
  - `CLEAR`：清汤
  - `RED`：红汤
  - `BLACK`：黑汤
- **SessionStatus**：`PLAYING | REVEALED | QUIT`
- **MessageRole**：`USER | ASSISTANT`
- **AnswerType（仅 AI 消息可选）**：`YES | NO | IRRELEVANT | BOTH`
  - `BOTH`：是也不是

### 0.4 统一错误格式
所有非 2xx 建议返回：

```json
{
  "error": {
    "code": "INVALID_ARGUMENT",
    "message": "human readable message",
    "request_id": "req_xxx",
    "details": {}
  }
}
```

常见 `error.code` 建议：
- `UNAUTHORIZED`：缺少/无效 external_id 或 token
- `FORBIDDEN`：访问非本人 session
- `NOT_FOUND`：资源不存在
- `INVALID_ARGUMENT`：入参不合法
- `RATE_LIMITED`：触发限流
- `AI_UNAVAILABLE`：AI 服务不可用/超时
- `INTERNAL`：未预期错误

---

## 1. 用户相关

### 1.1 获取当前用户信息

`GET /api/me`

**Headers**
- `X-External-Id`：必填

**Response 200**

```json
{
  "user": {
    "id": "123",
    "external_id": "device_xxx",
    "nickname": null,
    "avatar_url": null,
    "created_at": "2026-02-10T12:00:00.000Z",
    "updated_at": "2026-02-10T12:00:00.000Z"
  }
}
```

---

## 2. 会话 Sessions

### 2.1 新开一局（创建会话）

`POST /api/sessions`

**Body**

```json
{
  "soup_type": "CLEAR",
  "difficulty": 3
}
```

- `soup_type`：必填（`CLEAR|RED|BLACK`）
- `difficulty`：可选（1–5），不传则后端默认（例如 3）
- 选题逻辑：从 `puzzles` 表中 `status=ACTIVE` 且 `soup_type` 匹配的题目随机/策略选取，写入 `sessions.puzzle_id`

**Response 201**

```json
{
  "session": {
    "id": "888",
    "user_id": "123",
    "puzzle_id": "456",
    "soup_type": "CLEAR",
    "title": "海龟汤 · 清汤",
    "status": "PLAYING",
    "question_count": 0,
    "started_at": "2026-02-10T12:01:00.000Z",
    "ended_at": null,
    "created_at": "2026-02-10T12:01:00.000Z",
    "updated_at": "2026-02-10T12:01:00.000Z"
  },
  "puzzle": {
    "id": "456",
    "title": "题目标题",
    "surface": "汤面内容（用户可见）",
    "difficulty": 3,
    "tags": ["经典", "反转"]
  }
}
```

> 注意：不要在此接口返回 `bottom`（汤底）。

### 2.2 获取历史会话列表

`GET /api/sessions?limit=20&cursor=<optional>`

- 用于 PRD 的「历史会话列表」
- `cursor`：建议使用 `created_at/id` 组合游标或单调递增 `id` 游标

**Response 200**

```json
{
  "items": [
    {
      "id": "888",
      "soup_type": "CLEAR",
      "title": "海龟汤 · 清汤",
      "status": "PLAYING",
      "question_count": 5,
      "created_at": "2026-02-10T12:01:00.000Z",
      "updated_at": "2026-02-10T12:05:00.000Z"
    }
  ],
  "next_cursor": "..."
}
```

### 2.3 获取会话详情（用于恢复入口）

`GET /api/sessions/:sessionId`

**Response 200**

```json
{
  "session": {
    "id": "888",
    "soup_type": "CLEAR",
    "status": "PLAYING",
    "question_count": 5,
    "created_at": "2026-02-10T12:01:00.000Z",
    "updated_at": "2026-02-10T12:05:00.000Z"
  },
  "puzzle": {
    "id": "456",
    "title": "题目标题",
    "surface": "汤面内容（用户可见）",
    "difficulty": 3,
    "tags": ["经典", "反转"]
  }
}
```

### 2.4 退出本局

`POST /api/sessions/:sessionId/quit`

**Response 200**

```json
{
  "session": {
    "id": "888",
    "status": "QUIT",
    "ended_at": "2026-02-10T12:10:00.000Z",
    "updated_at": "2026-02-10T12:10:00.000Z"
  }
}
```

### 2.5 揭晓汤底

`POST /api/sessions/:sessionId/reveal`

**行为**
- 更新 `sessions.status = REVEALED`
- 返回 `puzzles.bottom`

**Response 200**

```json
{
  "session": {
    "id": "888",
    "status": "REVEALED",
    "ended_at": "2026-02-10T12:12:00.000Z",
    "updated_at": "2026-02-10T12:12:00.000Z"
  },
  "puzzle": {
    "id": "456",
    "bottom": "汤底内容（揭晓后可见）"
  }
}
```

---

## 3. 消息 Messages（问答）

### 3.1 拉取会话消息（恢复对话）

`GET /api/sessions/:sessionId/messages?limit=100&cursor=<optional>`

**Response 200**

```json
{
  "items": [
    {
      "id": "10001",
      "role": "USER",
      "content": "这个人是男的吗？",
      "answer_type": null,
      "created_at": "2026-02-10T12:02:00.000Z"
    },
    {
      "id": "10002",
      "role": "ASSISTANT",
      "content": "是",
      "answer_type": "YES",
      "created_at": "2026-02-10T12:02:01.000Z"
    }
  ],
  "next_cursor": "..."
}
```

### 3.2 提交问题（非流式）

`POST /api/sessions/:sessionId/messages`

**Headers**
- `Idempotency-Key: <uuid>`（建议，可防止前端重试导致重复入库）

**Body**

```json
{
  "content": "这个人是男的吗？",
  "stream": false
}
```

**Response 200**

```json
{
  "user_message": {
    "id": "10001",
    "role": "USER",
    "content": "这个人是男的吗？",
    "created_at": "2026-02-10T12:02:00.000Z"
  },
  "assistant_message": {
    "id": "10002",
    "role": "ASSISTANT",
    "content": "是",
    "answer_type": "YES",
    "created_at": "2026-02-10T12:02:01.000Z"
  },
  "session": {
    "id": "888",
    "question_count": 6,
    "status": "PLAYING",
    "updated_at": "2026-02-10T12:02:01.000Z"
  }
}
```

### 3.3 提交问题（流式 SSE）

`POST /api/sessions/:sessionId/messages`

**Body**

```json
{
  "content": "这个人是男的吗？",
  "stream": true
}
```

**Response 200（SSE）**
- `Content-Type: text/event-stream; charset=utf-8`

**SSE 事件建议**
- `event: message.created`：用户消息已入库（返回 `user_message_id`）
- `event: assistant.delta`：AI token 增量内容
- `event: assistant.done`：AI 最终消息落库（返回 `assistant_message_id`、`answer_type`）
- `event: session.updated`：`question_count/status` 更新
- `event: error`：AI 不可用/超时等

**示例（仅示意）**

```text
event: message.created
data: {"user_message_id":"10001"}

event: assistant.delta
data: {"delta":"是"}

event: assistant.done
data: {"assistant_message_id":"10002","content":"是","answer_type":"YES"}

event: session.updated
data: {"session_id":"888","question_count":6,"status":"PLAYING"}
```

---

## 4. 会话配图（V1.1 / 可选）

### 4.1 触发生成会话配图

`POST /api/sessions/:sessionId/images`

**Body**

```json
{
  "mode": "SURFACE",
  "style": "NOIR"
}
```

- `mode`：`SURFACE | BOTTOM | SUMMARY`（基于汤面/汤底/摘要生成）
- `style`：可选（由产品定义）

**Response 202**

```json
{
  "job": { "id": "imgjob_1", "status": "PENDING" }
}
```

> MVP 可先做同步生成直接返回 `image_url`，后续再改成异步 job。

### 4.2 查询会话配图列表

`GET /api/sessions/:sessionId/images`

**Response 200**

```json
{
  "items": [
    {
      "id": "9001",
      "image_url": "https://cdn.example.com/xxx.png",
      "created_at": "2026-02-10T12:20:00.000Z"
    }
  ]
}
```

---

## 5. 运营/管理接口（可选，默认不暴露给普通用户）

> 如需后台管理题库，可增加 `/api/admin/puzzles` 相关 CRUD，并用管理员鉴权保护。  
> 普通用户侧不建议提供“获取汤底”的 puzzle 查询接口，以免绕过 reveal。

---

## 6. 安全与一致性建议（实现约束）

- **用户隔离**：所有 `sessions/:id`、`messages` 相关接口必须校验该 session 属于当前 `X-External-Id` 对应的 user。
- **汤底保护**：除 `reveal` 外，任何接口不得返回 `puzzles.bottom`。
- **幂等**：`POST messages` 建议支持 `Idempotency-Key`，避免网络重试造成重复 message。
- **限流**：对 `POST messages`、`POST images` 做 rate limit。

---