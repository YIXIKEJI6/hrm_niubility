import { Router } from 'express';
import { getDb } from '../config/database';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { getUserEffectivePerms } from './permissions';
import { wecomConfig } from '../config/wecom';
import { verifySignature, decryptMsg, parseXml } from '../utils/wecom-crypto';

const router = Router();

// ═══════════════════════════════════════════════════════════════════
//  假期类型管理
// ═══════════════════════════════════════════════════════════════════

router.get('/leave-types', authMiddleware, (_req, res) => {
  const db = getDb();
  const rows = db.prepare('SELECT * FROM leave_types WHERE enabled = 1 ORDER BY sort_order ASC').all();
  return res.json({ code: 0, data: rows });
});

router.get('/leave-types/all', authMiddleware, (_req, res) => {
  const db = getDb();
  const rows = db.prepare('SELECT * FROM leave_types ORDER BY sort_order ASC').all();
  return res.json({ code: 0, data: rows });
});

router.post('/leave-types', authMiddleware, (req: AuthRequest, res) => {
  const perms = getUserEffectivePerms(req.userId!);
  if (!perms.includes('manage_leave_types')) return res.status(403).json({ code: 403, message: '无权操作' });

  const { name, code, color, need_approval, max_days, unit, sort_order } = req.body;
  if (!name || !code) return res.status(400).json({ code: 400, message: '名称和编码必填' });

  const db = getDb();
  try {
    db.prepare('INSERT INTO leave_types (name, code, color, need_approval, max_days, unit, sort_order) VALUES (?,?,?,?,?,?,?)')
      .run(name, code, color || '#3B82F6', need_approval ?? 1, max_days ?? null, unit || 'day', sort_order ?? 0);
    return res.json({ code: 0, message: '创建成功' });
  } catch (e: any) {
    if (e.message?.includes('UNIQUE')) return res.status(400).json({ code: 400, message: '编码已存在' });
    throw e;
  }
});

router.put('/leave-types/:id', authMiddleware, (req: AuthRequest, res) => {
  const perms = getUserEffectivePerms(req.userId!);
  if (!perms.includes('manage_leave_types')) return res.status(403).json({ code: 403, message: '无权操作' });

  const { name, code, color, need_approval, max_days, unit, sort_order, enabled } = req.body;
  const db = getDb();
  db.prepare('UPDATE leave_types SET name=?, code=?, color=?, need_approval=?, max_days=?, unit=?, sort_order=?, enabled=? WHERE id=?')
    .run(name, code, color, need_approval, max_days ?? null, unit, sort_order, enabled ?? 1, req.params.id);
  return res.json({ code: 0, message: '更新成功' });
});

router.delete('/leave-types/:id', authMiddleware, (req: AuthRequest, res) => {
  const perms = getUserEffectivePerms(req.userId!);
  if (!perms.includes('manage_leave_types')) return res.status(403).json({ code: 403, message: '无权操作' });

  const db = getDb();
  db.prepare('UPDATE leave_types SET enabled = 0 WHERE id = ?').run(req.params.id);
  return res.json({ code: 0, message: '已禁用' });
});

// ═══════════════════════════════════════════════════════════════════
//  班次类型管理
// ═══════════════════════════════════════════════════════════════════

router.get('/shift-types', authMiddleware, (_req, res) => {
  const db = getDb();
  const rows = db.prepare('SELECT * FROM shift_types WHERE enabled = 1 ORDER BY sort_order ASC').all();
  return res.json({ code: 0, data: rows });
});

router.post('/shift-types', authMiddleware, (req: AuthRequest, res) => {
  const perms = getUserEffectivePerms(req.userId!);
  if (!perms.includes('manage_leave_types')) return res.status(403).json({ code: 403, message: '无权操作' });

  const { name, code, color, start_time, end_time, sort_order } = req.body;
  if (!name || !code) return res.status(400).json({ code: 400, message: '名称和编码必填' });

  const db = getDb();
  try {
    db.prepare('INSERT INTO shift_types (name, code, color, start_time, end_time, sort_order) VALUES (?,?,?,?,?,?)')
      .run(name, code, color || '#10B981', start_time, end_time, sort_order ?? 0);
    return res.json({ code: 0, message: '创建成功' });
  } catch (e: any) {
    if (e.message?.includes('UNIQUE')) return res.status(400).json({ code: 400, message: '编码已存在' });
    throw e;
  }
});

