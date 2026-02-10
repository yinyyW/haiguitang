# 海龟汤 数据库设计

基于 [PRD](./prd.md) 中的会话与消息持久化（F-3.1、F-3.2）、历史会话列表与恢复（F-2.2、F-2.3）、按用户隔离（安全）及后续图片生成（F-5.x）进行设计。

---

## 1. 表关系概览
users (用户)
│
└── sessions (会话) ──┬── puzzle (题目)
└── messages (消息)
└── session_images (会话配图，后续版本)


- **users**：用户标识，支持后续登录与按用户隔离会话。
- **puzzles**：预设题库，每局会话关联一道题目。
- **sessions**：一局游戏为一条会话，关联用户与题目，用于历史列表与恢复。
- **messages**：单局内的多轮问答，按会话维度查询与展示。
- **session_images**：每段对话生成的配图（V1.1 图片功能）。

---

## 2. 表结构定义

### 2.1 users（用户）

用于按用户隔离会话、历史列表与鉴权；MVP 可用匿名 ID 写入 `external_id`，后续接入登录再补全。

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | BIGINT | PK, AUTO_INCREMENT | 主键 |
| external_id | VARCHAR(128) | NOT NULL, UNIQUE | 外部标识：匿名设备 ID 或第三方 open_id |
| nickname | VARCHAR(64) | NULL | 昵称（可选） |
| avatar_url | VARCHAR(512) | NULL | 头像 URL（可选） |
| created_at | DATETIME(3) | NOT NULL, DEFAULT CURRENT_TIMESTAMP(3) | 创建时间 |
| updated_at | DATETIME(3) | NOT NULL, DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3) | 更新时间 |

**索引建议**：`UNIQUE (external_id)`（建表时已包含）。

---

### 2.2 puzzles（题目）

预设题库，与 `puzzle_collection.json` 结构对齐；选题时按 `soup_type`、`status`、`difficulty` 筛选。

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | BIGINT | PK, AUTO_INCREMENT | 主键 |
| title | VARCHAR(256) | NOT NULL | 题目标题，列表/历史展示用 |
| soup_type | ENUM('CLEAR','RED','BLACK') | NOT NULL | 清汤(CLEAR)、红汤(RED)、黑汤(BLACK)；与 PRD 汤类型一致 |
| difficulty | TINYINT UNSIGNED | NOT NULL, DEFAULT 3 | 难度 1–5 |
| tags | JSON | NULL | 标签数组，如 ["经典","反转"] |
| surface | TEXT | NOT NULL | 汤面（诡异叙述） |
| bottom | TEXT | NOT NULL | 汤底（完整真相） |
| hint_list | JSON | NULL | 提示问题数组，可选 |
| language | VARCHAR(16) | NOT NULL, DEFAULT 'zh-CN' | 语言 |
| status | ENUM('ACTIVE','INACTIVE','DRAFT') | NOT NULL, DEFAULT 'ACTIVE' | 上架状态，选题仅用 ACTIVE |
| source | VARCHAR(32) | NOT NULL, DEFAULT 'OFFICIAL' | 来源：OFFICIAL / USER / OTHER |
| created_at | DATETIME(3) | NOT NULL, DEFAULT CURRENT_TIMESTAMP(3) | 创建时间 |
| updated_at | DATETIME(3) | NOT NULL, DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3) | 更新时间 |
| created_by | VARCHAR(64) | NULL | 创建人/导入批次（可选） |

**索引建议**：
- `idx_puzzles_status_soup_type (status, soup_type)`：按类型选题；
- `idx_puzzles_status_difficulty (status, difficulty)`：按难度选题。

---

### 2.3 sessions（会话）

一局游戏一条记录，对应 F-2.x 历史会话列表与恢复、F-1.6 结束与复盘。

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | BIGINT | PK, AUTO_INCREMENT | 主键 |
| user_id | BIGINT | NOT NULL, FK → users.id | 所属用户 |
| puzzle_id | BIGINT | NOT NULL, FK → puzzles.id | 本局题目 |
| soup_type | ENUM('CLEAR','RED','BLACK') | NOT NULL | 冗余，列表展示与筛选 |
| title | VARCHAR(256) | NULL | 会话标题，可取自汤面摘要或自动生成，列表展示 |
| status | ENUM('PLAYING','REVEALED','QUIT') | NOT NULL, DEFAULT 'PLAYING' | 进行中 / 已揭晓 / 用户退出 |
| question_count | INT UNSIGNED | NOT NULL, DEFAULT 0 | 提问次数，用于简单统计 |
| started_at | DATETIME(3) | NULL | 开始时间（可选） |
| ended_at | DATETIME(3) | NULL | 结束时间（可选） |
| created_at | DATETIME(3) | NOT NULL, DEFAULT CURRENT_TIMESTAMP(3) | 创建时间 |
| updated_at | DATETIME(3) | NOT NULL, DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3) | 更新时间 |

