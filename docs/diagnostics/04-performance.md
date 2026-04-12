# HRM Niubility - 性能分析报告

> 诊断日期: 2026-04-09 | Agent: performance-optimizer

---

## 执行摘要

应用有良好的基础 (WAL 模式、懒加载路由、预编译语句)，但存在多个高影响结构性问题：核心查询列缺少索引、每次请求执行无界全表扫描、逗号分隔的 `assignee_id` 列强制 LIKE 扫描反模式、完全缺失响应压缩、React 层无任何 memoization。

---

## HIGH 影响

### 1. 核心查询列缺少索引

**文件**: `server/config/database.ts`

整个数据库仅创建 3 个索引。以下高频查询列无索引:

| 表 | 列 | 使用场景 |
|---|---|---|
| `perf_plans` | `status` | dashboard, analytics, supervision, panorama |
| `perf_plans` | `assignee_id` | dashboard, team-status, history |
| `perf_plans` | `approver_id` | my-approvals, approve/reject |
| `perf_plans` | `creator_id` | perf-plans list, history |
| `perf_plans` | `quarter` | 列表过滤 |
| `perf_plans` | `deadline` | 督办超期扫描 |
| `notifications` | `user_id` | 每次通知获取 |
| `notifications` | `is_read` | 未读计数 |
| `pool_tasks` | `status` | 池任务列表 |
| `pool_tasks` | `deleted_at` | WHERE 条件 |
| `tasks` | `user_id` | 任务列表 |
| `user_role_tags` | `tag` | workflow 多次调用 |

**修复**: 添加到 `initDatabase()`:

```sql
CREATE INDEX IF NOT EXISTS idx_perf_plans_status ON perf_plans(status);
CREATE INDEX IF NOT EXISTS idx_perf_plans_assignee ON perf_plans(assignee_id);
CREATE INDEX IF NOT EXISTS idx_perf_plans_approver ON perf_plans(approver_id);
CREATE INDEX IF NOT EXISTS idx_perf_plans_creator ON perf_plans(creator_id);
CREATE INDEX IF NOT EXISTS idx_perf_plans_quarter ON perf_plans(quarter);
CREATE INDEX IF NOT EXISTS idx_perf_plans_deadline ON perf_plans(deadline);
CREATE INDEX IF NOT EXISTS idx_perf_plans_dept ON perf_plans(department_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_read ON notifications(user_id, is_read);
CREATE INDEX IF NOT EXISTS idx_pool_tasks_status ON pool_tasks(status, deleted_at);
CREATE INDEX IF NOT EXISTS idx_tasks_user ON tasks(user_id);
CREATE INDEX IF NOT EXISTS idx_user_role_tags_tag ON user_role_tags(tag);
```

### 2. 逗号分隔 `assignee_id` 强制 LIKE 全表扫描

**文件**: `server/routes/dashboard.ts`, `perf.ts`, `team.ts`, `workflows.ts`

```sql
WHERE (',' || assignee_id || ',' LIKE '%,' || ? || ',%')
```

SQLite 无法对此谓词使用索引。出现在至少 12 个查询位置。数据增长后这将成为应用的主要瓶颈。

**修复**: 规范化为关联表 `perf_plan_assignees(plan_id, user_id)`。

### 3. 无界查询: Dashboard 返回所有 pool_tasks

**文件**: `server/routes/dashboard.ts:46`

```typescript
const poolTasks = db.prepare('SELECT * FROM pool_tasks ORDER BY created_at DESC').all();
```

每次请求加载完整 pool_tasks 表到内存。

**修复**: 添加 LIMIT 和分页，或服务端汇总后返回。

### 4. N+1 查询: pool.ts GET /tasks

**文件**: `server/routes/pool.ts:38-55`

每个 pool task 触发 2 次额外查询。50 个任务 = 151 次查询。

**修复**: 使用 `WHERE pool_task_id IN (...)` 批量获取。

### 5. 无响应压缩

**文件**: `server/index.ts`

所有 API 响应和静态资源无 gzip/brotli 压缩。

**修复**:
```typescript
import compression from 'compression';
app.use(compression());
app.use(express.static(distPath, { maxAge: '1y', etag: true }));
```

### 6. 缺少 SQLite Pragma 优化

