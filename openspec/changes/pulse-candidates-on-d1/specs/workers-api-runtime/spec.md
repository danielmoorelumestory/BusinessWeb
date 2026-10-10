## MODIFIED Requirements

### Requirement: 密钥只在服务端配置
系统 SHALL 通过 Workers 的环境配置读取 `PULSE_SYNC_TOKEN`、`COMMENTS_ADMIN_TOKEN`、`SUPABASE_URL`、`SUPABASE_SECRET_KEY` 等服务端变量，并通过名为 `DB` 的 D1 绑定访问复盘与候选池的存储；这些变量 MUST NOT 带 `VITE_` 前缀，MUST NOT 提交到 Git，也 MUST NOT 出现在前端构建产物中。`SUPABASE_*` 只用于章节评论，复盘与候选池 MUST NOT 依赖 Supabase。

#### Scenario: 构建产物不含密钥
- **WHEN** 前端构建完成
- **THEN** `dist/` 中不包含任何服务端密钥的值

#### Scenario: 未配置同步变量
- **WHEN** 同步类接口所需的变量或 D1 绑定未配置
- **THEN** 接口返回明确的"未启用"错误，而不是崩溃或返回成功

#### Scenario: 复盘与候选池不需要 Supabase
- **WHEN** 只配置了 `PULSE_SYNC_TOKEN` 与 D1 绑定 `DB`，没有任何 `SUPABASE_*`
- **THEN** `/api/pulse-sync` 与 `/api/candidates-sync` 正常工作
