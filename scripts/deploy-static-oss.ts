/**
 * 前端静态资源部署到 OSS
 * 用法: npx tsx scripts/deploy-static-oss.ts
 *
 * 将 vite build 产物上传到阿里云 OSS，可用于 CDN 加速
 */
import 'dotenv/config';
import path from 'path';
import fs from 'fs';
import OSS from 'ali-oss';

const DIST_DIR = path.join(process.cwd(), 'dist');

const config = {
  region: process.env.OSS_REGION || 'oss-cn-shenzhen',
  bucket: process.env.OSS_BUCKET || '',
  accessKeyId: process.env.OSS_ACCESS_KEY_ID || '',
  accessKeySecret: process.env.OSS_ACCESS_KEY_SECRET || '',
  prefix: process.env.OSS_PREFIX || 'hrm',
};

// MIME 类型映射
const MIME_MAP: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.txt': 'text/plain; charset=utf-8',
};

/** 递归获取目录下所有文件 */
function getAllFiles(dir: string, baseDir: string = dir): string[] {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...getAllFiles(fullPath, baseDir));
    } else {
      files.push(path.relative(baseDir, fullPath));
    }
  }

  return files;
}

/** 判断是否为可长期缓存的文件（含 hash 的静态资源） */
function isHashedFile(filename: string): boolean {
  // Vite 产物通常为 assets/xxx-[hash].js/css
  return /assets\/.*-[a-zA-Z0-9]{8,}\.(js|css|woff2?|ttf|png|jpg|jpeg|gif|svg|webp|avif)$/.test(filename);
}

async function main() {
  if (!config.bucket || !config.accessKeyId || !config.accessKeySecret) {
    console.error('❌ OSS 配置不完整，请检查 .env');
    process.exit(1);
  }

  if (!fs.existsSync(DIST_DIR)) {
    console.error(`❌ dist 目录不存在，请先运行 npm run build`);
    process.exit(1);
  }

  const client = new OSS({
    region: config.region,
    bucket: config.bucket,
    accessKeyId: config.accessKeyId,
    accessKeySecret: config.accessKeySecret,
  });

  const files = getAllFiles(DIST_DIR);
  console.log(`📦 准备上传 ${files.length} 个文件到 OSS...\n`);

  let uploaded = 0;
  let failed = 0;

  for (const relativePath of files) {
    const localPath = path.join(DIST_DIR, relativePath);
    const ossKey = `${config.prefix}/static/${relativePath}`;
    const ext = path.extname(relativePath).toLowerCase();
    const contentType = MIME_MAP[ext] || 'application/octet-stream';

    // 含 hash 的文件设置长缓存，html 不缓存
    const cacheControl = isHashedFile(relativePath)
      ? 'public, max-age=31536000, immutable'
      : ext === '.html'
        ? 'no-cache'
        : 'public, max-age=3600';

    try {
      await client.put(ossKey, localPath, {
        headers: {
          'Content-Type': contentType,
          'Cache-Control': cacheControl,
        },
      });
      uploaded++;
      console.log(`  ✅ ${relativePath}`);
    } catch (err: unknown) {
      failed++;
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`  ❌ ${relativePath}: ${msg}`);
    }
  }

  console.log(`\n📊 上传完成: ${uploaded} 成功, ${failed} 失败`);

  // 输出访问地址
  const baseUrl = `https://${config.bucket}.${config.region}.aliyuncs.com/${config.prefix}/static`;
  console.log(`\n🌐 访问地址:`);
  console.log(`   ${baseUrl}/index.html`);
  console.log(`\n💡 如需 CDN 加速，请在阿里云 CDN 控制台绑定域名并指向此 Bucket`);
}

main().catch(err => {
  console.error('❌ 部署失败:', err.message);
  process.exit(1);
});
