# PaperLens 数据模型设计

> 版本：v1.1  
> 日期：2026-06-10  
> 数据库：PostgreSQL 15+ with pgvector  
> ORM：Prisma  
> 设计目标：**支持 MVP 全功能，表数量控制在 18 张以内，减少认知负担**

---

## 1. 设计原则

1. **JSONB 替代 MongoDB**：半结构化数据（论文作者信息、Agent 日志、对比矩阵列定义、文件元数据）使用 PostgreSQL JSONB，配合 GIN 索引查询，**减少一套数据库运维**。
2. **向量与业务同库**：embedding 使用 `vector(1536)`（默认 OpenAI text-embedding-3-small，可配置），建 `hnsw` 索引，支持 SQL + 向量 JOIN 的混合查询。
3. **软删除为主**：`deleted_at` 字段实现逻辑删除，满足用户隐私"可恢复 + 可彻底删除"需求；物理清理由后台定时任务执行。
4. **不写聚合缓存表**：`reading_archives` 等聚合视图由 API 层实时查询组装，MVP 阶段不引入物化视图或缓存表，降低 Schema 复杂度。数据量大时再通过物化视图或 Redis 缓存优化。
5. **预留分区扩展**：`agent_logs`、`semantic_blocks` 数据量大，当前版本不做分区，但主键和索引设计兼容未来按 `created_at` 或 `paper_id` 分区。

---

## 2. 实体关系总览

```
users
 ├── user_interests (1:N)
 ├── user_settings (1:1)
 ├── papers (1:N)
 │    ├── semantic_blocks (1:N)
 │    ├── annotations (1:N)
 │    ├── figures (1:N)
 │    ├── method_cards (1:N)
 │    ├── paper_qas (1:N)
 │    ├── notes (1:N)
 │    └── paper_files (1:1, 已合并到 papers.file_info)
 ├── projects (1:N)
 │    ├── project_papers (N:M)
 │    ├── comparison_matrices (1:1)
 │    │    └── matrix_cells (1:N)
 │    ├── method_timelines (1:N)
 │    └── project_qas (1:N)
 ├── briefings (1:N)
 ├── reading_list (1:N) -- 待读/收藏/忽略
 ├── reading_stats (1:N)
 ├── agent_logs (1:N)
 └── term_definitions (全局知识库, N:M 间接)
```

---

## 3. SQL DDL

