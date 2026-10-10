## MODIFIED Requirements

### Requirement: 同步接口的 token 鉴权保持不变
系统 SHALL 对 `pulse-sync`、`candidates-sync` 继续要求专用 token，并 MUST 使用常量时间比较校验 token。（网格同步 `grid-sync` 已随网格交易迁移到 notes 而移除，见 `grid-trading-entry`。）

#### Scenario: token 正确
- **WHEN** 请求携带正确的专用 token
- **THEN** 接口按原有逻辑读写 Supabase 并返回成功响应

#### Scenario: token 错误或缺失
- **WHEN** 请求缺少 token，或 token 不正确
- **THEN** 接口返回未授权状态码，且不访问 Supabase
