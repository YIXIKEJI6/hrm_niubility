/**
 * Unified task data mapper — single source of truth for converting
 * raw perf_tasks / perf_tasks / proposal data into SmartTaskData.
 *
 * All entry points (CompanyPerformance, PersonalGoalsPanel, MyWorkflows)
 * MUST use these functions to ensure data consistency across views.
 */

import { decodeSmartDescription } from '../components/SmartFormInputs';

// ─── SMART description parsing ───────────────────────────────────────────────

const SMART_MARKERS_REGEX = /【目标 S】\s*|【指标 M】\s*|【方案 A】\s*|【相关 R】\s*|【时限 T】\s*|【PDCA】[\s\S]*/g;

function cleanMarkers(v: string): string {
  return v.replace(SMART_MARKERS_REGEX, '').trim();
}

export interface ParsedSmartFields {
  s: string;
  m: string;
  a_smart: string;
  r_smart: string;
  t: string;
  planTime: string;
  doTime: string;
  checkTime: string;
  actTime: string;
}

/**
 * Parse a SMART-format description into individual fields.
 * Handles both new 【目标 S】 format and legacy S:/M:/T: format.
 */
export function parseSmartDescription(description: string, fallbackTitle?: string, fallbackTargetValue?: string): ParsedSmartFields {
  // 先去掉 markdown 粗体包裹: **【目标 S】** → 【目标 S】
  const desc = (description || '').replace(/\*\*\s*(【[^】]+】)\s*\*\*/g, '$1');
  const decoded = decodeSmartDescription(desc);
  const hasSmart = desc.includes('【目标 S】');

  let s = '', m = '', a_smart = '', r_smart = '', t = '';

  if (hasSmart) {
    const sMatch = desc.match(/【目标 S】\n?([\s\S]*?)(?=\n【指标 M】|$)/);
    const mMatch = desc.match(/【指标 M】\n?([\s\S]*?)(?=\n【方案 A】|$)/);
    const aMatch = desc.match(/【方案 A】\n?([\s\S]*?)(?=\n【相关 R】|$)/);
    const rMatch = desc.match(/【相关 R】\n?([\s\S]*?)(?=\n【时限 T】|$)/);
    const tMatch = desc.match(/【时限 T】\n?([\s\S]*?)(?=\n+【PDCA】|$)/);

    const preMarker = desc.substring(0, desc.indexOf('【目标 S】')).trim();
    const sContent = cleanMarkers(sMatch?.[1] || '');
    s = [preMarker, sContent].filter(Boolean).join('\n\n');
    m = mMatch ? cleanMarkers(mMatch[1]) : '';
    a_smart = aMatch ? cleanMarkers(aMatch[1]) : '';
    r_smart = rMatch ? cleanMarkers(rMatch[1]) : '';
    t = tMatch ? cleanMarkers(tMatch[1]) : '';
  } else if (fallbackTargetValue) {
    const tv = String(fallbackTargetValue);
    s = tv.match(/S:\s*(.*?)(?=\nM:|$)/s)?.[1]?.trim() || '';
    m = tv.match(/M:\s*(.*?)(?=\nT:|$)/s)?.[1]?.trim() || '';
    t = tv.match(/T:\s*(.*)/s)?.[1]?.trim() || '';
    a_smart = decoded.resource;
    r_smart = decoded.relevance;
  } else {
    const pdcaIdx = desc.indexOf('\n\n【PDCA】');
    s = pdcaIdx >= 0 ? desc.substring(0, pdcaIdx).trim() : desc;
    s = cleanMarkers(s);
    a_smart = decoded.resource;
    r_smart = decoded.relevance;
  }

  if (!s && fallbackTitle) s = fallbackTitle;

  return {
    s, m, a_smart, r_smart, t,
    planTime: decoded.planTime,
    doTime: decoded.doTime,
    checkTime: decoded.checkTime,
    actTime: decoded.actTime,
  };
}

// ─── SMART description builder (for API submission) ─────────────────────────

/**
 * Build a description string with SMART markers + PDCA block.
 * All frontend submit paths MUST use this to ensure parseSmartFromDescription works.
 */
export function buildSmartDescription(data: {
  s?: string; m?: string; a_smart?: string; r_smart?: string; t?: string;
  planTime?: string; doTime?: string; checkTime?: string; actTime?: string;
}): string {
  const hasPdca = data.planTime || data.doTime || data.checkTime || data.actTime;
  const pdca = hasPdca ? `\n\n【PDCA】\nPlan: ${data.planTime || ''}|Do: ${data.doTime || ''}|Check: ${data.checkTime || ''}|Act: ${data.actTime || ''}` : '';

  // 如果 s 字段已包含SMART标记（如简化模式下AI拆解合并的内容），直接使用，避免二次包裹
  if (data.s?.includes('【目标 S】') && data.s?.includes('【指标 M】')) {
    return data.s + pdca;
  }

  const smart = `【目标 S】\n${data.s || ''}\n【指标 M】\n${data.m || ''}\n【方案 A】\n${data.a_smart || ''}\n【相关 R】\n${data.r_smart || ''}\n【时限 T】\n${data.t || ''}`;
  return smart + pdca;
}

// ─── Attachments parsing ─────────────────────────────────────────────────────

