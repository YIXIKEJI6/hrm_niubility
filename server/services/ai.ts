const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;
if (!DEEPSEEK_API_KEY) throw new Error('DEEPSEEK_API_KEY environment variable is not configured');

export async function analyzePerformance(data: {
  companyMetrics?: any;
  teamMetrics?: any;
  individualMetrics?: any;
  prompt?: string;
  title?: string;
}): Promise<string> {
  const systemPrompt = `你是一个专业的人力资源管理（HRM）资深顾问。基于提供的上下文，给出专业的分析洞察和可执行建议。请严格控制输出格式。`;

  const userContent = data.prompt || JSON.stringify(data, null, 2);

  try {
    const res = await fetch('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${DEEPSEEK_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userContent }
        ],
        temperature: 0.3
      })
    });

    if (!res.ok) {
      throw new Error(`DeepSeek API Error: ${res.statusText}`);
    }

    const result = await res.json();
    return result.choices?.[0]?.message?.content || '分析结果生成失败';
  } catch (error: any) {
    console.error('DeepSeek AI 调用失败:', error.message);
    return `AI 分析暂时不可用: ${error.message}`;
  }
}

export async function diagnosePerformance(plans: any[]): Promise<string> {
  const systemPrompt = `你是一个深谙现代企业管理（如OKR机制、SMART原则）的高级HR专家。
用户将提供一组来自公司内部的“绩效计划提报”。你需要对这些提报卡片进行敏锐的扫描与诊断，找出常见问题：
1. 目标是否足够聚焦且符合 SMART 原则？
2. 是否存在“低价值拼凑”、“流水账式日常工作”被当成核心绩效的情况？
3. 各个目标的投入产出比是否合理？是否缺少具挑战性的目标？

请根据提供的计划列表，生成一份具有指导意义的“绩效审核AI诊断与建议报告”。要求语气专业、一针见血，条理清晰，可使用Markdown。`;

  const userContent = JSON.stringify(
    plans.map(p => ({
      ID: p.id,
      提报人: p.creator_name || p.creator_id,
      责任人: p.assignee_name || p.assignee_id,
      标题: p.title,
      目标说明: p.description,
      所属分类: p.category,
      预期目标: p.target_value,
      难度评估: p.difficulty,
      截止时间: p.deadline
    })), null, 2
  );

  try {
    const res = await fetch('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${DEEPSEEK_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userContent }
        ],
        temperature: 0.2
      })
    });

    if (!res.ok) throw new Error(`API Error: ${res.statusText}`);
    const result = await res.json();
    return result.choices?.[0]?.message?.content || '诊断失败';
  } catch (error: any) {
    console.error('DeepSeek 诊断 API 异常:', error.message);
    return `AI 诊断分析暂时不可用: ${error.message}`;
  }
}
