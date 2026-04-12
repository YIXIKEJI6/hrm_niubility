# HRM 四大流程全景图

## 流程一：任务下发 (perf_plans — 团队负责人指派)

**入口**: TeamPerformance → "指派任务" → SmartTaskModal
**表**: perf_plans
**关键字段**: creator_id=负责人, assignee_id=执行人(R), approver_id=负责人(A)
**核心机制**: 下发签收制（无审批链），全员签收后 A 发车

```mermaid
flowchart TD
    A[团队负责人打开 SmartTaskModal<br/>设置 R=执行人, A=自己] --> B{保存草稿 or 提交?}
    B -->|草稿| C[POST /api/perf/plans<br/>status=draft]
    B -->|直接下发| D[POST /api/perf/plans<br/>status=draft]
    D --> E[POST /api/perf/plans/:id/dispatch]
    C -->|后续手动下发| E
    
    E --> F[status=pending_receipt<br/>初始化签收状态<br/>R和A 均需签收]
    F --> G[通知 R+A: 新任务待查收]
    
    G --> H{R/A 签收操作}
    H -->|确认签收| I[receipt_status 更新为 confirmed]
    H -->|拒绝签收| J[status → draft<br/>通知负责人被拒签]
    
    I --> K{全员都签收了?}
    K -->|否| H
    K -->|是| L[通知 A: 全员已签收<br/>可以发车]
    
    L --> M[A 点击发车<br/>POST /plans/:id/start-task]
    M --> N[status=in_progress<br/>任务正式启动]
    
    J --> O[负责人修改任务<br/>重新下发]
    
    N --> P{执行中操作}
    P -->|更新进度| N
    P -->|退回任务| Q[returned → draft<br/>R或A可退回]
    P -->|发起验收| R[R或A 提交验收<br/>pending_assessment]
    
    R --> S{创建者评分}
    S --> T[assessed → completed 结案]
    T --> U[抄送 HRBP + GM]

    style C fill:#e3f2fd
    style N fill:#e8f5e9
    style T fill:#fff3e0
    style J fill:#ffebee
```

### 任务下发状态机
```
draft → pending_receipt (下发签收)
pending_receipt → in_progress (A发车，全员已签收)
pending_receipt → draft (有人拒签)
in_progress → pending_assessment (R/A发起验收)
in_progress → returned → draft (退回重编)
pending_assessment → assessed → completed (创建者评分结案)
```

### 签收机制详解
- 下发时收集 R + A 的 userId 列表
- 每人独立签收 (`confirm-receipt`) 或拒签 (`reject-receipt`)
- 任一人拒签 → 任务退回 draft
- 全员确认 → 仅 A(负责人) 有权"发车"启动任务

---

## 流程二：任务申请 (perf_plans — 员工自主申请)

**入口**: TeamPerformance → "申请新任务" / PersonalGoals / PersonalGoalsPanel → SmartTaskModal
**表**: perf_plans
**关键字段**: creator_id=员工自己, assignee_id=员工自己(R), approver_id=直属上级
**核心机制**: 审批链制（直属上级→部门负责人）

```mermaid
flowchart TD
    A[员工打开 申请新任务<br/>SmartTaskModal type=personal] --> B{保存草稿 or 提交?}
    B -->|草稿| C[POST /api/perf/plans<br/>status=draft<br/>assignee_id=自己]
    B -->|提交| D[POST /api/perf/plans<br/>创建 draft]
    
    D --> E[查询直属上级<br/>GET /api/org/my-superior<br/>设为 approver_id]
    E --> F[POST /api/perf/plans/:id/submit]
    
    F --> G{GM/Admin?}
    G -->|是| H[免审直通<br/>→ approved → in_progress<br/>抄送 HRBP]
    G -->|否| I{WorkflowEngine 计算审批链}
    
    I --> J{一审: 直属上级有效?}
    J -->|有效| K[pending_review<br/>通知直属上级]
    J -->|跳过| L{二审: 部门负责人有效?}
    L -->|有效| M[pending_dept_review<br/>通知部门负责人]
    L -->|跳过| ERR[报错: 无有效审批人]
    
    K --> N{直属上级审批}
    N -->|通过| O{二审是否需要?}
    N -->|驳回| P[rejected<br/>通知员工]
    N -->|转办| Q[更换 approver_id]
    
    O -->|跳过| R[approved → in_progress]
    O -->|需要| S[pending_dept_review<br/>通知部门负责人]
    
    M --> T{部门负责人审批}
    S --> T
    T -->|通过| R
    T -->|驳回| P
    T -->|转办| U[更换 dept_head_id]
    
    P --> V[员工修改后 resubmit]
    V --> F
    
    R --> W[in_progress 执行中]
    W --> X{员工操作}
    X -->|更新进度| W
    X -->|发起验收| Y[pending_assessment<br/>等待创建者评分]
    X -->|退回| Z[returned → draft]
    
    Y --> AA{创建者评分}
    AA -->|注意: 创建者=员工自己!| AB[assessed → completed 结案]
    AB --> AC[抄送 HRBP + GM]

    style C fill:#e3f2fd
    style R fill:#e8f5e9
    style AB fill:#fff3e0
    style ERR fill:#ffebee
    style P fill:#ffebee
```

