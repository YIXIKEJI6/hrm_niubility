# HRM Niubility - 架构探索报告

> 诊断日期: 2026-04-09 | Agent: code-explorer

---

## 1. 前端架构

**技术栈**: React 19, Vite 6, Tailwind CSS 4, TypeScript 5.8
**代码分割**: Vite `manualChunks` 分为 `vendor-react`, `vendor-ui`, `vendor-editor`

**路由**: 无 React Router。使用 `currentView` 字符串 + `useState` + `localStorage` 实现导航。`App.tsx` 中 `renderView()` switch 渲染对应懒加载页面组件。URL 状态编码在 view 字符串中（如 `"competency?tab=evaluations&testId=3"`）。

**状态管理**: 无 Redux/Zustand/Jotai。全部使用组件本地 `useState`。唯一全局状态为 `AuthContext`。

**Context Providers**: 仅 `AuthContext`（`src/context/AuthContext.tsx`），包含 `currentUser`, `userPerms`, `userScopes`，暴露 `hasPermission(key)`, `getPermissionScope(key)`, `loginWithMock()`, `logout()`。

### 页面 (15 个, 全部懒加载)

| 页面 | 路由键 | 用途 |
|------|--------|------|
| `EmployeeDashboard` | `dashboard` | 个人仪表盘、待办、绩效目标 |
| `PersonalGoals` | `personal` | 个人目标追踪 |
| `TeamPerformance` | `team` | 管理者团队目标/任务视图 |
| `CompanyPerformance` | `company` | 公司绩效总览 |
| `HRMap` | `hrmap` | HR 组织地图可视化 |
| `PanoramaDashboard` | `panorama` | 分析 + PDCA 监控 |
| `AdminPanel` | `admin*` | 权限、审批流、薪酬模板 |
| `OrgChart` | `org` | 部门树 + 企微同步 |
| `MyWorkflows` | `workflows*` | 我的审批流程实例 |
| `PerformanceManager` | `perf-manage` | 绩效池任务管理 |
| `PerfAnalyticsPage` | `perf-analytics` | 绩效分析 |
| `PerfAccountingPage` | `perf-accounting` | 薪酬/奖金核算 |
| `CompetencyManager` | `competency*` | 胜任力模型 + 测评分配 |
| `TestBankManager` | `test-bank` | 考试/题库管理 |
| `MonthlyEvaluationPage` | `monthly-eval` | 月度 360 评审引擎 |

### 组件 (18 个)

| 组件 | 用途 |
|------|------|
| `Sidebar.tsx` | 导航侧边栏 |
| `FloatingAiChat.tsx` | 浮动 AI 聊天窗口 ("小优") 使用 DeepSeek |
| `GlobalToast.tsx` | Toast 通知系统 |
| `GlobalPageSkeleton.tsx` | 页面切换加载骨架屏 |
| `Watermark.tsx` | 用户水印覆盖层 |
| `DevRoleSwitcher.tsx` | 开发角色切换器（生产环境自动隐藏） |
| `AuditTimeline.tsx` | 审批审计历史展示 |
| `WorkflowTrajectory.tsx` | 审批流轨迹可视化 |
| `PerfModuleV2.tsx` | 核心绩效计划模块 |
| `PersonalGoalsPanel.tsx` | 个人目标追踪面板 |
| `SharedSTARPanel.tsx` | STAR 报告共享面板 |
| `SmartGoalDisplay.tsx` | SMART 目标展示格式化 |
| `SmartTaskModal.tsx` | 任务创建/编辑弹窗 |
| `SmartFormInputs.tsx` | 可复用 SMART 表单输入 |
| `RewardDistributionModal.tsx` | 奖励分配配置 |
| `TestResultsModal.tsx` | 考试结果展示 |
| `TestTakingModal.tsx` | 在线考试 UI |
| `UserGuide.tsx` | 应用内使用指南 |

### Hooks (2 个)

- `src/hooks/useIsMobile.ts` — 视口断点检测
- `src/hooks/useRTASR.ts` — 讯飞实时语音转文字 WebSocket