```sql
-- ============================================
-- 扩展
-- ============================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "vector";

-- ============================================
-- 枚举类型
-- ============================================
CREATE TYPE annotation_type AS ENUM (
  'ALGORITHM',      -- 算法/模型
  'CONCEPT',        -- 概念/术语
  'DATASET_METRIC', -- 数据集/指标
  'CITATION',       -- 引用
  'CODE_TOOL'       -- 代码/工具
);

CREATE TYPE briefing_type AS ENUM ('MORNING', 'EVENING');
CREATE TYPE parse_status AS ENUM ('UPLOADED', 'QUEUED', 'PARSING', 'PARSED', 'FAILED');

-- ============================================
-- 用户域
-- ============================================
CREATE TABLE users (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email         VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  display_name  VARCHAR(100),
  avatar_url    TEXT,
  role          VARCHAR(20) DEFAULT 'USER',   -- USER, ADMIN
  plan          VARCHAR(20) DEFAULT 'FREE',   -- FREE, PRO
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE user_interests (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  keyword    VARCHAR(100) NOT NULL,
  weight     FLOAT DEFAULT 1.0,                 -- 预留兴趣算法
  source     VARCHAR(20) DEFAULT 'MANUAL',      -- MANUAL, AUTO_RECOMMENDED
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, keyword)
);

CREATE TABLE user_settings (
  user_id            UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  push_morning       BOOLEAN DEFAULT TRUE,
  push_evening       BOOLEAN DEFAULT TRUE,
  push_instant       BOOLEAN DEFAULT FALSE,
  language_ui        VARCHAR(10) DEFAULT 'zh-CN',
  language_translate VARCHAR(10) DEFAULT 'zh',
  updated_at         TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 论文域
-- ============================================
CREATE TABLE papers (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id           UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title             TEXT NOT NULL,
  title_translated  TEXT,
  authors           JSONB NOT NULL DEFAULT '[]',    -- [{name, affiliation}]
  abstract          TEXT,
  abstract_translated TEXT,
  source_type       VARCHAR(20) DEFAULT 'ARXIV',    -- ARXIV, UPLOAD, MANUAL
  source_url        TEXT,
  arxiv_id          VARCHAR(50),
  doi               VARCHAR(100),
  published_at      DATE,
  parse_status      parse_status DEFAULT 'UPLOADED',
  parse_error       TEXT,
  file_info         JSONB,                          -- {bucket, objectKey, fileSize, mimeType, checksum}
  is_favorite       BOOLEAN DEFAULT FALSE,
  is_ignored        BOOLEAN DEFAULT FALSE,
  reading_progress  FLOAT DEFAULT 0,                -- 0~1
  method_summary    JSONB,                          -- {methods: [{name, dataset, metric, value}]}
  deleted_at        TIMESTAMPTZ,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_papers_user_id ON papers(user_id);
CREATE INDEX idx_papers_parse_status ON papers(parse_status);
CREATE INDEX idx_papers_deleted_at ON papers(deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX idx_papers_arxiv_id ON papers(arxiv_id) WHERE arxiv_id IS NOT NULL;
CREATE INDEX idx_papers_user_created ON papers(user_id, created_at DESC);

-- 语义块（原文-译文锚定最小单元）
CREATE TABLE semantic_blocks (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  paper_id     UUID NOT NULL REFERENCES papers(id) ON DELETE CASCADE,
  block_index  INT NOT NULL,                       -- 论文内顺序
  block_type   VARCHAR(20) NOT NULL,               -- PARAGRAPH, HEADING, FORMULA, CAPTION
  level        INT,                                -- 标题层级 H1=1, H2=2...
  content      TEXT NOT NULL,                      -- 原文
  translation  TEXT,                               -- 译文（异步回填）
  page_number  INT,
  bbox         JSONB,                              -- 页内坐标 {x, y, w, h}
  embedding    VECTOR(1536),                       -- 语义向量（默认 1536 维，可配置）
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(paper_id, block_index)
);
CREATE INDEX idx_semantic_blocks_paper_id ON semantic_blocks(paper_id);
CREATE INDEX idx_semantic_blocks_embedding ON semantic_blocks USING hnsw (embedding vector_cosine_ops);
-- 注：hnsw 索引在数据量 < 1 万时可暂不创建，导入数据后再建以减少写入开销

-- 特别标注
CREATE TABLE annotations (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  paper_id     UUID NOT NULL REFERENCES papers(id) ON DELETE CASCADE,
  block_id     UUID REFERENCES semantic_blocks(id) ON DELETE SET NULL,
  type         annotation_type NOT NULL,
  text         TEXT NOT NULL,
  label        VARCHAR(100),                       -- 标准化名称
  definition   TEXT,                               -- 简要定义（Hover 气泡）
  evidence     JSONB DEFAULT '[]',                 -- 证据链 [{block_id, excerpt}]
  created_by   VARCHAR(20) DEFAULT 'AGENT',        -- AGENT, USER
  user_id      UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_annotations_paper_id ON annotations(paper_id);
CREATE INDEX idx_annotations_type ON annotations(type);
CREATE INDEX idx_annotations_label ON annotations(label);
CREATE INDEX idx_annotations_paper_type ON annotations(paper_id, type);

-- 图表
CREATE TABLE figures (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  paper_id         UUID NOT NULL REFERENCES papers(id) ON DELETE CASCADE,
  figure_index     INT NOT NULL,
  caption          TEXT,
  caption_translated TEXT,
  object_key       VARCHAR(255) NOT NULL,          -- MinIO 原图路径
  thumb_object_key VARCHAR(255),                   -- 缩略图路径
  ai_analysis      TEXT,
  page_number      INT,
  bbox             JSONB,
  embedding        VECTOR(1536),
  created_at       TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_figures_paper_id ON figures(paper_id);

-- 方法卡片
CREATE TABLE method_cards (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  paper_id          UUID NOT NULL REFERENCES papers(id) ON DELETE CASCADE,
  name              VARCHAR(200) NOT NULL,
  category          VARCHAR(100),
  backbone          VARCHAR(100),
  datasets          JSONB DEFAULT '[]',
  metrics           JSONB DEFAULT '[]',
  params_count      VARCHAR(50),
  is_code_available BOOLEAN,
  code_url          TEXT,
  evidence          JSONB DEFAULT '[]',
  created_by        VARCHAR(20) DEFAULT 'AGENT',
  user_id           UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_method_cards_paper_id ON method_cards(paper_id);

-- 论文 Q&A
CREATE TABLE paper_qas (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  paper_id     UUID NOT NULL REFERENCES papers(id) ON DELETE CASCADE,
  user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  session_id   UUID NOT NULL,
  question     TEXT NOT NULL,
  answer       TEXT NOT NULL,
  context      JSONB,                              -- {selected_text, surrounding_block_ids, annotations}
  is_helpful   BOOLEAN,
  correction   TEXT,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_paper_qas_paper_id ON paper_qas(paper_id);
CREATE INDEX idx_paper_qas_session_id ON paper_qas(session_id);

-- 笔记
CREATE TABLE notes (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  paper_id   UUID NOT NULL REFERENCES papers(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  block_id   UUID REFERENCES semantic_blocks(id) ON DELETE SET NULL,
  content    TEXT NOT NULL,
  color      VARCHAR(20) DEFAULT 'YELLOW',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_notes_paper_id ON notes(paper_id);
CREATE INDEX idx_notes_user_paper ON notes(user_id, paper_id);

-- ============================================
-- 项目域
-- ============================================
CREATE TABLE projects (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name         VARCHAR(200) NOT NULL,
  description  TEXT,
  topic_tags   JSONB DEFAULT '[]',
  settings     JSONB DEFAULT '{}',                 -- {default_columns: []}
  deleted_at   TIMESTAMPTZ,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_projects_user_id ON projects(user_id);
CREATE INDEX idx_projects_deleted_at ON projects(deleted_at) WHERE deleted_at IS NULL;

CREATE TABLE project_papers (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  paper_id   UUID NOT NULL REFERENCES papers(id) ON DELETE CASCADE,
  sort_order INT DEFAULT 0,
  added_at   TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(project_id, paper_id)
);
CREATE INDEX idx_project_papers_project_id ON project_papers(project_id);
CREATE INDEX idx_project_papers_paper_id ON project_papers(paper_id);

-- 对比矩阵（1:1 对应项目）
CREATE TABLE comparison_matrices (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id            UUID NOT NULL UNIQUE REFERENCES projects(id) ON DELETE CASCADE,
  columns               JSONB NOT NULL DEFAULT '[]',   -- 列定义 [{key, label, type, source}]
  is_auto_detect_conflict BOOLEAN DEFAULT TRUE,
  created_at            TIMESTAMPTZ DEFAULT NOW(),
  updated_at            TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE matrix_cells (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  matrix_id         UUID NOT NULL REFERENCES comparison_matrices(id) ON DELETE CASCADE,
  paper_id          UUID NOT NULL REFERENCES papers(id) ON DELETE CASCADE,
  column_key        VARCHAR(100) NOT NULL,
  value             TEXT,
  raw_value         JSONB,                           -- 保留原始类型
  evidence          JSONB DEFAULT '[]',
  is_conflict       BOOLEAN DEFAULT FALSE,
  conflict_reason   TEXT,
  is_user_corrected BOOLEAN DEFAULT FALSE,
  corrected_by      UUID REFERENCES users(id) ON DELETE SET NULL,
  corrected_at      TIMESTAMPTZ,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(matrix_id, paper_id, column_key)
);
CREATE INDEX idx_matrix_cells_matrix_id ON matrix_cells(matrix_id);
CREATE INDEX idx_matrix_cells_paper_id ON matrix_cells(paper_id);
CREATE INDEX idx_matrix_cells_conflict ON matrix_cells(matrix_id, is_conflict) WHERE is_conflict = TRUE;

-- 方法演进时间线（含连线信息，减少一张边表）
CREATE TABLE method_timelines (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id    UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  method_name   VARCHAR(200) NOT NULL,
  paper_id      UUID NOT NULL REFERENCES papers(id) ON DELETE CASCADE,
  year          INT NOT NULL,
  node_index    INT NOT NULL,                        -- 时间线显示顺序
  summary       TEXT,
  improvements  JSONB DEFAULT '[]',                  -- [{aspect, description}]
  evidence      JSONB,
  next_nodes    JSONB DEFAULT '[]',                  -- [{node_id, label}] 简化边表
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(project_id, node_index)
);
CREATE INDEX idx_method_timelines_project_id ON method_timelines(project_id);
CREATE INDEX idx_method_timelines_project_year ON method_timelines(project_id, year);

-- 项目问答
CREATE TABLE project_qas (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id   UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  session_id   UUID NOT NULL,
  question     TEXT NOT NULL,
  answer       TEXT NOT NULL,
  citations    JSONB DEFAULT '[]',                   -- [{paper_id, paper_index, block_id}]
  is_web_mode  BOOLEAN DEFAULT FALSE,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_project_qas_project_id ON project_qas(project_id);
CREATE INDEX idx_project_qas_session_id ON project_qas(session_id);

-- ============================================
-- 推送域
-- ============================================
CREATE TABLE briefings (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type         briefing_type NOT NULL,
  title        VARCHAR(255) NOT NULL,
  generated_at TIMESTAMPTZ DEFAULT NOW(),
  is_read      BOOLEAN DEFAULT FALSE,
  content      JSONB NOT NULL,                       -- 整存简报内容，见下方说明
  created_at   TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_briefings_user_id_type ON briefings(user_id, type);
CREATE INDEX idx_briefings_generated_at ON briefings(generated_at DESC);

/*
content JSONB 结构示例：
{
  "paperCards": [
    {"paperId": "...", "title": "...", "aiSummary": "...", "relevance": "HIGH"}
  ],
  "stats": {"papersRead": 3, "questions": 5, "notes": 2, "readingMinutes": 45},
  "trends": {"chartData": [{"date": "...", "count": 3}], "insight": "..."},
  "recommendations": [{"paperId": "...", "reason": "..."}],
  "previews": [{"event": "CVPR 2026", "time": "2026-06-11T09:00:00Z"}]
}
*/

-- 待读清单（收藏/忽略的统一管理）
CREATE TABLE reading_list (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id        UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  paper_id       UUID NOT NULL REFERENCES papers(id) ON DELETE CASCADE,
  status         VARCHAR(20) DEFAULT 'SAVED',        -- SAVED, DONE, IGNORED
  ignored_until  TIMESTAMPTZ,                        -- 预留撤销窗口
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  updated_at     TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, paper_id)
);
CREATE INDEX idx_reading_list_user_status ON reading_list(user_id, status);

-- ============================================
-- 阅读统计（晚间简报数据源）
-- ============================================
CREATE TABLE reading_stats (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id           UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date              DATE NOT NULL,
  papers_count      INT DEFAULT 0,
  questions_count   INT DEFAULT 0,
  notes_count       INT DEFAULT 0,
  corrections_count INT DEFAULT 0,
  reading_minutes   INT DEFAULT 0,
  continuous_days   INT DEFAULT 0,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, date)
);
CREATE INDEX idx_reading_stats_user_date ON reading_stats(user_id, date);

-- ============================================
-- 知识库与 Agent 域
-- ============================================
CREATE TABLE term_definitions (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  term            VARCHAR(200) NOT NULL UNIQUE,
  definition      TEXT NOT NULL,
  category        annotation_type,
  source_paper_id UUID REFERENCES papers(id) ON DELETE SET NULL,
  aliases         JSONB DEFAULT '[]',
  embedding       VECTOR(1536),
  usage_count     INT DEFAULT 1,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_term_definitions_term ON term_definitions(term);
CREATE INDEX idx_term_definitions_embedding ON term_definitions USING hnsw (embedding vector_cosine_ops);

-- Agent 行为日志（全链路审计）
CREATE TABLE agent_logs (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id        UUID REFERENCES users(id) ON DELETE SET NULL,
  paper_id       UUID REFERENCES papers(id) ON DELETE SET NULL,
  project_id     UUID REFERENCES projects(id) ON DELETE SET NULL,
  agent_type     VARCHAR(50) NOT NULL,              -- PARSER, TRANSLATOR, ANNOTATOR...
  action         VARCHAR(50) NOT NULL,              -- EXTRACT, TRANSLATE, ANSWER...
  input_summary  TEXT,
  output_summary TEXT,
  metadata       JSONB,                             -- {prompt, tokens, model, latency}
  latency_ms     INT,
  cost_estimate  FLOAT,                             -- 估算成本（元）
  is_success     BOOLEAN DEFAULT TRUE,
  error_message  TEXT,
  created_at     TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_agent_logs_user_id ON agent_logs(user_id);
CREATE INDEX idx_agent_logs_paper_id ON agent_logs(paper_id);
CREATE INDEX idx_agent_logs_created_at ON agent_logs(created_at);
```

