import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { isOSSConfigured, uploadFile, getSignedUrl } from '../services/oss';

const router = Router();

// 本地 uploads 目录（OSS 不可用时回退）
const uploadsDir = path.join(process.cwd(), 'data', 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// OSS 模式: 使用内存存储，直接上传到 OSS
// 本地模式: 使用磁盘存储
const useOSS = isOSSConfigured();

const storage = useOSS
  ? multer.memoryStorage()
  : multer.diskStorage({
      destination: (_req, _file, cb) => cb(null, uploadsDir),
      filename: (_req, file, cb) => {
        const ext = path.extname(file.originalname);
        const base = path.basename(file.originalname, ext);
        const uniqueName = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${base}${ext}`;
        cb(null, uniqueName);
      }
    });

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
});

// 上传文件
router.post('/files', authMiddleware, (req: AuthRequest, res) => {
  upload.array('files', 10)(req, res, async (err: any) => {
    if (err) {
      const msg = err.code === 'LIMIT_FILE_SIZE' ? '文件大小超过 50MB 限制'
        : err.message || '上传失败';
      return res.status(400).json({ code: 400, message: msg });
    }

    const files = req.files as Express.Multer.File[];
    if (!files || files.length === 0) {
      return res.status(400).json({ code: 400, message: '没有上传文件' });
    }

    try {
      if (useOSS) {
        // OSS 模式：上传到阿里云 OSS
        const results = await Promise.all(files.map(async (f) => {
          const originalName = Buffer.from(f.originalname, 'latin1').toString('utf8');
          const ext = path.extname(originalName);
          const base = path.basename(originalName, ext);
          const uniqueName = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${base}${ext}`;

          const { url, objectKey } = await uploadFile(uniqueName, f.buffer);

          return {
            name: originalName,
            size: f.size > 1024 * 1024
              ? `${(f.size / 1024 / 1024).toFixed(1)} MB`
              : `${(f.size / 1024).toFixed(0)} KB`,
            url,               // OSS 公开 URL
            objectKey,          // OSS 对象 key，用于生成签名 URL
            filename: uniqueName,
            storage: 'oss',
          };
        }));

        return res.json({ code: 0, data: results });
      } else {
        // 本地模式：文件已保存到磁盘
        const result = files.map(f => ({
          name: Buffer.from(f.originalname, 'latin1').toString('utf8'),
          size: f.size > 1024 * 1024
            ? `${(f.size / 1024 / 1024).toFixed(1)} MB`
            : `${(f.size / 1024).toFixed(0)} KB`,
          url: `/api/uploads/${f.filename}`,
          filename: f.filename,
          storage: 'local',
        }));

        return res.json({ code: 0, data: result });
      }
    } catch (uploadErr: unknown) {
      const message = uploadErr instanceof Error ? uploadErr.message : '上传到 OSS 失败';
      return res.status(500).json({ code: 500, message });
    }
  });
});

// 获取签名 URL（OSS 私有 Bucket 用）
router.get('/sign/:objectKey(*)', authMiddleware, (req: AuthRequest, res) => {
  if (!useOSS) {
    return res.status(400).json({ code: 400, message: 'OSS 未配置' });
  }

  try {
    const signedUrl = getSignedUrl(req.params.objectKey, 3600);
    return res.json({ code: 0, data: { url: signedUrl } });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : '生成签名 URL 失败';
    return res.status(500).json({ code: 500, message });
  }
});

// 本地文件下载/预览（本地模式 或 OSS 迁移前的旧文件）
router.get('/:filename', authMiddleware, (req: AuthRequest, res) => {
  const sanitized = path.basename(req.params.filename);
  const filePath = path.join(uploadsDir, sanitized);

  if (!filePath.startsWith(uploadsDir)) {
    return res.status(403).json({ code: 403, message: '非法文件路径' });
  }

  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ code: 404, message: '文件不存在' });
  }

  const ext = path.extname(sanitized).toLowerCase();
  const imageExtensions = ['.png', '.jpg', '.jpeg', '.gif', '.bmp', '.webp'];
  if (imageExtensions.includes(ext)) {
    res.setHeader('Content-Disposition', 'inline');
  } else {
    const parts = sanitized.split('-');
    const originalName = parts.slice(2).join('-');
    res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(originalName)}`);
  }

  res.sendFile(filePath);
});

export default router;
