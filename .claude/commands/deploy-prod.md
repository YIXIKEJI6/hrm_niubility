# 部署到生产服务器

将当前代码提交、推送 GitHub 备份、并部署到阿里云生产服务器（HrmNiubility）。

生产部署会 **临时移除** DevRoleSwitcher 和 Mock 登录代码后构建，确保生产包不含开发功能。

用户可通过 `$ARGUMENTS` 提供版本号或 commit message，如未提供则自动递增。

## 执行流程

### 1. 检查 Git 状态

运行 `git status` 和 `git diff --stat` 查看当前更改。

- 如果有未提交更改，**警告用户**并询问是否继续
- 如果工作区干净，跳过暂存步骤直接从步骤 4 开始

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

### 3. 版本号递增

读取 `package.json` 中的当前版本号，按以下规则递增：

- **`$ARGUMENTS` 中包含具体版本号**（如 `v2.8.0`）：直接使用该版本号
- **`$ARGUMENTS` 中未提供版本号**：在当前版本基础上自动递增 patch 版本（如 `2.7.0` → `2.7.1`）
- 如果本次包含新功能（feat），则递增 minor 版本（如 `2.7.1` → `2.8.0`）

修改 `package.json` 中的 `"version"` 字段，然后 `git add package.json`。

### 4. 生成 Release Commit Message

生成详细的发版 commit message，格式如下：

```
release(prod): v{新版本号} - 一句话概要

功能新增：
- feat(模块): 具体描述

功能修复：
- fix(模块): 具体描述

优化改进：
- perf/refactor(模块): 具体描述

其他：
- chore: 具体描述
```

**生成方法**：
1. 找到上一次 `release(prod):` 的 commit（使用 `git log --oneline --all | grep "release(prod):" | head -1`）
2. 用 `git log --oneline {上次release}..HEAD` 获取本次发版包含的所有 commit
3. 将这些 commit 按类型分类（feat/fix/perf/chore），生成清晰的中文变更说明
4. 如果 `$ARGUMENTS` 中包含额外描述，合并到概要中

### 5. 提交并推送 GitHub

1. `git commit` — 使用上面生成的 release commit message
2. `git push origin main` — 先备份到 GitHub

### 6. 清理开发代码（临时）

**重要**：部署脚本内部会自行执行 `npm run build:all`，所以必须在运行脚本**之前**清理开发代码。

#### 6.1 移除 DevRoleSwitcher

编辑 `src/App.tsx`：
- 删除 `import DevRoleSwitcher from './components/DevRoleSwitcher';` 行
- 删除 `{showDevTools && <DevRoleSwitcher />}` 行

#### 6.2 移除前端 Mock 自动登录

编辑 `src/context/AuthContext.tsx`：
- 删除 `if (!token && (isDev || isTestServer)) { ... }` 整个代码块（约 15 行）
  - 这个块是测试/开发环境自动 Mock 登录的逻辑
  - 从 `if (!token && (isDev || isTestServer)) {` 开始
  - 到对应的 `setIsAuthenticating(false); return; }` 结束

### 7. 执行生产部署脚本

运行 `bash scripts/deploy-aliyun-win.sh`。

脚本自动完成：构建 → 打包 → SCP 上传 → SSH 解压 → Restart-Service HrmNiubility

- 如果脚本失败，**先恢复文件**再报告错误

### 8. 恢复开发代码

部署脚本执行完成后，立即恢复被修改的文件：

```bash
git checkout -- src/App.tsx src/context/AuthContext.tsx
```

确保本地代码恢复到包含 DevRoleSwitcher 和 Mock 登录的完整状态。

### 9. 验证服务器端口与 Nginx 配置

部署完成后，SSH 到服务器验证端口配置是否正确。

#### 9.1 检查生产 `.env` 端口

```bash
ssh administrator@8.129.5.180 "powershell -Command \"Get-Content 'C:\\hrm-niubility\\.env' | Select-String 'SERVER_PORT'\""
```

