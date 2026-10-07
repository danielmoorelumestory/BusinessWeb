## Context

BusinessWeb 是 React 18 + Vite 站点，目前托管在 Vercel：静态页面来自 `dist/`，后端是 `api/` 下 10 个 Vercel 函数（约 490 行），`vercel.json` 负责 SPA 回退、未知 `/api/*` 返回 404，以及给 `macro`、`sentiment` 设置 `maxDuration: 30`。另有一份 GitHub Pages 降级构建（`build:pages`），其 `VITE_API_BASE` 指向 Vercel。

`api/` 大多是薄壳：`grid-market`、`macro`、`sentiment`、`cls-plate` 把请求转给 `server/*.mjs` 的实现；`grid-sync`、`pulse-sync`、`candidates-sync` 约 80 行，通过 Supabase REST 读写，并用 `node:crypto` 的 `timingSafeEqual` 比对 token，密钥来自 `process.env`。目前已确认没有在 `api/` 层使用文件系统；`server/` 层尚未审查。

使用者主要在国外访问、主要自用、不熟悉后端运维。后续会把 notes 项目（已用 Cloudflare Worker + D1）合并进来，但不属于本变更。

## Goals / Non-Goals

**Goals:**
- 前端在 Cloudflare Pages 上线，路由刷新正常，绑定自有域名。
- `api/*` 逐个迁为 Workers，请求/响应契约、鉴权和错误行为与现状一致。
- 迁移分两步、可随时回滚：第 1 步不动后端，第 2 步逐个接口切换。
- 先做调研，把"能不能迁"的不确定性在改写前消除。

**Non-Goals:**
- 不合并 notes 项目的网格交易、分钟线、笔记。
- 不在本变更里决定 D1 与 Supabase 的取舍，Supabase 保持不变。
- 不下线 Vercel 与 GitHub Pages。
- 不迁移依赖本地文件或本地 CLI 的功能（知识库本地部分、估值工作台）。

## Decisions

### 1. 前端用 Cloudflare Pages，后端用 Workers，分两步切换
第 1 步只上前端，`/api/*` 仍打到现有 Vercel；第 2 步再切后端。
- 理由：第 1 步风险小、反馈快，且两步相互独立，任一步失败都可回到 Vercel。
- 备选：一次性迁前端和后端。放弃，因为出问题时无法判断是前端还是接口导致。

### 2. 过渡期 `/api/*` 的指向
Pages 站点的 `/api/*` 在第 1 步通过构建期变量（沿用现有 `VITE_API_BASE`）指向 Vercel。第 2 步改为同域的 Workers 路由（`/api/*` 由 Worker 接管）。
- 理由：同域后无需处理跨域，也不会让浏览器里的 token 暴露在多个域名下。
- 备选：Workers 独立域名，前端跨域访问。放弃，因为要额外维护 CORS，并且 `/api/*` 未知路径返回 404 的约定更难统一。

### 3. 接口迁移顺序：先简单后复杂
`china-stock`、`grid-market` → Supabase 同步类三件套 → `macro`、`sentiment`、`cls-plate` → `knowledge`（视调研结果）。
- 理由：先用最简单的接口验证路由、环境变量、部署流程；Supabase 三件套结构高度相似，验证一个即可复制；依赖 `server/` 的重接口放在最后。

### 4. Node 兼容：优先开启 `nodejs_compat`，必要时改用 Web Crypto
`timingSafeEqual` 在开启 `nodejs_compat` 后可直接保留；若实测不可用，改用 Web Crypto 实现常量时间比较，并保留行为一致的单元测试。
- 理由：改动最小，且现有 `.test` 文件可以继续覆盖。
- 备选：直接全部改 Web Crypto。暂不采用，避免无谓重写。

### 5. 密钥读取：保留 `process.env`，由适配器从 Workers 的 `env` 填充
官方文档说明，在 `nodejs_compat` 且兼容日期不早于 2025-04-01 时，Workers 会自动用环境变量和密钥填充 `process.env`。适配器在每次请求前再兜底填充一次（只写入字符串值，且不覆盖已有值）。处理函数继续读 `process.env`，无需改写。保持"服务端变量不加 `VITE_` 前缀"的现有规则。已在本地 workerd 中验证变量能被读到。
- 理由：现有 `api/*` 与 `server/*` 的读取方式完全不用动，改动面最小。
- 备选：统一封装配置读取函数并改写所有调用点。放弃，收益小而改动面大。

