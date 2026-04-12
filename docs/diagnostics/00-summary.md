# HRM Niubility - 全面诊断汇总报告

> 诊断日期: 2026-04-09
> 版本: v2.6.1
> 诊断工具: Claude Code Agent Team (4 专项 Agent 并行)

---

## 项目概览

| 项目 | 详情 |
|------|------|
| 版本 | v2.6.1 |
| 前端 | React 19 + Vite 6 + Tailwind CSS 4 |
| 后端 | Express 4 + better-sqlite3 |
| 数据库 | SQLite (35 张表, WAL 模式) |
| 页面数 | 15 个懒加载页面 |
| API 端点 | ~209 个 |
| 路由文件 | 33 个 |
| 组件数 | 18 个 |
| 部署 | 阿里云轻量服务器 (Windows/NSSM) |
| 集成 | 企业微信 OAuth/消息推送、DeepSeek AI、讯飞语音识别 |

---

## 诊断结果统计

| 严重级别 | 安全 | 代码质量 | 性能 | 合计 |
|---------|------|---------|------|------|
| **CRITICAL** | 7 | 4 | - | **11** |
| **HIGH** | 7 | 7 | 6 | **20** |
| **MEDIUM** | 6 | 7 | 7 | **20** |
| **LOW** | 4 | 4 | 4 | **12** |
| **总计** | 24 | 22 | 17 | **63** |

---

## 优先级优化路线图

### Phase 1: 紧急修复 (立即执行)

| # | 问题 | 位置 | 行动 |
|---|------|------|------|
| 1 | DeepSeek API Key 硬编码在源码 | `server/services/ai.ts`, `routes/ai.ts`, `routes/tests.ts` | 删除 fallback，轮换密钥 |
| 2 | JWT Secret 硬编码 fallback | `server/middleware/auth.ts:4` | 删除 fallback，启动时强制检查 |
| 3 | `.env` 含真实生产凭据 | `.env` | 检查 git 历史，创建 `.env.example` |
| 4 | `mock_code` 登录无环境检查 | `server/routes/auth.ts:58` | 添加 `NODE_ENV !== 'production'` 门控 |
| 5 | SQL 注入 - workflow 字符串拼接 | `server/services/workflow.ts` | 改用参数化查询 |
| 6 | 薪资导出端点无认证 | `server/routes/payroll-export.ts` | 添加 `authMiddleware` |
| 7 | 文件下载路径穿越 | `server/routes/upload.ts:64` | 校验 filename，添加 auth |
| 8 | CORS 完全开放 | `server/index.ts:54` | 限制 origin |

### Phase 2: 安全加固 (1 周内)

| # | 问题 | 行动 |
|---|------|------|
| 1 | 无安全头 | 安装 `helmet` |
| 2 | 无速率限制 | 安装 `express-rate-limit` (auth + AI 端点) |
| 3 | SSRF 风险 | `/api/ai/extract-url` 添加 URL 白名单 |
| 4 | XSS via `dangerouslySetInnerHTML` | 使用 DOMPurify 净化 AI 输出 |
| 5 | 文件上传仅校验扩展名 | 同时校验 MIME type |
| 6 | 权限加载时默认放行 | 改为 loading 状态 |
| 7 | 全局错误处理中间件 | 防止进程崩溃和堆栈泄露 |

### Phase 3: 性能优化 (2 周内)

| # | 问题 | 预期收益 |
|---|------|---------|
| 1 | 添加 11 个核心索引 | 查询速度提升 5-10x |
| 2 | SQLite Pragma 优化 (cache_size, synchronous) | 写入吞吐提升 2-3x |
| 3 | 修复 N+1 查询 (pool.ts, team.ts) | API 响应时间降 50%+ |
| 4 | 添加 gzip 响应压缩 | 传输大小降 60-80% |
| 5 | 静态资源缓存头 (maxAge: 1y) | 减少重复加载 |
| 6 | Panorama 8 条 COUNT 合并为 1 条 | 减少 DB 负载 |
| 7 | unbounded pool_tasks 查询加 LIMIT | 减少内存占用 |

### Phase 4: 代码质量提升 (持续)

| # | 问题 | 行动 |
|---|------|------|
| 1 | 零测试覆盖 | 从核心路径开始添加测试 |
| 2 | TypeScript strict 未启用 | 渐进式开启 strict |
| 3 | 大文件 (pool.ts 900+行, perf.ts 829行) | 拆分为子模块 |
| 4 | 392 处 `any` 类型 | 逐步替换为具体类型 |
| 5 | 无 ErrorBoundary | 添加页面级错误边界 |
| 6 | `assignee_id` 逗号分隔存储 | 迁移为关联表 |
| 7 | 迁移散落在路由文件中 | 统一到 `initDatabase()` |
| 8 | 重复代码 (useApiGet, statusMap) | 提取为共享模块 |
| 9 | 109 处 console.log | 替换为结构化日志 |
| 10 | React 无 memoization | 添加 useMemo/useCallback |

---

## 详细报告索引

| 报告 | 文件 |
|------|------|
| 架构探索 | [01-architecture.md](./01-architecture.md) |
| 代码质量审计 | [02-code-quality.md](./02-code-quality.md) |
| 安全漏洞扫描 | [03-security.md](./03-security.md) |
| 性能分析 | [04-performance.md](./04-performance.md) |