---

## 4. 关键表设计说明

| 表名 | 设计意图 | 扩展性考虑 |
|------|---------|-----------|
| `papers` | 论文元数据 + 文件信息 JSONB + 解析状态机 | `file_info` 整存避免单独文件表；`method_summary` 缓存快速列表展示 |
| `semantic_blocks` | 段落级原文-译文锚定，向量支持语义检索 | `block_type` 为字符串，未来可扩展新类型；`embedding` 在数据导入后建 hnsw 索引 |
| `annotations` | Agent 提取 + 用户纠正双轨；`created_by` 区分来源 | `evidence` JSONB 存多源证据，不绑死单一块；联合索引加速按类型过滤 |
| `method_cards` | 标准化知识单元，支撑对比矩阵与方法演进 | `metrics` JSONB 数组，不同领域指标差异大（mIoU vs F1 vs Accuracy） |
| `matrix_cells` | 单元格级证据链 + 矛盾检测 + 用户纠正 | `raw_value` JSONB 保留原始类型；冲突单独索引便于快速筛选 |
| `method_timelines` | 时间线节点，**`next_nodes` JSONB 替代边表**减少一张表 | 第一版时间线固定排列，不支持拖拽，`next_nodes` 足够表达单向连线 |
| `briefings` | 简报内容整存 JSONB（读多写少） | MVP 不做条目级交互，整存足够；未来若需条目级操作再拆分 |
| `term_definitions` | 全局术语知识库，人机协同核心 | `usage_count` 支持排序；向量索引支持 Hover 模糊语义匹配 |
| `agent_logs` | 全链路可审计、成本追踪、错误复盘 | `metadata` 存完整上下文；按 `created_at` 分区预留，当前单表承载 |

