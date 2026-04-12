/**
 * /api/salary 薪资模块
 *
 * GET  /api/salary/payslip/:userId?month=YYYY-MM  员工查自己工资条
 * GET  /api/salary/sheets                          列出工资表（HR/Admin）
 * POST /api/salary/sheets/generate                 生成月度工资表
 * GET  /api/salary/sheets/:id                      工资表详情（含明细）
 * POST /api/salary/sheets/:id/submit               提交审批
 * POST /api/salary/sheets/:id/approve              审批通过
 * POST /api/salary/sheets/:id/reject               驳回
 * POST /api/salary/sheets/:id/publish              发放工资条（生成员工 payslip 记录）
 */
import { Router } from 'express';
import { getDb } from '../config/database';
import { authMiddleware, AuthRequest } from '../middleware/auth';

const router = Router();

// ─── 确保表存在 ──────────────────────────────────────────────────────────────
function ensureTables() {
  const db = getDb();
  db.exec(`
    CREATE TABLE IF NOT EXISTS salary_sheets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      month TEXT NOT NULL,
      department_id INTEGER,
      status TEXT DEFAULT 'draft',
      employee_count INTEGER DEFAULT 0,
      total_amount REAL DEFAULT 0,
      creator_id TEXT NOT NULL,
      approved_by TEXT,
      published_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS salary_sheet_rows (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sheet_id INTEGER NOT NULL,
      user_id TEXT NOT NULL,
      user_name TEXT,
      department TEXT,
      base_salary REAL DEFAULT 0,
      perf_bonus REAL DEFAULT 0,
      pool_bonus REAL DEFAULT 0,
      allowance REAL DEFAULT 0,
      social_insurance REAL DEFAULT 0,
      housing_fund REAL DEFAULT 0,
      tax REAL DEFAULT 0,
      net_pay REAL DEFAULT 0,
      items_json TEXT DEFAULT '[]',
      FOREIGN KEY (sheet_id) REFERENCES salary_sheets(id)
    );
    CREATE TABLE IF NOT EXISTS salary_payslips (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      sheet_id INTEGER NOT NULL,
      month TEXT NOT NULL,
      base_salary REAL DEFAULT 0,
      perf_bonus REAL DEFAULT 0,
      pool_bonus REAL DEFAULT 0,
      allowance REAL DEFAULT 0,
      social_insurance REAL DEFAULT 0,
      housing_fund REAL DEFAULT 0,
      tax REAL DEFAULT 0,
      net_pay REAL DEFAULT 0,
      items_json TEXT DEFAULT '[]',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);
}

// ─── GET /api/salary/payslip/:userId?month=YYYY-MM ─────────────────────────
// 员工查自己的工资条（限制只能查自己，HR/Admin 可查任意人）
router.get('/payslip/:userId', authMiddleware, (req: AuthRequest, res) => {
  ensureTables();
  const db = getDb();
  const targetId = req.params.userId;
  const month = (req.query.month as string) || new Date().toISOString().slice(0, 7);
  const me = req.userId!;
  const user = db.prepare('SELECT role FROM users WHERE id = ?').get(me) as any;
  const isHRAdmin = ['hr', 'admin'].includes(user?.role);

  if (targetId !== me && !isHRAdmin) {
    return res.status(403).json({ code: 403, message: '只能查看自己的工资条' });
  }

  const ps = db.prepare(
    'SELECT * FROM salary_payslips WHERE user_id = ? AND month = ? ORDER BY created_at DESC LIMIT 1'
  ).get(targetId, month) as any;

  if (!ps) return res.json({ code: 0, data: null });

  return res.json({ code: 0, data: ps });
});

// ─── GET /api/salary/sheets ─────────────────────────────────────────────────
router.get('/sheets', authMiddleware, (req: AuthRequest, res) => {
  ensureTables();
  const db = getDb();
  const userId = req.userId!;
  const user = db.prepare('SELECT role FROM users WHERE id = ?').get(userId) as any;
  if (!['hr', 'admin'].includes(user?.role)) {
    return res.status(403).json({ code: 403, message: '无权限' });
  }
  const sheets = db.prepare(`
    SELECT ss.*, u.name as creator_name
    FROM salary_sheets ss
    LEFT JOIN users u ON ss.creator_id = u.id
    ORDER BY ss.created_at DESC
    LIMIT 50
  `).all() as any[];
  return res.json({ code: 0, data: sheets });
});

// ─── POST /api/salary/sheets/generate ──────────────────────────────────────
router.post('/sheets/generate', authMiddleware, async (req: AuthRequest, res) => {
  ensureTables();
  const db = getDb();
  const userId = req.userId!;
  const user = db.prepare('SELECT role FROM users WHERE id = ?').get(userId) as any;
  if (!['hr', 'admin'].includes(user?.role)) {
    return res.status(403).json({ code: 403, message: '无权限' });
  }

  const { month, department_id } = req.body;
  if (!month || !/^\d{4}-\d{2}$/.test(month)) {
    return res.json({ code: 400, message: '月份格式错误（需 YYYY-MM）' });
  }

  // 检查同月同部门是否已存在
  const exists = db.prepare(
    `SELECT id FROM salary_sheets WHERE month = ? AND ${department_id ? 'department_id = ?' : 'department_id IS NULL'}`
  ).get(...(department_id ? [month, department_id] : [month])) as any;
  if (exists) {
    return res.json({ code: 400, message: `${month} 月的工资表已存在，请勿重复生成` });
  }

  // 获取员工列表
  let empSql = `SELECT u.id, u.name, u.position, d.name as dept_name
    FROM users u LEFT JOIN departments d ON u.department_id = d.id
    WHERE u.role NOT IN ('admin') AND u.is_active != 0`;
  const empParams: any[] = [];
  if (department_id) {
    empSql += ' AND u.department_id = ?';
    empParams.push(department_id);
  }
  const employees = db.prepare(empSql).all(...empParams) as any[];
  if (employees.length === 0) {
    return res.json({ code: 400, message: '未找到员工，无法生成' });
  }

  // 获取每个员工当月已批准的绩效奖金
  const perfBonusMap: Record<string, number> = {};
  const completedPlans = db.prepare(`
    SELECT assignee_id, SUM(CAST(target_value AS REAL)) as bonus
    FROM perf_tasks
    WHERE status IN ('completed','assessed','rewarded')
      AND substr(deadline, 1, 7) = ?
    GROUP BY assignee_id
  `).all(month) as any[];
  completedPlans.forEach((r: any) => { perfBonusMap[r.assignee_id] = r.bonus || 0; });

  // 获取当月已发放的赏金池奖励
  const poolBonusMap: Record<string, number> = {};
  const poolBonusRows = db.prepare(`
    SELECT prd.user_id, SUM(prd.bonus_amount) as total
    FROM pool_reward_distributions prd
    JOIN pool_reward_plans prp ON prd.reward_plan_id = prp.id
    WHERE prp.status = 'paid'
      AND substr(prp.pay_period, 1, 7) = ?
    GROUP BY prd.user_id
  `).all(month) as any[];
  poolBonusRows.forEach((r: any) => { poolBonusMap[r.user_id] = r.total || 0; });

  // 计算各项
  const BASE_SALARY_DEFAULT = 8000; // 无配置时的默认基本工资
  const SOCIAL_INS_RATE = 0.105;     // 社保个人缴纳比例（约 10.5%）
  const HOUSING_RATE = 0.07;         // 公积金个人比例
  const TAX_FREE = 5000;             // 个税起征点

  const now = new Date().toISOString();
  const deptLabel = department_id
    ? (db.prepare('SELECT name FROM departments WHERE id = ?').get(department_id) as any)?.name || `部门${department_id}`
    : '全员';
  const title = `${month} ${deptLabel}工资表`;

  const insertSheet = db.prepare(`
    INSERT INTO salary_sheets (title, month, department_id, status, employee_count, total_amount, creator_id, created_at, updated_at)
    VALUES (?, ?, ?, 'draft', ?, ?, ?, ?, ?)
  `);
  const sheetInfo = insertSheet.run(title, month, department_id || null, employees.length, 0, userId, now, now);
  const sheetId = sheetInfo.lastInsertRowid as number;

  const insertRow = db.prepare(`
    INSERT INTO salary_sheet_rows (sheet_id, user_id, user_name, department, base_salary, perf_bonus, pool_bonus, allowance, social_insurance, housing_fund, tax, net_pay)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  let totalAmount = 0;
  for (const emp of employees) {
    const base = BASE_SALARY_DEFAULT;
    const perf = perfBonusMap[emp.id] || 0;
    const pool = poolBonusMap[emp.id] || 0;
    const allowance = 0;
    const gross = base + perf + pool + allowance;
    const si = Math.round(base * SOCIAL_INS_RATE);
    const hf = Math.round(base * HOUSING_RATE);
    const taxable = gross - si - hf - TAX_FREE;
    const tax = Math.max(0, Math.round(taxable * 0.03)); // 简化税率 3%
    const net = gross - si - hf - tax;
    totalAmount += net;
    insertRow.run(sheetId, emp.id, emp.name, emp.dept_name || '', base, perf, pool, allowance, si, hf, tax, net);
  }

  db.prepare('UPDATE salary_sheets SET total_amount = ?, updated_at = ? WHERE id = ?').run(totalAmount, now, sheetId);

  return res.json({
    code: 0,
    data: { id: sheetId, employee_count: employees.length, total_amount: totalAmount }
  });
});

