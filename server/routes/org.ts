import { Router, Request, Response } from 'express';
import { getDb } from '../config/database';
import { authMiddleware, requireRole, requireSuperAdmin, AuthRequest, isSuperAdmin, SUPER_ADMIN_ID } from '../middleware/auth';
import { getDepartmentList, getDepartmentMembers } from '../services/wecom';
import { verifySignature, decryptMsg, parseXml } from '../utils/wecom-crypto';

const router = Router();

// 全量同步组织架构 (仅管理员)
router.post('/sync', authMiddleware, requireRole('admin', 'hr'), async (_req, res) => {
  try {
    const db = getDb();

    // 1. 预检查配置
    const { wecomConfig } = await import('../config/wecom');
    if (!wecomConfig.corpId) {
      return res.status(400).json({ code: 400, message: '未配置企业微信 Corp ID (WECOM_CORP_ID)' });
    }
    if (!wecomConfig.contactSecret && !wecomConfig.secret) {
      return res.status(400).json({ code: 400, message: '未配置企业微信通讯录密钥 (WECOM_CONTACT_SECRET)，请在管理后台 → 应用管理 → 通讯录同步 中获取' });
    }

    // 2. 拉取企微部门列表
    const departments = await getDepartmentList();

    const deptStmt = db.prepare(`INSERT OR IGNORE INTO departments (id, name, parent_id) VALUES (?, ?, ?)`);
    // 只插入新用户，不覆盖已有用户的编辑信息
    const userStmt = db.prepare(
      `INSERT OR IGNORE INTO users (id, name, title, department_id, avatar_url, mobile, email, synced_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    );

    // 3. 同步部门
    const syncDeptTransaction = db.transaction(() => {
      for (const dept of departments) {
        deptStmt.run(dept.id, dept.name, dept.parentid || 0);
      }
    });
    syncDeptTransaction();

    // 4. 同步各部门成员
    let memberCount = 0;
    let newCount = 0;
    let updateCount = 0;
    const failedDepts: string[] = [];
    const existingUserIds = new Set(
      (db.prepare('SELECT id FROM users').all() as any[]).map((u: any) => u.id)
    );

    for (const dept of departments) {
      try {
        const members = await getDepartmentMembers(dept.id);
        const memberTransaction = db.transaction(() => {
          for (const m of members) {
            const userId = m.userid || m.UserId;
            if (!userId) continue;
            
            if (existingUserIds.has(userId)) {
              updateCount++;
            } else {
              newCount++;
              existingUserIds.add(userId);
            }
            
            userStmt.run(
              userId,
              m.name,
              m.position || m.title || '',
              dept.id,
              m.avatar || m.thumb_avatar || '',
              m.mobile || '',
              m.email || '',
              new Date().toISOString()
            );
            memberCount++;
          }
        });
        memberTransaction();
      } catch (e: any) {
        console.error(`同步部门 ${dept.name} 成员失败:`, e.message);
        failedDepts.push(dept.name);
      }
    }

    // 5. 同步部门 leader（仅填充本地未设置的，不覆盖已手动指定的负责人）
    for (const dept of departments) {
      if (dept.department_leader && dept.department_leader.length > 0) {
        const leaderId = Array.isArray(dept.department_leader) ? dept.department_leader[0] : dept.department_leader;
        db.prepare('UPDATE departments SET leader_user_id = ? WHERE id = ? AND (leader_user_id IS NULL OR leader_user_id = ?)').run(leaderId, dept.id, '');
      }
    }

    return res.json({
      code: 0,
      data: {
        departments: departments.length,
        members: memberCount,
        new_members: newCount,
        updated_members: updateCount,
        failed_departments: failedDepts,
        using_contact_secret: !!wecomConfig.contactSecret,
      }
    });
  } catch (error: any) {
    console.error('同步企微通讯录失败:', error);
    return res.status(500).json({ code: 500, message: error.message });
  }
});

// 获取所有部门列表
router.get('/departments', authMiddleware, (_req, res) => {
  const db = getDb();
  const departments = db.prepare('SELECT * FROM departments ORDER BY sort_order').all();
  return res.json({ code: 0, data: departments });
});

// 获取组织树
router.get('/tree', authMiddleware, (_req, res) => {
  const db = getDb();
  const departments = db.prepare('SELECT * FROM departments ORDER BY sort_order').all() as any[];
  const userCounts = db.prepare("SELECT department_id, COUNT(*) as count FROM users WHERE status = 'active' GROUP BY department_id").all() as any[];

  const countMap: Record<number, number> = {};
  for (const uc of userCounts) countMap[uc.department_id] = uc.count;

  // 递归计算子树内的总成员数（用于过滤幽灵部门）
  function subtotalMembers(id: number): number {
    const children = departments.filter((d) => d.parent_id === id);
    return (countMap[id] || 0) + children.reduce((sum, c) => sum + subtotalMembers(c.id), 0);
  }

  function buildTree(parentId: number): any[] {
    return departments
      .filter((d) => d.parent_id === parentId)
      // 过滤掉整个子树都没有成员的幽灵部门
      .filter((d) => subtotalMembers(d.id) > 0)
      .map((d) => ({
        ...d,
        member_count: countMap[d.id] || 0,
        children: buildTree(d.id),
      }));
  }

  return res.json({ code: 0, data: buildTree(0) });
});


// 部门详情 + 成员
router.get('/departments/:id', authMiddleware, (req, res) => {
  const db = getDb();
  const dept = db.prepare('SELECT * FROM departments WHERE id = ?').get(req.params.id);
  const members = db.prepare("SELECT id, name, title, avatar_url, role, status FROM users WHERE department_id = ? AND status = 'active'").all(req.params.id);

  if (!dept) return res.status(404).json({ code: 404, message: '部门不存在' });
  return res.json({ code: 0, data: { ...(dept as Record<string, any>), members } });
});

// 用户详情
router.get('/users/:id', authMiddleware, (req, res) => {
  const db = getDb();
  const user = db.prepare('SELECT id, name, title, department_id, avatar_url, mobile, email, role, status FROM users WHERE id = ?').get(req.params.id);

  if (!user) return res.status(404).json({ code: 404, message: '用户不存在' });
  return res.json({ code: 0, data: user });
});

// 获取基础用户列表 (供全员选人组件使用)
router.get('/users', authMiddleware, (_req, res) => {
  const db = getDb();
  // 返回 id, name, role 给选人组件和流程路径节点名称解析
  const users = db.prepare('SELECT id, name, role FROM users WHERE status = ? ORDER BY name').all('active');
  return res.json({ code: 0, data: users });
});


// 手动新增员工 (HR / Admin)
router.post('/users', authMiddleware, requireRole('admin', 'hr'), (req: AuthRequest, res) => {
  const { id, name, title, department_id, mobile, email } = req.body;
  const db = getDb();

  if (!id?.trim()) return res.status(400).json({ code: 400, message: '工号不能为空' });
  if (!name?.trim()) return res.status(400).json({ code: 400, message: '姓名不能为空' });

  const existing = db.prepare('SELECT id FROM users WHERE id = ?').get(id.trim());
  if (existing) return res.status(400).json({ code: 400, message: `工号「${id.trim()}」已存在` });

  if (department_id) {
    const dept = db.prepare('SELECT id FROM departments WHERE id = ?').get(department_id);
    if (!dept) return res.status(400).json({ code: 400, message: '所选部门不存在' });
  }

  db.prepare(
    `INSERT INTO users (id, name, title, department_id, mobile, email, status, role) VALUES (?, ?, ?, ?, ?, ?, 'active', 'employee')`
  ).run(id.trim(), name.trim(), title || '', department_id || 0, mobile || '', email || '');

  return res.json({ code: 0, message: `已添加员工「${name.trim()}」` });
});

// 更新用户信息 (HR / Admin)
router.put('/users/:id', authMiddleware, requireRole('admin', 'hr'), (req: AuthRequest, res) => {
  const { name, title, mobile, email, role, status } = req.body;
  const db = getDb();
  const user = db.prepare('SELECT id FROM users WHERE id = ?').get(req.params.id);
  if (!user) return res.status(404).json({ code: 404, message: '用户不存在' });

  // 不允许通过此接口修改 super admin 的角色
  if (isSuperAdmin(req.params.id) && role && role !== 'admin') {
    return res.status(403).json({ code: 403, message: '不可修改最高系统管理员角色' });
  }

  db.prepare('UPDATE users SET name=?, title=?, mobile=?, email=?, role=?, status=? WHERE id=?')
    .run(name, title, mobile, email, role, status, req.params.id);
  return res.json({ code: 0, message: '更新成功' });
});



// 获取当前的角色配置列表
router.get('/role-tags', authMiddleware, requireSuperAdmin(), (_req, res) => {
  const db = getDb();
  const tags = db.prepare(`
    SELECT t.id, t.user_id, t.tag, t.label, u.name as user_name, d.name as department_name
    FROM user_role_tags t
    JOIN users u ON t.user_id = u.id
    LEFT JOIN departments d ON u.department_id = d.id
    ORDER BY t.created_at DESC
  `).all();
  return res.json({ code: 0, data: tags });
});

// 添加/取消 用户的高层角色标签 (仅 Super Admin)
router.post('/role-tags', authMiddleware, requireSuperAdmin(), (req: AuthRequest, res) => {
  const { userId, tag, isSet, label } = req.body;
  if (!userId || !tag) return res.status(400).json({ code: 400, message: '参数缺失' });
  const db = getDb();

  // 不要尝试配置超级管理员为别的标签，因为不需要且多余
  if (isSuperAdmin(userId) && isSet) {
      return res.status(400).json({ code: 400, message: '最高系统管理员拥有全局最高权限，无需打标签' });
  }

  const user = db.prepare('SELECT name FROM users WHERE id = ?').get(userId) as any;
  if (!user) return res.status(404).json({ code: 404, message: '用户不存在' });

  if (isSet) {
    try {
      db.prepare('INSERT OR IGNORE INTO user_role_tags (user_id, tag, label) VALUES (?, ?, ?)').run(userId, tag, label || tag);
      return res.json({ code: 0, message: `已将「${user.name}」设为「${label || tag}」` });
    } catch (e) {
      return res.status(500).json({ code: 500, message: '数据库写入失败' });
    }
  } else {
    try {
      db.prepare('DELETE FROM user_role_tags WHERE user_id = ? AND tag = ?').run(userId, tag);
      return res.json({ code: 0, message: `已撤销「${user.name}」的「${label || tag}」头衔` });
    } catch (e) {
      return res.status(500).json({ code: 500, message: '数据库删除失败' });
    }
  }
});

// 获取所有用户列表 (用于管理员分配选人)
router.get('/all-users', authMiddleware, requireSuperAdmin(), (_req, res) => {
  const db = getDb();
  const users = db.prepare(
    `SELECT u.id, u.name, u.title, u.role, u.avatar_url, u.department_id, d.name as department_name
     FROM users u LEFT JOIN departments d ON u.department_id = d.id
     WHERE u.status = 'active' ORDER BY u.name`
  ).all();
  return res.json({ code: 0, data: users });
});

// 获取用户列表 (admin/hr，用于审批流程指定人选)
router.get('/users-list', authMiddleware, requireRole('admin', 'hr'), (_req, res) => {
  const db = getDb();
  const users = db.prepare(
    `SELECT u.id, u.name, u.title, u.role, u.avatar_url, u.department_id, d.name as department_name
     FROM users u LEFT JOIN departments d ON u.department_id = d.id
     WHERE u.status = 'active' ORDER BY u.name`
  ).all();
  return res.json({ code: 0, data: users });
});

// 删除用户 (设为离职, 仅 admin/hr)
router.delete('/users/:id', authMiddleware, requireRole('admin', 'hr'), (req: AuthRequest, res) => {
  const db = getDb();
  const user = db.prepare('SELECT id, name, status FROM users WHERE id = ?').get(req.params.id) as any;
  if (!user) return res.status(404).json({ code: 404, message: '用户不存在' });

  // 不允许删除超级管理员
  if (isSuperAdmin(req.params.id)) {
    return res.status(403).json({ code: 403, message: '不可删除最高系统管理员' });
  }

  if (user.status === 'resigned') return res.json({ code: 0, message: `${user.name} 已是离职状态` });

  db.prepare("UPDATE users SET status = 'resigned' WHERE id = ?").run(req.params.id);
  return res.json({ code: 0, message: `已将「${user.name}」设为离职` });
});

// 调整用户部门 (仅 admin/hr)
router.put('/users/:id/department', authMiddleware, requireRole('admin', 'hr'), (req: AuthRequest, res) => {
  const { department_id } = req.body;
  const db = getDb();

  if (!department_id) return res.status(400).json({ code: 400, message: '缺少目标部门 ID' });

  const user = db.prepare('SELECT id, name FROM users WHERE id = ?').get(req.params.id) as any;
  if (!user) return res.status(404).json({ code: 404, message: '用户不存在' });

  const dept = db.prepare('SELECT id, name FROM departments WHERE id = ?').get(department_id) as any;
  if (!dept) return res.status(404).json({ code: 404, message: '目标部门不存在' });

  db.prepare('UPDATE users SET department_id = ? WHERE id = ?').run(department_id, req.params.id);
  return res.json({ code: 0, message: `已将 ${user.name} 调至 ${dept.name}` });
});

// ── 部门管理 CRUD ─────────────────────────────────────────────────────

// 创建子部门
router.post('/departments', authMiddleware, requireRole('admin', 'hr'), (req: AuthRequest, res) => {
  const { name, parent_id } = req.body;
  const db = getDb();
  if (!name?.trim()) return res.status(400).json({ code: 400, message: '部门名称不能为空' });

  const parentId = parent_id || 0;
  if (parentId > 0) {
    const parent = db.prepare('SELECT id FROM departments WHERE id = ?').get(parentId);
    if (!parent) return res.status(404).json({ code: 404, message: '上级部门不存在' });
  }

  const result = db.prepare('INSERT INTO departments (name, parent_id) VALUES (?, ?)').run(name.trim(), parentId);
  return res.json({ code: 0, data: { id: result.lastInsertRowid }, message: `已创建部门「${name.trim()}」` });
});

// 重命名部门
router.put('/departments/:id', authMiddleware, requireRole('admin', 'hr'), (req: AuthRequest, res) => {
  const { name } = req.body;
  const db = getDb();
  if (!name?.trim()) return res.status(400).json({ code: 400, message: '部门名称不能为空' });

  const dept = db.prepare('SELECT id FROM departments WHERE id = ?').get(req.params.id);
  if (!dept) return res.status(404).json({ code: 404, message: '部门不存在' });

  db.prepare('UPDATE departments SET name = ? WHERE id = ?').run(name.trim(), req.params.id);
  return res.json({ code: 0, message: `已重命名为「${name.trim()}」` });
});

// 设置部门负责人
router.put('/departments/:id/leader', authMiddleware, requireRole('admin', 'hr'), (req: AuthRequest, res) => {
  const { leader_user_id } = req.body;
  const db = getDb();

  if (!leader_user_id) return res.status(400).json({ code: 400, message: '缺少负责人 ID' });

  const dept = db.prepare('SELECT id, name FROM departments WHERE id = ?').get(req.params.id) as any;
  if (!dept) return res.status(404).json({ code: 404, message: '部门不存在' });

  const user = db.prepare('SELECT id, name FROM users WHERE id = ?').get(leader_user_id) as any;
  if (!user) return res.status(404).json({ code: 404, message: '用户不存在' });

  db.prepare('UPDATE departments SET leader_user_id = ? WHERE id = ?').run(leader_user_id, req.params.id);
  return res.json({ code: 0, message: `已将「${user.name}」设为「${dept.name}」的负责人` });
});

// 移动部门 (修改上级)
router.put('/departments/:id/parent', authMiddleware, requireRole('admin', 'hr'), (req: AuthRequest, res) => {
  const { parent_id } = req.body;
  const db = getDb();
  const deptId = Number(req.params.id);

  if (parent_id === undefined) return res.status(400).json({ code: 400, message: '缺少目标上级部门' });
  if (Number(parent_id) === deptId) return res.status(400).json({ code: 400, message: '不能将部门移动到自身下级' });

  const dept = db.prepare('SELECT id, name FROM departments WHERE id = ?').get(deptId) as any;
  if (!dept) return res.status(404).json({ code: 404, message: '部门不存在' });

  if (Number(parent_id) > 0) {
    const parent = db.prepare('SELECT id, name FROM departments WHERE id = ?').get(parent_id) as any;
    if (!parent) return res.status(404).json({ code: 404, message: '目标上级部门不存在' });
    db.prepare('UPDATE departments SET parent_id = ? WHERE id = ?').run(parent_id, deptId);
    return res.json({ code: 0, message: `已将「${dept.name}」移至「${parent.name}」下` });
  }

  db.prepare('UPDATE departments SET parent_id = 0 WHERE id = ?').run(deptId);
  return res.json({ code: 0, message: `已将「${dept.name}」移至顶级` });
});

// 删除部门
router.delete('/departments/:id', authMiddleware, requireRole('admin', 'hr'), (req: AuthRequest, res) => {
  const db = getDb();
  const deptId = Number(req.params.id);

  const dept = db.prepare('SELECT id, name FROM departments WHERE id = ?').get(deptId) as any;
  if (!dept) return res.status(404).json({ code: 404, message: '部门不存在' });

  // 检查是否有子部门
  const children = db.prepare('SELECT COUNT(*) as count FROM departments WHERE parent_id = ?').get(deptId) as any;
  if (children.count > 0) {
    return res.status(400).json({ code: 400, message: `「${dept.name}」下还有 ${children.count} 个子部门，请先移走或删除子部门` });
  }

  // 1. 检查是否还有在职成员
  const activeMembers = db.prepare("SELECT COUNT(*) as count FROM users WHERE department_id = ? AND status = 'active'").get(deptId) as any;
  if (activeMembers.count > 0) {
    return res.status(400).json({ code: 400, message: `「${dept.name}」下还有 ${activeMembers.count} 名在职成员，请先将成员调至其他部门` });
  }

  // 2. 将离职成员的部门关联置空（转移到虚拟部门 0），防止产生查询幽灵数据
  db.prepare("UPDATE users SET department_id = 0 WHERE department_id = ? AND status = 'resigned'").run(deptId);

  // 3. 安全删除部门
  db.prepare('DELETE FROM departments WHERE id = ?').run(deptId);
  return res.json({ code: 0, message: `已删除部门「${dept.name}」` });
});



// ─── 部门绩效统计 ─────────────────────────────────────────────────
router.get('/departments/:id/stats', authMiddleware, (req: AuthRequest, res) => {
  const db = getDb();
  const deptId = parseInt(req.params.id);

  // ── 递归收集该部门及所有子部门的 ID
  function getAllDeptIds(id: number): number[] {
    const children = db.prepare('SELECT id FROM departments WHERE parent_id = ?').all(id) as any[];
    return [id, ...children.flatMap((c: any) => getAllDeptIds(c.id))];
  }
  const allDeptIds = getAllDeptIds(deptId);

  // 直属成员（仅当前部门）
  const directMembers = db.prepare(
    `SELECT id, name FROM users WHERE department_id = ? AND status = 'active'`
  ).all(deptId) as any[];

  // 含子部门的全部成员
  const deptPlaceholders = allDeptIds.map(() => '?').join(',');
  const allMembers = db.prepare(
    `SELECT id, name FROM users WHERE department_id IN (${deptPlaceholders}) AND status = 'active'`
  ).all(...allDeptIds) as any[];

  const memberIds = allMembers.map((m: any) => m.id);
  const directMemberCount = directMembers.length;
  const totalMemberCount = memberIds.length;

  if (memberIds.length === 0) {
    return res.json({
      code: 0,
      data: {
        memberCount: 0, directMemberCount: 0,
        totalTasks: 0, completed: 0, inProgress: 0, pending: 0,
        completionRate: 0, avgProgress: 0, recentTasks: []
      }
    });
  }

  const placeholders = memberIds.map(() => '?').join(',');

  // Task statistics（基于含子部门的全员范围）
  const totalTasks = (db.prepare(`SELECT COUNT(*) as c FROM perf_tasks WHERE assignee_id IN (${placeholders})`).get(...memberIds) as any)?.c || 0;
  const completed = (db.prepare(`SELECT COUNT(*) as c FROM perf_tasks WHERE assignee_id IN (${placeholders}) AND status IN ('completed', 'assessed')`).get(...memberIds) as any)?.c || 0;
  const inProgress = (db.prepare(`SELECT COUNT(*) as c FROM perf_tasks WHERE assignee_id IN (${placeholders}) AND status = 'in_progress'`).get(...memberIds) as any)?.c || 0;
  const pending = (db.prepare(`SELECT COUNT(*) as c FROM perf_tasks WHERE assignee_id IN (${placeholders}) AND status IN ('pending_review', 'draft', 'pending_receipt')`).get(...memberIds) as any)?.c || 0;

  // Average progress
  const avgRow = db.prepare(`SELECT AVG(progress) as avg FROM perf_tasks WHERE assignee_id IN (${placeholders}) AND status NOT IN ('completed', 'assessed')`).get(...memberIds) as any;
  const avgProgress = Math.round(avgRow?.avg || 0);

  // Recent tasks (top 5)
  const recentTasks = db.prepare(`
    SELECT pp.id, pp.title, pp.status, pp.progress, pp.deadline, u.name as assignee_name
    FROM perf_tasks pp
    LEFT JOIN users u ON pp.assignee_id = u.id
    WHERE pp.assignee_id IN (${placeholders})
    ORDER BY pp.created_at DESC LIMIT 5
  `).all(...memberIds);


  return res.json({
    code: 0,
    data: {
      memberCount: totalMemberCount,
      directMemberCount,
      totalTasks,
      completed,
      inProgress,
      pending,
      completionRate: totalTasks > 0 ? Math.round((completed / totalTasks) * 100) : 0,
      avgProgress,
      recentTasks
    }
  });
});


// ── 获取我的直属上级（用于申请任务时动态填充审批人）
// 查找逻辑优先级：
//   1. team_view_scopes 中 member_id = 我的 manager_id（最精确）
//   2. 部门 leader（同部门负责人）
//   3. 返回 null（让前端手动选择）
router.get('/my-superior', authMiddleware, (req: AuthRequest, res) => {
  const db = getDb();
  const userId = req.userId!;

  // 策略1：从 team_view_scopes 反查（谁把我设为成员，那个人就是我的主管）
  const scopeManager = db.prepare(
    `SELECT u.id, u.name, u.title, u.role
     FROM team_view_scopes tvs
     JOIN users u ON tvs.manager_id = u.id
     WHERE tvs.member_id = ?
     LIMIT 1`
  ).get(userId) as any;

  if (scopeManager) {
    return res.json({ code: 0, data: scopeManager });
  }

  // 策略2：查同部门的 leader
  const me = db.prepare('SELECT department_id FROM users WHERE id = ?').get(userId) as any;
  if (me?.department_id) {
    const deptLeader = db.prepare(
      `SELECT u.id, u.name, u.title, u.role
       FROM departments d
       JOIN users u ON d.leader_user_id = u.id
       WHERE d.id = ? AND u.id != ?
       LIMIT 1`
    ).get(me.department_id, userId) as any;

    if (deptLeader) {
      return res.json({ code: 0, data: deptLeader });
    }
  }

  // 策略3：找同部门 role=supervisor/hr/admin 的人
  if (me?.department_id) {
    const superior = db.prepare(
      `SELECT id, name, title, role FROM users
       WHERE department_id = ? AND id != ? AND role IN ('supervisor','hr','admin')
       LIMIT 1`
    ).get(me.department_id, userId) as any;

    if (superior) return res.json({ code: 0, data: superior });
  }

  // 未找到直属上级
  return res.json({ code: 0, data: null });
});

// ─── 企微通讯录回调验证 (GET) ────────────────────────────────
// 在企微管理后台「设置接收事件服务器」时，企微会发 GET 请求验证 URL 有效性
router.get('/contact-callback', (req: Request, res: Response) => {
  const { msg_signature, timestamp, nonce, echostr } = req.query;

  if (!msg_signature || !timestamp || !nonce || !echostr) {
    return res.send('contact callback endpoint ready');
  }

  const valid = verifySignature(
    msg_signature as string,
    timestamp as string,
    nonce as string,
    echostr as string
  );

  if (!valid) {
    console.error('[Contact Callback] 签名验证失败');
    return res.status(403).send('签名验证失败');
  }

  try {
    const decrypted = decryptMsg(echostr as string);
    console.log('[Contact Callback] URL 验证成功');
    return res.send(decrypted);
  } catch (err) {
    console.error('[Contact Callback] echostr 解密失败:', err);
    return res.status(500).send('解密失败');
  }
});

// ─── 企微通讯录变更回调 (POST) ────────────────────────────────
// 接收 change_contact 事件：员工/部门的新增、修改、删除
router.post('/contact-callback', (req: Request, res: Response) => {
  const { msg_signature, timestamp, nonce } = req.query;

  // 解析请求体中的加密 XML
  const rawBody = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
  let eventData: Record<string, string>;

  try {
    const xmlObj = parseXml(rawBody);
    const encrypted = xmlObj.Encrypt;

    if (!encrypted || !msg_signature) {
      return res.send('success');
    }

    const valid = verifySignature(
      msg_signature as string,
      timestamp as string,
      nonce as string,
      encrypted
    );

    if (!valid) {
      console.error('[Contact Callback] 签名验证失败');
      return res.send('success');
    }

    const decrypted = decryptMsg(encrypted);
    eventData = parseXml(decrypted);
  } catch (err) {
    console.error('[Contact Callback] 解析失败:', err);
    return res.send('success');
  }

  const event = eventData.Event;
  const changeType = eventData.ChangeType;

  // 仅处理通讯录变更事件
  if (event !== 'change_contact' || !changeType) {
    return res.send('success');
  }

  console.log(`[Contact Callback] ${changeType}`, JSON.stringify(eventData));

  const db = getDb();

  try {
    switch (changeType) {
      // ── 员工变更 ──────────────────────────────────────
      case 'create_user': {
        const userId = eventData.UserID;
        if (!userId) break;
        // INSERT OR IGNORE：不覆盖已有用户的本地编辑信息
        const mainDept = eventData.MainDepartment || eventData.Department?.split(',')[0] || '0';
        db.prepare(
          `INSERT OR IGNORE INTO users (id, name, title, department_id, avatar_url, mobile, email, status, synced_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, 'active', ?)`
        ).run(
          userId,
          eventData.Name || userId,
          eventData.Position || '',
          parseInt(mainDept) || 0,
          eventData.Avatar || '',
          eventData.Mobile || '',
          eventData.Email || '',
          new Date().toISOString()
        );
        console.log(`[Contact Callback] 新增员工: ${eventData.Name || userId}`);
        break;
      }

      case 'update_user': {
        const userId = eventData.UserID;
        if (!userId) break;
        // 仅更新企微推送的字段，不覆盖本地 role/status 等管理字段
        const updates: string[] = [];
        const values: (string | number)[] = [];

        if (eventData.Name) { updates.push('name = ?'); values.push(eventData.Name); }
        if (eventData.Position) { updates.push('title = ?'); values.push(eventData.Position); }
        if (eventData.MainDepartment) { updates.push('department_id = ?'); values.push(parseInt(eventData.MainDepartment) || 0); }
        if (eventData.Avatar) { updates.push('avatar_url = ?'); values.push(eventData.Avatar); }
        if (eventData.Mobile) { updates.push('mobile = ?'); values.push(eventData.Mobile); }
        if (eventData.Email) { updates.push('email = ?'); values.push(eventData.Email); }

        if (updates.length > 0) {
          updates.push('synced_at = ?');
          values.push(new Date().toISOString());
          values.push(userId);
          db.prepare(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`).run(...values);
          console.log(`[Contact Callback] 更新员工: ${eventData.Name || userId}`);
        }
        break;
      }

      case 'delete_user': {
        const userId = eventData.UserID;
        if (!userId) break;
        // 标记为离职，不物理删除
        db.prepare("UPDATE users SET status = 'resigned' WHERE id = ?").run(userId);
        console.log(`[Contact Callback] 员工离职: ${userId}`);
        break;
      }

      // ── 部门变更 ──────────────────────────────────────
      case 'create_party': {
        const deptId = eventData.Id;
        if (!deptId) break;
        db.prepare(
          `INSERT OR IGNORE INTO departments (id, name, parent_id) VALUES (?, ?, ?)`
        ).run(
          parseInt(deptId),
          eventData.Name || `部门${deptId}`,
          parseInt(eventData.ParentId || '0')
        );
        console.log(`[Contact Callback] 新增部门: ${eventData.Name || deptId}`);
        break;
      }

      case 'update_party': {
        const deptId = eventData.Id;
        if (!deptId) break;
        const deptUpdates: string[] = [];
        const deptValues: (string | number)[] = [];

        if (eventData.Name) { deptUpdates.push('name = ?'); deptValues.push(eventData.Name); }
        if (eventData.ParentId) { deptUpdates.push('parent_id = ?'); deptValues.push(parseInt(eventData.ParentId)); }

        if (deptUpdates.length > 0) {
          deptValues.push(parseInt(deptId));
          db.prepare(`UPDATE departments SET ${deptUpdates.join(', ')} WHERE id = ?`).run(...deptValues);
          console.log(`[Contact Callback] 更新部门: ${eventData.Name || deptId}`);
        }
        break;
      }

      case 'delete_party': {
        const deptId = eventData.Id;
        if (!deptId) break;
        const id = parseInt(deptId);
        // 将该部门下的用户移到根部门，防止幽灵关联
        db.prepare('UPDATE users SET department_id = 0 WHERE department_id = ?').run(id);
        db.prepare('DELETE FROM departments WHERE id = ?').run(id);
        console.log(`[Contact Callback] 删除部门: ${deptId}`);
        break;
      }
    }
  } catch (err) {
    console.error(`[Contact Callback] 处理 ${changeType} 失败:`, err);
  }

  // 企微要求在 5 秒内返回 "success"
  return res.send('success');
});

export default router;
