# PaperLens Git 工作流规范

> 版本：v1.0  
> 日期：2026-06-10  
> 适用团队规模：2~4 人  
> 核心原则：**轻量、快速迭代、主干稳定、Code Review 不可省**

---

## 1. 分支模型：GitHub Flow（轻量版）

PaperLens 采用 **GitHub Flow** 而非 Git Flow。理由：

| 维度 | GitHub Flow | Git Flow |
|------|-------------|----------|
| 分支数量 | 少（main + feature） | 多（main + develop + release + hotfix + feature） |
| 认知负担 | 低，新人 5 分钟理解 | 高，需理解各分支职责 |
| 发布节奏 | 持续集成，随时可发布 | 固定版本周期 |
| 适合规模 | 小团队，快速迭代 | 大型团队，版本强管控 |
| 回滚成本 | 低（直接 revert PR） | 中（需处理分支合并关系） |

**决策：GitHub Flow**

PaperLens 是 MVP 阶段产品，需求变化快，2~3 人团队需要每天多次合并部署。Git Flow 的 `develop` / `release` 分支对当前阶段是过度设计。

```
main (protected, 始终可部署)
  │
  ├── feature/auth-login
  │       │
  │       ▼
  │   Pull Request → Code Review → Merge to main
  │
  ├── feature/reading-annotation
  │       │
  │       ▼
  │   Pull Request → Code Review → Merge to main
  │
  ├── hotfix/fix-parse-timeout
  │       │
  │       ▼
  │   Pull Request → Code Review → Merge to main
  │
  ▼
tag: v0.1.0
```

---

## 2. 分支规范

### 2.1 长期分支

| 分支名 | 作用 | 保护规则 |
|--------|------|---------|
| `main` | 唯一长期分支，始终可部署 | ✅ 禁止直接 push，必须通过 PR 合并；✅ PR 需至少 1 个 Approve；✅ CI 通过方可合并 |

> **为什么没有 `develop`？**  
> 小团队不需要隔离"开发中"和"稳定"代码。`main` 即稳定主干，feature 分支通过 Review 保证质量后直接合并。若需预发环境，用 `main` 分支的 Docker 镜像部署到 Staging。

### 2.2 临时分支命名规范

| 分支类型 | 命名格式 | 示例 |
|----------|---------|------|
| 功能开发 | `feature/{module}-{short-desc}` | `feature/reading-annotation-drawer` |
| 缺陷修复 | `fix/{module}-{short-desc}` | `fix/paper-parse-timeout-error` |
| 热修复 | `hotfix/{short-desc}` | `hotfix/auth-jwt-expiry` |
| 文档/配置 | `docs/{short-desc}` | `docs/api-contract-v1.1` |
| 重构 | `refactor/{module}-{short-desc}` | `refactor/ai-gateway-retry-logic` |
| 依赖升级 | `deps/{lib-name}-{version}` | `deps/prisma-5.15` |

**命名约束：**
- 全小写，用 `-` 连接词
- 长度控制在 50 字符以内
- 必须包含模块名或作用域，便于快速识别

### 2.3 分支生命周期

```
1. 从最新 main 切出：git checkout -b feature/reading-chat
2. 开发，本地 commit（遵循 Commit 规范）
3. 推送远程：git push -u origin feature/reading-chat
4. 创建 Pull Request，填写模板
5. Code Review，处理评论
6. Reviewer Approve
7. CI 通过
8. 合并到 main（使用 Squash Merge 或 Rebase Merge）
9. 删除远程分支
10. 本地清理：git branch -d feature/reading-chat
```

---

## 3. Commit 规范

采用 **Conventional Commits**，与语义化版本自动关联。

### 3.1 格式

```
<type>(<scope>): <subject>

<body>

<footer>
```

### 3.2 Type 定义

| Type | 含义 | 是否触发版本升级 |
|------|------|----------------|
| `feat` | 新功能 | ✅ MINOR (x.Y.z) |
| `fix` | 缺陷修复 | ✅ PATCH (x.y.Z) |
| `docs` | 文档变更 | ❌ 不触发 |
| `style` | 代码格式（不影响逻辑） | ❌ 不触发 |
| `refactor` | 重构（无新功能无修复） | ❌ 不触发 |
| `perf` | 性能优化 | ✅ PATCH (x.y.Z) |
| `test` | 测试相关 | ❌ 不触发 |
| `chore` | 构建/工具/依赖 | ❌ 不触发 |
| `ci` | CI/CD 配置 | ❌ 不触发 |

