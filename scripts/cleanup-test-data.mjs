/**
 * 清理测试账号及其产生的所有数据
 * 在生产环境部署后运行: node scripts/cleanup-test-data.mjs
 */
import Database from 'better-sqlite3';
import { existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const dbPath = join(__dirname, '..', 'data', 'hrm.db');

if (!existsSync(dbPath)) {
  console.log('⚠️  数据库文件不存在:', dbPath);
  process.exit(0);
}

const db = new Database(dbPath);

// 种子数据中的测试用户 ID
const TEST_USERS = ['admin', 'zhangwei', 'lifang', 'wangming', 'zhaoming', 'liuqiang', 'chenxia', 'huangli'];
const placeholders = TEST_USERS.map(() => '?').join(',');

const safeRun = (label, fn) => {
  try {
    const result = fn();
    console.log(`   ✅ ${label}: 删除 ${result.changes} 条`);
  } catch (e) {
    console.log(`   ⚠️  ${label}: 跳过 (${e.message})`);
  }
};

console.log('🧹 开始清理测试数据...');
console.log(`   目标账号: ${TEST_USERS.join(', ')}`);

const cleanup = db.transaction(() => {
  safeRun('通知', () => db.prepare(`DELETE FROM notifications WHERE user_id IN (${placeholders})`).run(...TEST_USERS));
  safeRun('待办任务', () => db.prepare(`DELETE FROM tasks WHERE user_id IN (${placeholders})`).run(...TEST_USERS));
  safeRun('绩效日志', () => db.prepare(`DELETE FROM perf_logs WHERE user_id IN (${placeholders})`).run(...TEST_USERS));
  safeRun('绩效计划', () => db.prepare(`DELETE FROM perf_plans WHERE creator_id IN (${placeholders}) OR assignee_id IN (${placeholders}) OR approver_id IN (${placeholders})`).run(...TEST_USERS, ...TEST_USERS, ...TEST_USERS));
  safeRun('绩效池任务', () => db.prepare(`DELETE FROM pool_tasks WHERE created_by IN (${placeholders})`).run(...TEST_USERS));
  safeRun('绩效池提案', () => db.prepare(`DELETE FROM pool_proposals WHERE proposer_id IN (${placeholders})`).run(...TEST_USERS));
  safeRun('团队动态', () => db.prepare(`DELETE FROM team_feeds`).run());
  safeRun('薪资记录', () => db.prepare(`DELETE FROM salary_records WHERE user_id IN (${placeholders})`).run(...TEST_USERS));
  safeRun('权限记录', () => db.prepare(`DELETE FROM permissions WHERE user_id IN (${placeholders})`).run(...TEST_USERS));

  // 删除测试用户本身（仅删除未通过企微同步的）
  const r = db.prepare(`DELETE FROM users WHERE id IN (${placeholders}) AND wecom_userid IS NULL`).run(...TEST_USERS);
  console.log(`   ✅ 测试用户: 删除 ${r.changes} 个 (企微同步用户不受影响)`);
});

try {
  cleanup();
  console.log('\n✅ 测试数据清理完成！');
} catch (err) {
  console.error('❌ 清理失败:', err);
}

db.close();
