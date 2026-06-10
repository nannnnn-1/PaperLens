# PaperLens API 契约定义

> 版本：v1.1  
> 日期：2026-06-10  
> 协议：REST + SSE（Server-Sent Events）  
> 格式：JSON  
> 字符编码：UTF-8

---

## 1. 通用约定

### 1.1 基础信息

- **Base URL**: `http://localhost:3000/api/v1`（开发）
- **API 版本**: 通过 URL Path 标识（`/api/v1`），未来升级通过 `/api/v2` 切换
- **认证方式**: `Authorization: Bearer <JWT>`
- **Content-Type**: `application/json`（文件上传除外）

### 1.2 统一响应信封

所有接口返回统一结构：

```json
{
  "code": 200,
  "data": { ... },
  "message": "success",
  "requestId": "req_abc123def456"
}
```

| 字段 | 类型 | 说明 |
|------|------|------|
| `code` | `number` | 业务状态码，见下表 |
| `data` | `T` | 实际业务数据，错误时可能为 `null` |
| `message` | `string` | 人类可读描述 |
| `requestId` | `string` | 单次请求唯一标识，用于日志追踪 |

### 1.3 错误码规范

| 状态码 | 含义 | 典型场景 |
|--------|------|---------|
| `200` | 成功 | 通用成功 |
| `201` | 创建成功 | POST 创建资源 |
| `204` | 无内容 | DELETE 成功 |
| `400` | 请求参数错误 | 缺少必填字段、格式错误 |
| `401` | 未认证 | Token 缺失或过期 |
| `403` | 无权限 | 访问他人资源、免费版功能限制 |
| `404` | 资源不存在 | 论文/项目 ID 不存在 |
| `409` | 资源冲突 | 重复收藏、重复关键词 |
| `422` | 业务校验失败 | 论文解析中不可翻译、免费版配额耗尽 |
| `429` | 限流 | AI 接口调用过于频繁 |
| `500` | 服务器内部错误 | 数据库连接失败、AI 服务超时 |
| `503` | 服务暂不可用 | AI 服务过载、队列堆积 |

**错误响应示例：**

```json
{
  "code": 422,
  "data": null,
  "message": "论文解析中，暂不可进行全文翻译",
  "requestId": "req_xyz789"
}
```

### 1.4 分页规范

列表接口统一支持：

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `page` | `number` | `1` | 页码，从 1 开始 |
| `limit` | `number` | `20` | 每页条数，最大 `100` |

**分页响应结构：**

```json
{
  "code": 200,
  "data": {
    "list": [ ... ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 156,
      "totalPages": 8
    }
  },
  "message": "success",
  "requestId": "req_abc123"
}
```

### 1.5 SSE（Server-Sent Events）规范

用于流式对话和解析进度推送。

**连接方式：**
- `GET /api/v1/sse/connect`（建立 SSE 连接，返回 `text/event-stream`）
- 前端使用原生 `EventSource` 或 `eventsource-parser` 库

**事件格式：**

```
event: chat:delta\n
data: {"sessionId":"sess_123","delta":"这是","finish":false}\n\n

event: chat:done\n
data: {"sessionId":"sess_123","finish":true,"usage":{"promptTokens":1200,"completionTokens":350}}\n\n
```

| 事件名 | 方向 | 说明 |
|--------|------|------|
| `paper:parse:progress` | Server → Client | PDF 解析进度 `{ paperId, status, progress }` |
| `paper:parse:complete` | Server → Client | 解析完成/失败 `{ paperId, status, error? }` |
| `chat:delta` | Server → Client | 对话流式片段 `{ sessionId, delta, finish }` |
| `chat:done` | Server → Client | 对话流结束 `{ sessionId, finish, usage }` |
| `briefing:new` | Server → Client | 新简报生成通知 `{ briefingId, type }` |

---

## 2. 认证模块（Auth）

> ⭐ Phase 1 必需