---

## 5. 索引策略

### 5.1 B-Tree 索引（等值/范围查询）

```sql
-- 高频查询场景
idx_papers_user_id              -- 用户论文列表
idx_papers_user_created         -- 按创建时间排序
idx_papers_deleted_at (partial) -- 只查未删除
idx_semantic_blocks_paper_id    -- 论文语义块加载
idx_annotations_paper_type      -- 按类型过滤标注
idx_notes_user_paper            -- 用户在某论文的笔记
idx_matrix_cells_matrix_id      -- 矩阵单元格加载
idx_reading_stats_user_date     -- 统计查询
```

### 5.2 GIN 索引（JSONB 查询）

```sql
-- 按需创建，非所有 JSONB 列都需要
CREATE INDEX idx_papers_authors_gin ON papers USING GIN (authors);
CREATE INDEX idx_method_cards_datasets_gin ON method_cards USING GIN (datasets);
CREATE INDEX idx_agent_logs_metadata_gin ON agent_logs USING GIN (metadata);
```

> **策略**：GIN 索引写入开销大，MVP 阶段只在确有 JSONB 字段查询需求的表上创建，其他 JSONB 列先不加 GIN，后续根据查询日志按需添加。

### 5.3 HNSW 向量索引（相似度检索）

```sql
-- 语义块向量索引
CREATE INDEX idx_semantic_blocks_embedding ON semantic_blocks
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

-- 术语向量索引
CREATE INDEX idx_term_definitions_embedding ON term_definitions
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);
```

