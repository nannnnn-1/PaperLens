# PaperLens

> 你的私人学术情报官——帮你高效消费、整理、追踪学术信息。

## 技术栈

| 层级 | 技术 |
|------|------|
| 前端 | React 18 + TypeScript + Vite + Tailwind CSS |
| 业务后端 | Nest.js + TypeScript + Prisma + PostgreSQL |
| AI 服务 | Python + FastAPI |
| 基础设施 | PostgreSQL (pgvector) + Redis + MinIO |

## 目录结构

```
PaperLens/
├── apps/
│   ├── web/          # 前端应用
│   ├── api/          # 业务后端 (Nest.js)
│   └── ai/           # AI 服务 (FastAPI)
├── docs/             # 产品文档 & 架构设计
├── docker-compose.dev.yml
└── README.md
```

## 快速开始

### 1. 启动基础设施

```bash
docker-compose -f docker-compose.dev.yml up -d
```

这会启动 PostgreSQL (带 pgvector)、Redis、MinIO。

### 2. 启动业务后端

```bash
cd apps/api
npm install
npx prisma migrate dev
npx prisma generate
npm run start:dev
```

### 3. 启动 AI 服务

```bash
cd apps/ai
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

### 4. 启动前端

```bash
cd apps/web
npm install
npm run dev
```

## 文档

- [产品需求文档（PRD）](./docs/PaperLens%20产品需求文档（PRD）.md)
- [系统架构设计](./docs/03-architecture.md)
- [API 契约](./docs/04-api-contract.md)
- [数据模型](./docs/05-data-model.md)
- [Git 工作流](./docs/09-git-workflow.md)

## 许可证

MIT
