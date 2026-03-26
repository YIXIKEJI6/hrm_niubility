import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'hrm_niubility_jwt_secret_2024';

// ── 最高系统管理员 (Super Admin) ────────────────────────────────
// 该用户始终拥有 admin 权限，无需数据库角色配置
export const SUPER_ADMIN_ID = 'CaoGuiQiang';

export function isSuperAdmin(userId?: string): boolean {
  return userId?.toLowerCase() === SUPER_ADMIN_ID.toLowerCase();
}

export interface AuthRequest extends Request {
  userId?: string;
  userRole?: string;
}

export function generateToken(userId: string, role: string): string {
  // Super admin 始终以 admin 角色生成 token
  const effectiveRole = isSuperAdmin(userId) ? 'admin' : role;
  return jwt.sign({ userId, role: effectiveRole }, JWT_SECRET, { expiresIn: '24h' });
}

export function verifyToken(token: string): { userId: string; role: string } | null {
  try {
    const payload = jwt.verify(token, JWT_SECRET) as { userId: string; role: string };
    // Super admin 始终以 admin 角色解析
    if (isSuperAdmin(payload.userId)) {
      payload.role = 'admin';
    }
    return payload;
  } catch {
    return null;
  }
}

export function authMiddleware(req: AuthRequest, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ code: 401, message: '未登录或Token已过期' });
    return;
  }

  const token = authHeader.substring(7);
  const payload = verifyToken(token);

  if (!payload) {
    res.status(401).json({ code: 401, message: 'Token无效' });
    return;
  }

  req.userId = payload.userId;
  req.userRole = payload.role;
  next();
}

// 角色检查中间件
export function requireRole(...roles: string[]) {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    // Super admin 永远通过角色检查
    if (isSuperAdmin(req.userId)) {
      next();
      return;
    }
    if (!req.userRole || !roles.includes(req.userRole)) {
      res.status(403).json({ code: 403, message: '权限不足' });
      return;
    }
    next();
  };
}

// 仅最高系统管理员可访问
export function requireSuperAdmin() {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!isSuperAdmin(req.userId)) {
      res.status(403).json({ code: 403, message: '仅限最高系统管理员操作' });
      return;
    }
    next();
  };
}
