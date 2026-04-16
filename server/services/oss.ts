import OSS from 'ali-oss';

// OSS 配置 — 所有密钥从环境变量读取
const OSS_REGION = process.env.OSS_REGION || 'oss-cn-shenzhen';
const OSS_BUCKET = process.env.OSS_BUCKET || '';
const OSS_ACCESS_KEY_ID = process.env.OSS_ACCESS_KEY_ID || '';
const OSS_ACCESS_KEY_SECRET = process.env.OSS_ACCESS_KEY_SECRET || '';
// 项目前缀，隔离不同项目
const OSS_PREFIX = process.env.OSS_PREFIX || 'hrm';

let _client: OSS | null = null;

/** 获取 OSS 客户端单例 */
function getClient(): OSS {
  if (_client) return _client;

  if (!OSS_BUCKET || !OSS_ACCESS_KEY_ID || !OSS_ACCESS_KEY_SECRET) {
    throw new Error('OSS 配置不完整，请检查环境变量: OSS_BUCKET, OSS_ACCESS_KEY_ID, OSS_ACCESS_KEY_SECRET');
  }

  _client = new OSS({
    region: OSS_REGION,
    bucket: OSS_BUCKET,
    accessKeyId: OSS_ACCESS_KEY_ID,
    accessKeySecret: OSS_ACCESS_KEY_SECRET,
  });

  return _client;
}

/** 检查 OSS 是否已配置 */
export function isOSSConfigured(): boolean {
  return !!(OSS_BUCKET && OSS_ACCESS_KEY_ID && OSS_ACCESS_KEY_SECRET);
}

/**
 * 上传文件到 OSS
 * @param objectKey OSS 对象路径 (不含前缀)
 * @param content 文件内容 (Buffer 或文件路径)
 * @returns 完整的 OSS URL
 */
export async function uploadToOSS(
  objectKey: string,
  content: Buffer | string
): Promise<{ url: string; objectKey: string }> {
  const client = getClient();
  const fullKey = `${OSS_PREFIX}/${objectKey}`;

  const result = await client.put(fullKey, content);

  return {
    url: result.url,
    objectKey: fullKey,
  };
}

/**
 * 生成带签名的临时访问 URL（私有 Bucket 用）
 * @param objectKey OSS 对象路径 (含前缀)
 * @param expiresSeconds 过期时间（秒），默认 1 小时
 */
export function getSignedUrl(objectKey: string, expiresSeconds = 3600): string {
  const client = getClient();
  return client.signatureUrl(objectKey, { expires: expiresSeconds });
}

/**
 * 删除 OSS 上的文件
 */
export async function deleteFromOSS(objectKey: string): Promise<void> {
  const client = getClient();
  await client.delete(objectKey);
}

/**
 * 列出指定前缀下的文件
 */
export async function listOSSFiles(prefix: string, maxKeys = 100) {
  const client = getClient();
  const fullPrefix = `${OSS_PREFIX}/${prefix}`;
  const result = await client.list({ prefix: fullPrefix, 'max-keys': maxKeys }, {});
  return result.objects || [];
}

/**
 * 上传用户文件到 OSS uploads 目录
 */
export async function uploadFile(
  filename: string,
  content: Buffer
): Promise<{ url: string; objectKey: string }> {
  return uploadToOSS(`uploads/${filename}`, content);
}

/**
 * 上传数据库备份到 OSS backups 目录
 */
export async function uploadBackup(
  filename: string,
  filePath: string
): Promise<{ url: string; objectKey: string }> {
  return uploadToOSS(`backups/${filename}`, filePath);
}

/**
 * 上传前端静态资源到 OSS static 目录
 */
export async function uploadStaticFile(
  relativePath: string,
  filePath: string
): Promise<{ url: string; objectKey: string }> {
  return uploadToOSS(`static/${relativePath}`, filePath);
}

export default {
  isOSSConfigured,
  uploadToOSS,
  getSignedUrl,
  deleteFromOSS,
  listOSSFiles,
  uploadFile,
  uploadBackup,
  uploadStaticFile,
};
