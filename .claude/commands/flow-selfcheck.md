---
description: 流程修复自查 — 每次修改流程相关代码后执行，检查RACI不可变、审批可达、三入口一致性
user-invocable: true
---

# 流程修复自查

执行以下 5 项检查，输出通过/失败报告：

## 1. RACI 不可变检查
搜索 `server/routes/perf.ts` 中所有 `UPDATE perf_tasks SET approver_id` 语句。
- 仅允许在**创建**（INSERT）和**重新提交审批**（resubmit/draft→pending_review）时设置
- 签收完成、审批通过、驳回等流程操作中**不允许**修改 `approver_id`
- flow2 的审批人应存到 `dept_head_id`

## 2. 审批可达性检查
检查 `server/routes/workflows.ts` 的 pending 查询：
- `approver_id = ?` 和 `dept_head_id = ?` 两个条件都要匹配
- flow2（`flow_type='application'`）的审批人走 `dept_head_id`

## 3. 自审批拦截
- 后端：`perf.ts` 的 approve/reject 端点必须有 `creator_id === req.userId` 拦截
- 前端：三个入口的 `approverMode` 都包含 `creator_id !== currentUser.id` 条件

## 4. 三入口一致性
对比以下三个文件中的 `approverMode` 逻辑，确认条件一致：
- `src/pages/TeamPerformance.tsx`
- `src/components/PersonalGoalsPanel.tsx`
- `src/pages/MyWorkflows.tsx`

## 5. 多流程隔离
检查改动是否只影响目标流程，不波及其他：
- flow1（下发/dispatch）：`flow_type` 为空或 `'dispatch'`
- flow2（申请/application）：`flow_type = 'application'`
- flow3（提案）：走 `proposal_status`
- flow4（赏金榜）：走 `pool_tasks` 相关逻辑

输出格式：
```
✅ RACI不可变: 通过 / ❌ 发现 N 处违规
✅ 审批可达: 通过 / ❌ 查询缺少 dept_head_id 条件
✅ 自审批拦截: 通过 / ❌ 缺少 creator 排除
✅ 三入口一致: 通过 / ❌ 不一致详情
✅ 多流程隔离: 通过 / ❌ 影响了 flowX
```
