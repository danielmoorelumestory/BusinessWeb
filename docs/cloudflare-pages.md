# Cloudflare Pages 部署

前端和 `/api/*` 都托管在 Cloudflare Pages：静态页面来自 `dist/`，后端是 `functions/api/*` 下的 Pages Functions（与 Workers 同一个运行时）。Vercel 部署已停用（见本文末尾"Vercel 已停用"）。迁移过程见 `openspec/changes/deploy-to-cloudflare/`。

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
| `VITE_API_BASE` | 不设置 | 为空时前端请求同域 `/api/*`，由本站的 Functions 处理 |
| `VITE_MARKET_DIRECT` | 不设置 | 设为 `true` 时热力图的行情由浏览器直连腾讯，绕开 `/api/grid-market` |
| `SITE_URL` | `https://businessweb-c0u.pages.dev`（建议设置） | 仅 `build:cloudflare` 使用，作为 notes 的 RSS 链接来源；不设置时使用每次部署各不相同的临时地址 |

## 服务端变量（运行时）

只有启用相应功能时才需要，在 Cloudflare 项目的 Settings → Variables and Secrets 里添加为 **Secret**，不要加 `VITE_` 前缀，不要提交到 Git。

| 变量 | 用途 |
|---|---|
| `PULSE_SYNC_TOKEN` | `/api/pulse-sync`、`/api/candidates-sync`（至少 32 字符） |
| `SUPABASE_URL`、`SUPABASE_SECRET_KEY` | 只用于 `/api/comments`（章节评论） |
| `COMMENTS_ADMIN_TOKEN` | `/api/comments` 的管理员操作（审核、驳回、删除），至少 32 字符；评论本身也依赖上面的 `SUPABASE_URL`、`SUPABASE_SECRET_KEY` |

### D1 绑定（复盘与候选池）

复盘与候选池存储在 Cloudflare D1。Pages 项目没有 `wrangler.toml`，绑定在控制台里添加：

1. 创建数据库并建表：`npx wrangler d1 create businessweb`，再 `npx wrangler d1 execute businessweb --remote --file=d1/schema.sql`（可重复执行，不清数据）。
2. 项目 Settings → Bindings → Add → D1 database：变量名必须是 `DB`，选 `businessweb`，Production 与 Preview 都加。
3. 添加 Secret `PULSE_SYNC_TOKEN`（`openssl rand -hex 32`）。
4. Deployments → Retry deployment，绑定与变量才会生效。

未配置（没有 `DB` 绑定、令牌缺失或短于 32 字符）时这些接口返回 503，这是正常状态。

## 静态响应头与客户端 IP（合并上游后补充）

- `public/_headers` 对应 `vercel.json` 里的 `headers`：全站 `X-Content-Type-Options: nosniff`、`Referrer-Policy`；`/assets/*` 长期缓存（`immutable`）；`/first-book/*.md` 加 `X-Robots-Tag: noindex`。**`_headers` 只作用于静态文件，不作用于 Functions 的响应。**
- `/api/*` 的 `X-Robots-Tag: noindex, nofollow` 由 `server/edge/adapter.mjs` 给所有函数响应添加（处理函数自己设置的值不会被覆盖）。
- **客户端 IP**：评论接口的限流依赖 `x-real-ip` / `x-forwarded-for`。在 Cloudflare 上客户端可以随便发送，限流会被伪造绕过。因此适配器在 Workers 里统一用可信的 `cf-connecting-ip` 覆盖这两个头（拿不到时用 `unknown`，绝不信任客户端自己发来的值）。以后新增依赖客户端 IP 的接口，直接读这两个头即可。

## 代码结构

```
functions/api/
├── [[path]].js          未知 /api/* 兜底，返回 404 JSON（具体文件优先匹配）
├── china-stock.js ...   每个接口入口两行：export const onRequest = toPagesFunction(handler)
server/edge/adapter.mjs  把 Vercel 风格 handler(req, res) 适配为 Pages Function
api/*.js、api/*.ts       处理函数本体（Vercel 风格的 handler(req, res)，由适配器接入 Pages Functions）
```

适配器做的事：解析查询参数与请求体、把 Workers 的 `env` 填进 `process.env`、把 `fetch` 的 `redirect: 'error'` 换成 `'manual'` 并在 3xx 时抛错（Workers 不支持 `'error'`）。新增接口时只需在 `functions/api/` 下加一个入口文件。

## 本地调试

```bash
npm run build
npx wrangler pages dev dist --compatibility-date=2026-10-07 --compatibility-flag=nodejs_compat
# 需要服务端变量时追加：--binding PULSE_SYNC_TOKEN=...；需要本地 D1 时追加：--d1 DB=businessweb（先 npx wrangler d1 execute businessweb --local --file=d1/schema.sql）
```

