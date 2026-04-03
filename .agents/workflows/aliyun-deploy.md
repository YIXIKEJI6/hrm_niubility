---
description: 部署生产环境到阿里云正式服务器（端口 3001，生产包剥离测试功能）
---

# /aliyun-deploy 工作流

将本地最新代码作为**正式版本**同步到阿里云生产服务器。该流程会利用代码内置的环境隔离机制（端口拦截与 ENV），自动确保生产环境纯净，**绝不带有任何测试后门、调试视图或免密登录逻辑。**

## 使用前提

- **高危操作，请再三确认：** 代码已经过 `/test-deploy` 在 4001 环境跑通自测，并通过了用户的验收认可！！
- 确认服务器已安装 Node.js 和 NSSM，服务名 `HrmNiubility` 存活。
- 服务器地址：`8.129.5.180:3001`

---

## 步骤

### 第 1 步：强制风险确认

向用户显示一段高危警报：
> 🚨 **高危警告：正在执行生产环境上线流程！**
> 当前代码即将被直接覆盖至 `8.129.5.180:3001`。这会影响所有正式用户的企微授权与业务数据。您是否确认当前已脱离测试阶段？回复【确认发布】继续。

（若用户未回复确认，流程终止）

### 第 2 步：收集更新并推演大版本号

询问用户本次正发版的核心内容，并生成一份正式的 `CHANGELOG`。
- 重大底层变革升 Major（如 3.0.0）
- 大功能集发布升 Minor（如 2.6.0）
- 日常小补丁升 Patch

### 第 3 步：更新版本号声明

1. 用 `replace_file_content` 更新 `package.json` 的版本。
2. 用 `replace_file_content` 更新 `src/components/DevRoleSwitcher.tsx` 顶部的 `APP_VERSION` 常量（虽然它在线上不显示，但为了代码对齐也需更新）。
3. 用 `multi_replace_file_content` 将本次的正式日志插入到 `src/data/changelog.ts` 顶部。

### 第 4 步：Git 封板与推流

// turbo
```bash
git add -A && git commit -m "release(prod): vX.Y.Z - [生产正式发版说明摘要]" && git push origin main && git tag vX.Y.Z-prod && git push origin vX.Y.Z-prod
```
*(注意 tag 后面可以加 `-prod` 后缀作为正式版的防呆区分)*

### 第 5 步：构建纯净的生产包

// turbo
```bash
npm run build:all 2>&1 | tail -8
```
*(由于 `.env` 分离，此命令将会为 Vite 和 Server 剔出相应的无用包)*

### 第 6 步：安全层叠传输（正式目录）

正式目录位于 `C:/hrm-niubility/`。需要将最新构建物传上去覆盖：
// turbo
```bash
sshpass -p 'yixi2026.' scp -o StrictHostKeyChecking=no -r dist/ server-dist/ administrator@8.129.5.180:C:/hrm-niubility/
```

### 第 7 步：重启生产引擎（并严苛校验）

// turbo
```bash
sshpass -p 'yixi2026.' ssh -o StrictHostKeyChecking=no administrator@8.129.5.180 "powershell -Command \"Restart-Service HrmNiubility; Start-Sleep 3; (Invoke-WebRequest 'http://localhost:3001/api/health' -UseBasicParsing).Content\""
```
（必须看到 `{"status":"ok"}` 否则需要立刻报障回滚！）

### 第 8 步：完成撒花

向用户发送大捷通知：
- 🟢 生产系统 `vX.Y.Z` 成功上线！
- 📭 原测试专属身份切换球判定为 3001 正式端，现已全盘隐身。
- ✅ 企微免密登录拦截器在 3001 端口下已失效，强制重定向至鉴权接口。
- 🔗 请访问 `http://8.129.5.180:3001`（或由 nginx 映射的外网域名）作正式投产前最后走查！