### 6. 调研先行：三项不确定项在改写前确认
1. `server/` 下实现是否使用 `fs`、`child_process`、原生模块等 Workers 不支持的能力。
2. `server/knowledge` 是否仅供本地使用；若是，`api/knowledge.ts` 不迁。
3. Workers 的 CPU 时间限制是否能满足 `macro`、`sentiment`（现为 `maxDuration: 30`）。注意 Workers 限制的是 CPU 时间而不是总耗时，等待上游网络请求通常不计入，但需要实测。
- 理由：这些问题决定改写量和是否需要拆分，结论应写回本设计文档。

### 7. 用一层薄适配器复用现有 `(req, res)` 处理函数
现有接口都是 Vercel 的 Express 风格 `handler(req, res)`（`req.query`、`res.status().json()`、`res.setHeader()`），而 Workers 使用标准 `Request`/`Response`。新增一个适配器，把 `Request` 转成 `{ method, headers, query, body }`，并收集 `res` 的调用结果后生成 `Response`。`server/market.mjs` 已经用同样的思路写过一个 Vite 中间件适配器，可以参考。
- 理由：处理函数本身基本不用改，现有测试仍然有效，改动集中在一处。
- 备选：把每个接口都重写成 `fetch(request)` 风格。放弃，因为改动面大、容易引入行为差异。

### 8. 用 Pages Functions 实现 `/api/*`，不单独建 Worker，也不加 `wrangler` 配置文件
Pages Functions 与 Workers 是同一个运行时，`functions/api/*.js` 同域、随推送自动部署。官方文档说明，一旦项目里有 `wrangler` 配置文件，它就成为配置的唯一来源，Cloudflare 后台里对应字段将变为只读；为避免意外改变已经在后台配置好的构建变量，本变更**不添加** `wrangler.toml`，兼容性开关改在后台设置（见任务 3.4）。
- 理由：少一个独立部署单元，不需要处理跨域，也不会在后台与文件之间产生配置冲突。
- 备选：独立 Worker（需要单独部署和路由绑定），放弃。代价是本地调试要用 `npx wrangler pages dev` 并手动传 `--compatibility-flag=nodejs_compat`。
- 约定：共享代码放在 `server/edge/`，不放在 `functions/` 下，避免被当成路由；每个接口的入口只有两行，`export const onRequest = toPagesFunction(handler)`。

### 9. 在适配器里统一抹平 `fetch` 的 `redirect: 'error'` 差异
本地用 Cloudflare 的运行时（workerd）验证时发现：Workers 的 `fetch` **不支持** `redirect: 'error'`，传入会直接抛错，被现有接口的 `catch` 吞掉后表现为 502。现有 8 处调用都用了它（含带 Supabase 密钥的同步接口），其目的是避免凭据被重定向转发到其他域名。适配器在 Workers 里包装 `fetch`：把 `'error'` 换成 `'manual'`，遇到 3xx 就抛错，语义与原来一致，Vercel 上不受影响。
- 理由：一处统一处理，不用改动 8 个调用点，也不削弱原有的安全保证。

## 调研结论（任务 1）

**`server/` 兼容性（任务 1.1）：** `market.mjs`、`macro.mjs`、`sentiment.mjs` 没有使用文件系统、子进程或原生模块，只用了 `fetch`、`AbortSignal.timeout`、`Buffer`，Workers 都支持。唯一需要处理的是 `sectorHistory.js` 里的 `process.env`（改为从配置封装读取）。

**`knowledge`（任务 1.2）：** 公网接口 `api/knowledge.ts` 依赖 `server/knowledge/cloud*.ts`、`sync-contract.ts`、`links.mjs`，它们只用到 `node:crypto`（`timingSafeEqual`、`createHash`）、`Buffer`、`node:path`、`process.env`，在 `nodejs_compat` 下可用。**真正的难点是 `cloud-mcp.ts`**：它使用 MCP SDK 的 `StreamableHTTPServerTransport`，需要 Node 的 `IncomingMessage`/`ServerResponse`，适配器无法直接满足，需要改用 SDK 提供的、基于标准 `Request`/`Response` 的传输实现，或把 `action=mcp` 暂时保留在 Vercel。`server/knowledge/vault.mjs` 使用本地文件系统，只供本地服务使用，不在公网接口的依赖里，不需要迁移。

