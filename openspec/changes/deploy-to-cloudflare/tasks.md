## 1. 调研运行时兼容性

- [x] 1.1 审查 `server/macro.mjs`、`sentiment.mjs`、`market.mjs`、`sectorHistory.js`，列出使用 `fs`、`child_process`、原生模块等 Workers 不支持功能的位置
- [x] 1.2 审查 `server/knowledge/`（`api/knowledge.ts` 已确认有公网使用场景，需要迁移），列出其中依赖本地文件或 Node 专有功能、需要在 Workers 上改造的部分
- [x] 1.3 查阅 Cloudflare 官方文档，确认 Workers 的 CPU 时间限制与免费额度，评估 `macro`、`sentiment` 能否满足
- [x] 1.4 把调研结论写回 `design.md`（接口迁移清单：迁 / 暂不迁 / 需拆分）

## 2. 前端部署到 Cloudflare Pages

- [x] 2.1 在 Cloudflare 创建 Pages 项目，连接 BusinessWeb 仓库，配置 `npm run build`、输出 `dist`、Node 24
- [x] 2.2 配置 SPA 回退（非 `/api/` 路径返回 `index.html`），并确认未知 `/api/*` 返回 404 而不是页面 HTML
- [x] 2.3 在 Pages 的构建环境变量里设置 `VITE_API_BASE=https://business-web-pi-eight.vercel.app`（使用者自己的 Vercel 部署；`business-web-black.vercel.app` 是上游作者的，不能用） 和 `VITE_MARKET_DIRECT=true`（网格行情在非直连模式下请求同源 `/api/grid-market`，不会使用 `VITE_API_BASE`，与现有 `build:pages` 的做法一致），保存后重新部署，使接口过渡期继续可用
- [x] 2.3a 把 Pages 的 `*.pages.dev` 来源加入 `api/knowledge.ts` 的跨域白名单（现在只允许 `business-web-black.vercel.app` 和 `turbosnails.github.io`，否则知识库接口会返回 403），并重新部署 Vercel
- [x] 2.4 确认 `*.pages.dev` 地址的 HTTPS 访问正常；自有域名的绑定推迟到使用者购买并接入域名之后（不阻塞后续任务）
- [x] 2.5 验证首页、`/grid-trading`、`/grid-trading/records` 的直接访问与刷新，以及行情接口返回正常
- [x] 2.6 在 `docs/` 补充 Cloudflare Pages 部署说明（构建设置、变量、验证命令）

## 3. Pages Functions 骨架与适配

- [x] 3.1 新增 `server/edge/adapter.mjs`：把 `handler(req, res)` 适配为 Pages Functions 的 `onRequest`（不添加 `wrangler` 配置文件，见设计决策 8）
- [x] 3.2 适配器从 Workers 的 `env` 填充 `process.env`，处理函数的读取方式不变；并在 Workers 里统一处理 `fetch` 的 `redirect: 'error'`（设计决策 5、9）
- [x] 3.3 未知 `/api/*` 返回 404 的兜底（`functions/api/[[path]].js`，已在任务 2.2 完成）
- [x] 3.4a 为适配器编写测试（`npm run test:edge`），并在本地 workerd 中验证 `china-stock`、`grid-market`、`grid-sync` 的真实行为
- [x] 3.4 在 Cloudflare 后台为 Pages 项目开启 `nodejs_compat` 兼容性开关并设置兼容日期不早于 2026-08-04（Settings → Functions → Compatibility flags，Production 与 Preview 都要设置）；服务端密钥变量留到迁移相应接口时（任务 5）再配置（已验证：线上 `grid-market` 用到 `Buffer`、`knowledge` 用到 `node:crypto`，均在 Production 正常运行）

## 4. 迁移简单接口（验证写法）