| Method | Path | Request | Response | 说明 |
|--------|------|---------|----------|------|
| `POST` | `/auth/register` | `{ email: string, password: string, displayName?: string }` | `{ user: UserProfile, token: string, refreshToken: string }` | 注册，密码强度要求 8 位以上含字母数字 |
| `POST` | `/auth/login` | `{ email: string, password: string }` | `{ user: UserProfile, token: string, refreshToken: string }` | 登录 |
| `POST` | `/auth/refresh` | `{ refreshToken: string }` | `{ token: string, refreshToken: string }` | 刷新 Access Token（Refresh Token 7 天有效） |
| `POST` | `/auth/logout` | — | `{ success: boolean }` | 将 Refresh Token 加入 Redis 黑名单 |

---

## 3. 用户模块（User）

> ⭐ Phase 1 必需

| Method | Path | Request | Response | 说明 |
|--------|------|---------|----------|------|
| `GET` | `/users/me` | — | `UserProfile` | 当前用户信息 |
| `PATCH` | `/users/me` | `{ displayName?: string, avatarUrl?: string }` | `UserProfile` | 更新 profile |
| `GET` | `/users/me/interests` | — | `{ interests: Interest[] }` | 获取兴趣标签列表 |
| `POST` | `/users/me/interests` | `{ keyword: string }` | `Interest` | 添加兴趣标签（去重，重复返回 409） |
| `DELETE` | `/users/me/interests/:id` | — | `{ success: boolean }` | 删除兴趣标签 |
| `GET` | `/users/me/settings` | — | `UserSettings` | 获取推送/语言设置 |
| `PATCH` | `/users/me/settings` | `{ pushMorning?: boolean, pushEvening?: boolean, pushInstant?: boolean, languageUi?: string }` | `UserSettings` | 更新设置 |
| `GET` | `/users/me/stats` | `?from=YYYY-MM-DD&to=YYYY-MM-DD` | `{ stats: ReadingStat[] }` | 阅读统计（晚间简报数据源） |

---

## 4. 论文模块（Paper）

> ⭐ Phase 1 必需（核心模块）

| Method | Path | Request | Response | 说明 |
|--------|------|---------|----------|------|
| `GET` | `/papers` | `?page=&limit=&status=&favorite=&q=` | `PaginatedResponse<PaperMeta>` | 论文列表，支持标题/作者/摘要模糊搜索 |
| `POST` | `/papers` | `{ title: string, authors: Author[], abstract?: string, sourceUrl?: string, arxivId?: string }` | `PaperMeta` | 手动创建论文元数据（如已知 arXiv ID） |
| `GET` | `/papers/:id` | — | `PaperDetail` | 论文详情（含解析状态、文件信息） |
| `DELETE` | `/papers/:id` | — | `{ success: boolean }` | 软删除（`deleted_at` 标记） |
| `POST` | `/papers/upload-complete` | `{ objectKey: string, filename: string, size: number, mimeType: string }` | `{ paper: PaperMeta }` | 前端直传 MinIO 完成后通知后端创建记录 |
| `GET` | `/papers/:id/download` | — | `302 Redirect` → presigned URL | 下载原 PDF（1 小时有效） |
| `POST` | `/papers/:id/reparse` | — | `{ jobId: string }` | 重新触发解析任务 |
| `POST` | `/papers/:id/translate` | `{ targetLang?: string }` | `{ paperId: string, status: string }` | 触发全文翻译（异步，通过 SSE 通知进度） |
| `PATCH` | `/papers/:id/progress` | `{ progress: number }` | `PaperMeta` | 更新阅读进度（0~1 浮点数） |
| `POST` | `/papers/:id/favorite` | `{ isFavorite: boolean }` | `PaperMeta` | 收藏/取消收藏 |

**说明：**
- `upload-complete` 替代传统文件上传接口，前端先通过 `/files/presign-upload` 获取直传 URL，上传完成后调此接口。
- `status` 查询参数支持：`UPLOADED`, `QUEUED`, `PARSING`, `PARSED`, `FAILED`。