### 任务申请状态机
```
draft → pending_review (一审: 直属上级)
pending_review → pending_dept_review (二审: 部门负责人)
pending_review → approved(→in_progress) (一审直接通过)
pending_review → rejected → draft
pending_dept_review → approved(→in_progress)
pending_dept_review → rejected → draft
in_progress → pending_assessment → assessed → completed
in_progress → returned → draft
```

### 任务下发 vs 任务申请 关键区别

| 维度 | 任务下发 | 任务申请 |
|------|---------|---------|
| **发起人** | 团队负责人 | 员工自己 |
| **执行人(R)** | 被指派的下属 | 员工自己 |
| **负责人(A)** | 负责人自己 | 员工的直属上级 |
| **启动机制** | 签收制: dispatch → 全员签收 → A发车 | 审批制: submit → 上级审批 → 自动启动 |
| **审批链** | 无（直接下发签收） | 直属上级 → 部门负责人 |
| **评分人** | creator_id (负责人) | creator_id (员工自己!) |
| **潜在问题** | - | 自己给自己打分 |

---

## 流程三：提案审批 (pool_tasks — 提案流程)

**入口**: CompanyPerformance → "发布提案" → SmartTaskModal
**表**: pool_tasks
**双状态架构**: proposal_status 管审批流程, status 管任务生命周期
**审批链**: HR(HRBP) → GM(总经理)

```mermaid
flowchart TD
    A[任何员工打开 CompanyPerformance<br/>点击发布提案] --> B{保存草稿 or 提交?}
    B -->|草稿| C[POST /api/pool/tasks<br/>proposal_status=draft<br/>status=proposing]
    B -->|提交| D{发起人身份?}
    
    D -->|GM/Admin| E[免审直通<br/>proposal_status=approved<br/>status=published<br/>通知全员 + 抄送HR]
    D -->|普通员工| F{WorkflowEngine 审批链}
    
    F --> G{HR(HRBP)节点有效?}
    G -->|有效| H[proposal_status=pending_hr<br/>status=proposing<br/>通知 HRBP 审批]
    G -->|跳过| I{GM节点有效?}
    I -->|有效| J[proposal_status=pending_admin<br/>通知 GM]
    I -->|跳过| K[proposal_status=approved<br/>status=published]
    
    H --> L{HR 审批操作}
    L -->|通过| M{GM 免审?<br/>HR=GM 或 GM 跳过}
    L -->|编辑SMART+通过| M
    L -->|驳回| N[proposal_status=rejected<br/>通知提案人]
    
    M -->|免审| O[直接 approved + published<br/>通知全员]
    M -->|需GM复核| P[pending_admin<br/>通知 GM 复核]
    
    P --> Q{GM 复核操作}
    Q -->|通过| R[proposal_status=approved<br/>status=published<br/>全员可见]
    Q -->|编辑SMART+通过| R
    Q -->|驳回| N
    
    N --> S[提案人修改草稿]
    S --> T[resubmit<br/>proposal_status=pending_hr]
    
    C --> U[草稿列表<br/>可编辑/删除/提交]
    U --> D
    
    R --> V[进入赏金榜<br/>等待认领]
    O --> V
    E --> V

    style C fill:#e3f2fd
    style R fill:#e8f5e9
    style E fill:#e8f5e9
    style O fill:#e8f5e9
    style N fill:#ffebee
```

### 提案审批状态机 (proposal_status)
```
draft → pending_hr → pending_admin → approved
                   → approved (GM免审直通)
                   → rejected → draft
       pending_admin → approved
                     → rejected → draft
```

### HR/GM 审批时可编辑字段
- SMART 字段 (S/M/A/R/T) — 重建 description
- PDCA 时间 (plan_time/do_time/check_time/act_time)
- 奖金金额 (bonus)、奖励类型 (reward_type)
- 人数上限 (max_participants)、分类 (category)
- 附件 (attachments)
- 标题 (title/summary)

---

## 流程四：赏金榜任务 (pool_tasks — 认领到完结)

**入口**: CompanyPerformance 赏金榜 → 认领角色
**表**: pool_tasks + pool_role_claims
**前置条件**: 提案审批通过后 status=published

