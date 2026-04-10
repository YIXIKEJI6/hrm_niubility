import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { authMiddleware, AuthRequest } from '../middleware/auth';

const router = Router();

// Ensure uploads directory exists
const uploadsDir = path.join(process.cwd(), 'data', 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Configure multer storage
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (_req, file, cb) => {
    // Preserve original extension, add timestamp for uniqueness
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

// Upload multiple files — 手动调用 multer 以捕获错误
router.post('/files', authMiddleware, (req: AuthRequest, res) => {
  upload.array('files', 10)(req, res, (err: any) => {
    if (err) {
      const msg = err.code === 'LIMIT_FILE_SIZE' ? '文件大小超过 50MB 限制'
        : err.message || '上传失败';
      return res.status(400).json({ code: 400, message: msg });
    }

    const files = req.files as Express.Multer.File[];
    if (!files || files.length === 0) {
      return res.status(400).json({ code: 400, message: '没有上传文件' });
    }

    const result = files.map(f => ({
      name: Buffer.from(f.originalname, 'latin1').toString('utf8'),
      size: f.size > 1024 * 1024
        ? `${(f.size / 1024 / 1024).toFixed(1)} MB`
        : `${(f.size / 1024).toFixed(0)} KB`,
      url: `/api/uploads/${f.filename}`,
      filename: f.filename
    }));

    return res.json({ code: 0, data: result });
  });
});

// Serve uploaded files (download / preview) — requires authentication
router.get('/:filename', authMiddleware, (req: AuthRequest, res) => {
  // Sanitize filename: strip path separators to prevent traversal
  const sanitized = path.basename(req.params.filename);
  const filePath = path.join(uploadsDir, sanitized);

  // Double-check resolved path stays within uploadsDir
  if (!filePath.startsWith(uploadsDir)) {
    return res.status(403).json({ code: 403, message: '非法文件路径' });
  }

  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ code: 404, message: '文件不存在' });
  }

  // For images, serve inline for preview; others as download
  const ext = path.extname(sanitized).toLowerCase();
  const imageExtensions = ['.png', '.jpg', '.jpeg', '.gif', '.bmp', '.webp'];
  if (imageExtensions.includes(ext)) {
    res.setHeader('Content-Disposition', 'inline');
  } else {
    // Extract original filename from stored name (after timestamp-random-)
    const parts = sanitized.split('-');
    const originalName = parts.slice(2).join('-');
    res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(originalName)}`);
  }

  res.sendFile(filePath);
});

export default router;
