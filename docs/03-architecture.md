# PaperLens 系统架构设计

> 版本：v1.1  
> 日期：2026-06-10  
> 范围：MVP（Phase 1~3）及可预见扩展  
> 设计目标：**轻量、可快速迭代、小团队友好**

---

## 1. 技术决策与 Trade-off

### 1.1 业务后端：Nest.js（而非 Express）

| 维度 | Nest.js | Express |
|------|---------|---------|
| 架构范式 | 模块化 + 依赖注入 | 中间件链式，自由组织 |
| TypeScript | 原生一等公民 | 需额外配置 |
| 代码组织 | 强制模块化，防腐败 | 灵活但易失控 |
| 测试 | DI 容器，Mock 极简 | 需手动注入 |
| 微服务演进 | 内置 Transporter 抽象 | 需自研或引入框架 |
| 学习曲线 | 中等 | 低 |

**决策：Nest.js**

理由：
- PaperLens 领域边界清晰（用户/论文/阅读/项目/推送），Nest.js 的 `Module` 天然对应，降低长期维护成本。
- 依赖注入使 AI 调用这类外部依赖极易 Mock，单测可落地。
- 未来 AI 服务若需拆分/流式升级，`ClientsModule` 可低成本切换协议。

**代价**：团队需熟悉 Decorator；启动时模块图构建有微量开销（可忽略）。

---

### 1.2 ORM：Prisma（而非 TypeORM）

| 维度 | Prisma | TypeORM |
|------|--------|---------|
| 类型安全 | 生成式 Client，100% 推导 | Decorator 驱动，部分宽松 |
| 迁移 | 成熟、可审计、可回滚 | 冲突处理较弱 |
| 关联查询 | `include` 直观，防 N+1 | Lazy/Eager 易踩坑 |
| JSONB 支持 | 完善，GIN 索引查询 | 可用 |

**决策：Prisma**

理由：
- PaperLens 关联查询极多（论文 → 语义块 → 标注 → 术语），Prisma 的类型推导显著减少类型错误。
- 完全替代 PRD 中 MongoDB 的角色（文档原文、Agent 日志用 JSONB），**减少一套数据库运维**。
- 迁移文件入版本控制，Schema 演进可审计。

---

### 1.3 向量检索：PGVector（而非独立 Milvus/Pinecone）

| 维度 | PGVector | Milvus | Pinecone |
|------|----------|--------|----------|
| 运维 | 低（PostgreSQL 插件） | 中（独立集群） | 托管 SaaS |
| 混合查询 | SQL + 向量 JOIN | 需应用层合并 | 有限 |
| 数据一致性 | 与业务同一事务 | 最终一致 | 最终一致 |
| 成本 | 零额外费用 | 自运维/云费用 | 按量计费 |

**决策：PGVector**

理由：
- PaperLens 向量场景为术语/论文语义检索与兴趣匹配，数据量级万~十万级，PGVector 的 `hnsw` 索引完全够用。
- 混合查询是刚需（如"某项目内与某向量最相似的语义块"），PGVector 一条 SQL JOIN 完成。
- **减少基础设施节点数**，降低故障面。

**代价**：百万级论文时索引构建变慢，届时可平滑导出 `embedding` 列迁移到专用向量库。

---

### 1.4 缓存与队列：Redis（多角色复用）

Redis 在 PaperLens 中承担三角色：
- **缓存**：术语定义热点缓存（TTL 1h）、用户会话（JWT 黑名单）。
- **任务队列**：**Redis List（LPUSH/BRPOP）作为跨语言通用队列**，Nest.js 生产者写入，Python 消费者阻塞读取。不绑死任何语言专属的队列库（如 BullMQ、Celery）。
- **SSE/实时**：Nest.js 用原生 SSE 推送；集群场景下 Redis 作跨进程状态同步（MVP 单实例可不启用）。

**不引入 Kafka/RabbitMQ/BullMQ 跨语言**：当前任务类型单一，Redis List + BRPOP 足够轻量且两端都原生支持；BullMQ 是 Node.js 专用库，Python 无法直接消费，**严禁在架构中假设 Python 能消费 BullMQ**。Kafka 运维重量与收益不成正比。

---

### 1.5 AI 服务通信：HTTP + Redis Queue（而非 gRPC 全链路）

