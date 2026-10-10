## MODIFIED Requirements

### Requirement: 同步接口的 token 鉴权保持不变
系统 SHALL 对 `pulse-sync`、`candidates-sync` 继续要求专用 token，并 MUST 使用常量时间比较校验 token。（网格同步 `grid-sync` 已随网格交易迁移到 notes 而移除，见 `grid-trading-entry`。）

#### Scenario: token 正确
- **WHEN** 请求携带正确的专用 token
- **THEN** 接口按原有逻辑读写 Supabase 并返回成功响应

#### Scenario: token 错误或缺失
- **WHEN** 请求缺少 token，或 token 不正确
- **THEN** 接口返回未授权状态码，且不访问 Supabase

### Requirement: 密钥只在服务端配置
系统 SHALL 通过 Workers 的环境配置读取 `SUPABASE_URL`、`SUPABASE_SECRET_KEY`、`PULSE_SYNC_TOKEN` 及 `KNOWLEDGE_*` 等服务端变量（网格同步的 `GRID_SYNC_TOKEN` 已随网格交易迁移到 notes 而移除），这些变量 MUST NOT 带 `VITE_` 前缀，MUST NOT 提交到 Git，也 MUST NOT 出现在前端构建产物中。

#### Scenario: 构建产物不含密钥
- **WHEN** 前端构建完成
- **THEN** `dist/` 中不包含任何服务端密钥的值

#### Scenario: 未配置同步变量
- **WHEN** 同步类接口所需的变量未配置
- **THEN** 接口返回明确的"未启用"错误，而不是崩溃或返回成功
