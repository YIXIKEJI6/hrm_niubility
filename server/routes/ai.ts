import { Router } from 'express';
import { authMiddleware } from '../middleware/auth';
import { analyzePerformance, diagnosePerformance } from '../services/ai';

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

// AI 提报质量深度诊断
router.post('/diagnose-perf', authMiddleware, async (req, res) => {
  try {
    const { plans } = req.body;
    if (!plans || !Array.isArray(plans)) return res.status(400).json({ code: 400, message: '无效的提报数据记录' });
    
    // 取前 50 条避免请求过载
    const report = await diagnosePerformance(plans.slice(0, 50));
    return res.json({ code: 0, data: { diagnosticReport: report } });
  } catch (error: any) {
    return res.status(500).json({ code: 500, message: error.message });
  }
});

export default router;
