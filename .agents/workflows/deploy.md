---
description: 一键部署到阿里云 Windows 服务器
---

# 一键部署到阿里云 Windows 服务器

// turbo-all

## 前置条件

- 服务器已安装 Node.js 18+
- 服务器已安装 NSSM
- 服务器已配置防火墙开放端口 3001
- 本地已配置 `deploy.config`

## 部署步骤

### 1. 确保依赖已安装

```bash
npm install
```

### 2. 构建生产包（前端 + 后端）

```bash
npm run build:all
```

### 3. 一键部署

```bash
npm run deploy
```

## 首次部署（服务器端配置）

在 Windows Server 上执行：

```powershell
# 1. 创建应用目录
mkdir C:\hrm-niubility

# 2. 注册 NSSM 服务
C:\nssm\nssm.exe install HrmNiubility "C:\Program Files\nodejs\node.exe" "C:\hrm-niubility\server-dist\index.mjs"
C:\nssm\nssm.exe set HrmNiubility AppDirectory "C:\hrm-niubility"
C:\nssm\nssm.exe set HrmNiubility AppEnvironmentExtra "NODE_ENV=production"

# 3. 配置防火墙
New-NetFirewallRule -DisplayName "HRM Niubility" -Direction Inbound -Port 3001 -Protocol TCP -Action Allow

# 4. 启动服务
nssm start HrmNiubility
```

## GitHub 仓库

```bash
# 推送代码
git push origin main
```