- [x] 4.1 迁移 `china-stock` 到 Pages Functions，线上验证 `/api/china-stock?symbol=sh000001`，输出与 Vercel 逐字节一致（该接口前端没有调用方）
- [x] 4.2 迁移 `grid-market` 到 Pages Functions，线上验证行情与 K 线，输出与 Vercel 一致（仅 `market` 字段里的服务器时间戳不同，因 Vercel 带 `s-maxage` 缓存）；同时确认 Production 的 `nodejs_compat` 已生效（行情分支用到 `Buffer`）
- [x] 4.3 实测新浪、腾讯行情接口从 Cloudflare 节点访问稳定：两个接口在线上均返回 200
- [x] 4.4 前端切换：在 Pages 的构建变量里删除 `VITE_MARKET_DIRECT`（或设为 `false`），重新部署后网格交易页改走同域 Workers；保留 Vercel 同名接口作为回退。注意热力图（`src/services/heatmapQuotes.ts`）请求的是 `${VITE_API_BASE}/api/grid-market`，在 `VITE_API_BASE` 清空之前仍走 Vercel

## 5. 迁移 Supabase 同步类接口

- [x] 5.1 迁移 `grid-sync`；在本地 workerd 验证 `timingSafeEqual` 可用（令牌长度不同时也不抛错）
- [x] 5.2 迁移 `pulse-sync`，复用 5.1 的写法
- [x] 5.3 迁移 `candidates-sync`，复用 5.1 的写法
- [x] 5.4 验证未配置（503）、令牌缺失或错误（401）、方法错误（405）、非法请求体（400）、缺少 `If-Match`（428）、上游不可用（502，不泄漏内部细节）的行为与 Vercel 一致
- [ ] 5.5 （延后）使用者尚未启用 Supabase 云同步（Vercel 上三个接口均返回 503"尚未配置"）。待使用者创建独立 Supabase 项目并执行迁移脚本后，在 Cloudflare 配置 `SUPABASE_URL`、`SUPABASE_SECRET_KEY`、`GRID_SYNC_TOKEN`、`PULSE_SYNC_TOKEN`，再用网格记录页的手动同步做端到端验证

## 6. 迁移重接口

- [x] 6.1 迁移 `macro`：线上连续 4 次返回 200，20 个序列（美国 12、中国 8）与 Vercel 内容完全相同，未触发 CPU 限制
- [x] 6.2 迁移 `sentiment`：线上多次返回 200，仅金银比因实时行情有 0.01 的波动
- [x] 6.3 迁移 `cls-plate`：交易日参数下 30796 字节，与 Vercel 哈希一致；非法参数 400 一致
- [x] 6.4 迁移 `knowledge`：除 `action=mcp` 外经适配器复用原处理函数；`action=mcp` 在 Workers 里改用 MCP SDK 的 Web 标准传输；已在本地 workerd 验证初始化、工具列表、工具调用与非法参数
- [x] 6.4a 新增 `scripts/check-edge-knowledge.mjs`（纳入 `npm run test:edge`），用假 Supabase 端到端覆盖只读动作、鉴权、来源校验、MCP 与 64KB 限制
- [ ] 6.5 前端逐个切换：把 `VITE_API_BASE` 改为空（或删除），使所有 `/api/*` 走同域 Workers；先在 Preview 或本地确认无遗漏，再改 Production。注意 `knowledge`、同步类接口在使用者启用 Supabase 之前都返回 503，切换前后行为相同

## 7. 收尾与验证

- [ ] 7.1 运行 `npm test -- --run`、`npm run test:functions`、`npm run typecheck`、`npm run build`，确认通过
- [ ] 7.2 为每个已迁移接口记录一条可复制的 curl 验证命令，写入 `docs/`
- [ ] 7.3 更新 `docs/DEPLOYMENT.md` 与 `README.md` 的部署说明，注明 Cloudflare 为主、Vercel 为回退
- [ ] 7.4 确认未迁移的接口清单与原因已记录，且 Vercel 部署仍保留