---

## 5. 阅读室模块（Reading）

> ⭐ Phase 1 必需（核心模块）

### 5.1 语义块

| Method | Path | Request | Response | 说明 |
|--------|------|---------|----------|------|
| `GET` | `/papers/:id/blocks` | `?page=&limit=` | `PaginatedResponse<SemanticBlock>` | 获取语义块（原文+译文），按 `blockIndex` 排序 |
| `GET` | `/papers/:id/blocks/:blockId` | — | `SemanticBlock` | 单个语义块详情 |

### 5.2 标注

| Method | Path | Request | Response | 说明 |
|--------|------|---------|----------|------|
| `GET` | `/papers/:id/annotations` | `?type=` | `{ list: Annotation[] }` | 获取标注，支持按 `ALGORITHM/CONCEPT/DATASET_METRIC/CITATION/CODE_TOOL` 过滤 |
| `POST` | `/papers/:id/annotations` | `{ type: AnnotationType, text: string, label?: string, definition?: string, evidence?: EvidenceItem[], blockId?: string }` | `Annotation` | 用户添加/纠正标注 |
| `DELETE` | `/papers/:id/annotations/:annotationId` | — | `{ success: boolean }` | 删除标注（用户自建的可删，Agent 提取的不可删，只可纠正） |

### 5.3 图表

| Method | Path | Request | Response | 说明 |
|--------|------|---------|----------|------|
| `GET` | `/papers/:id/figures` | — | `{ list: Figure[] }` | 获取图表列表 |
| `GET` | `/papers/:id/figures/:figureId` | — | `FigureDetail` | 图表详情（含 AI 解读） |
| `GET` | `/papers/:id/figures/:figureId/image` | `?size=original|thumb` | `image/*` | 获取图表图片（MinIO presigned URL 302 跳转） |

### 5.4 方法卡片

| Method | Path | Request | Response | 说明 |
|--------|------|---------|----------|------|
| `GET` | `/papers/:id/method-cards` | — | `{ list: MethodCard[] }` | 获取方法卡片列表 |
| `PATCH` | `/papers/:id/method-cards/:cardId` | `{ name?: string, metrics?: Metric[], evidence?: EvidenceItem[] }` | `MethodCard` | 用户纠正方法卡片 |

### 5.5 Q&A（选中再聊）

| Method | Path | Request | Response | 说明 |
|--------|------|---------|----------|------|
| `GET` | `/papers/:id/qas` | `?sessionId=` | `{ list: PaperQA[], sessions: QASession[] }` | 获取 Q&A 历史，按 session 分组 |
| `POST` | `/papers/:id/qas` | `{ question: string, selectedText?: string, surroundingBlockIds?: string[], sessionId?: string }` | `{ answer: string, sessionId: string, citations?: Citation[] }` | 提问（无 `sessionId` 则创建新会话） |
| `POST` | `/papers/:id/qas/:qaId/feedback` | `{ isHelpful: boolean, correction?: string }` | `{ success: boolean }` | 反馈有用 ✓ / 纠正 ✕ |

### 5.6 笔记

| Method | Path | Request | Response | 说明 |
|--------|------|---------|----------|------|
| `GET` | `/papers/:id/notes` | — | `{ list: Note[] }` | 获取笔记列表 |
| `POST` | `/papers/:id/notes` | `{ content: string, blockId?: string, color?: string }` | `Note` | 添加笔记 |
| `PATCH` | `/papers/:id/notes/:noteId` | `{ content?: string, color?: string }` | `Note` | 更新笔记 |
| `DELETE` | `/papers/:id/notes/:noteId` | — | `{ success: boolean }` | 删除笔记 |

### 5.7 大纲与档案

| Method | Path | Request | Response | 说明 |
|--------|------|---------|----------|------|
| `GET` | `/papers/:id/outline` | — | `{ chapters: OutlineNode[] }` | 获取章节大纲树（基于 `HEADING` 类型语义块构建） |
| `GET` | `/papers/:id/archive` | — | `ReadingArchive` | 论文理解档案（API 聚合：方法卡片 + Q&A + 笔记 + 标注 + Agent 日志） |

