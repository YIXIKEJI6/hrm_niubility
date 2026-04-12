# HRM Niubility - 代码质量审计报告

> 诊断日期: 2026-04-09 | Agent: code-reviewer

---

## 审计结论: BLOCK

| 严重级别 | 数量 | 状态 |
|----------|------|------|
| CRITICAL | 4 | block |
| HIGH | 7 | warn |
| MEDIUM | 7 | info |
| LOW | 4 | note |

---

## CRITICAL 问题

### 1. 硬编码 API Key

**文件**:
- `server/services/ai.ts:1`
- `server/routes/ai.ts:44`
- `server/routes/tests.ts:321`

DeepSeek API key (`sk-592b0ba541a94bc39f4f77480b3fe4f1`) 作为 fallback 硬编码在三个位置:

```typescript
const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY || 'sk-592b0ba541a94bc39f4f77480b3fe4f1';
```

**修复**: 删除所有 fallback，启动时强制检查:
```typescript
const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;
if (!DEEPSEEK_API_KEY) throw new Error('DEEPSEEK_API_KEY is not configured');
```
立即轮换已暴露的密钥。

### 2. `.env` 文件含真实生产凭据

**文件**: `.env`

包含真实、活跃的生产凭据 (WeChat Work, JWT Secret 等)。虽然 `.gitignore` 包含 `.env*`，但文件在磁盘上存在，一次 `git add .` 即可被提交。JWT secret 也很弱（可预测、包含年份）。

### 3. 硬编码 JWT Secret Fallback

**文件**: `server/middleware/auth.ts:4`

```typescript
const JWT_SECRET = process.env.JWT_SECRET || 'hrm_niubility_jwt_secret_2024';
```

可预测的 fallback 意味着未配置 `JWT_SECRET` 的环境中所有 token 使用已知值签发。攻击者可伪造有效 JWT。

### 4. CORS 完全开放

**文件**: `server/index.ts:54`

```typescript
app.use(cors());
```

允许任何来源的请求。对处理薪资数据和用户 PII 的 HRM 系统是重大暴露。

---

## HIGH 问题

### 1. 零测试覆盖

`src/` 和 `server/` 下无任何测试文件。无单元测试、集成测试、E2E 测试。按项目约定需 80% 最低覆盖率。

### 2. 迁移在请求处理器中使用静默 catch 执行

**文件**: `server/routes/perf.ts:16-17`, `pool.ts:12-13`, `notifications.ts:8`

```typescript
try { db.exec("ALTER TABLE perf_plans ADD COLUMN collaborators TEXT"); } catch(e) {}
```

每次请求时在热路径上执行 DDL，静默吞掉数据库错误，迁移逻辑散布在 5+ 个路由文件中。应移到 `initDatabase()`。整个服务端有 30+ 个空 `catch` 块。

### 3. N+1 查询: `GET /api/pool/tasks`

**文件**: `server/routes/pool.ts:38-55`

列表端点获取所有任务后，对每个任务在 `.map()` 内执行两个额外查询。50 个任务 = 101 次数据库查询。

### 4. TypeScript `strict` 模式未启用 — 392 处未类型化 `any`

**文件**: `tsconfig.json`

无 `strict`, `noImplicitAny`, `strictNullChecks`。`server/` 有 211 处 `as any`，`src/` 有 181 处。SQLite 查询结果类型为 `any`，DB 结构变更时调用方静默中断。

### 5. 无全局错误中间件

**文件**: `server/index.ts`

无 Express 错误处理中间件。异步路由处理器中未捕获的异常会崩溃进程或挂起请求。

### 6. 无 React 错误边界

`src/` 中不存在 `ErrorBoundary` 组件。任何页面或组件抛出渲染异常，整个应用白屏无恢复路径。

### 7. 重复工具代码

**文件**: `src/pages/AdminPanel.tsx:9`, `src/components/PerfModuleV2.tsx:5`

两个文件包含逐字节相同的 `useApiGet` 和 `apiCall` 实现。应提取到共享的 `src/hooks/useApi.ts`。

---

## MEDIUM 问题

### 1. 生产代码中 109 处 `console.log`

服务端 60 处 (22 个文件)，前端 49 处 (18 个文件)。应替换为结构化日志 (如 `pino`)。

### 2. `initDatabase()` 膨胀至 650 行

**文件**: `server/config/database.ts` (650 行)

基础模式、15+ `ALTER TABLE` 迁移和种子数据混合在一个函数中。无版本管理或迁移表。

### 3. `server/routes/perf.ts` 为 829 行 — 超过 800 行限制

18 个 HTTP 路由跨绩效计划全生命周期。应拆分为 `perf-lifecycle.ts`、`perf-receipt.ts`、`perf-assessment.ts`。

### 4. `server/routes/pool.ts` 超过 900+ 行

奖金池路由混合任务 CRUD、提案审批、加入请求、排行榜和角色认领。需提取为子模块。

### 5. `hasPermission` 权限未加载时默认放行

**文件**: `src/context/AuthContext.tsx:236`

```typescript
if (userPerms.length === 0) return true;
```

权限加载窗口期间所有用户拥有全部功能访问权限。应显示 loading 状态。

### 6. Mock 登录硬编码超级管理员 ID

**文件**: `src/context/AuthContext.tsx:134`

```typescript
body: JSON.stringify({ code: 'mock_code', userId: 'CaoGuiQiang' })
```

### 7. `WorkflowEngine.getDeptHead` 无界 while 循环

**文件**: `server/services/workflow-engine.ts:206`

每次迭代执行独立数据库查询，无深度限制。循环部门引用（DB 无约束防止）会导致无限循环。应添加最大深度守卫。

---

## LOW 问题

### 1. 魔数 `+ 1000000` 作为注入任务 ID 偏移

**文件**: `server/routes/tasks.ts:27` — 使用命名常量替代。

### 2. `StatusBadge` 和 `statusMap` 跨多文件重复

5 个文件各自定义相同 8-10 个状态键映射。应提取为共享组件。

### 3. `initializeAuth` 中的过期闭包依赖 bug

**文件**: `src/context/AuthContext.tsx:103` — 空依赖数组内的 `currentUser` 永远为 `null`。逻辑意外可工作。

### 4. 部分子路由缺少 `authMiddleware`

`perf-star.ts` 使用 `req: any` 而非 `req: AuthRequest`，隐藏了 `authMiddleware` 是否一致应用。

---

## 根目录杂项文件 (应清理)

以下文件看起来是临时脚本/调试工件：
- `clear-all-data.js`
- `fix_approvers.ts`, `fix_buttons.js`
- `query_logs.cjs`, `query_perf_plans_test.js`, `query_remote.js`
- `remote-clear-all.cjs`, `remote-clear-all.js`
- `run_test.cjs`, `test_db.cjs`, `test_db2.cjs`
- `test_eval.js`, `test-api.js`, `test-resolve.ts`, `test.ts`
- `temp_seed.ts`
- `src.tar.gz`
- `hrm.db`, `master.db`, `database.sqlite` (根目录的 DB 文件)