// ─── GET /api/salary/sheets/:id ─────────────────────────────────────────────
router.get('/sheets/:id', authMiddleware, (req: AuthRequest, res) => {
  ensureTables();
  const db = getDb();
  const userId = req.userId!;
  const user = db.prepare('SELECT role FROM users WHERE id = ?').get(userId) as any;
  if (!['hr', 'admin'].includes(user?.role)) {
    return res.status(403).json({ code: 403, message: '无权限' });
  }
  const sheet = db.prepare('SELECT * FROM salary_sheets WHERE id = ?').get(req.params.id) as any;
  if (!sheet) return res.status(404).json({ code: 404, message: '工资表不存在' });
  const rows = db.prepare('SELECT * FROM salary_sheet_rows WHERE sheet_id = ? ORDER BY user_name').all(req.params.id);
  return res.json({ code: 0, data: { ...sheet, rows } });
});

// ─── POST /api/salary/sheets/:id/submit ─────────────────────────────────────
router.post('/sheets/:id/submit', authMiddleware, (req: AuthRequest, res) => {
  ensureTables();
  const db = getDb();
  const sheet = db.prepare('SELECT * FROM salary_sheets WHERE id = ?').get(req.params.id) as any;
  if (!sheet) return res.status(404).json({ code: 404, message: '工资表不存在' });
  if (sheet.status !== 'draft') return res.json({ code: 400, message: '只有草稿状态可提交' });
  db.prepare(`UPDATE salary_sheets SET status = 'pending_approval', updated_at = ? WHERE id = ?`)
    .run(new Date().toISOString(), req.params.id);
  return res.json({ code: 0, message: '已提交审批' });
});

