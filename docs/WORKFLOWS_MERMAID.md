# HRM 系统 4 大流程 Mermaid 图

## 1. 赏金榜任务流程 (Bounty Board Task Flow)

### 1.1 状态流转图

```mermaid
stateDiagram-v2
    [*] --> Draft: 用户/HR创建提案
    
    Draft --> PendingHR: 提案人提交审核
    Draft --> Rejected: HR驳回
    Rejected --> Draft: 提案人重新编辑
    
    PendingHR --> PendingAdmin: HRBP审核通过
    PendingHR --> Rejected: HRBP驳回
    
    PendingAdmin --> Approved: 总经理确认
    PendingAdmin --> PendingHR: 总经理退回
    
    Approved --> Published: 自动发布
    
    Published --> Claiming: HR发起认领
    
    Claiming --> InProgress: A角色确认\n或参与人满员+A角色到位
    
    InProgress --> Completed: 执行人/A角色\n标记100%完成
    InProgress --> Terminated: A角色发起\n提前完结
    
    Completed --> StarPhase: 进入STAR报告阶段
    Terminated --> StarPhase: 进入STAR报告阶段
    
    StarPhase --> RewardPhase: 所有R/A提交STAR
    
    RewardPhase --> Rewarded: 总经理批准\n奖励分配
    
    Rewarded --> Closed: 任务归档/关闭
    Closed --> [*]
    
    InProgress --> Closed: 管理员强制关闭
    
    Published -.-> Trash: 软删除
    Trash -.-> Published: 恢复
    Trash -.-> [*]: 永久删除
    
    note right of Draft
        提案状态: draft
        任务状态: 无
    end
    
    note right of PendingHR
        提案状态: pending_hr
        任务状态: proposing(若提案)
    end
    
    note right of Approved
        提案状态: approved
        任务状态: published
    end
    
    note right of StarPhase
        等待R/A填写STAR报告
        pool_role_claims.status='star_submitted'
    end
    
    note right of RewardPhase
        奖励分配流程(见流程4)
        pool_reward_plans状态转移
    end
```

### 1.2 参与者泳道图 - 赏金榜任务

```mermaid
sequenceDiagram
    participant User as 普通员工
    participant HR as HR/HRBP
    participant Admin as 总经理/Admin
    participant System
    
    User->>System: 1. 提交任务提案
    System->>HR: 通知新提案待审
    
    alt HRBP驳回
        HR->>System: 驳回提案
        System->>User: 通知驳回,可重新编辑
        User->>System: 重新提交
    else HRBP审批通过
        HR->>System: 提案通过
        alt 需要总经理确认(2级审批)
            System->>Admin: 通知待总经理复核
            Admin->>System: 最终批准
        else 自动批准(1级)
            System->>System: 自动批准
        end
    end
    
    System->>System: 任务发布为published状态
    System->>HR: 通知可发起认领
    
    HR->>System: 2. 发起认领 (start-claiming)
    HR->>System: 配置RACI角色及人数限制
    
    loop 多个员工认领角色
        User->>System: 选择R/A/C/I角色申请
        System->>HR: 通知待审批角色认领
        HR->>System: 审批认领申请
        System->>User: 通知角色认领结果
    end
    
    System->>System: 当参与人满或A角色到位时\n自动→in_progress
    
    alt A角色启动项目
        User->>System: 3. A角色或HR调用start-project
        System->>User: 验证R/A角色齐备
        System->>System: 任务→in_progress
    end
    
    User->>System: 4. 执行任务,更新进度
    
    alt 提前完结
        User->>System: A角色发起terminate
        System->>User: 进入STAR报告阶段
    else 正常完成
        User->>System: R/A标记100%完成
        System->>User: 进入STAR报告阶段
    end
    
    loop R/A成员STAR填写
        User->>System: 5. 填写STAR报告(S/T/A/R)
        System->>User: 校验数据
        User->>System: 提交STAR
    end
    
    System->>HR: 通知所有STAR已提交
    
    alt A角色发起奖励分配
        User->>System: 6. 发起奖励分配草稿
        User->>System: 填写各成员分配金额/绩效分
        User->>System: 提交待HR审核
    end
    
    HR->>System: 7. HR合规审计
    alt HR驳回
        HR->>User: 打回修改
        User->>System: 修改后重新提交
    else HR批准
        System->>Admin: 通知待总经理最终确认
    end
    
    Admin->>System: 8. 总经理最终批准
    alt 总经理拒绝
        Admin->>HR: 退回重审
        HR->>System: 重新审核
    else 总经理批准
        System->>System: 任务→rewarded
        System->>User: 通知奖励已批准\n下月工资发放
    end
    
    HR->>System: 9. 确认实际发放 (mark-paid)
    System->>User: 通知奖励已发放
    
    System->>System: 10. 任务归档/关闭
```

