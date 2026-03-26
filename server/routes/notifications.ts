import { Router } from 'express';
import { getDb } from '../config/database';
import { authMiddleware, AuthRequest } from '../middleware/auth';

const router = Router();

// 兼容：确保 link 列存在
try { getDb().exec("ALTER TABLE notifications ADD COLUMN link TEXT"); } catch(e) {}

// 获取我的通知列表
router.get('/', authMiddleware, (req: AuthRequest, res) => {
  const db = getDb();
  const limit = Number(req.query.limit) || 50;
  const notifications = db.prepare(
    'SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT ?'
  ).all(req.userId, limit);
  return res.json({ code: 0, data: notifications });
});

// 未读数量
router.get('/unread-count', authMiddleware, (req: AuthRequest, res) => {
  const db = getDb();
  const row = db.prepare(
    'SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND is_read = 0'
  ).get(req.userId) as any;
  return res.json({ code: 0, data: { count: row?.count || 0 } });
});

// 标记单条已读
router.post('/:id/read', authMiddleware, (req: AuthRequest, res) => {
  const db = getDb();
  db.prepare('UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?').run(req.params.id, req.userId);
  return res.json({ code: 0, message: '已读' });
});

// 全部标记已读
router.post('/read-all', authMiddleware, (req: AuthRequest, res) => {
  const db = getDb();
  db.prepare('UPDATE notifications SET is_read = 1 WHERE user_id = ?').run(req.userId);
  return res.json({ code: 0, message: '全部已读' });
});

export default router;

// ── 站内通知工具函数 ──────────────────────────────────────────────────
export function createNotification(
  userIds: string[],
  type: string,
  title: string,
  content: string,
  link?: string,
  relatedPlanId?: number
) {
  const db = getDb();
  // 确保 link 列存在
  try { db.exec("ALTER TABLE notifications ADD COLUMN link TEXT"); } catch(e) {}

  const stmt = db.prepare(
    'INSERT INTO notifications (user_id, type, title, content, link, related_plan_id) VALUES (?, ?, ?, ?, ?, ?)'
  );
  for (const uid of userIds) {
    stmt.run(uid, type, title, content, link || null, relatedPlanId || null);
  }
}