### 3.3 Scope 定义

| Scope | 说明 |
|-------|------|
| `web` | 前端项目 |
| `api` | 业务后端（Nest.js） |
| `ai` | AI 服务（FastAPI） |
| `db` | 数据库 Schema / 迁移 |
| `docs` | 文档（PRD、架构设计等） |
| `shared` | 共享类型/工具库 |
| `infra` | 基础设施（Docker、CI、部署脚本） |

### 3.4 示例

```bash
# 功能提交
feat(api): 添加论文上传完成后的解析任务派发

调用 BullMQ 将 PDF 解析任务加入队列，
AI Worker 消费后通过回调接口回传结果。

Closes #12

# 修复提交
fix(web): 修复阅读室分屏拖拽在 Firefox 下失效

Firefox 对 flex 布局的 resize 行为与 Chrome 不同，
改用 react-resizable-panels 库统一处理。

# 文档提交
docs: 更新 API 契约中 SSE 事件定义

# 重构提交
refactor(ai): 将 PDF 解析流水线拆分为独立模块

提取 parser、extractor、translator 三个子模块，
便于单元测试和后续替换解析引擎。
```

### 3.5 Commit 粒度建议

- **一个 Commit 只做一件事**：不要把"添加登录 + 修复样式 + 升级依赖"塞进一个 Commit
- **Commit Message 第一行必须能独立理解**： reviewer 看历史时不需要点进去就知道做了什么
- **破坏性变更必须标注**：`BREAKING CHANGE: 旧版 API /auth/login 已移除`

---

## 4. Pull Request 规范

### 4.1 PR 模板

创建 `.github/pull_request_template.md`：

```markdown
## 变更类型
- [ ] feat: 新功能
- [ ] fix: 缺陷修复
- [ ] docs: 文档
- [ ] refactor: 重构
- [ ] perf: 性能优化
- [ ] test: 测试
- [ ] chore: 构建/工具

## 变更描述
<!-- 清晰描述做了什么、为什么做 -->

## 相关 Issue
Closes #

## 测试覆盖
- [ ] 已添加/更新单元测试
- [ ] 已本地手动验证
- [ ] 已更新 API 契约（如接口有变更）

## 截图（UI 变更必填）
<!-- 前后对比或功能演示 -->

## 检查清单
- [ ] 代码遵循项目 ESLint/Prettier 规范
- [ ] 无 console.log / debugger 残留
- [ ] 数据库迁移已生成（如 Schema 有变更）
```

### 4.2 PR 规模约束

| 指标 | 建议上限 | 超出处理 |
|------|---------|---------|
| 变更行数 | 400 行 | 拆分为多个 PR |
| 文件数 | 15 个 | 拆分为多个 PR |
| 功能点 | 1 个 | 独立分支 |

**为什么限制规模？**
- Reviewer 注意力有限，400 行以上 Review 质量显著下降
- 小 PR 回滚成本低，发现问题可快速 revert
- 阻塞时间短，团队成员不用等"大 PR"合并才能继续

### 4.3 Review 规则

| 规则 | 说明 |
|------|------|
| **必须 1 人 Approve** | 即使是自己非常熟悉的功能，也必须由他人 Review |
| **禁止自己 Approve 自己的 PR** | 无例外（见下方虚拟团队模式例外条款） |
| **Reviewer 有权 Request Changes** | 发现设计问题、测试缺失、明显 Bug 必须阻塞 |
| **24 小时内响应** | 收到 Review 请求后 24h 内必须开始 Review |
| **Comments 必须 Resolve** | 所有评论处理完后由评论者标记 Resolve |

#### 单人虚拟团队模式（当前适用）

> PaperLens 当前为"1 人 + AI 辅助"的开发模式，严格执行"必须他人 Approve"会导致流程卡死。采用以下补充规则：

