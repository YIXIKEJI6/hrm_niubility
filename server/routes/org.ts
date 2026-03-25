import { Router } from 'express';
import { getDb } from '../config/database';
import { authMiddleware, requireRole, requireSuperAdmin, AuthRequest, isSuperAdmin, SUPER_ADMIN_ID } from '../middleware/auth';
import { getDepartmentList, getDepartmentMembers } from '../services/wecom';

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

    const deptStmt = db.prepare(`INSERT OR REPLACE INTO departments (id, name, parent_id) VALUES (?, ?, ?)`);
    const userStmt = db.prepare(
      `INSERT OR REPLACE INTO users (id, name, title, department_id, avatar_url, mobile, email, synced_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
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

    // 5. 同步部门 leader
    for (const dept of departments) {
      if (dept.department_leader && dept.department_leader.length > 0) {
        const leaderId = Array.isArray(dept.department_leader) ? dept.department_leader[0] : dept.department_leader;
        db.prepare('UPDATE departments SET leader_user_id = ? WHERE id = ?').run(leaderId, dept.id);
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

// 获取组织树
router.get('/tree', authMiddleware, (_req, res) => {
  const db = getDb();
  const departments = db.prepare('SELECT * FROM departments ORDER BY sort_order').all() as any[];
  const userCounts = db.prepare('SELECT department_id, COUNT(*) as count FROM users GROUP BY department_id').all() as any[];

  const countMap: Record<number, number> = {};
  for (const uc of userCounts) countMap[uc.department_id] = uc.count;

  function buildTree(parentId: number): any[] {
    return departments
      .filter((d) => d.parent_id === parentId)
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
  const members = db.prepare('SELECT id, name, title, avatar_url, role, status FROM users WHERE department_id = ?').all(req.params.id);

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

// ── 系统管理员管理 (仅 Super Admin) ───────────────────────────────

// 获取所有管理员列表
router.get('/admins', authMiddleware, requireRole('admin'), (_req, res) => {
  const db = getDb();
  const admins = db.prepare(
    `SELECT u.id, u.name, u.title, u.avatar_url, u.department_id, d.name as department_name
     FROM users u LEFT JOIN departments d ON u.department_id = d.id
     WHERE u.role = 'admin' ORDER BY u.name`
  ).all();
  return res.json({ code: 0, data: { admins, super_admin_id: SUPER_ADMIN_ID } });
});

// 设置/取消管理员 (仅 Super Admin)
router.post('/admins/set', authMiddleware, requireSuperAdmin(), (req: AuthRequest, res) => {
  const { userId, isAdmin } = req.body;
  const db = getDb();

  if (!userId) return res.status(400).json({ code: 400, message: '缺少 userId' });

  // 不允许修改自己的角色
  if (isSuperAdmin(userId)) {
    return res.status(400).json({ code: 400, message: '最高管理员角色不可修改' });
  }

  const user = db.prepare('SELECT id, name, role FROM users WHERE id = ?').get(userId) as any;
  if (!user) return res.status(404).json({ code: 404, message: '用户不存在' });

  const newRole = isAdmin ? 'admin' : 'employee';
  db.prepare('UPDATE users SET role = ? WHERE id = ?').run(newRole, userId);
  return res.json({ code: 0, message: `已${isAdmin ? '授予' : '撤销'} ${user.name} 的管理员权限` });
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

export default router;
