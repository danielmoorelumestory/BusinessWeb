## Context

Pages Functions 的动态响应默认不进边缘缓存，`Cache-Control: s-maxage` 只对静态资源或显式使用 Cache API 的响应有意义。`api/indexes`、`macro`、`china-stock`、`grid-market` 等已经按 Vercel 习惯设置了 `s-maxage=30/300/600`，但在 Cloudflare 上被忽略（线上无 `cf-cache-status`）。Worker `grid-trading-sync` 的 CLS 代理已经用 `caches.default` 做过缓存，可以沿用同样的模式。

前端 `getCandles` 现有逻辑：缓存里必须有「今天」才算有效；云端结果也必须含「今天」才采用，否则整段从腾讯重新下载。云端日 K 由 15:10 的定时任务写入，所以盘中、周末、节假日云端都没有「今天」，每次打开都走整段直连。

## Goals / Non-Goals

**Goals:**
- 公开行情接口在边缘缓存，减少 Function 调用与上游请求。
- 日线读取在云端数据足够新时不再整段重下。

**Non-Goals:**
- 不改 Worker、D1 结构、接口格式。
- 不做 IndexedDB 迁移、分钟线与日志的清理（另行评估）。
- 不实现 `stale-while-revalidate`（Cache API 不支持），缓存时长取 `s-maxage`。

## Decisions

1. **缓存放在适配器里，一处生效。** `toPagesFunction` 对 GET 请求：先 `caches.default.match(请求 URL)`；未命中则执行处理函数，响应满足「状态 200、`Cache-Control` 含 `s-maxage` 且不含 `no-store`/`private`」时，`ctx.waitUntil(cache.put(...))`。各接口已有的头不用改，缓存时间沿用其 `s-maxage`。
2. **缓存键为完整 URL（含查询参数）。** 不同代码、不同类型的请求互不干扰；认证类接口（`pulse-sync`、`candidates-sync`、`comments`）本来就是 `no-store`，不会进入缓存。
3. **命中时标记 `x-edge-cache: HIT`，未命中为 `MISS`。** 便于线上验证，与 CLS 代理的 `x-cls-cache` 保持同类做法。
4. **非 Workers 环境（本地单测、`vite` 开发代理）不启用。** 检测不到 `caches.default` 时直接走原逻辑。
5. **云端日 K 的采用规则。** 云端返回的数据覆盖所需起点，且最后一根不早于今天往前 5 个自然日，就采用，不再要求含「今天」；缺的当天交给 `mergeQuote`（实时报价）补齐。最后一根更早（定时任务可能停摆）或云端不可用时，回退直连腾讯。
6. **本地缓存有效期按自然日。** 缓存条目的 `fetchedOn` 等于今天且起点覆盖所需起点即有效；不再要求含「今天」，避免周末、节假日每次整段重下。
7. **接受的代价：** 盘中打开时，当天这一根来自实时报价合并，开盘价取报价里的今开；收盘后到下一次缓存过期之间，当天这一根是报价值而不是云端落库值，次日自动以云端为准。

## Risks / Trade-offs

- [公开接口数据最多滞后 `s-maxage` 秒] → 与原设计一致，行情接口最长 30 到 600 秒。
- [缓存键含查询参数，可被用来制造大量不同键] → 这些接口本身带上游超时与限流，且键数量受上游参数限制；先不额外处理。
- [云端数据过旧时静默回退直连] → 回退行为与改动前一致，不影响正确性。

## Migration Plan

纯服务端适配器与前端逻辑变更，随 Pages 部署生效；回滚即回退提交。验证：对同一 `/api/*` 地址连续请求两次，第二次带 `x-edge-cache: HIT`。
