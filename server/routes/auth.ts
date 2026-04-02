import { Router } from 'express';
import { getDb } from '../config/database';
import { generateToken, AuthRequest, authMiddleware, isSuperAdmin } from '../middleware/auth';
import { getUserIdByCode } from '../services/wecom';

const router = Router();

// 获取企微 OAuth 跳转链接（企微客户端内用）
router.get('/wecom-url', (req, res) => {
  // 动态获取当前访问的域名（如 nb.szyixikeji.com），支持 Nginx 等反代传过来的原始 Host
  const protocol = req.headers['x-forwarded-proto'] || req.protocol;
  const hostRaw = req.headers['x-forwarded-host'] || req.get('host') || '';
  let host = Array.isArray(hostRaw) ? hostRaw[0] : hostRaw;
  
  // 如果是测试环境端口 (4001)，则在生成 redirect_uri 时过滤掉，避免平台校验失败
  if (host.includes(':4001')) {
    host = host.replace(':4001', ''); 
  }
  const redirectUri = encodeURIComponent(`${protocol}://${host}/`); 
  
  const appid = process.env.WECOM_CORP_ID || 'CORPID_MISSING';
  const agentid = process.env.WECOM_AGENT_ID || 'AGENTID_MISSING';
  const url = `https://open.weixin.qq.com/connect/oauth2/authorize?appid=${appid}&redirect_uri=${redirectUri}&response_type=code&scope=snsapi_base&state=HRM_LOGIN&agentid=${agentid}#wechat_redirect`;
  res.redirect(url);
});

// 获取企微扫码登录跳转链接（外部浏览器用）
router.get('/wecom-qr-url', (req, res) => {
  const protocol = req.headers['x-forwarded-proto'] || req.protocol;
  const hostRaw = req.headers['x-forwarded-host'] || req.get('host') || '';
  let host = Array.isArray(hostRaw) ? hostRaw[0] : hostRaw;

  // 同样处理扫码链接的回调地址
  if (host.includes(':4001')) {
    host = host.replace(':4001', '');
  }
  const redirectUri = encodeURIComponent(`${protocol}://${host}/`);
  
  const appid = process.env.WECOM_CORP_ID || 'CORPID_MISSING';
  const agentid = process.env.WECOM_AGENT_ID || 'AGENTID_MISSING';
  // 企业微信扫码授权登录 URL
  const url = `https://login.work.weixin.qq.com/wwlogin/sso/login?login_type=CorpApp&appid=${appid}&agentid=${agentid}&redirect_uri=${redirectUri}&state=HRM_QR_LOGIN`;
  res.redirect(url);
});

// 企微 OAuth 登录
router.post('/login', async (req, res) => {
  const { code } = req.body;

  if (!code) {
    return res.status(400).json({ code: 400, message: '缺少 code 参数' });
  }

  try {
    // Mock 登录: code 为 'mock_code' 时直接用 userId 登录（测试/开发专用）
    // 生产安全性：真实企微 code 永远不会等于 'mock_code'，无需额外环境变量判断
    let userId: string;
    if (code === 'mock_code') {
      userId = req.body.userId || 'zhangwei';
    } else {
      const result = await getUserIdByCode(code);
      userId = result.userId;
    }

    const db = getDb();
    let user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId) as any;

    if (!user) {
      return res.status(404).json({ code: 404, message: '用户不存在，请先同步组织架构' });
    }

    // Super admin 强制 admin 角色
    const effectiveRole = isSuperAdmin(user.id) ? 'admin' : user.role;
    const token = generateToken(user.id, effectiveRole);
    return res.json({
      code: 0,
      data: {
        token,
        user: { id: user.id, name: user.name, title: user.title, avatar_url: user.avatar_url, role: effectiveRole, department_id: user.department_id, is_super_admin: isSuperAdmin(user.id) },
      },
    });
  } catch (error: any) {
    return res.status(500).json({ code: 500, message: error.message });
  }
});

// 获取当前用户信息
router.get('/me', authMiddleware, (req: AuthRequest, res) => {
  const db = getDb();
  const user = db.prepare('SELECT id, name, title, department_id, avatar_url, mobile, email, role, status FROM users WHERE id = ?').get(req.userId) as any;

  if (!user) {
    return res.status(404).json({ code: 404, message: '用户不存在' });
  }

  // Super admin 强制 admin 角色
  if (isSuperAdmin(user.id)) {
    user.role = 'admin';
  }

  return res.json({ code: 0, data: { ...user, is_super_admin: isSuperAdmin(user.id) } });
});

export default router;