export function parseAttachments(raw: unknown): { name: string; size: string; url?: string }[] {
  try {
    if (Array.isArray(raw)) return raw;
    if (typeof raw === 'string' && raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return [];
}

// ─── RACI extraction from role_claims / roles_config ─────────────────────────

function extractRoleIds(
  roleName: string,
  roleClaims?: any[],
  rolesConfig?: any[],
): string {
  if (roleClaims?.length) {
    const fromClaims = roleClaims
      .filter((c: any) => c.role_name === roleName && (c.status === 'approved' || c.status === 'star_submitted'))
      .map((c: any) => c.user_id)
      .join(',');
    if (fromClaims) return fromClaims;
  }
  if (rolesConfig?.length) {
    const roleEntry = rolesConfig.find?.((r: any) => r.name === roleName);
    if (roleEntry?.users?.length) {
      return roleEntry.users.map((u: any) => u.id).join(',');
    }
  }
  return '';
}

// ─── Unified data mapper ─────────────────────────────────────────────────────

interface RawTaskLike {
  id?: number | string;
  title?: string;
  description?: string;
  target_value?: string;
  status?: string;
  proposal_status?: string;
  category?: string;
  department?: string;
  bonus?: number;
  reward_type?: string;
  max_participants?: number;
  deadline?: string;
  attachments?: unknown;
  role_claims?: any[];
  roles_config?: any[];
  creator_id?: string;
  creator_name?: string;
  assignee_id?: string;
  approver_id?: string;
  collaborators?: string;
  informed_parties?: string;
  delivery_target?: string;
  reject_reason?: string;
  hr_reviewer_id?: string;
  hr_reviewer_name?: string;
  admin_reviewer_id?: string;
  admin_reviewer_name?: string;
  task_type?: string;
  is_pool?: boolean;
  pool_task_id?: number;
  current_participants?: number;
  [key: string]: any;
}

/**
 * Build a consistent Partial<SmartTaskData> from any raw task/plan/proposal object.
 *
 * @param raw - The raw data object (pool_task, perf_plan, or proposal)
 * @param source - Which context is building the data:
 *   - 'pool_task': Published pool task (from 赏金榜)
 *   - 'proposal': Proposal in draft/review
 *   - 'perf_plan': Performance plan (personal or pool-linked)
 */
export function buildSmartTaskData(
  raw: RawTaskLike,
  source: 'pool_task' | 'proposal' | 'perf_plan',
): Record<string, any> {
  const isPool = source === 'pool_task' || source === 'proposal' || !!raw.is_pool || raw.task_type === 'bounty' || raw.task_type === 'proposal';
  const parsed = parseSmartDescription(
    raw.description || '',
    raw.title,
    raw.target_value,
  );
  const attachments = parseAttachments(raw.attachments);

  // 方案A: 优先读独立列，兜底 description 解析值
  const s = raw.smart_s ?? parsed.s;
  const m = raw.smart_m ?? parsed.m;
  const a_smart = raw.smart_a ?? parsed.a_smart;
  const r_smart = raw.smart_r ?? parsed.r_smart;
  const t_smart = raw.smart_t ?? parsed.t;
  const planTime = raw.plan_time ?? parsed.planTime;
  const doTime = raw.do_time ?? parsed.doTime;
  const checkTime = raw.check_time ?? parsed.checkTime;
  const actTime = raw.act_time ?? parsed.actTime;

  // RACI: pool tasks use role_claims/roles_config; perf_tasks use assignee/approver fields
  let r: string, a: string, c: string, i: string;
  if (isPool) {
    r = extractRoleIds('R', raw.role_claims, raw.roles_config);
    a = extractRoleIds('A', raw.role_claims, raw.roles_config);
    c = extractRoleIds('C', raw.role_claims, raw.roles_config);
    i = extractRoleIds('I', raw.role_claims, raw.roles_config);
  } else {
    r = raw.assignee_id || raw.creator_id || '';
    a = raw.approver_id || '';
    c = raw.collaborators || '';
    i = raw.informed_parties || '';
  }

  const flowType = (source === 'perf_plan' && !raw.is_pool && raw.task_type !== 'bounty' && raw.task_type !== 'proposal') ? 'perf_plan' : 'proposal';

  return {
    id: raw.id,
    task_type: raw.task_type,
    status: source === 'proposal' ? raw.proposal_status : raw.status,
    proposal_status: raw.proposal_status,
    flow_type: flowType,
    pool_task_id: raw.pool_task_id,
    creator_name: raw.creator_name,
    creator_id: raw.creator_id,
    assignee_id: raw.assignee_id,
    approver_id: raw.approver_id,
    summary: raw.title || '',
    s,
    m,
    a_smart,
    r_smart,
    t: t_smart || '',
    planTime,
    doTime,
    checkTime,
    actTime,
    taskType: raw.category || raw.department || '',
    bonus: String(raw.bonus || ''),
    rewardType: raw.reward_type || 'money',
    maxParticipants: String(raw.max_participants ?? 5),
    attachments,
    role_claims: raw.role_claims,
    roles_config: raw.roles_config,
    r, a, c, i,
    dt: raw.delivery_target || '',
    reject_reason: raw.reject_reason,
    hr_reviewer_id: raw.hr_reviewer_id,
    hr_reviewer_name: raw.hr_reviewer_name,
    admin_reviewer_id: raw.admin_reviewer_id,
    admin_reviewer_name: raw.admin_reviewer_name,
    current_participants: raw.current_participants,
    receipt_status: raw.receipt_status,
    progress: raw.progress,
    collaborators: raw.collaborators,
    informed_parties: raw.informed_parties,
  };
}