- 必须为 `SERVER_PORT=3000`
- 如果不是 3000，自动修改为 3000 并重启 HrmNiubility 服务：
  ```bash
  ssh administrator@8.129.5.180 "powershell -Command \"(Get-Content 'C:\\hrm-niubility\\.env') -replace 'SERVER_PORT=\d+', 'SERVER_PORT=3000' | Set-Content 'C:\\hrm-niubility\\.env'\""
  ssh administrator@8.129.5.180 "C:\\nssm\\win64\\nssm.exe restart HrmNiubility"
  ```

#### 9.2 检查 Nginx 反向代理

```bash
ssh administrator@8.129.5.180 "powershell -Command \"Get-Content 'C:\\nginx\\conf\\nginx.conf' | Select-String 'proxy_pass'\""
```

- 必须为 `proxy_pass http://127.0.0.1:3000;`
- 如果不是 3000，自动修改并重启 nginx：
  ```bash
  ssh administrator@8.129.5.180 "powershell -Command \"(Get-Content 'C:\\nginx\\conf\\nginx.conf') -replace 'proxy_pass http://127.0.0.1:\d+', 'proxy_pass http://127.0.0.1:3000' | Set-Content 'C:\\nginx\\conf\\nginx.conf'\""
  ssh administrator@8.129.5.180 "powershell -Command \"Stop-Process -Name nginx -Force; Start-Sleep -Seconds 2; Start-Process -FilePath 'C:\\nginx\\nginx.exe' -WorkingDirectory 'C:\\nginx'\""
  ```

#### 9.3 验证服务可达

等待 5 秒后检查：

```bash
# 服务器内部验证
ssh administrator@8.129.5.180 "curl -s -o NUL -w \"%{http_code}\" http://localhost:3000/"
# 外部域名验证
curl -s -o /dev/null -w "%{http_code}" https://nb.szyixikeji.com/ --max-time 10
```

- 两者都应返回 HTTP 200
- 如果域名返回 502，检查 nginx 是否正确重启

#### 9.4 确认测试服务未受影响

```bash
ssh administrator@8.129.5.180 "curl -s -o NUL -w \"%{http_code}\" http://localhost:4001/"
```

- 应返回 HTTP 200，确认测试服务 HrmNiubilityTest 未被影响

### 10. 汇报结果

- 版本号：v{旧版本} → v{新版本}
- commit hash
- GitHub 推送状态
- 构建状态（已确认不含开发功能，modules 数量）
- 生产部署是否成功
- 端口验证：生产 3000 / 测试 4001
- Nginx 反向代理状态
- 生产服务器访问地址：https://nb.szyixikeji.com

## 服务器架构

```
用户 → https://nb.szyixikeji.com (443)
       → Nginx (SSL 终止)
       → proxy_pass http://127.0.0.1:3000 (生产 HrmNiubility)

测试 → http://8.129.5.180:4001 (测试 HrmNiubilityTest)
```

- 生产服务名：`HrmNiubility`，端口 3000
- 测试服务名：`HrmNiubilityTest`，端口 4001
- NSSM 路径：`C:\nssm\win64\nssm.exe`
- Nginx 配置：`C:\nginx\conf\nginx.conf`

## 安全保障

- **物理隔离**：生产构建包中不含 DevRoleSwitcher 组件代码和 Mock 登录代码
- **环境变量**：生产服务器 `.env` 设置 `NODE_ENV=production` 且不设置 `ALLOW_MOCK_LOGIN`
- **后端保护**：即使有人手动调用 mock 登录 API，后端在 `NODE_ENV=production` 时也会拒绝
- **文件恢复**：构建后自动 `git checkout` 恢复，本地/GitHub 代码始终保留完整开发功能
- **端口校验**：部署后自动验证端口配置和 Nginx 代理，防止端口冲突导致 502

## 异常处理

- 构建失败 → 先 `git checkout` 恢复文件 → 报告错误
- 部署脚本失败 → 报告错误（文件已在步骤 8 恢复）
- GitHub 推送失败 → 停止，不继续部署到生产
- 端口配置错误 → 自动修复 `.env` 和 Nginx → 重启服务 → 重新验证
- Nginx 502 → 强制重启 nginx 进程（Stop-Process + Start-Process）