router.put('/shift-types/:id', authMiddleware, (req: AuthRequest, res) => {
  const perms = getUserEffectivePerms(req.userId!);
  if (!perms.includes('manage_leave_types')) return res.status(403).json({ code: 403, message: '无权操作' });

  const { name, code, color, start_time, end_time, sort_order, enabled } = req.body;
  const db = getDb();
  db.prepare('UPDATE shift_types SET name=?, code=?, color=?, start_time=?, end_time=?, sort_order=?, enabled=? WHERE id=?')
    .run(name, code, color, start_time, end_time, sort_order, enabled ?? 1, req.params.id);
  return res.json({ code: 0, message: '更新成功' });
});

// ═══════════════════════════════════════════════════════════════════
//  请假记录
// ═══════════════════════════════════════════════════════════════════

// 查询请假记录（支持部门/日期/状态筛选）
router.get('/leaves', authMiddleware, (req: AuthRequest, res) => {
  const db = getDb();
  const { department_id, start_date, end_date, status, user_id } = req.query;
  const perms = getUserEffectivePerms(req.userId!);
  const canViewDept = perms.includes('view_dept_leaves');

  let sql = `SELECT lr.*, lt.name as leave_type_name, lt.color as leave_type_color, u.name as user_name, u.avatar_url, d.name as dept_name
    FROM leave_requests lr
    LEFT JOIN leave_types lt ON lr.leave_type_id = lt.id
    LEFT JOIN users u ON lr.user_id = u.id
    LEFT JOIN departments d ON u.department_id = d.id
    WHERE 1=1`;
  const params: any[] = [];

  if (user_id) {
    sql += ' AND lr.user_id = ?';
    params.push(user_id);
  } else if (!canViewDept) {
    sql += ' AND lr.user_id = ?';
    params.push(req.userId);
  }

  if (department_id) {
    sql += ' AND u.department_id = ?';
    params.push(department_id);
  }
  if (start_date) {
    sql += ' AND lr.end_date >= ?';
    params.push(start_date);
  }
  if (end_date) {
    sql += ' AND lr.start_date <= ?';
    params.push(end_date);
  }
  if (status) {
    sql += ' AND lr.status = ?';
    params.push(status);
  }
  sql += ' ORDER BY lr.created_at DESC';

  const rows = db.prepare(sql).all(...params);
  return res.json({ code: 0, data: rows });
});

// 创建请假申请
router.post('/leaves', authMiddleware, async (req: AuthRequest, res) => {
  const db = getDb();
  const { leave_type_id, start_date, end_date, start_half, end_half, duration, reason } = req.body;

  if (!leave_type_id || !start_date || !end_date || !duration) {
    return res.status(400).json({ code: 400, message: '请假类型、起止日期和时长必填' });
  }

  const leaveType = db.prepare('SELECT * FROM leave_types WHERE id = ?').get(leave_type_id) as any;
  if (!leaveType) return res.status(400).json({ code: 400, message: '无效的假期类型' });

  // 检查年度额度
  if (leaveType.max_days) {
    const year = new Date().getFullYear();
    const used = db.prepare(
      `SELECT COALESCE(SUM(duration), 0) as total FROM leave_requests
       WHERE user_id = ? AND leave_type_id = ? AND status IN ('pending', 'approved')
       AND strftime('%Y', start_date) = ?`
    ).get(req.userId, leave_type_id, String(year)) as any;
    if (used.total + duration > leaveType.max_days) {
      return res.status(400).json({ code: 400, message: `${leaveType.name}年度额度不足（已用 ${used.total} 天，上限 ${leaveType.max_days} 天）` });
    }
  }

  const initialStatus = leaveType.need_approval ? 'pending' : 'approved';
  const result = db.prepare(
    `INSERT INTO leave_requests (user_id, leave_type_id, start_date, end_date, start_half, end_half, duration, reason, status)
     VALUES (?,?,?,?,?,?,?,?,?)`
  ).run(req.userId, leave_type_id, start_date, end_date, start_half || 'am', end_half || 'pm', duration, reason || '', initialStatus);

  const leaveId = result.lastInsertRowid;

  // 企微 OA 审批集成：如果配置了模板 ID 且需要审批，提交到企微
  if (wecomConfig.leaveTemplateId && initialStatus === 'pending') {
    try {
      const { submitLeaveApproval } = await import('../services/approval');
      const { spNo } = await submitLeaveApproval({
        userId: req.userId!,
        leaveTypeName: leaveType.name,
        startDate: start_date,
        endDate: end_date,
        startHalf: start_half || 'am',
        endHalf: end_half || 'pm',
        duration,
        reason: reason || '',
      });
      // 写入企微审批单号
      db.prepare('UPDATE leave_requests SET wecom_sp_no = ?, wecom_template_id = ? WHERE id = ?')
        .run(spNo, wecomConfig.leaveTemplateId, leaveId);
      console.log(`[Schedule] 请假 #${leaveId} 已提交企微审批, sp_no=${spNo}`);
    } catch (err: any) {
      // 企微提交失败不阻塞系统内请假，记录错误即可
      console.error(`[Schedule] 企微审批提交失败 (leave #${leaveId}):`, err.message);
    }
  }

  return res.json({ code: 0, data: { id: leaveId }, message: '请假申请已提交' });
});

