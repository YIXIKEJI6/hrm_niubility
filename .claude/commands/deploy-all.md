# 一键全部部署（GitHub + 阿里云服务器）

先推送到 GitHub 备份，再部署到阿里云服务器。

用户可通过 `$ARGUMENTS` 指定目标环境（test/prod），默认询问。

## 执行流程

### 阶段 1：GitHub 部署

按照 `/deploy-github` 命令的流程执行：

1. 检查 Git 状态
2. 暂存文件（排除敏感文件）
3. 分析更改，自动生成 commit message
4. `git commit` + `git push origin main`
5. 确认推送成功后继续

### 阶段 2：服务器部署

按照 `/deploy` 命令的流程执行：

1. 确定部署环境（根据 `$ARGUMENTS` 或询问用户）
2. 运行对应部署脚本
3. 等待部署完成

### 阶段 3：汇报

汇报完整部署结果：
- GitHub 推送状态 + commit hash
- 服务器部署状态 + 访问地址
- 总耗时