> **策略**：HNSW 索引构建耗时，建议在**数据批量导入完成后创建**，而不是空表就建索引。参数 `m=16, ef_construction=64` 适合万~十万级数据；百万级后调大 `ef_construction`。

### 5.4 部分索引（Partial Index）

```sql
-- 只索引未删除的数据，减少索引大小
idx_papers_deleted_at WHERE deleted_at IS NULL
idx_projects_deleted_at WHERE deleted_at IS NULL

-- 只索引冲突单元格，快速定位
idx_matrix_cells_conflict WHERE is_conflict = TRUE
```

---

## 6. 数据一致性要点

### 6.1 解析结果的多表写入

AI 服务回调解析结果后，Nest.js 使用 Prisma `$transaction` 原子写入：

```typescript
await prisma.$transaction(async (tx) => {
  await tx.semantic_blocks.createMany({ data: blocks });
  await tx.annotations.createMany({ data: annotations });
  await tx.figures.createMany({ data: figures });
  await tx.method_cards.createMany({ data: methodCards });
  await tx.papers.update({
    where: { id: paperId },
    data: { parse_status: 'PARSED', updated_at: new Date() }
  });
});
```

**回滚策略**：事务中任一失败全部回滚，`papers.parse_status` 保持 `PARSING` 或回退到 `UPLOADED`，前端可重试。