// 审批请假（系统内备用/管理员手动审批）
router.put('/leaves/:id/approve', authMiddleware, (req: AuthRequest, res) => {
  const perms = getUserEffectivePerms(req.userId!);
  if (!perms.includes('view_dept_leaves')) return res.status(403).json({ code: 403, message: '无权操作' });

  const db = getDb();
  const leave = db.prepare('SELECT * FROM leave_requests WHERE id = ?').get(req.params.id) as any;
  if (!leave) return res.status(404).json({ code: 404, message: '记录不存在' });

  const { action } = req.body; // 'approve' | 'reject'
  const newStatus = action === 'approve' ? 'approved' : 'rejected';
  db.prepare('UPDATE leave_requests SET status = ?, approved_at = ?, updated_at = ? WHERE id = ?')
    .run(newStatus, new Date().toISOString(), new Date().toISOString(), req.params.id);

  return res.json({ code: 0, message: action === 'approve' ? '已通过' : '已驳回' });
});

// 撤销请假
router.delete('/leaves/:id', authMiddleware, (req: AuthRequest, res) => {
  const db = getDb();
  const leave = db.prepare('SELECT * FROM leave_requests WHERE id = ?').get(req.params.id) as any;
  if (!leave) return res.status(404).json({ code: 404, message: '记录不存在' });
  if (leave.user_id !== req.userId) return res.status(403).json({ code: 403, message: '只能撤销自己的请假' });
  if (leave.status !== 'pending') return res.status(400).json({ code: 400, message: '仅待审批状态可撤销' });

  db.prepare('UPDATE leave_requests SET status = ?, updated_at = ? WHERE id = ?')
    .run('cancelled', new Date().toISOString(), req.params.id);
  return res.json({ code: 0, message: '已撤销' });
});

// 企微审批回调验证 (GET)
router.get('/leaves/sync', (req, res) => {
  const { msg_signature, timestamp, nonce, echostr } = req.query;
  if (!msg_signature || !timestamp || !nonce || !echostr) {
    return res.send('callback endpoint ready');
  }
  const valid = verifySignature(msg_signature as string, timestamp as string, nonce as string, echostr as string);
  if (!valid) return res.status(403).send('签名验证失败');
  try {
    const decrypted = decryptMsg(echostr as string);
    return res.send(decrypted);
  } catch {
    return res.status(500).send('解密失败');
  }
});

