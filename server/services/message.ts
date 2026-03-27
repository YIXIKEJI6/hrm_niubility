import axios from 'axios';
import { wecomConfig } from '../config/wecom';
import { getAccessToken } from './wecom';
import { getDb } from '../config/database';
import { createNotification } from '../routes/notifications';

// 发送文字消息
export async function sendTextMessage(userIds: string[], content: string): Promise<void> {
  // 先写入本地库
  const db = getDb();
  const stmt = db.prepare(`INSERT INTO message_logs (user_id, msg_type, title, content) VALUES (?, ?, ?, ?)`);
  for (const uid of userIds) {
    stmt.run(uid, 'text', '', content);
  }

  // 再尝试推送到企微
  try {
    const token = await getAccessToken();
    const url = `${wecomConfig.apiBase}/message/send?access_token=${token}`;
    await axios.post(url, {
      touser: userIds.join('|'),
      msgtype: 'text',
      agentid: wecomConfig.agentId,
      text: { content },
    });
  } catch (err) {
    console.error('[WeCom] 发送文字消息失败:', err);
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
  // 先写入本地库保证站内信到达
  const db = getDb();
  const stmt = db.prepare(`INSERT INTO message_logs (user_id, msg_type, title, content) VALUES (?, ?, ?, ?)`);
  for (const uid of userIds) {
    stmt.run(uid, 'card', title, description);
  }

  // 再尝试推送到企微
  try {
    const token = await getAccessToken();
    const apiUrl = `${wecomConfig.apiBase}/message/send?access_token=${token}`;

    await axios.post(apiUrl, {
      touser: userIds.join('|'),
      msgtype: 'textcard',
      agentid: wecomConfig.agentId,
      textcard: { title, description, url, btntxt: btnTxt },
    });
  } catch (err) {
    console.error('[WeCom] 发送卡片消息失败:', err);
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

  // 1. 发送企业微信卡片消息 (和本地 message_logs)
  await sendCardMessage(targetUserIds, title, description, appUrl);

  // 2. 存入本地消息通知中心 (支持前端点击跳转)
  const systemLink = action === 'submitted' ? '/team' : '/personal';
  createNotification(targetUserIds, 'perf', title, `${planTitle}${extra ? `：${extra}` : ''}`, systemLink, planId);
}

// 工资条发放推送
export async function notifyPayslip(userId: string, month: string, netPay: number): Promise<void> {
  const title = '💰 工资条已发放';
  const description = `<div class="gray">${month} 工资条</div><div class="highlight">实发工资: ¥${netPay.toFixed(2)}</div><div class="normal">点击查看详细明细</div>`;
  const appUrl = `${process.env.APP_URL || 'https://your-domain.com'}/#/salary/payslip`;

  await sendCardMessage([userId], title, description, appUrl, '查看工资条');
  createNotification([userId], 'salary', title, `${month} 工资已出账：¥${netPay.toFixed(2)}`, '/salary');
}
