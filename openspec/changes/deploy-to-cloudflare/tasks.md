## 1. 调研运行时兼容性

- [x] 1.1 审查 `server/macro.mjs`、`sentiment.mjs`、`market.mjs`、`sectorHistory.js`，列出使用 `fs`、`child_process`、原生模块等 Workers 不支持功能的位置
- [x] 1.2 审查 `server/knowledge/`（`api/knowledge.ts` 已确认有公网使用场景，需要迁移），列出其中依赖本地文件或 Node 专有功能、需要在 Workers 上改造的部分
- [x] 1.3 查阅 Cloudflare 官方文档，确认 Workers 的 CPU 时间限制与免费额度，评估 `macro`、`sentiment` 能否满足
- [x] 1.4 把调研结论写回 `design.md`（接口迁移清单：迁 / 暂不迁 / 需拆分）

## 2. 前端部署到 Cloudflare Pages

- [ ] 2.1 在 Cloudflare 创建 Pages 项目，连接 BusinessWeb 仓库，配置 `npm run build`、输出 `dist`、Node 24
- [ ] 2.2 配置 SPA 回退（非 `/api/` 路径返回 `index.html`），并确认未知 `/api/*` 返回 404 而不是页面 HTML
- [ ] 2.3 在 Pages 的构建环境变量里设置 `VITE_API_BASE=https://business-web-black.vercel.app` 和 `VITE_MARKET_DIRECT=true`（网格行情在非直连模式下请求同源 `/api/grid-market`，不会使用 `VITE_API_BASE`，与现有 `build:pages` 的做法一致），保存后重新部署，使接口过渡期继续可用
- [ ] 2.3a 把 Pages 的 `*.pages.dev` 来源加入 `api/knowledge.ts` 的跨域白名单（现在只允许 `business-web-black.vercel.app` 和 `turbosnails.github.io`，否则知识库接口会返回 403），并重新部署 Vercel
- [ ] 2.4 确认 `*.pages.dev` 地址的 HTTPS 访问正常；自有域名的绑定推迟到使用者购买并接入域名之后（不阻塞后续任务）
- [ ] 2.5 验证首页、`/grid-trading`、`/grid-trading/records` 的直接访问与刷新，以及行情接口返回正常
- [ ] 2.6 在 `docs/` 补充 Cloudflare Pages 部署说明（构建设置、变量、验证命令）

## 3. Workers 骨架与配置封装

- [ ] 3.1 新增 `wrangler` 配置与 Worker 入口，开启 `nodejs_compat`，配置 `/api/*` 路由
- [ ] 3.2 实现统一的配置读取函数（从 Workers `env` 取值），替代 `process.env`
- [ ] 3.3 实现未知 `/api/*` 返回 404 的兜底处理
- [ ] 3.4 在 Cloudflare 配置服务端变量（不加 `VITE_` 前缀），确认不进入前端构建产物

## 4. 迁移简单接口（验证写法）

- [ ] 4.1 迁移 `china-stock` 到 Workers，并用 curl 验证 `/api/china-stock?symbol=sh000001`
- [ ] 4.2 迁移 `grid-market` 到 Workers，并用 curl 验证 `/api/grid-market?kind=quotes&symbols=sh510300`
- [ ] 4.3 实测新浪、腾讯行情接口从 Cloudflare 节点访问是否稳定，失败则记录并保留在 Vercel
- [ ] 4.4 前端切换这两个接口到 Workers，保留 Vercel 同名接口作为回退

## 5. 迁移 Supabase 同步类接口

- [ ] 5.1 迁移 `grid-sync`，验证 `timingSafeEqual` 在 Workers 上可用，不可用则改 Web Crypto
- [ ] 5.2 迁移 `pulse-sync`，复用 5.1 的写法
- [ ] 5.3 迁移 `candidates-sync`，复用 5.1 的写法
- [ ] 5.4 为三个接口验证 token 正确、token 错误或缺失、变量未配置三种情况的行为与迁移前一致
- [ ] 5.5 前端切换三个接口，并用手动同步验证网格记录能读写 Supabase

## 6. 迁移重接口

- [ ] 6.1 按任务 1 的结论迁移 `macro`，在 Workers 上实测 CPU 时间；超限则采用拆分、缓存或快照方案
- [ ] 6.2 迁移 `sentiment`，处理同样的时间限制问题
- [ ] 6.3 迁移 `cls-plate`（含 `sectorHistory` 的存取逻辑）
- [ ] 6.4 迁移 `knowledge`（有公网场景）；若依赖本地文件或 Node 专有功能，按任务 1.2 的结论改造，无法改造的部分在设计文档中记录原因，该部分保留在 Vercel
- [ ] 6.5 前端逐个切换上述接口，每切换一个就验证对应页面

## 7. 收尾与验证

- [ ] 7.1 运行 `npm test -- --run`、`npm run test:functions`、`npm run typecheck`、`npm run build`，确认通过
- [ ] 7.2 为每个已迁移接口记录一条可复制的 curl 验证命令，写入 `docs/`
- [ ] 7.3 更新 `docs/DEPLOYMENT.md` 与 `README.md` 的部署说明，注明 Cloudflare 为主、Vercel 为回退
- [ ] 7.4 确认未迁移的接口清单与原因已记录，且 Vercel 部署仍保留