---

## 6. AI 对话模块（Chat）

> ⭐ Phase 1 必需（选中再聊核心依赖）

| Method | Path | Request | Response | 说明 |
|--------|------|---------|----------|------|
| `POST` | `/chat/paper` | `{ paperId: string, question: string, selectedText?: string, surroundingBlockIds?: string[], sessionId?: string, stream?: boolean }` | `SSE Stream` 或 `{ reply: string, sessionId: string, citations?: Citation[] }` | **单篇论文对话**（上下文自动组装：论文摘要 + 选中文字 + 邻近段落 + 标注） |
| `POST` | `/chat/project` | `🔒 Phase 3` `{ projectId: string, question: string, isWebMode?: boolean, sessionId?: string, stream?: boolean }` | `SSE Stream` 或 `{ reply: string, sessionId: string, citations?: Citation[] }` | **项目问答**（范围锁定在项目内论文，`isWebMode=true` 时扩展全网） |

**流式响应说明：**
- `stream=true` 时返回 `Content-Type: text/event-stream`
- 前端通过 SSE `chat:delta` 事件逐字接收，`chat:done` 事件标识结束
- `citations` 格式：`[{ paperId, paperIndex: number, blockId, excerpt }]`，前端渲染为上标 `[n]` 可点击跳转

---

## 7. 项目模块（Project）

> 🔒 Phase 3 必需（多篇整理）

| Method | Path | Request | Response | 说明 |
|--------|------|---------|----------|------|
| `GET` | `/projects` | — | `{ list: Project[] }` | 项目列表 |
| `POST` | `/projects` | `{ name: string, description?: string, topicTags?: string[] }` | `Project` | 创建项目 |
| `GET` | `/projects/:id` | — | `ProjectDetail` | 项目详情（含论文列表、对比矩阵、时间线） |
| `PATCH` | `/projects/:id` | `{ name?: string, description?: string, settings?: object }` | `Project` | 更新项目 |
| `DELETE` | `/projects/:id` | — | `{ success: boolean }` | 删除项目 |
| `POST` | `/projects/:id/papers` | `{ paperId: string }` | `ProjectPaper` | 添加论文到项目 |
| `DELETE` | `/projects/:id/papers/:paperId` | — | `{ success: boolean }` | 从项目移除论文 |
| `PATCH` | `/projects/:id/papers/:paperId/order` | `{ sortOrder: number }` | `{ success: boolean }` | 调整论文排序 |

---

## 8. 对比矩阵模块（Matrix）

> 🔒 Phase 3 必需

| Method | Path | Request | Response | 说明 |
|--------|------|---------|----------|------|
| `GET` | `/projects/:id/matrix` | — | `ComparisonMatrix` | 获取对比矩阵（列定义 + 单元格数据） |
| `POST` | `/projects/:id/matrix/columns` | `{ key: string, label: string, type: 'TEXT'|'NUMBER'|'BOOLEAN'|'URL', source?: 'PRESET'|'AGENT'|'USER' }` | `MatrixColumn` | 添加列（Agent 自定义列走此接口，前端传自然语言需求，后端调 AI 解析后写入） |
| `DELETE` | `/projects/:id/matrix/columns/:key` | — | `{ success: boolean }` | 删除列（仅 USER/AGENT 来源可删，PRESET 不可删） |
| `PATCH` | `/projects/:id/matrix/cells` | `{ paperId: string, columnKey: string, value?: string, rawValue?: any, evidence?: EvidenceItem[] }` | `MatrixCell` | 更新单元格（用户纠正） |
| `GET` | `/projects/:id/matrix/cells/:cellId/evidence` | — | `EvidenceDrawer` | 获取证据抽屉（定位原文/图表/原图） |
| `POST` | `/projects/:id/matrix/export` | `{ format: 'CSV'|'MD'|'PNG' }` | `{ downloadUrl: string }` | 导出对比矩阵 |

