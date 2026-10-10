# pulse-candidates-d1-sync Specification

## Purpose
TBD - created by archiving change pulse-candidates-on-d1. Update Purpose after archive.
## Requirements
### Requirement: 复盘与候选池存储在 Cloudflare D1
系统 SHALL 把经济脉搏每日复盘与研究笔记候选池的云端副本存储在绑定名为 `DB` 的 Cloudflare D1 数据库中，每份数据一条带版本号的整份快照；`/api/pulse-sync` 与 `/api/candidates-sync` 的请求路径、方法、请求体与响应格式 MUST 与存储迁移前一致。

#### Scenario: 读取空快照
- **WHEN** 数据库刚建好，带正确令牌用 GET 请求 `/api/pulse-sync`
- **THEN** 返回 200、`ETag: "0"`，响应体是合法的空复盘数据（`schemaVersion: 1`、`reviews: []`）

#### Scenario: 写入后再读取
- **WHEN** 带令牌与 `If-Match: "0"` 用 PUT 提交一份合法的复盘数据，随后用 GET 读取
- **THEN** PUT 返回 200 `{ ok: true }`，GET 返回刚提交的内容，`ETag` 为 `"1"`

#### Scenario: 候选池读取带版本头
- **WHEN** 带令牌用 GET 请求 `/api/candidates-sync`
- **THEN** 响应同时带 `ETag` 与 `X-Revision`，两者的版本号一致

### Requirement: 版本号乐观并发
系统 SHALL 只在 `If-Match` 中的版本号等于云端当前版本号时才写入，写入成功后版本号加一；不匹配时 MUST 返回 409 且不修改任何数据；写入 MUST 是原子的，两个并发请求带相同版本号时只有一个成功。

#### Scenario: 其他设备已更新
- **WHEN** 云端版本号是 3，请求带 `If-Match: "2"`
- **THEN** 返回 409，云端数据与版本号不变

#### Scenario: 缺少版本号
- **WHEN** PUT 请求没有 `If-Match` 或格式不是 `"数字"`
- **THEN** 返回 428，不写入

#### Scenario: 并发写入
- **WHEN** 两个 PUT 同时以相同版本号提交
- **THEN** 恰好一个返回 200，另一个返回 409

### Requirement: 复盘防大面积误删并保留历史
系统 SHALL 在复盘写入时，若现有有效（未标记删除）记录不少于 6 条，且新数据的有效记录少于现有的一半，且请求没有 `X-Allow-Shrink: 1`，则返回 422 并拒绝写入；每次成功写入前 MUST 把上一版快照存入历史表，历史只保留最近 30 份。候选池不做此检查，也没有历史。

#### Scenario: 误删被拒绝
- **WHEN** 云端有 10 条有效复盘，请求只带 4 条有效复盘且无 `X-Allow-Shrink`
- **THEN** 返回 422，云端数据不变

#### Scenario: 显式允许缩减
- **WHEN** 同样的请求带 `X-Allow-Shrink: 1`
- **THEN** 写入成功，旧版本进入历史表

#### Scenario: 历史只保留 30 份
- **WHEN** 已成功写入 35 次
- **THEN** 历史表只有最近 30 份

### Requirement: 数据校验与大小限制保持不变
系统 SHALL 继续用现有的校验函数拒绝无效数据：复盘最多 500 条、候选池最多 2000 条且不重复、请求体不超过 1,000,000 字节、必须是合法 JSON。

#### Scenario: 请求体过大
- **WHEN** PUT 请求体超过 1,000,000 字节
- **THEN** 返回 413

#### Scenario: 结构无效
- **WHEN** PUT 提交的复盘结构不符合校验
- **THEN** 返回 400，不写入

### Requirement: 未绑定数据库时明确提示
系统 SHALL 在没有 D1 绑定 `DB`、或 `PULSE_SYNC_TOKEN` 未配置或短于 32 字符时返回 503 与"尚未配置"的提示，而不是崩溃；这包括没有 D1 的 Vercel 与 GitHub Pages 构建线。令牌校验 MUST 先于任何数据库访问，令牌无效返回 401。

#### Scenario: 没有数据库绑定
- **WHEN** 请求到达时 `env.DB` 不存在
- **THEN** 返回 503，不访问任何存储

#### Scenario: 令牌无效
- **WHEN** 数据库已绑定但 `Authorization` 与令牌不符
- **THEN** 返回 401，不读取也不写入数据库

#### Scenario: 数据库不可用
- **WHEN** D1 查询抛出错误
- **THEN** 返回 502 与通用的错误提示，不泄露内部细节

