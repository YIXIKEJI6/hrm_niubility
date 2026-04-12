# HRM Niubility - 安全漏洞扫描报告

> 诊断日期: 2026-04-09 | Agent: security-reviewer

---

## 发现汇总

| 严重级别 | 数量 |
|----------|------|
| CRITICAL | 7 |
| HIGH | 7 |
| MEDIUM | 6 |
| LOW | 4 |

---

## CRITICAL 发现

### CRITICAL-1: 生产密钥提交到仓库

**文件**: `.env`

包含真实生产凭据:
- `WECOM_CORP_ID=ww7654ee8db2907fbd`
- `WECOM_SECRET=TIW4sJvtbN8y0h83oJPnHRdZWZh2YPhuCbAPuIvdxyM`
- `WECOM_CALLBACK_TOKEN=28638e3127a2d81cfac8bf185abc408d`
- `WECOM_CALLBACK_AES_KEY=ybMCPbPkOB3gpRPEfqCj9FWsM00t8IYO9NqTcxqPA4A`
- `JWT_SECRET=hrm_niubility_jwt_secret_2024`
- `APP_URL=http://nb.szyixikeji.com`

**行动**: 如果文件曾被推送到远程仓库，立即轮换所有密钥。

### CRITICAL-2: JWT Secret 硬编码为 Fallback

**文件**: `server/middleware/auth.ts:4`, `scripts/test-token.ts:2`, `test.ts:2`

```typescript
const JWT_SECRET = process.env.JWT_SECRET || 'hrm_niubility_jwt_secret_2024';
```

攻击者知道此字符串可伪造任何用户（包括超级管理员）的有效 JWT token。

### CRITICAL-3: DeepSeek API Key 硬编码

**文件**: `server/services/ai.ts:1`, `server/routes/ai.ts:44`, `server/routes/tests.ts:321`

```typescript
const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY || 'sk-592b0ba541a94bc39f4f77480b3fe4f1';
```

**行动**: 在 DeepSeek 控制台立即轮换此密钥并从代码中删除。

### CRITICAL-4: 生产环境认证绕过 — `mock_code`

**文件**: `server/routes/auth.ts:55-60`

```typescript
if (code === 'mock_code') {
  userId = req.body.userId || 'zhangwei';
}
```

无环境检查门控此路径。攻击者发送 `POST /api/auth/login` `{"code": "mock_code", "userId": "CaoGuiQiang"}` 即可获得超级管理员的有效 JWT token，无需任何企微认证。**这是完整的认证绕过**。

### CRITICAL-5: SQL 注入 — Workflow Service 字符串拼接

**文件**: `server/services/workflow.ts:80, 101, 106, 128, 131`

`transitionPlan` 函数通过字符串插值直接将值拼接到查询中:

```typescript
const updates: string[] = [`status = '${targetStatus}'`, `updated_at = '${now}'`];
if (extra?.comment) updates.push(`reject_reason = '${extra.comment}'`);
```

`targetStatus` 来自调用方控制的 HTTP 请求体。手动单引号转义不完整，`targetStatus` 本身无任何转义。

**修复**: 全面改用参数化查询。

### CRITICAL-6: 薪资导出端点无认证

**文件**: `server/routes/payroll-export.ts`

所有三个路由 (`GET /fields`, `POST /preview`, `GET|POST /templates`) 缺少 `authMiddleware`。未认证请求可获取所有活跃员工的薪资数据。

**修复**: 添加 `authMiddleware` 和 `requireRole('admin', 'hr')`。

### CRITICAL-7: 文件下载路径穿越

**文件**: `server/routes/upload.ts:63-82`

```typescript
router.get('/:filename', (req, res) => {
  const filePath = path.join(uploadsDir, req.params.filename);
  res.sendFile(filePath);
});
```

`req.params.filename` 未净化。`GET /api/uploads/../../.env` 可提供服务器文件系统上的任意文件。此路由还无需认证。