| 场景 | 规则 |
|------|------|
| **AI 生成代码，人类合并** | 作者在 PR 描述中必须填写 **Self-review checklist**，逐项自查通过后方可合并。Checklist 内容与正式 Review 标准一致（设计正确性、测试覆盖、无残留日志、契约同步等）。 |
| **人类手动修改的代码** | 若修改行数 > 50 行或涉及架构调整，强烈建议冷却 2 小时后再 Self-review，避免"刚写完就合并"的思维盲区。 |
| **何时切换为强制 Approve** | 项目引入第 2 个人类贡献者时，立即切换为标准"1 人 Approve"规则，删除 Self-review 例外。 |

**Self-review checklist 模板（PR 描述中粘贴并勾选）：**

```markdown
## Self-review Checklist
- [ ] 代码逻辑与设计文档一致
- [ ] 新增/修改接口已同步更新 API 契约（04-api-contract.md）
- [ ] 数据库变更已生成迁移并更新数据模型文档（05-data-model.md）
- [ ] 相关单元测试/集成测试已添加并通过
- [ ] 本地手动验证通过（关键路径）
- [ ] 无 console.log / debugger 残留
- [ ] 无敏感信息硬编码（密钥、密码）
- [ ] Commit message 遵循 Conventional Commits
```

### 4.4 Merge 策略

**使用 Squash Merge（推荐）**

```
main:    A---B---C---D
                ↑
feature:         E---F---G---H (4 个 commit，可能包含"fix typo""wip"等)

Squash Merge 后：
main:    A---B---C---D---S (S 是一个干净的功能 Commit)
```

**Squash Merge 的提交信息格式：**
```
feat(api): 添加项目空间对比矩阵功能 (#45)

- 实现对比矩阵 CRUD
- 支持 Agent 自定义列
- 添加 CSV/Markdown 导出

Co-authored-by: reviewer-name
```

**何时不用 Squash Merge？**
- 大型重构需要保留历史时，使用 Rebase Merge
- 但 MVP 阶段优先 Squash，保持 main 历史线性干净

---

## 5. 版本发布流程

### 5.1 语义化版本（SemVer）

```
版本格式：主版本号.次版本号.修订号（MAJOR.MINOR.PATCH）

MAJOR：不兼容的 API 修改（如认证方式变更）
MINOR：向下兼容的功能新增（如新增项目空间模块）
PATCH：向下兼容的问题修复（如修复 Hover 气泡延迟）
```

### 5.2 发布步骤

```bash
# 1. 确保 main 稳定，CI 全绿
git checkout main
git pull origin main

# 2. 打版本标签
git tag -a v0.2.0 -m "release: v0.2.0 - Phase 1 单篇阅读完整版"

# 3. 推送标签
git push origin v0.2.0

# 4. GitHub 自动生成 Release Notes（基于 PR 标题）
# 5. CI 触发构建生产镜像
```

### 5.3 版本里程碑映射

| 版本 | 目标 | 预期时间 |
|------|------|---------|
| `v0.1.0` | Phase 1 MVP：单篇阅读核心功能可用 | Week 6 |
| `v0.2.0` | Phase 1 完整：标注、图表、Q&A、档案稳定 | Week 8 |
| `v0.3.0` | Phase 2：早间/晚间简报上线 | Week 12 |
| `v0.4.0` | Phase 3：项目空间、对比矩阵上线 | Week 16 |
| `v1.0.0` | 正式版：付费体系、稳定性达标 | Week 20+ |

---

## 6. CI/CD 集成

### 6.1 GitHub Actions 工作流

创建 `.github/workflows/ci.yml`：

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  lint-and-test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Lint
        run: npm run lint

      - name: Type Check
        run: npm run type-check

      - name: Test
        run: npm run test

      - name: Build
        run: npm run build
```

### 6.2 分支保护规则（GitHub Settings）

配置 `main` 分支保护：

| 规则 | 设置 |
|------|------|
| Require a pull request before merging | ✅ Enabled |
| Require approvals | 1 |
| Dismiss stale PR approvals | ✅ Enabled |
| Require status checks to pass | ✅ Enabled（CI workflow） |
| Require branches to be up to date | ✅ Enabled |
| Include administrators | 建议启用（防止管理员误操作） |

### 6.3 自动部署流程

```
main 分支 merge
    │
    ▼