---

## 2. 绩效计划流程 (Performance Plan Flow)

### 2.1 状态流转图

```mermaid
stateDiagram-v2
    [*] --> Draft: 创建绩效计划\n(目标、OKR、专项任务)
    
    Draft --> PendingReview: 提交审核
    
    alt 一级审批(直接上级)
        PendingReview --> PendingDeptReview: 直接上级\n审批通过
        PendingReview --> Rejected: 直接上级\n驳回
    else 二级审批(部门负责人)
        PendingReview --> PendingDeptReview: 跳过\n(多级组织)
    end
    
    PendingDeptReview --> Published: 部门负责人\n审批通过
    PendingDeptReview --> Rejected: 部门负责人\n驳回
    
    Rejected --> Draft: 编辑后\n重新提交
    
    Published --> InProgress: 自动进入执行\n或手动发起执行
    
    InProgress --> PendingAssessment: R/A发起\n完成总结
    InProgress --> Returned: 管理员\n暂时退回
    
    Returned --> InProgress: R/A\n继续执行
    
    PendingAssessment --> Completed: 任务创建人\n打分完成
    
    Completed --> Settled: 完成归档/结案
    Settled --> [*]
    
    Draft --> [*]: 删除(仅创建人)
    
    Draft -.-> PendingReview: 撤回\n(待审状态)
    
    note right of Draft
        状态: draft
        操作: 编辑、提交、删除
        权限: 创建人
    end
    
    note right of PendingReview
        状态: pending_review
        等待: 直接上级(直属主管)审批
        操作: 撤回(待审)、转办
    end
    
    note right of PendingDeptReview
        状态: pending_dept_review
        等待: 部门负责人审批
        操作: 转办
    end
    
    note right of InProgress
        状态: in_progress
        执行: R角色执行,A角色验收
        操作: 进度更新、退回、完成总结
    end
    
    note right of PendingAssessment
        状态: pending_assessment
        等待: 任务创建人评分
        操作: 打分、完成
    end
```

### 2.2 参与者泳道图 - 绩效计划

```mermaid
sequenceDiagram
    participant Employee as 员工(创建人/R)
    participant Manager as 直属主管
    participant DeptHead as 部门负责人
    participant Creator as 创建人(A)
    participant System
    
    Employee->>System: 1. 创建绩效计划\n(目标S、指标M、方案A、相关R、时限T)
    
    Employee->>System: 2. 提交审核\n(draft→pending_review)
    System->>Manager: 通知待审核
    
    alt 一级审批: 直属主管
        Manager->>System: 审核通过
        System->>System: 根据组织层级\n决定是否进入二级审批
        
        alt 需要二级审批(跨部门等)
            System->>DeptHead: 转入二级审批
            DeptHead->>System: 部门负责人审核
        else 只需一级审批
            System->>System: 直接→published
        end
    else 驳回
        Manager->>System: 驳回申请
        System->>Employee: 通知驳回原因
        Employee->>System: 编辑后重新提交
    end
    
    System->>Employee: 计划已发布/执行
    System->>System: 状态→in_progress
    
    alt 执行过程
        loop 周期内更新
            Employee->>System: 更新进度/自评
            Employee->>System: 补充执行情况说明
        end
    else 执行困难
        Employee->>System: 发起退回\n(暂停执行)
        System->>System: 状态→returned
        Employee->>System: 解决问题后\n继续执行
    end
    
    alt 任务完成
        Employee->>System: R角色: 发起\n完成总结(assess)
        System->>Creator: 通知待评分\n(pending_assessment)
    end
    
    Creator->>System: 3. 查看R执行汇报
    Creator->>System: 4. 打分\n(百分制评分、批注)
    System->>System: 状态→completed
    
    System->>Employee: 通知最终评分结果
    System->>System: 5. 状态→settled\n(结案)
```

---

## 3. 工作流任务流程 (Workflow Task Flow)

### 3.1 状态流转图

