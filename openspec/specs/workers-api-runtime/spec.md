# workers-api-runtime Specification

## Purpose
api/* 接口在 Cloudflare 的 Workers 运行时（Pages Functions）上提供：保持与 Vercel 版本一致的契约，密钥只在服务端配置，同步接口的 token 鉴权不变，并可按接口回退。

## Requirements
### Requirement: 接口以 Cloudflare Workers 提供并保持契约
系统 SHALL 以 Cloudflare Workers 提供 `api/*` 中被迁移的接口，请求路径、查询参数、请求体、响应状态码和响应格式 MUST 与迁移前的 Vercel 版本一致。

#### Scenario: 行情代理接口返回同样的数据
- **WHEN** 客户端请求 `/api/grid-market?kind=quotes&symbols=sh510300`
- **THEN** Workers 返回腾讯行情文本，格式与 Vercel 版本一致

#### Scenario: 中国指数代理接口
- **WHEN** 客户端请求 `/api/china-stock?symbol=sh000001`
- **THEN** Workers 返回新浪财经的原始数据

### Requirement: 逐个接口迁移且可回退
系统 SHALL 支持按接口为单位切换到 Workers，未迁移的接口 MUST 继续由 Vercel 提供，且 Vercel 上的同名接口在本变更期间 MUST 保留以便回退。

#### Scenario: 只迁移部分接口
- **WHEN** 仅 `china-stock` 和 `grid-market` 切换到 Workers
- **THEN** 其余接口仍由 Vercel 提供服务，页面功能不受影响

#### Scenario: 回退单个接口
- **WHEN** 某个已迁移接口出现问题，将前端对该接口的指向改回 Vercel
- **THEN** 该接口恢复到迁移前的行为

### Requirement: 密钥只在服务端配置
系统 SHALL 通过 Workers 的环境配置读取 `SUPABASE_URL`、`SUPABASE_SECRET_KEY`、`GRID_SYNC_TOKEN`、`PULSE_SYNC_TOKEN` 等服务端变量，这些变量 MUST NOT 带 `VITE_` 前缀，MUST NOT 提交到 Git，也 MUST NOT 出现在前端构建产物中。

#### Scenario: 构建产物不含密钥
- **WHEN** 前端构建完成
- **THEN** `dist/` 中不包含任何服务端密钥的值

#### Scenario: 未配置同步变量
- **WHEN** 同步类接口所需的变量未配置
- **THEN** 接口返回明确的"未启用"错误，而不是崩溃或返回成功

### Requirement: 同步接口的 token 鉴权保持不变
系统 SHALL 对 `grid-sync`、`pulse-sync`、`candidates-sync` 继续要求专用 token，并 MUST 使用常量时间比较校验 token。

#### Scenario: token 正确
- **WHEN** 请求携带正确的专用 token
- **THEN** 接口按原有逻辑读写 Supabase 并返回成功响应

#### Scenario: token 错误或缺失
- **WHEN** 请求缺少 token，或 token 不正确
- **THEN** 接口返回未授权状态码，且不访问 Supabase

### Requirement: 迁移前先调研运行时兼容性
系统的迁移工作 SHALL 在改写 `server/` 相关接口之前，确认 `server/` 下实现不依赖 Workers 不支持的 Node 功能，并确认 Workers 的 CPU 时间限制能满足现有长时接口；无法满足的接口 MUST NOT 强行迁移，而是保留在 Vercel 并记录原因。

#### Scenario: 发现不兼容的依赖
- **WHEN** 调研发现某个接口依赖文件系统或原生模块
- **THEN** 该接口被标记为"暂不迁移"，并在设计文档中记录原因与替代方案

#### Scenario: 长时接口超出限制
- **WHEN** `macro` 或 `sentiment` 在 Workers 上实测超出 CPU 时间限制
- **THEN** 采用拆分请求、缓存或预生成快照的方式处理，或保留在 Vercel，并记录结论