**修复**: 验证解析后的 `filePath` 以 `uploadsDir` 开头，并添加 `authMiddleware`。

---

## HIGH 发现

### HIGH-1: CORS 通配符

**文件**: `server/index.ts:54`

`app.use(cors())` 无来源白名单。

### HIGH-2: SSRF — AI 端点未验证 URL

**文件**: `server/routes/ai.ts:75-93`

`url.startsWith('http')` 允许 `http://169.254.169.254/` (云元数据)、`http://127.0.0.1:3001/api/...` (回环)、`http://192.168.x.x/...` (内网)。

**修复**: 添加 URL 白名单，禁止内网/元数据地址。

### HIGH-3: XSS — `dangerouslySetInnerHTML` 渲染 AI 内容

**文件**: `src/pages/TeamPerformance.tsx:698, 702`

AI 生成文本中的任意 HTML/script 标签未净化即渲染。

**修复**: 使用 DOMPurify 净化。

### HIGH-4: 无安全头

**文件**: `server/index.ts`

无 CSP、X-Frame-Options、X-Content-Type-Options 等。未安装 `helmet`。

### HIGH-5: 超级管理员身份硬编码

**文件**: `server/middleware/auth.ts:8`

```typescript
export const SUPER_ADMIN_ID = 'CaoGuiQiang';
```

### HIGH-6: 无速率限制

所有端点无 `express-rate-limit`。登录端点、AI 端点完全暴露。

### HIGH-7: `safeAddColumn` 接受未验证的表/列名

**文件**: `server/config/database.ts:635-643`

`table`, `col`, `type` 直接插值到 SQL 中。当前仅硬编码调用，但函数设计不安全。

---

## MEDIUM 发现

### MEDIUM-1: 种子密码 `123456`

**文件**: `server/seed.ts:16` — 所有演示用户使用相同 bcrypt 哈希。

### MEDIUM-2: `.gitignore` 范围外的数据库文件

`hrm.db`, `master.db`, `database.sqlite` 在项目根目录和 `server/` 下，不被 `data/*.db` 模式覆盖。

### MEDIUM-3: 错误消息泄露内部堆栈

多处路由直接返回 `error.message` 给客户端。

### MEDIUM-4: 授权检查不一致

部分路由用 `req.userRole` (JWT)，部分重新查询 DB。

### MEDIUM-5: Multer 仅校验文件扩展名

**文件**: `server/routes/upload.ts:32-40` — 应同时校验 `file.mimetype`。

### MEDIUM-6: SQL 转义不完整

**文件**: `server/services/workflow.ts:101` — `reject_reason` 无转义，`returned` case 的 `replace(/'/g, "''")` 不完整。

---

## LOW 发现

### LOW-1: `xlsx@0.18.5` 已知漏洞

SheetJS 社区版有原型污染和 ReDoS 漏洞。考虑迁移到 `exceljs`。

### LOW-2: `pdf-parse` 未修补漏洞

恶意 PDF 可触发解析器 bug。进程内无沙箱。

### LOW-3: 员工手机号暴露

**文件**: `server/routes/org.ts:159` — 所有认证用户可查看任何员工手机号。

### LOW-4: JWT 算法未固定

**文件**: `server/middleware/auth.ts:74` — `jwt.verify()` 未指定 `algorithms`。应固定 `{ algorithms: ['HS256'] }`。

---

## 立即补救优先级

1. **立即轮换所有密钥**: WeChat Work、DeepSeek API key、JWT Secret
2. **移除 `mock_code` 绕过** 或严格门控 `NODE_ENV !== 'production'`
3. **修复薪资导出路由**: 添加认证和角色检查
4. **修复路径穿越**: 验证 filename 并添加认证
5. **重写 `transitionPlan`**: 全面使用参数化查询
6. **删除源码中的硬编码密钥 fallback**: 启动时缺失则报错退出