---

## 2. 后端架构

**技术栈**: Express 4, TypeScript, `tsup` 编译生产版本（输出 `server-dist/index.mjs`），开发使用 `tsx watch`。

**入口**: `server/index.ts` — 注册所有路由、初始化 DB、seed 数据、启动审批引擎，端口 3001。

### 中间件 (`server/middleware/auth.ts`)

- `authMiddleware` — JWT Bearer token 验证
- `requireRole(...roles)` — 基于角色的门控，支持 `admin`/`hr`/`manager`/`employee`
- `requireSuperAdmin()` — 硬编码超级管理员 (`SUPER_ADMIN_ID = 'CaoGuiQiang'`)

### 路由模块 (33 个文件, ~209 个端点)

| 挂载路径 | 文件 | 领域 |
|----------|------|------|
| `/api/auth` | `auth.ts` | 企微 OAuth, JWT 登录, `/me` |
| `/api/org` | `org.ts` | 部门/用户 CRUD, 企微同步, 角色标签 |
| `/api/perf` | `perf.ts` | 绩效计划 CRUD (~21 端点) |
| `/api/perf/stats` | `perf-stats.ts` | 绩效统计聚合 |
| `/api/perf/analytics` | `perf-analytics.ts` | 分析数据 |
| `/api/perf/supervision` | `perf-supervision.ts` | PDCA 督办 |
| `/api/perf/finance` | `perf-finance.ts` | 财务/预算 |
| `/api/perf/pdca` | `perf-pdca.ts` | PDCA 周期 |
| `/api/pool` | `pool.ts` | 奖金池任务 (~33 端点) |
| `/api/pool/star` | `pool-star.ts` | 池任务 STAR 报告 |
| `/api/pool/rewards` | `pool-rewards.ts` | 奖励分配方案 (~10 端点) |
| `/api/team` | `team.ts` | 团队视图 |
| `/api/team-scope` | `team-scope.ts` | 团队视图范围配置 |
| `/api/dashboard` | `dashboard.ts` | 仪表盘聚合数据 |
| `/api/ai` | `ai.ts` | AI 分析、诊断、聊天、文档解析 |
| `/api/tasks` | `tasks.ts` | 个人待办任务 |
| `/api/task-discussions` | `task-discussions.ts` | 任务/计划的讨论线程 |
| `/api/permissions` | `permissions.ts` | 权限矩阵管理 |
| `/api/notifications` | `notifications.ts` | 站内通知 |
| `/api/notify` | `notify.ts` | 企微消息推送 |
| `/api/workflows` | `workflows.ts` | 审批流实例管理 |
| `/api/approval-flows` | `approval-flows.ts` | 审批流模板 |
| `/api/workflow/trajectory` | `workflow-trajectory.ts` | 审批步骤历史 |
| `/api/workflow-fix` | `workflow-fix.ts` | 管理员审批修复工具 |
| `/api/workflow-exceptions` | `workflow-exceptions.ts` | 异常处理 |
| `/api/voice` | `voice.ts` | 讯飞 RTASR WebSocket URL 生成 |
| `/api/competency` | `competency.ts` | 胜任力模型 + 评估 (~11 端点) |
| `/api/uploads` | `upload.ts` | 文件上传 (multer, 50MB) + 文件服务 |
| `/api/tests` | `tests.ts` | 题库 + 在线考试 |
| `/api/monthly-eval` | `monthly-eval.ts` | 月度 360 评审 |
| `/api/payroll-export` | `payroll-export.ts` | 薪酬导出模板 |
| `/api/perf/star` | `perf-star.ts` | 绩效计划 STAR 报告 |
| `/api/salary` | `salary.ts` | 薪资管理 |

### 服务层