```mermaid
flowchart TD
    A[赏金榜展示<br/>status=published<br/>全员可见] --> B[员工申请认领 RACI 角色<br/>POST /tasks/:id/claim]
    
    B --> C[创建 pool_role_claims<br/>status=pending]
    
    C --> D{HR/创建者 审批认领}
    D -->|通过| E[claims.status=approved]
    D -->|拒绝| F[claims.status=rejected]
    
    E --> G{自动检测:<br/>A角色已有 approved?}
    G -->|是| H[tasks.status → claiming<br/>开始组队阶段]
    G -->|否| I[继续等待<br/>status=published]
    
    H --> J{HR 面板检查角色}
    J -->|R+A 未满员| K[继续等待认领<br/>或HR直接分配]
    J -->|R+A 到位| L[HR/A 点击启动项目<br/>POST /tasks/:id/start-project]
    
    L --> M{校验必填角色}
    M -->|缺角色| N[报错: 必填角色未满员]
    M -->|到位| O[status=in_progress<br/>项目正式启动<br/>通知 RA 成员]
    
    O --> P{项目执行中}
    P -->|更新进度| O
    P -->|进度100% 正常完结| Q[POST /tasks/:id/complete<br/>status=completed<br/>star_phase_started_at=now]
    P -->|A 提前完结| R[POST /tasks/:id/terminate<br/>status=terminated<br/>需填: 原因+完成度+交付物]
    
    Q --> S[RA 成员填写 STAR 报告<br/>S-情境 T-任务 A-行动 R-结果]
    R --> S
    
    S --> T[HR 分配奖励<br/>POST /tasks/:id/distribute-rewards<br/>按 claim 分配 reward]
    T --> U[status=rewarded<br/>通知所有参与者]
    
    U --> V[HR 归档<br/>POST /tasks/:id/close]
    V --> W[status=closed<br/>流程完结]

    style A fill:#e3f2fd
    style O fill:#e8f5e9
    style Q fill:#fff3e0
    style R fill:#fff3e0
    style U fill:#c8e6c9
    style W fill:#f5f5f5
    style N fill:#ffebee
```

### 赏金榜任务状态机 (pool_tasks.status)
```
proposing → published  (提案审批通过)
published → claiming   (A角色认领通过)
claiming  → in_progress (HR/A启动项目, R+A满员)
in_progress → completed   (满分完结, progress=100%)
in_progress → terminated  (A提前完结, 需说明原因)
completed/terminated → rewarded (HR发赏)
rewarded → closed (HR归档)
```

### 角色认领状态机 (pool_role_claims.status)
```
pending → approved  (HR/创建者审批通过)
pending → rejected  (拒绝)
```

### RACI 角色说明
| 角色 | 含义 | 必填 | 人数限制 | 启动校验 |
|------|------|------|---------|---------|
| R | 执行者 Responsible | 是 | 由 roles_config 定义 | 必须满员 |
| A | 责任验收者 Accountable | 是 | 通常 max=1 | 必须有人 |
| C | 被咨询者 Consulted | 否 | 无限制 | 不校验 |
| I | 被告知者 Informed | 否 | 无限制 | 不校验 |

---

## 四流程对比总览

| 维度 | 流程一: 任务下发 | 流程二: 任务申请 | 流程三: 提案审批 | 流程四: 赏金榜 |
|------|:---:|:---:|:---:|:---:|
| **数据表** | perf_plans | perf_plans | pool_tasks | pool_tasks + claims |
| **发起人** | 团队负责人 | 员工自己 | 任何人 | 提案通过后自动 |
| **执行人** | 被指派下属 | 员工自己 | N/A | RACI 认领 |
| **启动机制** | 签收制 (dispatch) | 审批制 (submit) | HR→GM 审批 | 认领→启动项目 |
| **审批链** | 无 | 上级→部门负责人 | HR→GM | N/A |
| **评分人** | 任务创建者 | 创建者(=自己!) | N/A | N/A |
| **奖励发放** | 无 | 无 | N/A | HR 按 claim 分配 |
| **完结方式** | 验收评分→结案 | 验收评分→结案 | 审批通过→发布 | STAR→发赏→归档 |
| **入口** | TeamPerformance | TeamPerf/PersonalGoals | CompanyPerformance | CompanyPerformance |

---

## 已知问题标注

### 流程二: 自己给自己评分
任务申请时 `creator_id = assignee_id = 员工自己`，而评分人逻辑取 `creator_id`，导致员工自己给自己打分。

### 流程三+四: PDCA 覆盖风险 (已修复)
HR/GM 审批时编辑 SMART 但未传 PDCA 时间时，原有 PDCA 会被空字符串覆盖。已修复为 fallback 到数据库原值。

### 流程四: start-project PDCA 覆盖 (已修复)
启动项目时编辑 SMART 但未传 PDCA 时，同上问题。已修复。
