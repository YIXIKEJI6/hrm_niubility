/**
 * 后端通过 new Date().toISOString() 生成 UTC 时间戳，
 * 存入 SQLite 后 Z 后缀可能丢失。前端 new Date('2026-04-12T08:50:44')
 * 在无 Z 时会当作本地时间解析，导致中国时区偏移 8 小时。
 *
 * 此工具函数统一处理两种场景：
 * - 完整时间戳（created_at 等）：确保以 Z 结尾
 * - 纯日期（deadline 等）：当作本地日期解析
 */

/** 解析后端 UTC 时间戳，自动补 Z 后缀 */
export function parseUTC(ts: string): Date {
  if (!ts) return new Date(NaN);
  const s = ts.trim();
  // 已有时区信息（Z 或 +/-偏移），直接解析
  if (/[Zz]$/.test(s) || /[+-]\d{2}:\d{2}$/.test(s)) return new Date(s);
  // 含 T 或空格分隔的完整时间戳，补 Z 当 UTC 解析
  if (s.includes('T') || /\d{4}-\d{2}-\d{2} \d{2}:\d{2}/.test(s)) {
    return new Date(s.replace(' ', 'T') + 'Z');
  }
  // 纯日期（如 2026-04-30），当作本地日期解析
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    return new Date(s + 'T00:00:00');
  }
  return new Date(s);
}