| 文件 | 用途 |
|------|------|
| `services/ai.ts` | DeepSeek API 调用 (绩效分析 + 诊断) |
| `services/wecom.ts` | 企微 API (token, OAuth, 部门/成员同步, 智能表格) |
| `services/message.ts` | 企微消息推送 (文本、卡片、Markdown、交互卡片) |
| `services/audit-logger.ts` | 统一审计日志写入 `workflow_audit_logs` |
| `services/workflow-engine.ts` | 审批模板引导 + `WorkflowEngine` 解析器 |
| `services/workflow.ts` | 审批实例状态机 |
| `services/formula-engine.ts` | 安全算术公式求值器 (无 `eval`) 用于薪酬 |
| `services/payroll.ts` | 薪酬/税务计算逻辑 |

---

## 3. 数据库模式

单 SQLite 文件 `data/hrm.db` (WAL 模式, 外键开启)。所有模式在 `server/config/database.ts`，无独立迁移工具，使用 `CREATE TABLE IF NOT EXISTS` + `ALTER TABLE` catch-exception 模式。

### 数据表 (35 张)

| 分组 | 表 |
|------|---|
| 组织结构 | `departments`, `users` |
| 绩效生命周期 | `perf_plans`, `perf_logs` |
| 奖金池 | `pool_tasks`, `pool_participants`, `pool_join_requests`, `pool_role_claims`, `pool_task_extensions`, `pool_reward_plans`, `pool_reward_distributions` |
| STAR 报告 | `pool_star_reports`, `perf_star_reports` |
| 审批流 | `workflow_templates`, `workflow_nodes`, `approval_templates`, `approval_nodes` |
| 审计 | `workflow_audit_logs` |
| 胜任力 | `competency_models`, `competency_library`, `competency_dimensions`, `competency_evaluations`, `competency_scores` |
| 考试 | `test_banks`, `test_questions`, `test_assignments`, `test_answers` |
| 月度评审 | `monthly_evaluations`, `monthly_eval_reviewers` |
| 通知 | `notifications`, `team_feeds`, `message_logs`, `card_response_codes` |
| 任务 | `tasks`, `task_discussions` |
| 权限 | `permission_overrides`, `user_perm_overrides`, `user_role_tags`, `team_view_scopes` |
| 薪酬 | `perf_budgets`, `payroll_export_templates` |

---

## 4. 文件统计

- **总文件数**: 226 (排除 `node_modules`, `.git`, `.claude`)
- **前端 (`src/`)**: 43 文件
- **后端 (`server/`)**: 49 文件
- **脚本**: 22 文件
- **根目录杂项**: ~112 文件

---

## 5. 部署流水线

两个部署目标，均为阿里云 Windows 服务器，通过 NSSM 管理:

| 环境 | 配置 | 端口 | 服务名 |
|------|------|------|--------|
| 生产 | `deploy.config` | 3001 | `HrmNiubility` |
| 测试 | `deploy-test.config` | 4001 | `HrmNiubilityTest` |

**部署流程** (`scripts/deploy-aliyun-win.sh`):
1. 本地 `npm run build:all` (Vite 前端 + tsup 服务端)
2. 打包 `dist/ server-dist/ .env package.json package-lock.json scripts/`
3. `scp` 上传至 Windows 服务器 (expect 密码 SSH)
4. SSH + PowerShell: 解压、`npm install --production`、重启 NSSM 服务
5. 清理 zip

**Ansible**: `infra/ansible/` 目录存在 `.env.j2` 模板，目标为 MySQL + Redis + 阿里云 OSS，为未来规划。

---

## 6. 关键依赖与集成

### 企业微信集成
- OAuth 登录 (应用内静默 + 外部扫码)
- 通讯录同步 (部门树 + 成员列表)
- 消息推送 (文本、卡片、Markdown、交互卡片)
- 智能表格 (薪资数据读写)
- 域名验证 + 回调签名验证

### AI 集成
- **DeepSeek API** (`deepseek-chat`) — 绩效分析、诊断、浮动聊天助手
- **`@google/genai`** — 已安装但未使用 (规划中)
- **讯飞 RTASR** — 实时语音识别 WebSocket

### 文件上传
- `multer` 磁盘存储到 `data/uploads/`，50MB 限制
- 支持类型: pdf, doc/x, xls/x, ppt/x, txt, csv, zip, rar, 图片, mp4, mp3
