# 一键部署到 GitHub

将当前代码提交并推送到 GitHub 远程仓库（origin/main）。

用户可通过 `$ARGUMENTS` 提供 commit message，如未提供则自动生成。

## 执行流程

### 1. 检查 Git 状态

运行 `git status` 和 `git diff --stat` 查看当前更改。

- 如果没有任何更改（工作区干净），通知用户"无需推送"并结束
- 如果有更改，继续下一步

### 2. 暂存文件

暂存所有已修改和新增的文件，但 **排除以下敏感文件**：
- `.env`（非 `.env.example`）
- `deploy.config`
- `deploy-test.config`
- `*.db` / `*.sqlite`
- `data/` 目录

使用 `git add` 逐个添加安全文件，而非 `git add -A`。

### 3. 生成 Commit Message

- 如果用户通过 `$ARGUMENTS` 提供了 commit message，直接使用
- 如果未提供，分析 `git diff --staged --stat` 生成规范的 commit message：
  - 遵循 `<type>: <description>` 格式
  - type: feat / fix / refactor / docs / chore / perf

### 4. 提交并推送

1. `git commit -m "<message>"`
2. `git push origin main`

### 5. 报告结果

- commit hash
- 推送是否成功
- GitHub 仓库地址：https://github.com/caoguiqiang2009-dev/hrm-niubility
