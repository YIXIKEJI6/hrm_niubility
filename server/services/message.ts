import axios from 'axios';
import { wecomConfig } from '../config/wecom';
import { getAccessToken } from './wecom';
import { getDb } from '../config/database';

// 发送文字消息
export async function sendTextMessage(userIds: string[], content: string): Promise<void> {
  const token = await getAccessToken();
  const url = `${wecomConfig.apiBase}/message/send?access_token=${token}`;

  await axios.post(url, {
    touser: userIds.join('|'),
    msgtype: 'text',
    agentid: wecomConfig.agentId,
    text: { content },
  });

  // 记录日志
  const db = getDb();
  const stmt = db.prepare(`INSERT INTO message_logs (user_id, msg_type, title, content) VALUES (?, ?, ?, ?)`);
  for (const uid of userIds) {
    stmt.run(uid, 'text', '', content);
  }
}

// 发送卡片消息 (Markdown样式)
export async function sendCardMessage(
  userIds: string[],
  title: string,
  description: string,
  url: string,
  btnTxt: string = '详情'
): Promise<void> {
  const token = await getAccessToken();
  const apiUrl = `${wecomConfig.apiBase}/message/send?access_token=${token}`;

  await axios.post(apiUrl, {
    touser: userIds.join('|'),
    msgtype: 'textcard',
    agentid: wecomConfig.agentId,
    textcard: { title, description, url, btntxt: btnTxt },
  });

  const db = getDb();
  const stmt = db.prepare(`INSERT INTO message_logs (user_id, msg_type, title, content) VALUES (?, ?, ?, ?)`);
  for (const uid of userIds) {
    stmt.run(uid, 'card', title, description);
  }
}

// 绩效状态变更推送
export async function notifyPerfStatusChange(
  planId: number,
  action: string,
  targetUserIds: string[],
  planTitle: string,
  extra?: string
): Promise<void> {
  const actionLabels: Record<string, string> = {
    submitted: '📋 新的绩效审批请求',
    approved: '✅ 绩效计划已通过审批',
    rejected: '❌ 绩效计划被驳回',
    progress_update: '📊 绩效进度已更新',
    assessed: '🏆 绩效考核评分完成',
    rewarded: '💰 绩效奖金已发放',
    overdue: '⚠️ 绩效任务逾期预警',
  };

  const title = actionLabels[action] || '绩效通知';
  const description = `<div class="gray">绩效计划</div><div class="normal">${planTitle}</div>${extra ? `<div class="highlight">${extra}</div>` : ''}`;
  const appUrl = `${process.env.APP_URL || 'https://your-domain.com'}/#/perf/${planId}`;

  await sendCardMessage(targetUserIds, title, description, appUrl);
}

// 工资条发放推送
export async function notifyPayslip(userId: string, month: string, netPay: number): Promise<void> {
  const title = '💰 工资条已发放';
  const description = `<div class="gray">${month} 工资条</div><div class="highlight">实发工资: ¥${netPay.toFixed(2)}</div><div class="normal">点击查看详细明细</div>`;
  const appUrl = `${process.env.APP_URL || 'https://your-domain.com'}/#/salary/payslip`;

  await sendCardMessage([userId], title, description, appUrl, '查看工资条');
}
