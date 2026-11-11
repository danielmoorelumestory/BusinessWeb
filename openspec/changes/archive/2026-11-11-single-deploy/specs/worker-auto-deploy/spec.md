## ADDED Requirements

### Requirement: Worker 随 main 的推送自动发布
系统 SHALL 在 `main` 分支收到涉及 `notes-site/workers/grid-trading-sync/` 的提交时，由 GitHub Actions 自动发布 Worker `grid-trading-sync`，不需要任何手动命令；该工作流 MUST 同时支持手动触发。

#### Scenario: 改动 Worker 后推送
- **WHEN** 一个修改了 `notes-site/workers/grid-trading-sync/src/index.ts` 的提交被推送到 `main`
- **THEN** 部署工作流自动运行，成功后线上 Worker 是该提交的代码

#### Scenario: 未改动 Worker 的推送
- **WHEN** 推送到 `main` 的提交只修改了 `src/` 或 `public/` 下的文件
- **THEN** 部署工作流不运行，线上 Worker 不变

#### Scenario: 手动触发
- **WHEN** 使用者在 GitHub 上手动运行部署工作流
- **THEN** 工作流按 `main` 当前的代码执行完整流程

### Requirement: 发布按测试、表结构、部署的顺序执行
系统 SHALL 依次执行：Worker 目录的自动化测试、对线上 D1 数据库 `grid-trading-sync` 应用 `schema.sql`、部署 Worker。任一步失败时 MUST 立即停止，后续步骤 MUST NOT 执行。

#### Scenario: 测试失败不发布
- **WHEN** Worker 目录的测试有一条失败
- **THEN** 工作流以失败结束，没有应用表结构，也没有部署，线上 Worker 保持上一版

#### Scenario: 新表先于新代码
- **WHEN** 一个提交同时在 `schema.sql` 里新增了一张表并在 Worker 里读写它
- **THEN** 部署完成时该表已存在于线上 D1，新接口可以正常读写

#### Scenario: 表结构重复应用不丢数据
- **WHEN** 工作流在表结构没有变化的情况下再次运行
- **THEN** 线上 D1 已有的表与数据不变

### Requirement: 凭据缺失或不足时明确失败
系统 SHALL 通过仓库密钥 `CLOUDFLARE_API_TOKEN` 获取 Cloudflare 凭据，该密钥 MUST NOT 出现在仓库文件与工作流日志中；密钥未配置或权限不足时，工作流 MUST 以失败结束并给出原因，MUST NOT 以成功状态跳过部署。

#### Scenario: 未配置密钥
- **WHEN** 仓库没有配置 `CLOUDFLARE_API_TOKEN` 时工作流运行
- **THEN** 工作流失败，日志说明缺少密钥，线上 Worker 不变

#### Scenario: 权限不足
- **WHEN** 密钥只有 D1 编辑权限、没有 Workers 脚本编辑权限
- **THEN** 部署步骤失败，工作流以失败结束

### Requirement: 连续推送按顺序发布
系统 SHALL 保证同一时间只有一个部署在执行，后到的部署等待前一个结束，MUST NOT 取消正在进行的部署。

#### Scenario: 连续两次推送
- **WHEN** 两个都修改了 Worker 的提交先后被推送到 `main`，第二个到达时第一个仍在部署
- **THEN** 第一个部署完成后第二个才开始，最终线上是第二个提交的代码

### Requirement: 文档说明自动发布的范围与限制
系统的文档 SHALL 说明：Worker 与表结构随 `main` 自动发布；`schema.sql` 只能新建表，修改已有表的列需要手动执行；Worker 的接口改动需向后兼容一个版本，因为站点与 Worker 各自独立发布、先后顺序不保证。文档 MUST NOT 再把手动 `wrangler deploy` 描述为日常发布方式。

#### Scenario: 阅读部署文档
- **WHEN** 使用者阅读 `docs/notes-cohosting.md` 中关于网格后端的部分
- **THEN** 文档说明推送 `main` 即自动发布，并列出"改列需手动""接口向后兼容"两条限制与手动回退的命令
