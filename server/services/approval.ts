/**
 * 企微 OA 审批服务 — 请假审批提交 + 模板查询
 *
 * API docs: https://developer.work.weixin.qq.com/document/path/91853
 */

import axios from 'axios';
import { wecomConfig } from '../config/wecom';
import { getApprovalAccessToken } from './wecom';

// ── 获取审批模板详情 ────────────────────────────────────────────

interface TemplateControl {
  property: { control: string; id: string; title: { text: string; lang: string }[]; require: number };
  config?: any;
}

export interface TemplateDetail {
  template_id: string;
  template_name: { text: string; lang: string }[];
  template_content: { controls: TemplateControl[] };
  vacation_list?: { item: { id: number; name: { text: string; lang: string }[] }[] };
}

export async function getTemplateDetail(templateId?: string): Promise<TemplateDetail> {
  const token = await getApprovalAccessToken();
  const tplId = templateId || wecomConfig.leaveTemplateId;
  if (!tplId) throw new Error('未配置 WECOM_LEAVE_TEMPLATE_ID');

  const url = `${wecomConfig.apiBase}/oa/gettemplatedetail?access_token=${token}`;
  const res = await axios.post(url, { template_id: tplId });

  if (res.data.errcode !== 0) {
    throw new Error(`获取审批模板详情失败: ${res.data.errmsg} (errcode: ${res.data.errcode})`);
  }

  return res.data.template_names
    ? res.data
    : { template_id: tplId, template_name: [], template_content: res.data.template_content, vacation_list: res.data.vacation_list };
}

// ── 提交请假审批 ─────────────────────────────────────────────────

interface LeaveApprovalParams {
  userId: string;           // 企微 userid (= HRM user_id)
  leaveTypeName: string;    // 假期类型名称（年假、事假等）
  startDate: string;        // YYYY-MM-DD
  endDate: string;          // YYYY-MM-DD
  startHalf: 'am' | 'pm';  // 上午/下午
  endHalf: 'am' | 'pm';
  duration: number;         // 天数（可含 0.5）
  reason: string;
}

/**
 * 查找模板中 Vacation 控件的 ID 和假期类型 key
 */
function findVacationControl(tplDetail: TemplateDetail): { controlId: string; leaveTypeMap: Map<string, number> } {
  const controls = tplDetail.template_content?.controls || [];
  const vacCtrl = controls.find(c => c.property.control === 'Vacation');
  if (!vacCtrl) throw new Error('审批模板中未找到 Vacation 控件');

  const leaveTypeMap = new Map<string, number>();
  const items = tplDetail.vacation_list?.item || [];
  for (const item of items) {
    const zhName = item.name.find(n => n.lang === 'zh_CN')?.text || item.name[0]?.text || '';
    leaveTypeMap.set(zhName, item.id);
  }

  return { controlId: vacCtrl.property.id, leaveTypeMap };
}

/**
 * 查找模板中 Textarea 控件 (请假事由) 的 ID
 */
function findTextareaControlId(tplDetail: TemplateDetail): string | null {
  const controls = tplDetail.template_content?.controls || [];
  const textCtrl = controls.find(c => c.property.control === 'Textarea');
  return textCtrl?.property.id || null;
}

/**
 * 日期字符串 → 当天 0 点 UTC+8 时间戳
 */
function dateToTimestamp(dateStr: string, half: 'am' | 'pm'): number {
  const d = new Date(dateStr + 'T00:00:00+08:00');
  const ts = Math.floor(d.getTime() / 1000);
  // am = 当天起始, pm = 当天中午12点
  return half === 'pm' ? ts + 12 * 3600 : ts;
}

export async function submitLeaveApproval(params: LeaveApprovalParams): Promise<{ spNo: string }> {
  const token = await getApprovalAccessToken();
  const tplId = wecomConfig.leaveTemplateId;
  if (!tplId) throw new Error('未配置 WECOM_LEAVE_TEMPLATE_ID');

  // 获取模板详情，找到控件 ID 和假期类型映射
  const tplDetail = await getTemplateDetail(tplId);
  const { controlId, leaveTypeMap } = findVacationControl(tplDetail);

  // 匹配假期类型
  let leaveTypeKey = leaveTypeMap.get(params.leaveTypeName);
  if (leaveTypeKey === undefined) {
    // 模糊匹配：如果系统里叫"年假"但模板里叫"年休假"
    for (const [name, key] of leaveTypeMap) {
      if (name.includes(params.leaveTypeName) || params.leaveTypeName.includes(name)) {
        leaveTypeKey = key;
        break;
      }
    }
  }
  // 如果还匹配不到，用第一个假期类型兜底
  if (leaveTypeKey === undefined) {
    const firstEntry = leaveTypeMap.entries().next().value;
    leaveTypeKey = firstEntry ? firstEntry[1] : 1;
    console.warn(`[Approval] 假期类型 "${params.leaveTypeName}" 未在企微模板中找到，使用兜底 key=${leaveTypeKey}`);
  }

  const newBegin = dateToTimestamp(params.startDate, params.startHalf);
  const newEnd = dateToTimestamp(params.endDate, params.endHalf);
  const durationSec = params.duration * 86400;

  const contents: any[] = [
    {
      control: 'Vacation',
      id: controlId,
      value: {
        vacation: {
          selector: {
            type: 'single',
            options: [{
              key: String(leaveTypeKey),
              value: [{ text: params.leaveTypeName, lang: 'zh_CN' }],
            }],
          },
          attendance: {
            date_range: {
              type: 'halfday',
              new_begin: newBegin,
              new_end: newEnd,
              new_duration: durationSec,
            },
          },
        },
      },
    },
  ];

  // 如果模板有请假事由 Textarea 控件
  const textareaId = findTextareaControlId(tplDetail);
  if (textareaId && params.reason) {
    contents.push({
      control: 'Textarea',
      id: textareaId,
      value: { text: params.reason },
    });
  }

  const body = {
    creator_userid: params.userId,
    template_id: tplId,
    use_template_approver: 1,   // 使用模板配置的审批流
    apply_data: { contents },
    summary_list: [
      {
        summary_info: [
          { text: `${params.leaveTypeName} ${params.duration}天`, lang: 'zh_CN' },
        ],
      },
      {
        summary_info: [
          { text: `${params.startDate} ~ ${params.endDate}`, lang: 'zh_CN' },
        ],
      },
    ],
  };

  console.log('[Approval] 提交请假审批:', JSON.stringify(body, null, 2));

  const url = `${wecomConfig.apiBase}/oa/applyevent?access_token=${token}`;
  const res = await axios.post(url, body);

  if (res.data.errcode !== 0) {
    console.error('[Approval] 提交失败:', res.data);
    throw new Error(`企微审批提交失败: ${res.data.errmsg} (errcode: ${res.data.errcode})`);
  }

  console.log('[Approval] ✅ 审批提交成功, sp_no:', res.data.sp_no);
  return { spNo: res.data.sp_no };
}

// ── 获取审批申请详情 ──────────────────────────────────────────────

export async function getApprovalDetail(spNo: string): Promise<any> {
  const token = await getApprovalAccessToken();
  const url = `${wecomConfig.apiBase}/oa/getapprovaldetail?access_token=${token}`;
  const res = await axios.post(url, { sp_no: spNo });

  if (res.data.errcode !== 0) {
    throw new Error(`获取审批详情失败: ${res.data.errmsg}`);
  }
  return res.data.info;
}
