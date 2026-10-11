## 1. 适配器边缘缓存

- [x] 1.1 在 `server/edge/adapter.mjs` 的 `toPagesFunction` 中，对 GET 请求先查 `caches.default`，命中直接返回并标记 `x-edge-cache: HIT`
- [x] 1.2 未命中时执行处理函数；响应为 200、含 `s-maxage` 且不含 `no-store`/`private` 时用 `waitUntil` 写入缓存，并标记 `MISS`
- [x] 1.3 没有 `caches.default` 的环境（本地单测、开发）保持原逻辑；确认 `pulse-sync`、`candidates-sync`、`comments` 的 `no-store` 不进缓存
- [x] 1.4 在 `adapter.test.mjs` 增加用例：命中、未命中、不同查询参数、`no-store`、非 200、非 GET

## 2. 前端日线读取

- [x] 2.1 `getCandles`：云端数据覆盖起点且最后一根不早于今天往前 5 个自然日时直接采用，不再要求含当天；过旧或不可用才回退直连腾讯
- [x] 2.2 本地缓存有效期按自然日（`fetchedOn` 等于今天且起点覆盖即有效），去掉「必须含今天」的判断
- [x] 2.3 核对 `refreshRecord`、`loadCandles`、详情页曲线、计算器页都用 `mergeQuote` 补齐当天，行为一致

## 3. 验证与发布

- [x] 3.1 跑 `npm test -- --run`、`npm run typecheck`、`npm run test:edge`、`npm run test:functions` 与三个构建；本地用 `wrangler pages dev` 连续请求同一接口确认命中
- [x] 3.2 用浏览器模拟「云端缺当天」和「周末重复打开」，确认没有整段下载请求
- [x] 3.3 推送（需用户确认）后线上验证：同一 `/api/*` 地址连续两次请求第二次为 HIT，详情页正常