**Workers 限制（任务 1.3，来自 Cloudflare 官方文档的限制页面）：**
| 项目 | Free | Paid |
|---|---|---|
| CPU 时间/请求 | **10 ms** | 默认 30 秒，最高 5 分钟 |
| 子请求/次调用 | 50 | 10,000 |
| 每日请求 | 100,000 | 无上限 |
| 内存 | 128 MB | 128 MB |

HTTP 请求的总耗时没有上限，只限制 CPU 时间；等待上游网络响应通常不计入 CPU 时间。因此 `macro`、`sentiment` 的 30 秒上限不是问题，**问题在 Free 的 10 ms CPU 上**：`macro` 要并行拉取十几个 FRED 序列并解析 CSV，是否超过 10 ms 需要实测，不能提前下结论。`macro` 子请求数量也需要对照 50 的上限逐一核对。

**Node 兼容（支持情况来自官方文档）：** 兼容日期在 2026-08-04 之前需要显式开启 `nodejs_compat`，之后默认开启。文档没有逐个列出 `crypto` 的具体方法，所以 `timingSafeEqual`、`createHash` 仍需实测确认。

**迁移清单（任务 1.4）：**
| 接口 | 结论 |
|---|---|
| `china-stock`、`grid-market` | 迁 |
| `grid-sync`、`pulse-sync`、`candidates-sync` | 迁（`node:crypto` 需实测） |
| `cls-plate` | 迁（`process.env` 改封装） |
| `macro`、`sentiment` | 迁，但需先实测 CPU 时间，Free 计划可能不够 |
| `knowledge`（非 MCP 部分） | 迁 |
| `knowledge`（`action=mcp`） | 待定：改用标准 Request/Response 传输，或暂留 Vercel |

## Risks / Trade-offs

- [Workers 不是完整 Node，部分依赖无法运行] → 任务一先调研；对不兼容的依赖逐个替换，替换不了的接口保留在 Vercel，不强行迁移。
- [`macro`、`sentiment` 处理时间较长，可能超出 CPU 限制] → 实测；超限则拆分上游请求、加缓存，或用 Cron 预生成快照（仓库已有 `macro-snapshot` 的做法）。
- [新浪、腾讯行情接口从 Cloudflare 节点访问不稳定或被限制] → 第 2 步迁 `china-stock`、`grid-market` 时第一时间实测；失败则这两个接口保留在 Vercel。
- [双平台并行期间配置不一致，行为出现差异] → 在迁移期保留现有契约测试（`test:functions`）并对 Workers 版本复用；接口逐个切换。
- [SPA 回退与 `/api/*` 404 规则在 Pages 上实现方式不同，容易出现 API 404 被页面 HTML 替代] → 作为规格场景明确验证。
- [自己不熟后端，调试成本高] → 每个接口迁完立刻做一条可复制的 curl 验证命令，并写入 `docs/`。

## Migration Plan

1. 调研 `server/` 与限制，结论写回本文档。
2. 创建 Cloudflare Pages 项目，配置构建（`npm run build`、输出 `dist`、Node 24）、SPA 回退、域名；`/api/*` 仍指向 Vercel。
3. 验证首页及主要路由直接访问与刷新。
4. 建立 Worker 骨架（`wrangler` 配置、路由、配置读取封装、`nodejs_compat`），迁 `china-stock`、`grid-market`。
5. 前端切换这两个接口到 Workers，保留 Vercel 同名接口作为回退。
6. 依次迁 Supabase 同步类、`macro`、`sentiment`、`cls-plate`，每个接口单独切换与验证。
7. 全部稳定一段时间后，再另行决定下线 Vercel（不在本变更内）。

回滚：任一阶段只需把前端的 API 指向改回 Vercel，Vercel 部署在本变更内始终保留。

## Open Questions

- Pages 上 `/api/*` 由 Worker 接管的具体路由配置方式（Pages Functions 与独立 Worker 的路由绑定）需在实施时对照 Cloudflare 官方文档确定。
- 已确认：`knowledge` 云端接口有公网使用场景，需要迁移，因此它不能被排除在范围外，其迁移难度取决于任务 1.2 的调研结果。
- 已确认：使用者在 Cloudflare 上暂无域名。本变更先使用 `*.pages.dev` 地址（自带 HTTPS）；自有域名后续再接入，不阻塞迁移。