| 维度 | HTTP + Redis Queue | gRPC 全链路 |
|------|-------------------|-------------|
| 实时交互 | HTTP 足够，AI 无状态 | 需保持连接 |
| 异步任务 | Redis Queue 天然支持 | 需额外引入流 |
| 跨语言类型 | OpenAPI / JSON | Proto 需维护两套 |
| 调试 | curl / Postman | 需 grpcurl |
| 流式传输 | SSE / ReadableStream | 原生 Streaming |

**决策：同步 HTTP（即时 AI）+ 异步 Redis Queue（重任务）**

理由：
- Hover 气泡、对话问答要求 500ms~2s 响应，HTTP + FastAPI `async` 足够。
- PDF 解析（30s SLA）必须异步：Nest.js `LPUSH` 任务到 Redis List → Python `BRPOP` 阻塞消费 → 处理完成调 Nest.js HTTP 回调 → Nest.js 事务写库。
- **AI 服务不接触数据库**，完全无状态，可水平扩展。
- 未来若需双向流式，可在网关层做协议转换。

---

### 1.6 对象存储：MinIO（而非云厂商直联）

理由：
- 开发/测试环境完全一致，无需申请云账号。
- 兼容 S3 API，未来切云厂商零代码改动。
- PDF、图表截图非高频小文件，MinIO 单机足够；生产可分布式部署。

---

### 1.7 前端-后端实时通信：SSE（而非 Socket.io）

| 维度 | SSE | Socket.io |
|------|-----|-----------|
| 协议 | 原生 HTTP，自动重连 | WebSocket + 降级轮询 |
| 复杂度 | 极低（NestJS 原生 `@Sse`） | 需额外适配器和客户端库 |
| 方向 | 服务端 → 客户端（单向足够） | 双向 |
| 穿透性 | 等同 HTTP，无防火墙问题 | WebSocket 偶有企业墙拦截 |
| 客户端 | `EventSource` 原生支持 | 需引入 socket.io-client |

**决策：SSE 为主，WebSocket 预留**

理由：
- PaperLens 的实时场景全部是"服务端推送"（解析进度、对话流式、新简报），SSE 单向足够。
- 减少客户端包体积和连接管理复杂度。
- 未来若需双向实时协作（如导师协同批注），可再引入 Socket.io，架构不阻塞。

---

## 2. 系统总体架构

```
┌─────────────────────────────────────────────────────────────┐
│                      客户端层                                │
│  React 18 + TypeScript + Vite + Tailwind + Zustand         │
│  EventSource (SSE) for streaming & push                    │
└────────────────────────┬────────────────────────────────────┘
                         │ REST / SSE
┌────────────────────────┼────────────────────────────────────┐
│                   业务后端层 (Nest.js)                       │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐           │
│  │ AuthModule  │ │PaperModule  │ │ProjectModule│           │
│  │  认证/授权   │ │论文/文件/解析│ │ 项目/矩阵   │           │
│  └─────────────┘ └─────────────┘ └─────────────┘           │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐           │
│  │ReadingModule│ │BriefingModule│ │  AiGateway  │           │
│  │ 阅读室/QA   │ │ 早间/晚间    │ │ 代理/限流   │           │
│  └─────────────┘ └─────────────┘ └─────────────┘           │
│  ┌─────────────┐ ┌─────────────┐                            │
│  │  BullMQ     │ │   Prisma    │                            │
│  │  Producer   │ │   Client    │                            │
│  └─────────────┘ └─────────────┘                            │
└────────────────────────┬────────────────────────────────────┘
                         │
          ┌──────────────┼──────────────┐
          │              │              │
┌─────────▼──────┐ ┌─────▼──────┐ ┌────▼─────┐
│ AI 服务层      │ │  数据存储   │ │ 基础设施  │
│ (FastAPI)      │ │            │ │           │
│ ┌────────────┐ │ │ PostgreSQL │ │  Redis    │
│ │PDF Parser  │ │ │ + PGVector │ │ Cache/Queue│
│ │LLM Agent   │ │ │            │ │           │
│ │Embedding   │ │ │   MinIO    │ │ Scheduler │
│ └────────────┘ │ │ (S3 API)   │ │           │
└────────────────┘ └────────────┘ └───────────┘
```

### 2.1 分层职责