---

## 9. 方法演进模块（Timeline）

> 🔒 Phase 3 必需

| Method | Path | Request | Response | 说明 |
|--------|------|---------|----------|------|
| `GET` | `/projects/:id/timeline` | — | `{ nodes: TimelineNode[], edges: TimelineEdge[] }` | 获取方法演进时间线 |
| `POST` | `/projects/:id/timeline/nodes` | `{ methodName: string, paperId: string, year: number, summary?: string, improvements?: Improvement[] }` | `TimelineNode` | 添加时间线节点 |
| `POST` | `/projects/:id/timeline/edges` | `{ fromNodeId: string, toNodeId: string, label?: string }` | `TimelineEdge` | 添加节点间连线（改进关系） |
| `DELETE` | `/projects/:id/timeline/nodes/:nodeId` | — | `{ success: boolean }` | 删除节点 |

---

## 10. 简报模块（Briefing）

> 🔒 Phase 2 必需（推送引擎）

| Method | Path | Request | Response | 说明 |
|--------|------|---------|----------|------|
| `GET` | `/briefings` | `?type=MORNING|EVENING&date=YYYY-MM-DD&page=&limit=` | `PaginatedResponse<Briefing>` | 简报列表 |
| `GET` | `/briefings/today` | — | `{ morning?: Briefing, evening?: Briefing }` | 今日简报聚合 |
| `GET` | `/briefings/:id` | — | `BriefingDetail` | 简报详情 |
| `POST` | `/briefings/:id/read` | — | `{ success: boolean }` | 标记已读 |
| `POST` | `/briefings/generate` | `{ type: 'MORNING'|'EVENING' }` | `{ briefingId: string, status: string }` | 手动触发简报生成（异步，SSE 通知完成） |

---

## 11. 术语/知识库模块（Term）

> ⭐ Phase 1 必需（Hover 气泡核心）

| Method | Path | Request | Response | 说明 |
|--------|------|---------|----------|------|
| `GET` | `/terms` | `?q=string&type=ALGORITHM|CONCEPT|...` | `{ list: TermDefinition[] }` | 术语搜索（前缀匹配 + 别名匹配） |
| `GET` | `/terms/:term` | — | `TermDefinition` | 术语详情（精确匹配） |
| `POST` | `/terms` | `{ term: string, definition: string, category?: AnnotationType, aliases?: string[] }` | `TermDefinition` | 用户添加/纠正术语（反哺知识库） |
| `POST` | `/terms/search/semantic` | `{ query: string, topK?: number }` | `{ list: TermDefinition[] }` | 语义搜索术语（向量相似度） |

---

## 12. 文件/存储模块（File）

> ⭐ Phase 1 必需

| Method | Path | Request | Response | 说明 |
|--------|------|---------|----------|------|
| `POST` | `/files/presign-upload` | `{ filename: string, mimeType: string, size: number }` | `{ presignedUrl: string, objectKey: string, publicUrl: string }` | 获取直传 MinIO 的预签名 URL（15 分钟有效） |
| `POST` | `/files/presign-download` | `{ objectKey: string }` | `{ presignedUrl: string }` | 获取预签名下载 URL（1 小时有效） |

---

## 13. 类型定义（TypeScript 共享）

以下类型应维护在 `packages/shared-types` 或 `apps/web/src/types/api.ts`，后端通过 `prisma generate` 获得精确类型。