// 企微审批回调同步 (POST) — 处理 open_approval_change 事件
router.post('/leaves/sync', (req, res) => {
  const db = getDb();

  let eventData: Record<string, any> = {};

  // 解析 XML / JSON 回调数据
  if (typeof req.body === 'string' || req.headers['content-type']?.includes('xml')) {
    const rawBody = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
    const { msg_signature, timestamp, nonce } = req.query;
    try {
      const xmlObj = parseXml(rawBody);
      const encrypted = xmlObj.Encrypt;
      if (encrypted && msg_signature) {
        const valid = verifySignature(msg_signature as string, timestamp as string, nonce as string, encrypted);
        if (!valid) {
          console.error('[Leave Sync] 签名验证失败');
          return res.send('success');
        }
        const decrypted = decryptMsg(encrypted);
        eventData = parseXml(decrypted);
      } else {
        eventData = xmlObj;
      }
    } catch (err) {
      console.error('[Leave Sync] XML 解析失败:', err);
      return res.send('success');
    }
  } else if (typeof req.body === 'object') {
    eventData = req.body;
  }

  // 检查是否是审批状态变更事件
  const event = eventData.Event || eventData.event || '';
  if (event !== 'open_approval_change') {
    console.log('[Leave Sync] 非审批变更事件，忽略:', event);
    return res.send('success');
  }

  // 提取审批信息（XML 格式嵌套在 ApprovalInfo 中）
  const approvalInfo = eventData.ApprovalInfo || eventData;
  const spNo = approvalInfo.SpNo || approvalInfo.sp_no || '';
  const spStatus = Number(approvalInfo.SpStatus || approvalInfo.sp_status || 0);
  // SpStatus: 1=审批中  2=已通过  3=已驳回  4=已撤销  6=通过后撤销  7=已删除  10=已支付

  if (!spNo) {
    console.log('[Leave Sync] 无审批单号，忽略');
    return res.send('success');
  }

  console.log(`[Leave Sync] 收到审批回调: sp_no=${spNo}, status=${spStatus}`);

  // 查找对应的请假记录
  const leave = db.prepare('SELECT * FROM leave_requests WHERE wecom_sp_no = ?').get(spNo) as any;
  if (!leave) {
    console.log(`[Leave Sync] 未找到 sp_no=${spNo} 的请假记录，可能不是本系统的审批`);
    return res.send('success');
  }

  // 映射状态
  let newStatus: string | null = null;
  if (spStatus === 2) newStatus = 'approved';
  else if (spStatus === 3) newStatus = 'rejected';
  else if (spStatus === 4 || spStatus === 6 || spStatus === 7) newStatus = 'cancelled';

  if (newStatus && leave.status !== newStatus) {
    const now = new Date().toISOString();
    db.prepare('UPDATE leave_requests SET status = ?, approved_at = ?, updated_at = ? WHERE id = ?')
      .run(newStatus, newStatus === 'approved' ? now : null, now, leave.id);
    console.log(`[Leave Sync] ✅ 请假 #${leave.id} 状态更新: ${leave.status} → ${newStatus}`);
  }

  return res.send('success');
});

// ═══════════════════════════════════════════════════════════════════
//  排班管理
// ═══════════════════════════════════════════════════════════════════

// 查询排班（按部门+月份）
router.get('/shifts', authMiddleware, (req: AuthRequest, res) => {
  const db = getDb();
  const { department_id, year, month } = req.query;
  if (!year || !month) return res.status(400).json({ code: 400, message: 'year 和 month 必填' });

  const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
  const endDate = `${year}-${String(month).padStart(2, '0')}-31`;

  let sql = `SELECT ss.*, u.name as user_name, u.avatar_url, u.title as user_title, d.name as dept_name
    FROM shift_schedules ss
    LEFT JOIN users u ON ss.user_id = u.id
    LEFT JOIN departments d ON u.department_id = d.id
    WHERE ss.date >= ? AND ss.date <= ?`;
  const params: any[] = [startDate, endDate];

  if (department_id) {
    sql += ' AND ss.department_id = ?';
    params.push(department_id);
  }
  sql += ' ORDER BY u.name ASC, ss.date ASC';

  const rows = db.prepare(sql).all(...params);
  return res.json({ code: 0, data: rows });
});