| 层级 | 职责 | 关键技术 |
|------|------|----------|
| 客户端层 | UI 渲染、交互状态、本地缓存 | React 18, Zustand, SSE EventSource |
| 业务后端层 | 领域逻辑、权限、事务编排、任务派发 | Nest.js, Prisma, BullMQ, Passport |
| AI 服务层 | **无状态**计算：PDF 解析、LLM 调用、向量化 | FastAPI, HTTP 服务 |
| 数据存储层 | 持久化、向量检索、对象存储 | PostgreSQL 15+, MinIO |
| 基础设施层 | 缓存、队列、定时任务 | Redis 7+, node-cron |

---

## 3. 服务边界与通信契约

### 3.1 业务后端模块边界

| 模块 | 职责 | 禁止越界 |
|------|------|---------|
| `AuthModule` | JWT 签发/校验、注册登录 | 不碰业务数据权限（由各自 Guard 处理） |
| `UserModule` | 用户画像、兴趣标签、阅读统计、推送设置 | 不直接调用 LLM；不解析 PDF |
| `PaperModule` | 论文 CRUD、文件上传、解析状态机、语义块/标注/图表/方法卡片/笔记 | 不直接调用 LLM；通过 `AiGateway` 代理 |
| `ReadingModule` | 阅读会话、选中再聊上下文组装、论文理解档案聚合 | 不存储 PDF 二进制 |
| `ProjectModule` | 项目空间、对比矩阵、方法演进时间线、项目问答范围锁定 | 不跨项目查全文 |
| `BriefingModule` | 早间/晚间简报编排、arXiv 抓取调度 | 内容由 AI 服务生成，本模块只编排与缓存 |
| `AiGatewayModule` | 统一代理 AI 服务 HTTP 调用；限流、熔断、日志、密钥管理 | 不实现 AI 算法逻辑 |

### 3.2 业务后端 ↔ AI 服务接口契约

AI 服务（FastAPI）仅暴露以下 HTTP 接口，由 Nest.js `AiGateway` 统一调用：

| 接口 | Method | Path | Request | Response | 说明 |
|------|--------|------|---------|----------|------|
| 解析任务提交 | `POST` | `/api/v1/parse` | `{ paper_id, file_url }` | `{ job_id }` | 接收 MinIO presigned URL |
| 解析结果回调 | `POST` | `/api/v1/parse/callback` | `{ job_id, paper_id, result }` | `{ received }` | **AI 服务完成解析后回调 Nest.js** |
| 解析状态查询 | `GET` | `/api/v1/parse/{job_id}` | — | `{ status, progress? }` | 查询进度 |
| 翻译 | `POST` | `/api/v1/translate` | `{ blocks, target_lang }` | `{ translations }` | 批量翻译语义块 |
| 术语提取 | `POST` | `/api/v1/terms/extract` | `{ text, context? }` | `{ terms }` | 提取术语+定义+类别 |
| 图表解读 | `POST` | `/api/v1/figures/analyze` | `{ image_url }` | `{ analysis }` | 图表 AI 解读 |
| 对话 | `POST` | `/api/v1/chat` | `{ messages, stream? }` | `SSE Stream / { reply }` | 通用对话 |
| 简报生成 | `POST` | `/api/v1/briefing/generate` | `{ type, papers, stats? }` | `{ content }` | 生成简报结构化内容 |
| 向量化 | `POST` | `/api/v1/embeddings` | `{ texts }` | `{ embeddings }` | 批量生成向量 |
| 语义检索 | `POST` | `/api/v1/search/semantic` | `{ query_embedding, top_k, filters? }` | `{ results }` | 语义相似检索 |

> **核心契约原则：**
> 1. AI 服务**不接触数据库**，不接触 MinIO 凭据（文件以 presigned URL 传递）。
> 2. AI 服务完全无状态，解析结果通过 HTTP 回调回传 Nest.js，由 Nest.js 统一事务写库。
> 3. 所有 AI 接口均支持超时配置和重试策略（Nest.js `HttpModule` + `axios-retry`）。

---

## 4. 核心数据流

### 4.1 PDF 上传与解析流水线（修正版）

