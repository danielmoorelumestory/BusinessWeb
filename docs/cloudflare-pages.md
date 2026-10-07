# Cloudflare Pages 部署

前端托管在 Cloudflare Pages；`/api/*` 在迁移完成前仍由 Vercel 提供。迁移计划见 `openspec/changes/deploy-to-cloudflare/`。

线上地址：https://businessweb-c0u.pages.dev

## 构建设置

在 Cloudflare 的 Workers & Pages 里连接 GitHub 仓库后：

| 项目 | 值 |
|---|---|
| 生产分支 | `main` |
| 构建命令 | `npm run build` |
| 输出目录 | `dist` |
| `NODE_VERSION` | `24` |

## 构建环境变量（Production）

| 变量 | 值 | 作用 |
|---|---|---|
| `VITE_API_BASE` | `https://business-web-black.vercel.app` | 监控、投资计划等页面的 `/api/*` 请求发往 Vercel |
| `VITE_MARKET_DIRECT` | `true` | 网格行情由浏览器直连腾讯行情，不经过 `/api/grid-market` |

这两个变量在构建时写入前端代码，**修改后必须重新部署才会生效**。它们与 `package.json` 里 `build:pages` 的做法一致，区别是这里站点在根路径，不需要 `VITE_BASE_PATH`。

## `/api/*` 的兜底

`functions/api/[[path]].js` 让没有对应接口的 `/api/*` 返回 404 JSON。没有它时，Pages 会把这些请求回退成 `index.html`，接口错误会被页面 HTML 掩盖。以后迁移接口时，在 `functions/api/` 下新增具体文件即可，它们会优先于这个兜底文件匹配。

## 跨域白名单

- `api/knowledge.ts` 的 `allowed` 数组包含 Pages 地址，否则知识库接口返回 403。
- 本地估值服务（`npm run valuation:server`）默认不允许 Pages 来源。如需在线上页面使用 AI 解读，启动时追加：

  ```bash
  VALUATION_ALLOWED_ORIGINS=https://businessweb-c0u.pages.dev npm run valuation:server
  ```

  请使用 Chrome 或 Edge，Safari 会拦截网页访问本机服务。

## 验证

```bash
B=https://businessweb-c0u.pages.dev
# 前端路由刷新：返回应用入口页（200，text/html）
curl -s -o /dev/null -w "%{http_code} %{content_type}\n" $B/grid-trading/records
# 未知接口：应为 404 JSON，而不是页面 HTML
curl -s -w "\n%{http_code}\n" $B/api/does-not-exist
# 构建变量是否写入：监控页分包里应能找到 Vercel 地址
curl -s $B/ | grep -o 'assets/index-[^"]*\.js'
```

## 暂不包含

- 自有域名：暂未接入，目前使用 `*.pages.dev`。
- 接口迁移：`/api/*` 尚在 Vercel，迁移按 openspec 任务 3～6 逐个进行。
- 知识库本地服务、估值工作台：依赖本机文件和 CLI，不上公网。
