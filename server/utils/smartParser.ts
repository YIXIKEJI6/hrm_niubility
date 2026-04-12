/**
 * Backend utility: parse SMART/PDCA fields from description text.
 * Used by pool.ts, perf.ts, and database.ts migration.
 */

export interface SmartParsed {
  s: string;
  m: string;
  a: string;
  r: string;
  t: string;
  planTime: string;
  doTime: string;
  checkTime: string;
  actTime: string;
}

export function parseSmartFromDescription(desc: string): SmartParsed {
  // 先去掉 markdown 粗体包裹: **【目标 S】** → 【目标 S】
  const d = (desc || '').replace(/\*\*\s*(【[^】]+】)\s*\*\*/g, '$1');
  let s = '', m = '', a = '', r = '', t = '';
  let planTime = '', doTime = '', checkTime = '', actTime = '';

  if (d.includes('【目标 S】')) {
    s = d.match(/【目标 S】\n?([\s\S]*?)(?=\n【指标 M】|$)/)?.[1]?.trim() || '';
    m = d.match(/【指标 M】\n?([\s\S]*?)(?=\n【方案 A】|$)/)?.[1]?.trim() || '';
    a = d.match(/【方案 A】\n?([\s\S]*?)(?=\n【相关 R】|$)/)?.[1]?.trim() || '';
    r = d.match(/【相关 R】\n?([\s\S]*?)(?=\n【时限 T】|$)/)?.[1]?.trim() || '';
    t = d.match(/【时限 T】\n?([\s\S]*?)(?=\n+【PDCA】|$)/)?.[1]?.trim() || '';
  } else if (d.includes('【所需资源】')) {
    // Backward compat: old format encodeSmartDescription — 【所需资源】=a_smart, 【岗位关联】=r_smart
    a = d.match(/【所需资源】\n?([\s\S]*?)(?=\n\n【岗位关联】|\n\n【PDCA】|$)/)?.[1]?.trim() || '';
    r = d.match(/【岗位关联】\n?([\s\S]*?)(?=\n\n【PDCA】|$)/)?.[1]?.trim() || '';
  }

  const pdcaBlock = d.match(/【PDCA】\n?([\s\S]*?)$/)?.[1]?.trim() || '';
  if (pdcaBlock) {
    planTime = pdcaBlock.match(/Plan:\s*(.*?)(?:\s*\||$)/)?.[1]?.trim() || '';
    doTime = pdcaBlock.match(/Do:\s*(.*?)(?:\s*\||$)/)?.[1]?.trim() || '';
    checkTime = pdcaBlock.match(/Check:\s*(.*?)(?:\s*\||$)/)?.[1]?.trim() || '';
    actTime = pdcaBlock.match(/Act:\s*(.*?)$/)?.[1]?.trim() || '';
  }

  return { s, m, a, r, t, planTime, doTime, checkTime, actTime };
}