```mermaid
stateDiagram-v2
    [*] --> Published: 系统发起\n工作流任务
    
    Published --> PendingReceipt: 任务下发\n给指定人员
    
    PendingReceipt --> Acknowledged: 任务接收人\n确认收到
    
    Acknowledged --> InProgress: 开始\n执行任务
    
    InProgress --> PendingAssessment: 执行人\n提交任务完成\n(可选里程碑)
    
    PendingAssessment --> Assessed: 审核人\n评审完成
    
    Assessed --> Completed: 自动结案
    
    Completed --> [*]
    
    InProgress -.-> Returned: 审核人\n退回修改
    Returned --> InProgress: 继续\n执行
    
    note right of Published
        工作流任务自动下发
        无人为干预的流程节点
    end
    
    note right of PendingReceipt
        状态: pending_receipt
        等待: 任务接收人确认
    end
    
    note right of InProgress
        状态: in_progress
        执行: 指定受理人执行
        可选: 里程碑节点
    end
    
    note right of PendingAssessment
        状态: pending_assessment
        等待: 审核人评审
    end
```

### 3.2 参与者泳道图 - 工作流任务

```mermaid
sequenceDiagram
    participant System
    participant Assignee as 任务接收人
    participant Reviewer as 审核人
    
    System->>Assignee: 1. 下发工作流任务\n(发票审核、合同审批等)
    System->>Assignee: 状态→pending_receipt\n通知任务已分配
    
    Assignee->>System: 2. 确认收到任务
    System->>System: 状态→acknowledged
    
    Assignee->>System: 3. 开始执行任务
    System->>System: 状态→in_progress
    
    loop 执行阶段
        Assignee->>System: 更新进度/提交证明
        alt 里程碑检查(可选)
            System->>Reviewer: 中间检查点
            Reviewer->>System: 确认进度
        end
    end
    
    Assignee->>System: 4. 提交任务完成
    System->>System: 状态→pending_assessment
    System->>Reviewer: 通知待评审
    
    alt 审核
        Reviewer->>System: 审核通过
        System->>System: 状态→assessed
        System->>System: 自动→completed\n(结案)
    else 需要修改
        Reviewer->>System: 驳回\n(返回in_progress)
        System->>System: 状态→returned
        Assignee->>System: 修改后\n重新提交
    end
    
    System->>Assignee: 5. 通知任务结案\n并记录绩效
```

---

## 4. 奖励分配流程 (Reward Distribution Flow)

### 4.1 状态流转图

```mermaid
stateDiagram-v2
    [*] --> Draft: A角色发起\n奖励分配草稿\n(仅completed/terminated任务)
    
    Draft --> EditDistribution: A角色编辑\n各成员分配金额\n&绩效加分
    EditDistribution --> Draft: 保存草稿
    
    Draft --> PendingHR: A角色提交\nHR合规审计\n(须所有R/A提交STAR)
    
    PendingHR --> Draft: HR驳回\n需修改方案
    
    PendingHR --> PendingAdmin: HRBP\n合规审批通过\n(可调整分配)
    
    PendingAdmin --> Draft: 总经理\n退回重审
    
    PendingAdmin --> Approved: 总经理\n最终批准
    
    Approved --> Paid: HR确认\n实际发放\n(mark-paid)
    
    Paid --> [*]
    
    note right of Draft
        状态: draft
        操作: 编辑分配、提交、删除
        权限: A角色(初期)或无草稿时幂等创建
    end
    
    note right of PendingHR
        状态: pending_hr
        验证: 所有R/A已提交STAR
        验证: 附件已上传(验收证明)
        操作: 转办HRBP
    end
    
    note right of PendingAdmin
        状态: pending_admin
        校验: 分配总额≤奖金池
        操作: 调整分配、转办
    end
    
    note right of Approved
        状态: approved
        计算: pay_period = 下月
        通知: 各成员已批准
    end
    
    note right of Paid
        状态: paid
        记录: paid_at时间戳
        通知: 确认发放
    end
```

### 4.2 参与者泳道图 - 奖励分配