### 6.2 论文删除的级联行为

```
papers (ON DELETE CASCADE)
  ├── semantic_blocks  CASCADE
  ├── annotations      CASCADE
  ├── figures          CASCADE（但 MinIO 对象需后台任务清理）
  ├── method_cards     CASCADE
  ├── paper_qas        CASCADE
  ├── notes            CASCADE
  └── reading_list     CASCADE（通过外键约束）
```

MinIO 对象的物理删除不放在事务中（避免阻塞），由定时任务扫描 `papers.deleted_at IS NOT NULL` 后异步清理。

---

## 7. Phase 表启用计划

| 表名 | Phase 1 | Phase 2 | Phase 3 | 说明 |
|------|---------|---------|---------|------|
| `users` | ✅ | — | — | 全阶段 |
| `user_interests` | ✅ | — | — | 兴趣标签 |
| `user_settings` | ✅ | — | — | 推送设置 |
| `papers` | ✅ | — | — | 核心 |
| `semantic_blocks` | ✅ | — | — | 阅读室底座 |
| `annotations` | ✅ | — | — | 标注 |
| `figures` | ✅ | — | — | 图表 |
| `method_cards` | ✅ | — | — | 方法卡片 |
| `paper_qas` | ✅ | — | — | Q&A |
| `notes` | ✅ | — | — | 笔记 |
| `term_definitions` | ✅ | — | — | 术语库 |
| `agent_logs` | ✅ | — | — | 审计日志 |
| `reading_list` | ✅ | — | — | 收藏/忽略 |
| `reading_stats` | ✅ | — | — | 统计 |
| `briefings` | — | ✅ | — | 简报 |
| `projects` | — | — | ✅ | 项目空间 |
| `project_papers` | — | — | ✅ | 项目论文关联 |
| `comparison_matrices` | — | — | ✅ | 对比矩阵 |
| `matrix_cells` | — | — | ✅ | 矩阵单元格 |
| `method_timelines` | — | — | ✅ | 方法演进 |
| `project_qas` | — | — | ✅ | 项目问答 |

**MVP 最小表集（Phase 1）**：13 张表，覆盖单篇阅读全部功能。

---

## 8. 迁移与迭代策略

### 8.1 Prisma Migrate 工作流

```bash
# 1. 修改 schema.prisma
# 2. 生成迁移文件
npx prisma migrate dev --name add_figure_embedding

# 3. 生成类型安全的 Client
npx prisma generate

# 4. 生产环境应用迁移
npx prisma migrate deploy
```

### 8.2 向量维度的可配置性

`semantic_blocks.embedding` 和 `term_definitions.embedding` 使用 `VECTOR(1536)`，但系统应支持配置维度：

- OpenAI `text-embedding-3-small`: 1536 维
- OpenAI `text-embedding-3-large`: 3072 维
- BGE-M3 / GTE 等开源模型: 768~1024 维

**策略**：MVP 阶段固定 1536 维；切换模型时通过迁移脚本 `ALTER COLUMN` 调整维度并重建索引。

### 8.3 未来分区扩展

当 `agent_logs` 或 `semantic_blocks` 超过百万行时，可按以下方式分区：

```sql
-- agent_logs 按时间范围分区（预留，当前不实现）
CREATE TABLE agent_logs_2026_q3 PARTITION OF agent_logs
  FOR VALUES FROM ('2026-07-01') TO ('2026-10-01');

-- semantic_blocks 按 paper_id 哈希分区（预留）
CREATE TABLE semantic_blocks_p0 PARTITION OF semantic_blocks
  FOR VALUES WITH (MODULUS 4, REMAINDER 0);
```

当前表结构无主键依赖自增 ID，UUID 分区友好，无需修改即可支持。

---

> **设计原则总结**：本数据模型以"**每张表必须有明确的单一职责**"为原则，拒绝过早拆分。JSONB 的适度使用替代了 4 张可能的子表（`paper_files`、`briefing_items`、`method_timeline_edges`、`reading_archives`），在查询性能和 Schema 简洁度之间取得平衡。当任一 JSONB 字段的查询模式稳定后，再考虑提取为独立表。
