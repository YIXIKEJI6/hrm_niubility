import express from 'express';
import { getDb } from '../config/database';
import { authMiddleware, AuthRequest } from '../middleware/auth';

const router = express.Router();

// GET /api/task-discussions/:targetType/:targetId
router.get('/:targetType/:targetId', authMiddleware, (req: AuthRequest, res) => {
  try {
    const db = getDb();
    const { targetType, targetId } = req.params;
    
    const rows = db.prepare(`
      SELECT 
        d.*,
        u.name as user_name,
        u.avatar_url
      FROM task_discussions d
      LEFT JOIN users u ON d.user_id = u.id
      WHERE d.target_type = ? AND d.target_id = ?
      ORDER BY d.created_at ASC
    `).all(targetType, parseInt(targetId));
    
    // Parse attachments JSON
    const parsedRows = (rows as any[]).map(row => ({
      ...row,
      attachments: row.attachments ? JSON.parse(row.attachments) : []
    }));

    res.json({ code: 0, data: parsedRows });
  } catch (error: any) {
    console.error('Failed to get discussions:', error);
    res.status(500).json({ code: 500, message: '获取跟帖失败' });
  }
});

// POST /api/task-discussions/:targetType/:targetId
router.post('/:targetType/:targetId', authMiddleware, (req: AuthRequest, res) => {
  try {
    const db = getDb();
    const { targetType, targetId } = req.params;
    const { content, attachments, parent_id } = req.body;
    const userId = req.userId!;

    if (!content && (!attachments || attachments.length === 0)) {
      return res.status(400).json({ code: 400, message: '内容或附件不能同时为空' });
    }

    const attachStr = attachments ? JSON.stringify(attachments) : '[]';
    
    const result = db.prepare(`
      INSERT INTO task_discussions (target_type, target_id, user_id, content, attachments, parent_id)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(targetType, parseInt(targetId), userId, content || '', attachStr, parent_id || null);

    res.json({ code: 0, message: '发布成功', data: { id: result.lastInsertRowid } });
  } catch (error: any) {
    console.error('Failed to post discussion:', error);
    res.status(500).json({ code: 500, message: '发布失败' });
  }
});

// DELETE /api/task-discussions/:id
router.delete('/:id', authMiddleware, (req: AuthRequest, res) => {
  try {
    const db = getDb();
    const id = parseInt(req.params.id);
    const userId = req.userId!;

    // Check ownership or admin
    const disc = db.prepare('SELECT user_id FROM task_discussions WHERE id = ?').get(id) as { user_id: string } | undefined;
    if (!disc) {
      return res.status(404).json({ code: 404, message: '跟帖不存在' });
    }

    if (disc.user_id !== userId) {
      const u = db.prepare('SELECT is_super_admin FROM users WHERE id = ?').get(userId) as any;
      if (!u || u.is_super_admin !== 1) {
        return res.status(403).json({ code: 403, message: '无权删除他人跟帖' });
      }
    }

    db.prepare('DELETE FROM task_discussions WHERE id = ?').run(id);
    // Also delete child comments mapping? For now, we leave them or standard cascade.

    res.json({ code: 0, message: '删除成功' });
  } catch (error: any) {
    console.error('Failed to delete discussion:', error);
    res.status(500).json({ code: 500, message: '删除失败' });
  }
});

export default router;
