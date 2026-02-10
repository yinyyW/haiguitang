# 海龟汤应用技术设计

## 1. 方案设计
### 1.1 AI工具类
- 训练一个AI主持人，需不断给AI补充用户对话信息，并给予反馈，在用户不想玩的时候结束游戏，例如：玩家主动表示”退出“，”不想玩了“等。
- AI稳定性：调用AI失败后可重试，如果当前AI不好用可切换AI模型

### 1.2 持久化
将用户的每一次对话和消息保存至MySQL数据库中。当用户刷新后还能找回之前的对话进度。

### 1.3 工具类
- 对用户的操作及AI反馈生成相应日志
- 捕获异常，并推出消息警告
- 性能优化：SSE实时推送、反应式编程、线程池+连接池

## 2. 技术栈
**前端**
- React/Next.js
- 样式：Tailwind CSS
- 本地数据储存：LocalStorage
- 数据请求：Axios

**后端**
- HTTP + 流式: Node.js + Fastify/Nest.js + SSE
- 持久化：MySQL + mysql2/Prisma
- AI：OpenAI 兼容 SDK + 重试库 + 流式 → SSE
- 可观测：pino/winston + Sentry
- 安全：JWT/Passport + zod/joi + rate-limit
- Docker