```mermaid
sequenceDiagram
    participant A as A角色(负责人)
    participant R as R角色(执行人)
    participant HR as HRBP/HR
    participant Admin as 总经理/Admin
    participant System
    
    Note over System: 前提: 任务已completed/terminated
    Note over R,A: STAR报告已全部提交
    
    A->>System: 1. 发起奖励分配草稿\n(幂等:已有草稿则返回)
    System->>System: 查询所有R/A/C/I成员\n预填分配行
    System->>A: 返回草稿\n(预填金额=0)
    
    A->>System: 2. 编辑分配方案\n-各成员奖金金额\n-各成员绩效加分\n-上传验收附件
    System->>System: 校验:\n总分配≤奖金池
    
    A->>System: 3. 提交HR审核\n(draft→pending_hr)
    System->>System: 强校验:\n所有R/A已提交STAR
    System->>System: 强校验:\n附件不能为空
    
    System->>HR: 通知奖励方案待审\n(含I角色抄送知会)
    
    alt HR驳回
        HR->>System: 驳回申请\n(返回draft)
        System->>A: 通知驳回\n可修改后重新提交
        A->>System: 修改方案\n重新提交
    else HR合规审批通过
        HR->>System: 审批通过\n可调整分配金额/绩效分
        System->>System: 状态→pending_admin
        System->>Admin: 通知待总经理最终确认
    end
    
    alt 总经理拒绝
        Admin->>System: 拒绝\n(返回pending_hr)
        System->>HR: 退回重审
    else 总经理批准
        Admin->>System: 最终批准\n计算pay_period=下月
        System->>System: 状态→approved
        System->>System: 同步更新\ntask.status=rewarded
        
        loop 通知各成员
            System->>R: 🎉恭喜获得奖励\n金额¥XXX\n绩效+XX分\n下月工资发放
            System->>A: 同上通知
        end
    end
    
    alt HR确认发放
        HR->>System: 4. 标记实际发放\n(mark-paid)
        System->>System: 状态→paid\n记录paid_at
        
        loop 再次通知
            System->>R: ✅奖励已确认发放\n请留意账户到账
            System->>A: ✅奖励已确认发放
        end
    end
    
    System->>System: 5. 奖励分配流程完成
```

---

## 流程关键属性速查表

### 任务状态速查

| 流程 | 状态值 | 含义 | 权限 |
|------|--------|------|------|
| **赏金榜** | draft | 提案草稿 | 创建人编辑 |
| | pending_hr | HRBP审批 | HR/HRBP审批 |
| | pending_admin | 总经理复核 | 总经理审批 |
| | approved | 已批准 | 发布为published |
| | published | 已发布 | 员工可认领 |
| | claiming | 认领阶段 | HR配置RACI |
| | in_progress | 执行中 | R/A执行 |
| | completed | 已完成100% | 进入STAR阶段 |
| | terminated | 提前完结 | 进入STAR阶段 |
| | rewarded | 已发赏 | 最终状态 |
| | closed | 已关闭 | 归档 |
| **绩效计划** | draft | 草稿 | 创建人编辑 |
| | pending_review | 一级审批 | 直属主管审批 |
| | pending_dept_review | 二级审批 | 部门负责人审批 |
| | published | 已发布 | 进入执行 |
| | in_progress | 执行中 | R执行,A验收 |
| | pending_assessment | 待评分 | 创建人打分 |
| | completed | 已完成 | 进入结案 |
| | settled | 已结案 | 最终 |
| **工作流任务** | pending_receipt | 待接收 | 任务人确认 |
| | acknowledged | 已确认 | 开始执行 |
| | in_progress | 执行中 | 任务人执行 |
| | pending_assessment | 待评审 | 审核人评审 |
| | assessed | 已评审 | 自动结案 |
| | completed | 已完成 | 最终 |
| **奖励分配** | draft | 草稿 | A角色编辑 |
| | pending_hr | HR审计 | HRBP审批 |
| | pending_admin | 总经理确认 | 总经理审批 |
| | approved | 已批准 | HR发放 |
| | paid | 已发放 | 最终 |

### 核心表字段映射

| 表名 | 关键字段 | 用途 |
|------|---------|------|
| pool_tasks | status, proposal_status | 赏金榜任务状态 |
| pool_role_claims | status, role_name, pool_task_id, user_id | RACI角色分配 |
| pool_star_reports | is_submitted, situation, task_desc, action, result | STAR报告内容 |
| pool_reward_plans | status, total_bonus, pay_period | 奖励分配方案 |
| perf_plans | status, creator_id, assignee_id | 绩效计划 |
| workflow_nodes | status, skip_rule | 工作流节点 |

---

## 流程交互关系

```mermaid
graph TB
    Pool["赏金榜任务<br/>(Pool Task)"]
    Star["STAR报告<br/>(STAR Report)"]
    Reward["奖励分配<br/>(Reward Plan)"]
    Perf["绩效计划<br/>(Perf Plan)"]
    Workflow["工作流任务<br/>(Workflow Task)"]
    
    Pool -->|完成后进入| Star
    Star -->|R/A全部提交| Reward
    Reward -->|批准后| Pool
    
    Perf -->|可关联| Pool
    Workflow -->|独立流程| Workflow
    Perf -->|可独立| Perf
    
    style Pool fill:#ff9999
    style Star fill:#ffcc99
    style Reward fill:#99cc99
    style Perf fill:#99ccff
    style Workflow fill:#cc99ff
```