**文件**: `server/config/database.ts:17-18`

WAL 模式已启用，但缺少关键性能 pragma:

```typescript
db.pragma('cache_size = -32000');    // 32 MB 页面缓存
db.pragma('synchronous = NORMAL');   // WAL 下安全且更快
db.pragma('temp_store = MEMORY');    // 临时表放内存
db.pragma('mmap_size = 268435456');  // 256 MB 内存映射 I/O
```

---

## MEDIUM 影响

### 7. React 全代码零 Memoization

所有 `.tsx` 文件中 `useMemo|useCallback|React.memo` 搜索结果为零。每个计算值和回调函数在每次渲染时重新创建。

**关键缺失**:
- `Sidebar.tsx`: `navItems` 每次渲染重新过滤权限
- `PerformanceManager.tsx`: `fetchPlans` 每次渲染重建
- `PanoramaDashboard.tsx`: JSX 内联 IIFE 每次渲染执行

### 8. N+1 团队查询: team.ts 和 perf.ts

**文件**: `server/routes/team.ts:12-16`, `server/routes/perf.ts:818-821`

`GET /team/:managerId/overview` 每个成员 4 次查询。20 人团队 = 81 次查询。

**修复**: 单个 GROUP BY 查询聚合:
```sql
SELECT assignee_id,
  COUNT(CASE WHEN status NOT IN ('draft','completed') THEN 1 END) as active_plans,
  COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_plans,
  AVG(CASE WHEN score IS NOT NULL THEN score END) as avg_score
FROM perf_plans WHERE assignee_id IN (?) GROUP BY assignee_id
```

### 9. Panorama 仪表盘: 8 条顺序 COUNT 查询

**文件**: `server/routes/dashboard.ts:60-67`

8 个独立 `SELECT COUNT(*)` 可合并为单次查询。

### 10. 审批效率循环: perf-supervision.ts N+1

**文件**: `server/routes/perf-supervision.ts:69-89`

每个 approver 执行关联查询。应移至初始 SQL 的子查询。

### 11. `ALTER TABLE` 在请求处理器内执行

**文件**: `perf.ts:16-17`, `pool.ts:12-13`, `notifications.ts:8,56`

SQLite `ALTER TABLE` 即使失败也获取写锁，在写密集路径上增加不必要的锁竞争。

**修复**: 统一移至 `initDatabase()`。

### 12. `xlsx` 模块级导入，未懒加载

**文件**: `src/pages/PerfAccountingPage.tsx:4`

`xlsx` (~470 KB) 在页面打开时立即加载。

**修复**: 按钮点击时动态导入:
```typescript
const handleExport = async () => {
  const XLSX = await import('xlsx');
};
```

### 13. `@uiw/react-md-editor` 未条件加载

**文件**: `vite.config.ts:29-30`

编辑器在 `SmartTaskModal` 和 `SharedSTARPanel` 中静态导入，用户未打开弹窗时也加载。

---

## LOW 影响

### 14. `getUsersByRoleTag` 无请求级缓存

**文件**: `server/services/workflow-engine.ts:184`

单次审批操作调用 4 次。角色分配很少变化，可短期缓存。

### 15. 无速率限制

AI 端点和认证端点接受无限请求。

### 16. Vite 未配置 sourcemap 和 chunkSizeWarningLimit

### 17. 静态资源无缓存头

**文件**: `server/index.ts:110` — `express.static` 无 `maxAge`。

---

## 最高 ROI 行动 (优先级排序)

| 优先级 | 行动 | 预期收益 | 改动量 |
|--------|------|---------|--------|
| 1 | 添加 11 个缺失索引 | 查询速度 5-10x | 1 文件 |
| 2 | SQLite pragma 优化 | 写入吞吐 2-3x | 4 行 |
| 3 | 添加 compression 中间件 | API 负载降 60-80% | 2 行 |
| 4 | 静态资源 `maxAge: '1y'` | 消除资源重验证 | 1 行 |
| 5 | pool.ts N+1 修复 | 高频端点响应降 50%+ | 1 文件 |
| 6 | Panorama 8 条 COUNT 合并 | DB 负载降低 | 1 文件 |
| 7 | xlsx 动态导入 | 首次加载减 470KB | 1 文件 |