`.wrangler/` 是本地缓存，已被 Git 忽略。自动化检查：

```bash
npm run test:edge        # 适配器单元测试
npm run test:functions   # 函数加载与未配置时的检查
```

## 验证接口

把 `B` 换成你的地址。下表的预期是**尚未绑定 D1 / 未配置令牌**的状态；绑定并配置后，`pulse-sync` 与 `candidates-sync` 无令牌为 401、带令牌 GET 为 200 且带 `ETag`。

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
curl -s "$B/api/indexes" | head -c 120          # 指数价格与成分股 PE，较慢（十几秒）
curl -s "$B/api/sentiment"
curl -s -w " [%{http_code}]\n" "$B/api/cls-plate?date=20260930&up_limit=1"   # 已移除，应为 404 的 JSON

# 同步类接口：未配置时应为 503；方法不对为 405；陌生来源为 403
curl -s -w " [%{http_code}]\n" $B/api/grid-sync   # 已移除，应为 404 的 JSON
curl -s -w " [%{http_code}]\n" $B/api/pulse-sync
curl -s -w " [%{http_code}]\n" $B/api/candidates-sync
curl -s -w " [%{http_code}]\n" "$B/api/comments?slug=a.md"   # 未配置评论所需的 Supabase 时为 503
curl -s -w " [%{http_code}]\n" -H "Origin: https://evil.example" "$B/api/pulse-sync"
```



## 网格交易的旧路径

主站自己的网格交易已被 notes 的网格交易计算器取代（变更 `replace-grid-trading`）。`public/_redirects` 里是服务端 302 跳转，前端的 `GridMoved` 路由作兜底：

```bash
B=https://businessweb-c0u.pages.dev
curl -s -o /dev/null -w "%{http_code} -> %{redirect_url}\n" $B/grid-trading                 # 302 -> /note/lab/grid-trading/
curl -s -o /dev/null -w "%{http_code} -> %{redirect_url}\n" $B/grid-trading/records         # 302 -> /note/lab/grid-trading/saved/
curl -s -o /dev/null -w "%{http_code} -> %{redirect_url}\n" $B/grid-trading/records/abc123  # 302 -> /note/lab/grid-trading/detail/?id=abc123
```

旧的板块轮动与涨停分析同理跳转到 notes 的股市分析 lab（主站自己的实现与 `/api/cls-plate` 已删除）：

```bash
curl -s -o /dev/null -w "%{http_code} -> %{redirect_url}\n" $B/sector-rotation      # 302 -> /note/lab/stock/#sector-rotation
curl -s -o /dev/null -w "%{http_code} -> %{redirect_url}\n" $B/limit-up-analysis    # 302 -> /note/lab/stock/#stock-analysis
```

先用 302（临时）便于回退；稳定后可以改成 301。GitHub Pages 的构建没有 `/note/`，那里 `/grid-trading*`、`/sector-rotation`、`/limit-up-analysis` 显示"已迁移"的说明页，并链接到 Cloudflare 站点上的对应工具。

## Vercel 已停用

原来的 Vercel 部署已停用：仓库里的 `vercel.json`、`.vercelignore` 与旧的 `DEPLOY.md` 已删除，页面与接口只在 Cloudflare Pages 上提供。在 Vercel 控制台里需要你自己删除项目或断开 Git 集成（否则每次推送仍会触发一次构建），详见 `docs/DEPLOYMENT.md`。

如要回到 Vercel，从 git 历史恢复 `vercel.json` 再导入项目即可；注意复盘与候选池的云同步需要 D1，在 Vercel 上返回 503。

## 已知限制与后续

- **复盘与候选池的云同步**：存储在 D1，配置步骤见上文"D1 绑定"；GitHub Pages 构建线没有 D1，这两个接口在那里返回 503。章节评论仍需要 Supabase，未配置时 503。
- **CPU 时间**：Workers 免费计划每次请求的 CPU 时间上限很低（官方文档为 10 ms）。`macro` 在线上连续多次实测未触发，但高峰期是否偶发超限需要观察；如出现 `Error 1102`，可升级 Workers Paid，或改为定时生成快照。
- **自有域名**：暂未接入，目前使用 `*.pages.dev`。
- **不上公网**：估值工作台（`npm run valuation:server`）依赖本机文件和 CLI。线上页面访问本地估值服务时，启动需追加 `VALUATION_ALLOWED_ORIGINS=https://businessweb-c0u.pages.dev`，并使用 Chrome 或 Edge。
