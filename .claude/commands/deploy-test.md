# 部署到测试服务器

将当前代码提交并部署到阿里云测试服务器（HrmNiubilityTest）。

用户可通过 `$ARGUMENTS` 提供 commit message，如未提供则自动生成。

## 执行流程

### 1. 检查 Git 状态

运行 `git status` 和 `git diff --stat` 查看当前更改。

- 如果没有任何更改（工作区干净），通知用户"无更改可部署"并结束
- 如果有更改，继续下一步

### 2. 暂存文件

暂存所有已修改和新增的文件，但 **排除以下敏感/临时文件**：
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
- 如果未提供，分析 `git diff --staged --stat` 生成规范的 commit message：
  - 遵循 `<type>: <description>` 格式
  - type: feat / fix / refactor / docs / chore / perf

### 4. 提交

执行 `git commit`（不推送到 GitHub）。

### 5. 构建验证

运行 `npm run build`。

- 如果构建失败，停止部署并报告错误
- 构建成功则继续

### 6. 执行部署脚本

运行 `bash scripts/deploy-test-aliyun-win.sh`。

脚本自动完成：打包 → SCP 上传 → SSH 解压 → Restart-Service HrmNiubilityTest

### 7. 汇报结果

- commit hash
- 构建状态
- 部署是否成功
- 测试服务器访问地址

## 注意事项

- **不推送到 GitHub**
- **不触碰生产环境**
- DevRoleSwitcher 和 Mock 登录代码 **保留**（测试环境需要）
