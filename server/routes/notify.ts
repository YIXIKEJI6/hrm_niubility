import { Router } from 'express';
import { getDb } from '../config/database';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { sendTextMessage, sendCardMessage } from '../services/message';
import { transitionPlan } from '../services/workflow';

const router = Router();

// 发送文字消息
router.post('/send', authMiddleware, async (req, res) => {
  const { userIds, content } = req.body;
  try {
    await sendTextMessage(userIds, content);
    return res.json({ code: 0, message: '发送成功' });
  } catch (error: any) {
    return res.status(500).json({ code: 500, message: error.message });
  }
});

// 发送卡片消息
router.post('/card', authMiddleware, async (req, res) => {
  const { userIds, title, description, url, btnTxt } = req.body;
  try {
    await sendCardMessage(userIds, title, description, url, btnTxt);
    return res.json({ code: 0, message: '发送成功' });
  } catch (error: any) {
    return res.status(500).json({ code: 500, message: error.message });
  }
});

// 卡片按钮回调 (企微回调此接口)
router.post('/card/callback', async (req, res) => {
  const { EventKey, FromUserName } = req.body;

  if (!EventKey) return res.json({ code: 0 });

  // EventKey 格式: action:planId (如 approve:123, reject:123)
  const [action, planIdStr] = EventKey.split(':');
  const planId = parseInt(planIdStr);

  if (!planId || !['approve', 'reject'].includes(action)) {
    return res.json({ code: 0 });
  }

  const targetStatus = action === 'approve' ? 'approved' : 'rejected';
  const result = await transitionPlan(planId, targetStatus, FromUserName, {
    comment: action === 'reject' ? '通过企微卡片驳回' : undefined,
  });

  // 回复用户操作结果
  if (result.success) {
    try {
      await sendTextMessage([FromUserName], `✅ 操作成功：绩效计划已${action === 'approve' ? '通过' : '驳回'}`);
    } catch (e) {
      console.error('回复消息失败:', e);
    }
  }

  return res.json({ code: 0, message: result.message });
});

// 推送记录查询
router.get('/history', authMiddleware, (req: AuthRequest, res) => {
  const db = getDb();
  const logs = db.prepare('SELECT * FROM message_logs ORDER BY created_at DESC LIMIT 100').all();
  return res.json({ code: 0, data: logs });
});

export default router;
