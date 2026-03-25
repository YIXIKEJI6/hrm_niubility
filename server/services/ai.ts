import { GoogleGenAI } from '@google/genai';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

export async function analyzePerformance(data: {
  companyMetrics?: any;
  teamMetrics?: any;
  individualMetrics?: any;
  prompt?: string;
}): Promise<string> {
  const systemPrompt = `你是一个专业的人力资源绩效分析师。基于提供的绩效数据，给出专业的分析洞察和可执行建议。
请用中文回复，结构化输出，包含：
1. 数据概要
2. 关键发现
3. 风险预警
4. 改进建议`;

  const userContent = data.prompt || JSON.stringify(data, null, 2);

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.0-flash',
      contents: [
        { role: 'user', parts: [{ text: `${systemPrompt}\n\n数据：\n${userContent}` }] },
      ],
    });

    return response.text || '分析结果生成失败';
  } catch (error: any) {
    console.error('Gemini AI 调用失败:', error.message);
    return `AI 分析暂时不可用: ${error.message}`;
  }
}