```typescript
// ==================== 通用 ====================
interface ApiResponse<T> {
  code: number;
  data: T;
  message: string;
  requestId: string;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

interface PaginatedResponse<T> {
  list: T[];
  pagination: Pagination;
}

// ==================== 用户域 ====================
interface UserProfile {
  id: string;
  email: string;
  displayName: string | null;
  avatarUrl: string | null;
  role: 'USER' | 'ADMIN';
  plan: 'FREE' | 'PRO';
  createdAt: string;
}

interface Interest {
  id: string;
  keyword: string;
  weight: number;
  source: 'MANUAL' | 'AUTO_RECOMMENDED';
}

interface UserSettings {
  pushMorning: boolean;
  pushEvening: boolean;
  pushInstant: boolean;
  languageUi: string;
  languageTranslate: string;
}

interface ReadingStat {
  date: string;
  papersCount: number;
  questionsCount: number;
  notesCount: number;
  correctionsCount: number;
  readingMinutes: number;
  continuousDays: number;
}

// ==================== 论文域 ====================
interface Author {
  name: string;
  affiliation?: string;
}

interface PaperMeta {
  id: string;
  title: string;
  titleTranslated?: string;
  authors: Author[];
  sourceType: 'ARXIV' | 'UPLOAD' | 'MANUAL';
  sourceUrl?: string;
  arxivId?: string;
  parseStatus: 'UPLOADED' | 'QUEUED' | 'PARSING' | 'PARSED' | 'FAILED';
  parseError?: string;
  readingProgress: number;
  isFavorite: boolean;
  createdAt: string;
}

interface PaperDetail extends PaperMeta {
  abstract?: string;
  abstractTranslated?: string;
  doi?: string;
  publishedAt?: string;
  fileInfo: {
    objectKey: string;
    fileSize: number;
    mimeType: string;
  };
  methodSummary?: {
    methods: Array<{
      name: string;
      dataset?: string;
      metric?: string;
      value?: string;
    }>;
  };
}

// ==================== 阅读室域 ====================
interface SemanticBlock {
  id: string;
  blockIndex: number;
  blockType: 'PARAGRAPH' | 'HEADING' | 'FORMULA' | 'CAPTION';
  level?: number;
  content: string;
  translation?: string;
  pageNumber?: number;
  bbox?: { x: number; y: number; w: number; h: number };
}

type AnnotationType = 'ALGORITHM' | 'CONCEPT' | 'DATASET_METRIC' | 'CITATION' | 'CODE_TOOL';

interface EvidenceItem {
  type: 'TEXT' | 'FIGURE' | 'TABLE';
  blockId?: string;
  figureId?: string;
  excerpt: string;
}

interface Annotation {
  id: string;
  type: AnnotationType;
  text: string;
  label?: string;
  definition?: string;
  evidence?: EvidenceItem[];
  createdBy: 'AGENT' | 'USER';
  userId?: string;
  createdAt: string;
}

interface Figure {
  id: string;
  figureIndex: number;
  caption?: string;
  captionTranslated?: string;
  thumbUrl: string;
  aiAnalysis?: string;
  pageNumber?: number;
}

interface FigureDetail extends Figure {
  imageUrl: string;
  bbox?: { x: number; y: number; w: number; h: number };
}

interface Metric {
  name: string;
  value: number | string;
  unit?: string;
}

interface MethodCard {
  id: string;
  name: string;
  category?: string;
  backbone?: string;
  datasets: Array<{ name: string; splits?: string }>;
  metrics: Metric[];
  paramsCount?: string;
  isCodeAvailable?: boolean;
  codeUrl?: string;
  evidence?: EvidenceItem[];
  createdBy: 'AGENT' | 'USER';
}

interface PaperQA {
  id: string;
  sessionId: string;
  question: string;
  answer: string;
  context?: {
    selectedText?: string;
    surroundingBlockIds?: string[];
  };
  isHelpful?: boolean;
  correction?: string;
  createdAt: string;
}

interface Note {
  id: string;
  content: string;
  blockId?: string;
  color: string;
  createdAt: string;
  updatedAt: string;
}

interface OutlineNode {
  id: string;
  blockId: string;
  title: string;
  level: number;
  children?: OutlineNode[];
}

interface ReadingArchive {
  paperId: string;
  methodCards: MethodCard[];
  qaCount: number;
  noteCount: number;
  annotationCount: number;
  agentLogs: Array<{
    agentType: string;
    action: string;
    createdAt: string;
  }>;
}

// ==================== AI 对话域 ====================
interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface Citation {
  paperId: string;
  paperIndex: number;
  blockId?: string;
  excerpt: string;
}

// ==================== 项目域 ====================
interface Project {
  id: string;
  name: string;
  description?: string;
  topicTags: string[];
  paperCount: number;
  createdAt: string;
}

interface ProjectDetail extends Project {
  papers: PaperMeta[];
  matrix?: ComparisonMatrix;
  timeline?: { nodes: TimelineNode[]; edges: TimelineEdge[] };
}

interface ProjectPaper {
  id: string;
  paperId: string;
  sortOrder: number;
  addedAt: string;
}

// ==================== 对比矩阵域 ====================
interface MatrixColumn {
  key: string;
  label: string;
  type: 'TEXT' | 'NUMBER' | 'BOOLEAN' | 'URL';
  source: 'PRESET' | 'AGENT' | 'USER';
}

interface MatrixCell {
  id: string;
  paperId: string;
  columnKey: string;
  value?: string;
  rawValue?: unknown;
  evidence?: EvidenceItem[];
  isConflict: boolean;
  conflictReason?: string;
  isUserCorrected: boolean;
  correctedAt?: string;
}

interface ComparisonMatrix {
  id: string;
  columns: MatrixColumn[];
  cells: MatrixCell[];
}

interface EvidenceDrawer {
  cell: MatrixCell;
  paper: PaperMeta;
  sourceBlocks: SemanticBlock[];
  sourceFigures: Figure[];
}

interface Conflict {
  cellId: string;
  paperId: string;
  columnKey: string;
  detectedValue: string;
  conflictingValue: string;
  reason: string;
}

// ==================== 方法演进域 ====================
interface TimelineNode {
  id: string;
  methodName: string;
  paperId: string;
  year: number;
  summary?: string;
  improvements: Array<{
    aspect: string;
    description: string;
  }>;
}

interface TimelineEdge {
  id: string;
  fromNodeId: string;
  toNodeId: string;
  label?: string;
}

// ==================== 简报域 ====================
interface Briefing {
  id: string;
  type: 'MORNING' | 'EVENING';
  title: string;
  generatedAt: string;
  isRead: boolean;
}

interface BriefingDetail extends Briefing {
  content: {
    stats?: {
      papersRead: number;
      questions: number;
      notes: number;
      readingMinutes: number;
    };
    trends?: {
      chartData: Array<{ date: string; count: number }>;
      insight: string;
    };
    recommendations?: Array<{
      paperId: string;
      reason: string;
    }>;
    previews?: Array<{
      event: string;
      time: string;
    }>;
    paperCards?: Array<{
      paperId: string;
      title: string;
      aiSummary: string;
      relevance: 'HIGH' | 'MAYBE';
    }>;
  };
}

// ==================== 术语域 ====================
interface TermDefinition {
  id: string;
  term: string;
  definition: string;
  category?: AnnotationType;
  sourcePaperId?: string;
  aliases: string[];
  usageCount: number;
}
```

---

## 14. Phase 接口优先级速查

| 模块 | Phase 1 | Phase 2 | Phase 3 |
|------|---------|---------|---------|
| Auth | ✅ 全部 | — | — |
| User | ✅ 全部 | — | — |
| Paper | ✅ 全部 | — | — |
| Reading | ✅ 全部 | — | — |
| Chat | ✅ `/chat/paper` | — | 🔒 `/chat/project` |
| Term | ✅ 全部 | — | — |
| File | ✅ 全部 | — | — |
| Briefing | — | ✅ 全部 | — |
| Project | — | — | ✅ 全部 |
| Matrix | — | — | ✅ 全部 |
| Timeline | — | — | ✅ 全部 |

---

> **维护约定：** 本文档为前后端唯一接口契约来源。后端实现使用 NestJS Swagger 自动导出 OpenAPI JSON，前端使用 `openapi-typescript` 生成类型，确保运行时与契约一致。