// ─── POST /api/salary/sheets/:id/approve ────────────────────────────────────
router.post('/sheets/:id/approve', authMiddleware, (req: AuthRequest, res) => {
  ensureTables();
  const db = getDb();
  const userId = req.userId!;
  const user = db.prepare('SELECT role FROM users WHERE id = ?').get(userId) as any;
  if (user?.role !== 'admin') return res.status(403).json({ code: 403, message: '只有总经理可审批' });
  const sheet = db.prepare('SELECT * FROM salary_sheets WHERE id = ?').get(req.params.id) as any;
  if (!sheet) return res.status(404).json({ code: 404, message: '工资表不存在' });
  if (sheet.status !== 'pending_approval') return res.json({ code: 400, message: '当前状态不可审批' });
  db.prepare(`UPDATE salary_sheets SET status = 'approved', approved_by = ?, updated_at = ? WHERE id = ?`)
    .run(userId, new Date().toISOString(), req.params.id);
  return res.json({ code: 0, message: '审批通过' });
});

// ─── POST /api/salary/sheets/:id/reject ─────────────────────────────────────
router.post('/sheets/:id/reject', authMiddleware, (req: AuthRequest, res) => {
  ensureTables();
  const db = getDb();
  const userId = req.userId!;
  const user = db.prepare('SELECT role FROM users WHERE id = ?').get(userId) as any;
  if (user?.role !== 'admin') return res.status(403).json({ code: 403, message: '只有总经理可驳回' });
  const sheet = db.prepare('SELECT * FROM salary_sheets WHERE id = ?').get(req.params.id) as any;
  if (!sheet) return res.status(404).json({ code: 404, message: '工资表不存在' });
  if (sheet.status !== 'pending_approval') return res.json({ code: 400, message: '当前状态不可驳回' });
  db.prepare(`UPDATE salary_sheets SET status = 'draft', updated_at = ? WHERE id = ?`)
    .run(new Date().toISOString(), req.params.id);
  return res.json({ code: 0, message: '已驳回，工资表退回草稿' });
});

// ─── POST /api/salary/sheets/:id/publish ────────────────────────────────────
// 发放工资条：把每行写入 salary_payslips 供员工查看
router.post('/sheets/:id/publish', authMiddleware, (req: AuthRequest, res) => {
  ensureTables();
  const db = getDb();
  const userId = req.userId!;
  const user = db.prepare('SELECT role FROM users WHERE id = ?').get(userId) as any;
  if (!['hr', 'admin'].includes(user?.role)) return res.status(403).json({ code: 403, message: '无权限' });
  const sheet = db.prepare('SELECT * FROM salary_sheets WHERE id = ?').get(req.params.id) as any;
  if (!sheet) return res.status(404).json({ code: 404, message: '工资表不存在' });
  if (sheet.status !== 'approved') return res.json({ code: 400, message: '只有审批通过的工资表才能发放' });

  const rows = db.prepare('SELECT * FROM salary_sheet_rows WHERE sheet_id = ?').all(req.params.id) as any[];
  const now = new Date().toISOString();
  const insertPs = db.prepare(`
    INSERT OR REPLACE INTO salary_payslips
      (user_id, sheet_id, month, base_salary, perf_bonus, pool_bonus, allowance, social_insurance, housing_fund, tax, net_pay, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  for (const row of rows) {
    insertPs.run(row.user_id, sheet.id, sheet.month, row.base_salary, row.perf_bonus, row.pool_bonus,
      row.allowance, row.social_insurance, row.housing_fund, row.tax, row.net_pay, now);
  }
  db.prepare(`UPDATE salary_sheets SET status = 'published', published_at = ?, updated_at = ? WHERE id = ?`)
    .run(now, now, req.params.id);
  return res.json({ code: 0, message: `已向 ${rows.length} 名员工发放工资条` });
});

export default router;