**索引建议**：
- `idx_sessions_user_created (user_id, created_at DESC)`：用户历史会话列表；
- `idx_sessions_user_status (user_id, status)`：按状态筛选；
- `FK sessions.puzzle_id → puzzles.id`。

---

### 2.4 messages（消息）

单局内每一轮用户提问与 AI 回答，对应 F-2.1 当前对话进行、F-3.1 对话持久化。

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | BIGINT | PK, AUTO_INCREMENT | 主键 |
| session_id | BIGINT | NOT NULL, FK → sessions.id | 所属会话 |
| role | ENUM('USER','ASSISTANT') | NOT NULL | 发言方：用户 / AI |
| content | TEXT | NOT NULL | 消息内容：用户为问题，AI 为回答 |
| answer_type | VARCHAR(16) | NULL | 仅 role=ASSISTANT 时使用：YES / NO / IRRELEVANT / BOTH（是也不是） |
| created_at | DATETIME(3) | NOT NULL, DEFAULT CURRENT_TIMESTAMP(3) | 创建时间 |

**索引建议**：
- `idx_messages_session_created (session_id, created_at)`：按会话拉取消息顺序恢复对话；
- `FK messages.session_id → sessions.id`，删除策略建议 CASCADE 或应用层先删 message 再删 session。

---

### 2.5 session_images（会话配图，可选 / V1.1）

对应 F-5.1、F-5.2：按对话生成图片、展示与下载。

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | BIGINT | PK, AUTO_INCREMENT | 主键 |
| session_id | BIGINT | NOT NULL, FK → sessions.id | 所属会话 |
| image_url | VARCHAR(512) | NOT NULL | 图片存储 URL 或路径 |
| prompt_used | TEXT | NULL | 生成时使用的文案（可选，便于审计） |
| created_at | DATETIME(3) | NOT NULL, DEFAULT CURRENT_TIMESTAMP(3) | 创建时间 |

**索引建议**：`idx_session_images_session (session_id)`；FK → sessions.id。

---

## 3. 与 PRD 的对应关系

| PRD 需求 | 实现方式 |
|----------|----------|
| F-3.1 对话持久化 | messages 表落库，session 维度的 message 列表即完整对话 |
| F-3.2 会话与消息结构 | sessions + messages 两级结构 |
| F-2.2 历史会话列表 | 按 user_id 查 sessions，按 created_at 倒序，带 title / soup_type / status |
| F-2.3 恢复历史对话 | 根据 session_id 查 messages 按 created_at 正序返回 |
| F-2.4 新开一局 | 插入新 session，关联 puzzle_id（从 puzzles 按 soup_type 选题） |
| F-1.2 汤面展示 | 通过 session.puzzle_id 取 puzzles.surface |
| F-1.5 揭晓汤底 | 取 puzzles.bottom 返回；session.status 置为 REVEALED |
| F-1.6 结束与复盘 | question_count、ended_at 更新；列表展示用 session.title |
| 按用户隔离（安全） | 所有会话查询带 user_id；鉴权校验 user_id 与请求身份一致 |
| F-5.x 图片生成 | session_images 按 session_id 关联，一次会话可有多张 |

---

## 4. 题库数据与 puzzles 表

现有 [puzzle_collection.json](./puzzle_collection.json) 中 `soup_type` 含 `WHITE`（清汤）、`RED`、`BLACK`。入库时建议映射：**WHITE → CLEAR**，RED/BLACK 保持不变，与表枚举一致。其他字段（title, difficulty, tags, surface, bottom, hint_list, language, status, source）与表结构一一对应即可。

### puzzle
- id (bigint, PK, auto increment)
- title (varchar)
- soup_type (enum: CLEAR, RED, BLACK)
- difficulty (tinyint)
- tags (json 或 逗号分隔字符串)
- surface (text)
- bottom (text)
- hint_list (json, 可空)
- language (varchar, 默认 zh-CN)
- status (enum: ACTIVE, INACTIVE, DRAFT)
- source (varchar，题库中的则为"OFFICIAL“)
- created_at, updated_at, created_by