```
用户选择 PDF
    │
    ▼
前端 ──POST /api/v1/files/presign-upload──► Nest.js
    │                                         │
    ◄──── { presignedUrl, objectKey } ────────┘
    │
    ▼
前端直传 MinIO ────────────────────────────► MinIO
    │                                         │
    ▼                                         │
上传完成 ──POST /api/v1/papers/upload-complete──► Nest.js
                                                  │
                                                  ▼
                                            1. 创建 paper 记录 (UPLOADED)
                                            2. Redis List `LPUSH` 添加 parse job
                                                  │
                                                  ▼
                                            Redis List (`parse:queue`)
                                                  │
                                                  ▼
    ┌─────────────────────────────────────────────┐
    │           AI Worker (Python/FastAPI)         │
    │  ┌─────────────────────────────────────────┐  │
    │  │ 1. `BRPOP parse:queue` 阻塞消费 job     │  │
    │  │ 2. 下载 PDF                             │  │
    │  │ 3. PyMuPDF 提取文本/图表/表格           │  │
    │  │ 4. LLM 提取术语、方法卡片               │  │
    │  │ 5. 生成 embedding                       │  │
    │  │ 6. 图表裁剪上传 MinIO                   │  │
    │  │ 7. 全文翻译（分批）                     │  │
    │  └─────────────────────────────────────────┘  │
    │                      │                        │
    │                      ▼                        │
    │  HTTP POST /api/v1/parse/callback ────────────┼──► Nest.js
    │  { job_id, paper_id, blocks, annotations,     │    │
    │    figures, method_cards, embeddings }        │    │
    └─────────────────────────────────────────────┘    │
                                                       ▼
                                            Nest.js 事务写库：
                                              - semantic_blocks
                                              - annotations
                                              - figures
                                              - method_cards
                                              - 更新 papers.parse_status = PARSED
                                                       │
                                                       ▼
                                            SSE push: paper:parse:complete
                                                       │
                                                       ▼
                                            前端刷新状态
```

**关键修正（相比 v1.0）：**
- AI Worker **不再直接写 PostgreSQL**，而是通过 HTTP 回调把结构化结果回传 Nest.js。
- Nest.js 使用 Prisma 事务 `$transaction` 统一多表写入，保证数据一致性。
- AI 服务的 DB 连接权限被完全移除，安全边界清晰。

### 4.2 Hover 术语查询（500ms SLA）

```
用户 Hover 标注文本
    │
    ▼
前端 ──GET /api/v1/terms?q={text}──► Nest.js
                                       │
                                       ├─ ① Redis 缓存 (term:{text}) ──► 命中直接返回
                                       │
                                       └─ ② PostgreSQL term_definitions ──► 命中写 Redis 返回
                                               │
                                               └─ ③ AI 服务 /api/v1/terms/extract
                                                      返回定义 ──► 异步写 PG + Redis ──► 返回
```

三级兜底确保永不返回"未知"。AI 提取的结果异步反哺全局知识库。

### 4.3 对比矩阵矛盾检测（轻量版）

```
PDF 解析完成时
    │
    ▼
AI Worker 提取 method_cards.metrics
    │
    ▼
Nest.js 预填充 matrix_cells（预设列）
    │
    ▼
用户打开对比矩阵
    │
    ▼
Nest.js 轻量规则校验（同 paper_id 数值比对）
    │
    ▼
标记 is_conflict = TRUE（如有）
```

**修正**：矛盾检测从"实时 AI 验证"改为"解析时预提取 + 打开时轻量规则校验"，大幅降低打开矩阵的延迟。

---

## 5. 非功能需求落地

### 5.1 性能

| 需求 | 方案 |
|------|------|
| Hover 500ms | Redis 缓存 + PG 覆盖索引 + 骨架屏优先；AI 兜底异步 |
| PDF 解析 < 30s | PyMuPDF 多进程；图表 OCR 按需；8 页论文基准 |
| 首屏 < 2s | Vite 代码分割；语义块分页加载；CDN 静态资源 |
| 对话响应 | LLM 流式 SSE；首 token < 1s |
| 对比矩阵打开 | 解析时预生成数据，打开即读，无 AI 实时调用 |

### 5.2 成本控制

| 项目 | 策略 |
|------|------|
| LLM API | ① 语义块级翻译缓存（同一论文不重复）；② 术语全局缓存；③ 图表/方法卡片仅在用户触发时调用 |
| 存储 | MinIO 生命周期：解析失败临时文件 7 天清理；图表压缩缩略图 |
| 免费版 | `users.plan='FREE'` 时月上传数软拦截；解析任务低优先级排队 |