GitHub Actions: CI 通过
    │
    ▼
自动构建 Docker 镜像
    │
    ▼
推送镜像到镜像仓库
    │
    ▼
触发 staging 部署（可选）
    │
    ▼
手动触发 production 部署（打 tag 时）
```

**MVP 阶段简化：**
- 开发环境：本地 `docker-compose.dev.yml`
- 预发环境：`main` 分支自动部署到 Staging（如有）
- 生产环境：打 `v*` tag 后手动触发或自动部署

---

## 7. 代码回滚策略

### 7.1 标准回滚（PR 引入的问题）

```bash
# 方式 1：GitHub UI Revert PR（推荐，生成新的Revert PR）
# PR 页面 → Revert → 创建 Revert PR → Review → Merge

# 方式 2：命令行 revert
git revert -m 1 <merge-commit-hash>
git push origin main
```

### 7.2 紧急回滚（生产故障）

```bash
# 直接回退到上一个稳定 tag
git checkout main
git reset --hard v0.1.3
git push origin main --force-with-lease

# 同时打 hotfix tag
git tag -a v0.1.4-hotfix -m "hotfix: 回退到 v0.1.3 修复线上故障"
git push origin v0.1.4-hotfix
```

> **注意**：`--force-with-lease` 比 `--force` 安全，若有人在此期间推送会失败，避免覆盖他人提交。

---

## 8. 多人协作常见问题

### 8.1 本地分支与远程不同步

```bash
# 每天开始工作前
git checkout main
git pull origin main

# feature 分支同步 main 最新代码
git checkout feature/xxx
git rebase main
# 或
git merge main
```

**推荐 rebase**：保持 feature 分支历史干净，但**已推送的公共分支不要 rebase**（会改变 commit hash）。

### 8.2 解决冲突

```bash
# 1. 合并 main 到 feature 分支
git checkout feature/xxx
git merge main

# 2. 处理冲突文件，完成后
git add <resolved-files>
git commit  # 使用默认 merge commit message

# 3. 推送
git push origin feature/xxx
```

### 8.3 提交到了错误的分支

```bash
# 场景：在 main 上直接 commit 了（main 受保护通常不会发生，但本地可能）

# 保存当前改动
git stash

# 切到正确分支
git checkout -b feature/correct-branch

# 恢复改动
git stash pop

# 提交
git add .
git commit -m "feat: ..."
```

---

## 9. 提交前检查清单（Pre-commit Checklist）

建议在本地配置 **Husky + lint-staged** 自动执行：

```json
// package.json
{
  "husky": {
    "hooks": {
      "pre-commit": "lint-staged"
    }
  },
  "lint-staged": {
    "*.{ts,tsx}": ["eslint --fix", "prettier --write"],
    "*.py": ["black", "flake8"]
  }
}
```

**手动检查项：**
- [ ] `git diff` 确认没有提交不该提交的文件（如 `.env`、临时文件）
- [ ] Commit message 遵循 Conventional Commits
- [ ] 相关测试已通过
- [ ] 数据库迁移已生成（如有 Schema 变更）：`npx prisma migrate dev`

---

## 10. 文档与代码的同步

架构文档和 API 契约位于 `docs/` 目录，当以下情况发生时必须同步更新：

| 变更场景 | 需更新的文档 | 更新方式 |
|---------|------------|---------|
| 新增/修改接口 | `04-api-contract.md` | 同 PR 中更新 |
| 新增/修改数据库表 | `05-data-model.md` | 同 PR 中更新 |
| 架构重大调整 | `03-architecture.md` | 独立 PR 或同 PR |
| 发布新版本 | `09-git-workflow.md` 版本映射表 | 发布前更新 |

**原则：文档即代码**，文档变更走同样的 PR Review 流程。

---

> **总结**：本工作流以"**最小阻力 + 质量保证**"为核心。GitHub Flow 的分支模型让小团队专注开发而非分支管理；Conventional Commits 自动生成 CHANGELOG；PR Review 是唯一的质量闸门。所有规则都服务于一个目标：**每天多次、安全地将代码合并到 main**。
