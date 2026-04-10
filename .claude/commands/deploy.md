# 一键部署到阿里云服务器

根据用户参数 `$ARGUMENTS` 决定部署目标环境。

## 执行流程

### 1. 确定部署环境

- 如果参数包含 `test` 或 `测试`，使用 **测试环境** 配置：`scripts/deploy-test-aliyun-win.sh`
- 如果参数包含 `prod` 或 `生产`，使用 **生产环境** 配置：`scripts/deploy-aliyun-win.sh`
- 如果没有参数或不明确，**询问用户**选择环境

### 2. 预检查

运行以下检查，任一失败则停止并报告：

1. 检查是否有未提交的代码更改（`git status`）
   - 如果有未提交更改，**警告用户**并询问是否继续
2. 检查对应的 deploy config 文件是否存在（`deploy.config` 或 `deploy-test.config`）
3. 检查 `expect` 命令是否可用

### 3. 执行部署

运行对应的部署脚本：

- 测试环境：`bash scripts/deploy-test-aliyun-win.sh`
- 生产环境：`bash scripts/deploy-aliyun-win.sh`

脚本会自动完成：构建 → 打包 → 上传 → 解压 → 重启服务

### 4. 报告结果

部署完成后，汇报：
- 部署环境（测试/生产）
- 部署是否成功
- 访问地址
