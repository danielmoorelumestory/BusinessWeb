## ADDED Requirements

### Requirement: 公开行情接口在边缘缓存
系统 SHALL 对带有 `s-maxage` 的 `GET /api/*` 成功响应（状态码 200）在 Cloudflare 边缘缓存，缓存时长取该响应 `Cache-Control` 的 `s-maxage`；缓存键 MUST 包含完整请求地址（含查询参数）。命中缓存时 MUST NOT 再次执行处理函数，也 MUST NOT 再次请求上游行情源。

#### Scenario: 第二次请求命中缓存
- **WHEN** 同一个带 `s-maxage` 的接口地址在缓存有效期内被请求两次
- **THEN** 第二次响应带 `x-edge-cache: HIT`，内容与第一次相同

#### Scenario: 不同查询参数互不影响
- **WHEN** 请求 `/api/china-stock?symbol=sh000001` 之后请求 `symbol=sz399001`
- **THEN** 后者不会返回前者的缓存内容

### Requirement: 不缓存的响应
系统 MUST NOT 缓存以下响应：`Cache-Control` 含 `no-store` 或 `private` 的响应、状态码不是 200 的响应、非 GET 请求的响应。需要同步密钥或写入数据的接口（`pulse-sync`、`candidates-sync`、`comments`）MUST 继续不缓存。

#### Scenario: 同步接口不缓存
- **WHEN** 请求 `/api/pulse-sync`
- **THEN** 响应不带 `x-edge-cache: HIT`，每次都由处理函数返回

#### Scenario: 上游失败不缓存
- **WHEN** 行情接口因上游超时返回 502 或 504
- **THEN** 该响应不写入缓存，下一次请求重新访问上游