// 批量排班
router.post('/shifts/batch', authMiddleware, (req: AuthRequest, res) => {
  const perms = getUserEffectivePerms(req.userId!);
  if (!perms.includes('manage_dept_shifts')) return res.status(403).json({ code: 403, message: '无权操作' });

  const db = getDb();
  const { items } = req.body; // [{ user_id, date, shift_type, shift_label, department_id, note }]
  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ code: 400, message: '排班数据不能为空' });
  }

  const upsert = db.prepare(
    `INSERT INTO shift_schedules (user_id, date, shift_type, shift_label, department_id, created_by, note, updated_at)
     VALUES (?,?,?,?,?,?,?,?)
     ON CONFLICT(user_id, date) DO UPDATE SET shift_type=excluded.shift_type, shift_label=excluded.shift_label, note=excluded.note, updated_at=excluded.updated_at`
  );

  const now = new Date().toISOString();
  db.transaction(() => {
    for (const item of items) {
      upsert.run(item.user_id, item.date, item.shift_type, item.shift_label || '', item.department_id || null, req.userId, item.note || '', now);
    }
  })();

  return res.json({ code: 0, message: `已保存 ${items.length} 条排班` });
});

// 修改单条排班
router.put('/shifts/:id', authMiddleware, (req: AuthRequest, res) => {
  const perms = getUserEffectivePerms(req.userId!);
  if (!perms.includes('manage_dept_shifts')) return res.status(403).json({ code: 403, message: '无权操作' });

  const db = getDb();
  const { shift_type, shift_label, note } = req.body;
  db.prepare('UPDATE shift_schedules SET shift_type=?, shift_label=?, note=?, updated_at=? WHERE id=?')
    .run(shift_type, shift_label || '', note || '', new Date().toISOString(), req.params.id);
  return res.json({ code: 0, message: '已更新' });
});

// 删除排班
router.delete('/shifts/:id', authMiddleware, (req: AuthRequest, res) => {
  const perms = getUserEffectivePerms(req.userId!);
  if (!perms.includes('manage_dept_shifts')) return res.status(403).json({ code: 403, message: '无权操作' });

  const db = getDb();
  db.prepare('DELETE FROM shift_schedules WHERE id = ?').run(req.params.id);
  return res.json({ code: 0, message: '已删除' });
});

// ═══════════════════════════════════════════════════════════════════
//  综合日历数据（排班+请假合并）
// ═══════════════════════════════════════════════════════════════════

router.get('/calendar', authMiddleware, (req: AuthRequest, res) => {
  const db = getDb();
  const { department_id, year, month } = req.query;
  if (!year || !month) return res.status(400).json({ code: 400, message: 'year 和 month 必填' });

  const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
  const endDate = `${year}-${String(month).padStart(2, '0')}-31`;

  // 获取部门成员
  let userSql = `SELECT id, name, avatar_url, title, department_id FROM users WHERE status = 'active'`;
  const userParams: any[] = [];
  if (department_id) {
    userSql += ' AND department_id = ?';
    userParams.push(department_id);
  }
  userSql += ' ORDER BY name ASC';
  const users = db.prepare(userSql).all(...userParams) as any[];

  // 获取排班数据
  const userIds = users.map(u => u.id);
  if (userIds.length === 0) return res.json({ code: 0, data: { users: [], shifts: [], leaves: [] } });

  const placeholders = userIds.map(() => '?').join(',');

  const shifts = db.prepare(
    `SELECT * FROM shift_schedules WHERE user_id IN (${placeholders}) AND date >= ? AND date <= ? ORDER BY date ASC`
  ).all(...userIds, startDate, endDate);

  const leaves = db.prepare(
    `SELECT lr.*, lt.name as leave_type_name, lt.color as leave_type_color
     FROM leave_requests lr
     LEFT JOIN leave_types lt ON lr.leave_type_id = lt.id
     WHERE lr.user_id IN (${placeholders}) AND lr.end_date >= ? AND lr.start_date <= ? AND lr.status IN ('pending', 'approved')
     ORDER BY lr.start_date ASC`
  ).all(...userIds, startDate, endDate);

  // 获取部门列表
  const depts = db.prepare('SELECT id, name FROM departments ORDER BY name ASC').all();

  return res.json({ code: 0, data: { users, shifts, leaves, departments: depts } });
});

export default router;
