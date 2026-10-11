## Why

线上实测发现两处浪费：主站 `/api/*` 的 `s-maxage` 缓存头是 Vercel 时代的写法，在 Cloudflare Pages Functions 上不生效（响应里没有 `cf-cache-status`），每个访问者都会触发一次 Function 调用并重新请求新浪、东财、腾讯；另外前端取日 K 时，只要云端数据里没有「今天」这一根（盘中、周末、节假日都是如此），就会丢弃云端结果，从腾讯整段重新下载最多约 4 年的日线。

## What Changes

- 在 `server/edge/adapter.mjs` 里为带 `s-maxage` 的 GET 响应加边缘缓存（Cloudflare Cache API）：命中时直接返回，未命中时执行处理函数并写入缓存；`no-store` 和非 200 的响应不缓存。
- 前端 `getCandles` 改为：云端数据足够新时直接采用，缺「今天」的部分交给已有的实时报价合并（`mergeQuote`）补齐，不再整段重新下载；云端数据过旧（超过 5 天）或不可用时才回退直连腾讯。
- 本地日线缓存的有效期改为按自然日判断，不再要求缓存里必须含「今天」这一根。
- 不改动云端 Worker、数据库结构和接口契约。

## Capabilities

### New Capabilities
- `api-edge-cache`: 主站 `/api/*` 公开行情接口的边缘缓存规则（哪些响应缓存、缓存时间、不缓存的情形）。

### Modified Capabilities
- `daily-bar-client`: 云端日 K 缺少当天数据时的采用规则与本地缓存有效期。

## Impact

- `server/edge/adapter.mjs` 与 `adapter.test.mjs`；`functions/api/*.js` 不变。
- `notes-site/src/lib/grid-trading.ts`：`getCandles` 与缓存判断。
- 线上行为：行情类接口的响应最多滞后其 `s-maxage` 秒（30 到 600 秒，与原设计一致）；日线页面在盘中和非交易日打开更快。
- 已确认 `/api/grid-market` 仍被主站热力图使用，保留。
