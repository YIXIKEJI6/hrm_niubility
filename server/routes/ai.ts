import { Router } from 'express';
import { authMiddleware } from '../middleware/auth';
import { analyzePerformance } from '../services/ai';

const router = Router();

// AI 绩效分析
router.post('/analyze', authMiddleware, async (req, res) => {
  const { data, prompt } = req.body;
  try {
    const result = await analyzePerformance({ ...data, prompt });
    return res.json({ code: 0, data: { analysis: result } });
  } catch (error: any) {
    return res.status(500).json({ code: 500, message: error.message });
  }
});

export default router;
