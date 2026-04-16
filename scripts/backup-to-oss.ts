/**
 * 数据库备份到 OSS
 * 用法: npx tsx scripts/backup-to-oss.ts
 *
 * 将 SQLite 数据库文件备份到阿里云 OSS
 * 支持自动保留最近 N 份备份（默认 30 份）
 */
import 'dotenv/config';
import path from 'path';
import fs from 'fs';
import OSS from 'ali-oss';

const DB_PATH = path.join(process.cwd(), 'data', 'hrm.db');
const MAX_BACKUPS = 30; // 保留最近 30 份备份

const config = {
  region: process.env.OSS_REGION || 'oss-cn-shenzhen',
  bucket: process.env.OSS_BUCKET || '',
  accessKeyId: process.env.OSS_ACCESS_KEY_ID || '',
  accessKeySecret: process.env.OSS_ACCESS_KEY_SECRET || '',
  prefix: process.env.OSS_PREFIX || 'hrm',
};

async function main() {
  // 校验配置
  if (!config.bucket || !config.accessKeyId || !config.accessKeySecret) {
    console.error('❌ OSS 配置不完整，请检查 .env 文件中的 OSS_BUCKET, OSS_ACCESS_KEY_ID, OSS_ACCESS_KEY_SECRET');
    process.exit(1);
  }

  // 校验数据库文件
  if (!fs.existsSync(DB_PATH)) {
    console.error(`❌ 数据库文件不存在: ${DB_PATH}`);
    process.exit(1);
  }

  const client = new OSS({
    region: config.region,
    bucket: config.bucket,
    accessKeyId: config.accessKeyId,
    accessKeySecret: config.accessKeySecret,
  });

  // 生成备份文件名（含时间戳）
  const now = new Date();
  const timestamp = now.toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const backupKey = `${config.prefix}/backups/hrm-db-${timestamp}.db`;

  console.log(`📦 开始备份数据库...`);
  console.log(`   源文件: ${DB_PATH}`);
  console.log(`   目标: oss://${config.bucket}/${backupKey}`);

  // 上传
  const stat = fs.statSync(DB_PATH);
  const sizeMB = (stat.size / 1024 / 1024).toFixed(1);
  console.log(`   大小: ${sizeMB} MB`);

  const result = await client.put(backupKey, DB_PATH);
  console.log(`✅ 备份成功: ${result.url}`);

  // 同时备份 WAL 文件（如果存在）
  const walPath = `${DB_PATH}-wal`;
  if (fs.existsSync(walPath)) {
    const walKey = `${config.prefix}/backups/hrm-db-${timestamp}.db-wal`;
    await client.put(walKey, walPath);
    console.log(`✅ WAL 文件也已备份`);
  }

  // 清理旧备份（保留最近 MAX_BACKUPS 份）
  console.log(`\n🧹 检查旧备份（保留最近 ${MAX_BACKUPS} 份）...`);
  const listResult = await client.list({
    prefix: `${config.prefix}/backups/hrm-db-`,
    'max-keys': 1000,
  }, {});

  const backups = (listResult.objects || [])
    .filter((obj: OSS.ObjectMeta) => obj.name.endsWith('.db'))
    .sort((a: OSS.ObjectMeta, b: OSS.ObjectMeta) => b.name.localeCompare(a.name));

  if (backups.length > MAX_BACKUPS) {
    const toDelete = backups.slice(MAX_BACKUPS);
    for (const obj of toDelete) {
      await client.delete(obj.name);
      // 同时删除对应的 WAL 文件
      try { await client.delete(`${obj.name}-wal`); } catch { /* WAL 可能不存在 */ }
      console.log(`   🗑️ 已删除旧备份: ${obj.name}`);
    }
    console.log(`   共删除 ${toDelete.length} 份旧备份`);
  } else {
    console.log(`   当前 ${backups.length} 份备份，无需清理`);
  }

  console.log(`\n✨ 数据库备份完成！`);
}

main().catch(err => {
  console.error('❌ 备份失败:', err.message);
  process.exit(1);
});
