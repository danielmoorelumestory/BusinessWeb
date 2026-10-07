# Cloudflare Pages 部署

前端和 `/api/*` 都托管在 Cloudflare Pages：静态页面来自 `dist/`，后端是 `functions/api/*` 下的 Pages Functions（与 Workers 同一个运行时）。Vercel 上的同名接口保留作为回退。迁移过程见 `openspec/changes/deploy-to-cloudflare/`。

线上地址：https://businessweb-c0u.pages.dev

## 构建设置

在 Cloudflare 的 Workers & Pages 里连接 GitHub 仓库后：

| 项目 | 值 |
|---|---|
| 生产分支 | `main`（推送即自动部署） |
| 构建命令 | `npm run build:cloudflare`（主站 + `/note/` 下的 notes，见 [notes-cohosting.md](notes-cohosting.md)）；只要主站时用 `npm run build` |
| 输出目录 | `dist` |
| `NODE_VERSION`（构建变量） | `24` |
| 兼容性日期 | 不早于 `2026-08-04`（当前 `2026-10-07`） |
| 兼容性开关 | `nodejs_compat`（Settings → Functions → Compatibility flags） |

**不要在仓库里添加 `wrangler.toml`。** 官方文档说明，一旦有 wrangler 配置文件，它就成为 Pages 项目配置的唯一来源，后台里对应字段会变成只读，容易覆盖已在后台设好的构建变量。

## 构建变量

构建变量会在构建时写入前端代码，**修改后必须重新部署（Retry deployment）才会生效**。

| 变量 | 当前值 | 说明 |
|---|---|---|
| `VITE_API_BASE` | 不设置 | 为空时前端请求同域 `/api/*`，由本站的 Functions 处理。如需临时回退到 Vercel，设为你自己的 Vercel 域名 |
| `VITE_MARKET_DIRECT` | 不设置 | 设为 `true` 时网格行情由浏览器直连腾讯，绕开 `/api/grid-market` |
| `SITE_URL` | `https://businessweb-c0u.pages.dev`（建议设置） | 仅 `build:cloudflare` 使用，作为 notes 的 RSS 链接来源；不设置时使用每次部署各不相同的临时地址 |

> 仓库里曾硬编码上游作者的 `business-web-black.vercel.app`，那不是你自己的部署，**不要**把它填进 `VITE_API_BASE`。你自己的 Vercel 域名可在 Vercel 项目 Overview 页查看。

## 服务端变量（运行时）

只有启用相应功能时才需要，在 Cloudflare 项目的 Settings → Variables and Secrets 里添加为 **Secret**，不要加 `VITE_` 前缀，不要提交到 Git。

| 变量 | 用途 |
|---|---|
| `SUPABASE_URL`、`SUPABASE_SECRET_KEY` | 同步类接口与知识库云端接口访问 Supabase |
| `GRID_SYNC_TOKEN` | `/api/grid-sync` |
| `PULSE_SYNC_TOKEN` | `/api/pulse-sync`、`/api/candidates-sync` |
| `KNOWLEDGE_READ_TOKEN`、`KNOWLEDGE_MCP_TOKEN`、`KNOWLEDGE_UPLOAD_TOKEN`、`KNOWLEDGE_SYNC_TOKEN` | `/api/knowledge`（前三个互不相同，且至少 32 字符） |

未配置时这些接口返回 503，这是正常状态：目前尚未启用 Supabase 云同步。

## 代码结构

```
functions/api/
├── [[path]].js          未知 /api/* 兜底，返回 404 JSON（具体文件优先匹配）
├── china-stock.js ...   每个接口入口两行：export const onRequest = toPagesFunction(handler)
server/edge/adapter.mjs  把 Vercel 风格 handler(req, res) 适配为 Pages Function
api/*.js、api/*.ts       处理函数本体，Vercel 与 Cloudflare 共用，未做改写
```

