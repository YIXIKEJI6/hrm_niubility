# 部署到生产服务器

将当前代码提交、推送 GitHub 备份、并部署到阿里云生产服务器（HrmNiubility）。

生产部署会 **临时移除** DevRoleSwitcher 和 Mock 登录代码后构建，确保生产包不含开发功能。

用户可通过 `$ARGUMENTS` 提供 commit message，如未提供则自动生成。

## 执行流程

### 1. 检查 Git 状态

运行 `git status` 和 `git diff --stat` 查看当前更改。

- 如果有未提交更改，**警告用户**并询问是否继续
- 如果工作区干净，跳过提交步骤直接从步骤 5 开始

### 2. 暂存文件

暂存所有已修改和新增的文件，但 **排除以下敏感文件**：
- `.env`（非 `.env.example`）
- `deploy.config`
- `deploy-test.config`
- `*.db` / `*.sqlite`
- `data/` 目录
- `test-results/` 目录
- `ARCHITECTURE_ANALYSIS.md`

使用 `git add` 逐个添加安全文件，而非 `git add -A`。

### 3. 生成 Commit Message

- 如果用户通过 `$ARGUMENTS` 提供了 commit message，直接使用
- 如果未提供，自动生成带 `release(prod):` 前缀的 commit message
  - 分析 staged diff，汇总主要更改
  - 格式：`release(prod): v{version} - 简要描述`

### 4. 提交并推送 GitHub

1. `git commit -m "<message>"`
2. `git push origin main` — 先备份到 GitHub

### 5. 清理开发代码（临时）

**重要**：部署脚本内部会自行执行 `npm run build:all`，所以必须在运行脚本**之前**清理开发代码。

#### 5.1 移除 DevRoleSwitcher

编辑 `src/App.tsx`：
- 删除 `import DevRoleSwitcher from './components/DevRoleSwitcher';` 行
- 删除 `{showDevTools && <DevRoleSwitcher />}` 行

#### 5.2 移除前端 Mock 自动登录

编辑 `src/context/AuthContext.tsx`：
- 删除 `if (!token && (isDev || isTestServer)) { ... }` 整个代码块（约 15 行）
  - 这个块是测试/开发环境自动 Mock 登录的逻辑
  - 从 `if (!token && (isDev || isTestServer)) {` 开始
  - 到对应的 `setIsAuthenticating(false); return; }` 结束

### 6. 执行生产部署脚本

运行 `bash scripts/deploy-aliyun-win.sh`。

脚本自动完成：构建 → 打包 → SCP 上传 → SSH 解压 → Restart-Service HrmNiubility

- 如果脚本失败，**先恢复文件**再报告错误

### 7. 恢复开发代码

部署脚本执行完成后，立即恢复被修改的文件：

```bash
git checkout -- src/App.tsx src/context/AuthContext.tsx
```

确保本地代码恢复到包含 DevRoleSwitcher 和 Mock 登录的完整状态。

### 8. 汇报结果

- commit hash
- GitHub 推送状态
- 构建状态（已确认不含开发功能）
- 生产部署是否成功
- 生产服务器访问地址

## 安全保障

- **物理隔离**：生产构建包中不含 DevRoleSwitcher 组件代码和 Mock 登录代码
- **环境变量**：生产服务器 `.env` 设置 `NODE_ENV=production` 且不设置 `ALLOW_MOCK_LOGIN`
- **后端保护**：即使有人手动调用 mock 登录 API，后端在 `NODE_ENV=production` 时也会拒绝
- **文件恢复**：构建后自动 `git checkout` 恢复，本地/GitHub 代码始终保留完整开发功能

## 异常处理

- 构建失败 → 先 `git checkout` 恢复文件 → 报告错误
- 部署脚本失败 → 报告错误（文件已在步骤 7 恢复）
- GitHub 推送失败 → 停止，不继续部署到生产
