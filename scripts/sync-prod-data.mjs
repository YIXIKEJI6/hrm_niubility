#!/usr/bin/env node
/**
 * 从生产服务器拉取真实组织架构数据到本地 SQLite
 * 用途：本地开发时使用真实的公司成员、部门、角色数据
 * 
 * 用法: node scripts/sync-prod-data.mjs
 */
import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.join(__dirname, '..', 'data', 'hrm.db');
const PROD_API = 'http://8.129.5.180:3001/api';

async function getToken() {
  const res = await fetch(`${PROD_API}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code: 'mock_code', userId: 'CaoGuiQiang' })
  });
  const json = await res.json();
  if (json.code !== 0) throw new Error(`Login failed: ${json.message}`);
  return json.data.token;
}

async function fetchJson(url, token) {
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` }
  });
  const json = await res.json();
  if (json.code !== 0) throw new Error(`API error: ${json.message}`);
  return json.data;
}

function flattenDepts(nodes, result = []) {
  for (const n of nodes) {
    result.push({
      id: n.id,
      name: n.name,
      parent_id: n.parent_id || 0,
      leader_user_id: n.leader_user_id || null,
      region: n.region || null,
      sort_order: n.sort_order || 0
    });
    if (n.children) flattenDepts(n.children, result);
  }
  return result;
}

async function main() {
  console.log('🔄 开始从生产服务器同步数据...\n');

  // 1. 登录获取 Token
  console.log('🔐 登录生产服务器...');
  const token = await getToken();
  console.log('   ✅ Token 获取成功\n');

  // 2. 拉取组织架构树
  console.log('🏢 拉取部门树...');
  const tree = await fetchJson(`${PROD_API}/org/tree`, token);
  const depts = flattenDepts(tree);
  console.log(`   ✅ ${depts.length} 个部门\n`);

  // 3. 拉取各部门成员详情
  console.log('👥 拉取部门成员...');
  const allUsers = new Map();
  for (const dept of depts) {
    try {
      const deptData = await fetchJson(`${PROD_API}/org/departments/${dept.id}`, token);
      const members = deptData.members || [];
      for (const m of members) {
        if (!allUsers.has(m.id)) {
          allUsers.set(m.id, {
            id: m.id,
            name: m.name,
            title: m.title || '',
            department_id: dept.id,
            avatar_url: m.avatar_url || '',
            role: m.role || 'employee',
            status: m.status || 'active'
          });
        }
      }
      if (members.length > 0) {
        console.log(`   📁 ${dept.name}: ${members.length} 人`);
      }
    } catch (e) {
      console.log(`   ⚠️  ${dept.name}: 拉取失败 - ${e.message}`);
    }
  }
  console.log(`   ✅ 共 ${allUsers.size} 个独立用户\n`);

  // 4. 拉取角色标签
  console.log('🏷️  拉取角色标签...');
  let roleTags = [];
  try {
    roleTags = await fetchJson(`${PROD_API}/org/role-tags`, token);
    console.log(`   ✅ ${roleTags.length} 条角色标签\n`);
  } catch (e) {
    console.log(`   ⚠️  角色标签拉取失败: ${e.message}\n`);
  }

  // 5. 写入本地 SQLite
  console.log('💾 写入本地数据库...');
  const db = new Database(DB_PATH);

  // 备份
  const backupPath = DB_PATH + '.bak-' + new Date().toISOString().replace(/[:.]/g, '-');
  fs.copyFileSync(DB_PATH, backupPath);
  console.log(`   📋 已备份至 ${path.basename(backupPath)}`);

  // 写入部门
  const deptStmt = db.prepare(`INSERT OR REPLACE INTO departments (id, name, parent_id, leader_user_id, region, sort_order) VALUES (?, ?, ?, ?, ?, ?)`);
  const deptTx = db.transaction(() => {
    for (const d of depts) {
      deptStmt.run(d.id, d.name, d.parent_id, d.leader_user_id, d.region, d.sort_order);
    }
  });
  deptTx();
  console.log(`   ✅ ${depts.length} 个部门已同步`);

  // 写入用户
  const userStmt = db.prepare(`INSERT OR REPLACE INTO users (id, name, title, department_id, avatar_url, role, status, synced_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`);
  const userTx = db.transaction(() => {
    for (const [, u] of allUsers) {
      userStmt.run(u.id, u.name, u.title, u.department_id, u.avatar_url, u.role, u.status, new Date().toISOString());
    }
  });
  userTx();
  console.log(`   ✅ ${allUsers.size} 个用户已同步`);

  // 写入角色标签
  if (roleTags.length > 0) {
    db.prepare('DELETE FROM user_role_tags').run();
    const tagStmt = db.prepare(`INSERT OR REPLACE INTO user_role_tags (user_id, tag, label) VALUES (?, ?, ?)`);
    const tagTx = db.transaction(() => {
      for (const t of roleTags) {
        tagStmt.run(t.user_id, t.tag, t.label);
      }
    });
    tagTx();
    console.log(`   ✅ ${roleTags.length} 条角色标签已同步`);
  }

  db.close();

  console.log('\n🎉 同步完成！本地数据库已更新为生产环境数据。');
  console.log('   重启本地服务后即可使用真实组织架构测试。');
  console.log(`\n📊 汇总: ${depts.length} 部门 | ${allUsers.size} 用户 | ${roleTags.length} 角色标签`);
}

main().catch(e => {
  console.error('❌ 同步失败:', e.message);
  process.exit(1);
});