适配器做的事：解析查询参数与请求体、把 Workers 的 `env` 填进 `process.env`、把 `fetch` 的 `redirect: 'error'` 换成 `'manual'` 并在 3xx 时抛错（Workers 不支持 `'error'`）、`knowledge` 的 MCP 分支改用 SDK 的 Web 标准传输。新增接口时只需在 `functions/api/` 下加一个入口文件。

## 本地调试

```bash
npm run build
npx wrangler pages dev dist --compatibility-date=2026-10-07 --compatibility-flag=nodejs_compat
# 需要服务端变量时追加：--binding SUPABASE_URL=... --binding GRID_SYNC_TOKEN=...
```

`.wrangler/` 是本地缓存，已被 Git 忽略。自动化检查：

```bash
npm run test:edge        # 适配器单元测试 + knowledge/MCP 端到端（假 Supabase）
npm run test:functions   # 原有 Vercel 风格函数检查
```

## 验证接口

把 `B` 换成你的地址。下表的预期是**未启用 Supabase** 的状态。

```bash
B=https://businessweb-c0u.pages.dev

# 前端路由刷新：应为 200 text/html
curl -s -o /dev/null -w "%{http_code} %{content_type}\n" $B/grid-trading/records

# 未知接口：应为 404 的 JSON，而不是页面 HTML
curl -s -w "\n%{http_code}\n" $B/api/does-not-exist

# 行情与宏观
curl -s "$B/api/china-stock?symbol=sh000001" | head -c 120
curl -s "$B/api/grid-market?kind=quotes&symbols=sh510300" | iconv -f gbk -t utf-8 | head -c 120
curl -s "$B/api/grid-market?kind=candles&symbol=sh510300&begin=2026-09-01&end=2026-10-07" | head -c 120
curl -s "$B/api/macro" | head -c 120
curl -s "$B/api/sentiment"
curl -s "$B/api/cls-plate?date=20260930&up_limit=1" | head -c 120   # 需交易日

# 同步与知识库：未配置时应为 503；方法不对为 405；陌生来源为 403
curl -s -w " [%{http_code}]\n" $B/api/grid-sync
curl -s -w " [%{http_code}]\n" $B/api/pulse-sync
curl -s -w " [%{http_code}]\n" $B/api/candidates-sync
curl -s -w " [%{http_code}]\n" "$B/api/knowledge?action=status"
curl -s -w " [%{http_code}]\n" -H "Origin: https://evil.example" "$B/api/knowledge?action=status"
```

对比 Vercel 的输出可以确认一致性（Vercel 带 `s-maxage` 缓存，行情里的服务器时间戳可能差几秒）。

## 回退

任一阶段出问题，把 `VITE_API_BASE` 设为你自己的 Vercel 域名并重新部署，前端即回到 Vercel；Vercel 上的接口一直保留。

## 已知限制与后续

- **Supabase 云同步尚未启用**：Vercel 与 Cloudflare 上的同步类接口都返回 503。启用步骤见 `docs/DEPLOYMENT.md` 的"启用自有 Supabase 免费同步"，把其中的变量配到 Cloudflare 即可，需要用真实 Supabase 做一次端到端验证（openspec 任务 5.5）。
- **CPU 时间**：Workers 免费计划每次请求的 CPU 时间上限很低（官方文档为 10 ms）。`macro` 在线上连续多次实测未触发，但高峰期是否偶发超限需要观察；如出现 `Error 1102`，可升级 Workers Paid，或改为定时生成快照。
- **自有域名**：暂未接入，目前使用 `*.pages.dev`。
- **不上公网**：知识库本地服务（`npm run knowledge:app`）和估值工作台（`npm run valuation:server`）依赖本机文件和 CLI。线上页面访问本地估值服务时，启动需追加 `VALUATION_ALLOWED_ORIGINS=https://businessweb-c0u.pages.dev`，并使用 Chrome 或 Edge。