### 5.3 安全与隐私

| 需求 | 方案 |
|------|------|
| 论文不上传训练 | AI 服务调用 LLM 时注入系统指令禁止训练；不与模型商共享数据 |
| 删除机制 | `papers.deleted_at` 软删除 + 定时任务物理清理 MinIO；用户可主动"彻底删除" |
| 未发表论文警示 | `source_type='UPLOAD'` 时弹窗提示隐私风险 |
| 权限隔离 | 所有查询附加 `user_id` 过滤；RBAC 预留 `role` 字段 |

---

## 6. Phase 里程碑与架构预留

### Phase 1：单篇阅读（核心尖刀，~6 周）

**架构重点：**
- 搭起 Nest.js + Prisma + PostgreSQL + MinIO + Redis + SSE 骨架。
- AI 服务优先实现：PDF 解析、翻译、术语提取、单篇对话。
- 前端阅读室 50/50 分屏 + 语义块渲染 + 选中再聊。

**可舍弃的复杂性：**
- 简报生成走简化模板/模拟数据，不调用 LLM 生成完整 Newsletter。
- 项目空间仅做论文列表，不做对比矩阵和方法演进。
- 方法演进图不做。

### Phase 2：推送（留存引擎，~4 周）

**架构重点：**
- 引入 `briefings` 表（JSONB 整存，不拆条目表）。
- 接入 arXiv RSS/API 抓取（独立 Python 脚本或 Nest.js Schedule）。
- AI 服务增加 `/api/v1/briefing/generate`。
- `user_interests.weight` 预留算法优化空间。

### Phase 3：多篇整理（付费转化，~6 周）

**架构重点：**
- 启用 `projects` / `comparison_matrices` / `method_timelines`。
- 对比矩阵 Agent 自定义列：前端自然语言 → AI 解析意图 → 回写 `columns` JSONB。
- 导出 CSV/Markdown/PNG（后端生成或前端 Canvas）。
- 中间件检查 `users.plan`，PRO 用户放行高级功能。

### 远期预留（不阻塞当前架构）

| 功能 | 当前预留点 |
|------|-----------|
| 团队/导师视图 | `users.role` 字段；未来建 `project_members` 表 |
| 浏览器插件 | 独立 Chrome Extension，调用相同上传接口 |
| 中文论文（知网）| `papers.source_type` 预留 `CNKI` |
| 独立向量库 | `embedding` 列可直接导出迁移 |
| gRPC 升级 | `AiGateway` 封装 HTTP，未来替换 Client 不影响业务 |
| WebSocket 双向 | SSE 基础上可叠加 Socket.io，不影响现有事件设计 |

---

## 7. 轻量本地开发方案

```yaml
# docker-compose.dev.yml（MVP 开发环境）
version: '3.8'
services:
  postgres:
    image: ankane/pgvector:latest
    environment:
      POSTGRES_USER: paperlens
      POSTGRES_PASSWORD: paperlens
      POSTGRES_DB: paperlens
    ports: ["5432:5432"]
    volumes:
      - pgdata:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine
    ports: ["6379:6379"]

  minio:
    image: minio/minio:latest
    command: server /data --console-address ":9001"
    environment:
      MINIO_ROOT_USER: paperlens
      MINIO_ROOT_PASSWORD: paperlens123
    ports: ["9000:9000", "9001:9001"]
    volumes:
      - miniodata:/data

volumes:
  pgdata:
  miniodata:
```

**启动命令：**
```bash
docker-compose -f docker-compose.dev.yml up -d
# Nest.js
npm run start:dev
# AI Service
uvicorn app.main:app --reload --port 8000
# Web
npm run dev
```

**无 Docker 启动（Windows 开发）：**
- PostgreSQL 15 + pgvector 扩展（需手动安装扩展）
- Redis for Windows / WSL2 Redis
- MinIO 单二进制文件

---

> **设计原则总结：** 本架构以"**少即是多**"为核心，拒绝过早引入 Kafka、gRPC、MongoDB、Socket.io 等重型组件。所有技术选型均围绕"2~3 人小团队能否在 1 周内跑通完整开发环境"这一标准进行 Trade-off。
