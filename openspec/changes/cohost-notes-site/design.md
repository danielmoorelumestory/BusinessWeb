## Context

BusinessWeb 是 React 18 + Vite 站点，已部署在 Cloudflare Pages（`businessweb-c0u.pages.dev`），`/api/*` 由 `functions/api/*` 的 Pages Functions 提供，`functions/api/[[path]].js` 让未知 `/api/*` 返回 404 JSON，其余未匹配路径回退到 `index.html`。当前 Pages 构建命令是 `npm run build`，输出 `dist/`。

notes 是 Astro 7 + Tailwind 4 的静态站点，目前发布在 GitHub Pages 的 `/note`。它有 6 个笔记 md、2 份静态 HTML 报告、行业 ETF 专栏、RSS，以及 4 个网格交易页面（计算器、已保存、详情、分钟线）。网格交易的后端是独立的 Cloudflare Worker `grid-trading-sync`（D1 + 每个交易日 3 次的定时抓取），前端跨域直连其 `workers.dev` 地址，Worker 已返回 `access-control-allow-origin: *`。

已验证的事实：Astro 的构建产物是平铺目录（`index.html`、`lab/`、`notes/`、`_astro/`、`reports/`、`rss.xml`、`404.html`），但产物里所有链接都已带 `/note/` 前缀，因为 `astro.config.mjs` 在非 Vercel 环境下设置了 `base: '/note'`。因此把产物整体放到 `dist/note/` 即可，页面代码无需修改。notes 没有任何测试文件。

Cloudflare 官方文档对 Pages Functions 的说明里没有提到定时触发，因此分钟线抓取这类定时任务必须留在独立 Worker。

## Goals / Non-Goals

**Goals:**
- notes 的全部现有功能在 BusinessWeb 同一域名的 `/note/` 下可用，路径与旧站一致。
- 不修改 notes 的任何页面或库代码；`notes-site/` 内只有 `astro.config.mjs` 的一处环境分支改动。
- 构建集成不影响现有的 BusinessWeb 构建、GitHub Pages 构建线和 `/api/*`。
- 搬入 notes 的 OpenSpec 规格，使规格与代码同处一个仓库。
- 把"搬家后本地数据会丢"的风险写清楚，并给出操作步骤。

**Non-Goals:**
- 不把任何 notes 页面重写成 React，也不统一视觉风格。
- 不替换、不删除 BusinessWeb 现有的 `/grid-trading` 等页面（留给 `replace-grid-trading`）。
- 不整合笔记与行业 ETF 内容（留给 `migrate-notes-content`）。
- 不下线 GitHub Pages 旧站，不把 Worker 纳入自动部署，不为 notes 补测试。

## Decisions

### 1. 源码一次性整体复制进 `notes-site/`
- 理由：之后只在一个仓库里改，符合"逐步拆解 notes"的方向，没有两个仓库同步的负担，Cloudflare 构建也不需要拉取其他仓库。
- 备选：git submodule（构建要拉子模块、两边改动易失步）；提交预构建产物到 `public/note/`（构建产物进 git，notes 每次改动都要手动重建，易过期）；构建时 `git clone`（多一个网络与权限失败点）。均放弃。
- 复制范围：`src/`、`public/`、`workers/`、`docs/`、`astro.config.mjs`、`package.json`、`package-lock.json`、`tsconfig.json`、`README.md`、`.gitignore`。**不复制** `node_modules/`、`dist/`、`.astro/`、`.git/`，也不复制 `.github/`（仓库级工作流只在根目录生效，notes 的 `deploy.yml` 留在旧仓库）。`openspec/` 不放进 `notes-site/`，而是迁入根目录（见决策 6）。
- 不保留 notes 的 git 历史（普通复制）。历史仍在 notes 仓库里，归档该仓库即可保留。

### 2. 构建集成：新增 Cloudflare 专用脚本，把产物复制到 `dist/note/`
新增 npm 脚本（例如 `build:cloudflare`），顺序为：`npm run build`（生成 `dist/`）→ 在 `notes-site` 内安装依赖并构建 → 把 `notes-site/dist/` 复制为 `dist/note/`。复制必须发生在 Vite 构建之后，因为 Vite 会清空输出目录。
- 理由：Pages 先匹配真实文件、再走 SPA 回退，所以 `/note/` 下的页面直接可访问，不需要额外路由配置。
- GitHub Pages 的 `pages.yml` 与 `build:pages` 保持不变，避免它的 `/BusinessWeb/` 子路径与 notes 的 `/note` 互相牵扯。
- 备选：把 notes 作为 Vite 插件或多页面入口。放弃，因为 Astro 与 Vite 构建管线不同，强行合并成本高。
- 使用者需在 Cloudflare 后台把构建命令改成新脚本，这是一次后台操作。

### 3. `astro.config.mjs` 增加 Cloudflare 分支
当前只按 `VERCEL` 区分：Vercel 用根路径，其余用 `/note`。Cloudflare Pages 的构建环境会设置 `CF_PAGES=1`。在该分支下 `base` 保持 `/note`，`site` 改为站点自己的地址（来自构建环境变量，不写死域名），否则 RSS 与规范链接会指向 GitHub Pages。
- 理由：以后换自有域名时只改环境变量，不改代码。

### 4. 主站导航入口使用普通 `<a href>`
`Header` 中指向 `/note/` 的入口不能用 React Router 的 `Link`，否则点击后由前端路由接管，找不到匹配路由而显示"这一页不存在"。普通链接会触发整页加载，由 Pages 返回真实文件。

### 5. 网格后端保持不变，沿用跨域直连
前端继续直连 `workers.dev` 上的 Worker。后续如果希望不暴露该地址，可再升级为 Pages Function 同域代理（Service binding），但不属于本变更。
- 理由：零改动、零数据迁移；D1 里已有数据按同步密钥的哈希存放，新域名的前端只要用同一个密钥就能读到。

### 6. OpenSpec 规格迁入根目录
notes 的 7 个主规格（`daily-bar-client`、`daily-bar-store`、`four-year-extremes`、`local-cache-eviction`、`minute-bar-health`、`minute-bar-sync`、`records-sync`）迁入根目录 `openspec/specs/`，4 个归档变更迁入 `openspec/changes/archive/`，均原样复制。
- 理由：这些规格就是 Worker 与网格库的行为契约，应当与代码在同一个仓库、同一个 OpenSpec 根目录下。名称与现有的 `cloudflare-pages-hosting`、`workers-api-runtime` 不冲突，不需要生成增量规格。

### 7. 本地数据按域名隔离：不做自动迁移，只写明操作步骤
notes 的"已保存标的"和同步密钥保存在 `localStorage`，按域名隔离，旧域名 `danielmoorelumestory.github.io` 与新域名 `*.pages.dev` 互不相通。已同步的记录在 D1 中：在新站点填写同一个同步密钥再同步即可恢复；**只存在本地、从未同步的记录会丢失**，所以搬家前应先在旧站点点一次同步，或导出备份。以后接入自有域名时 `localStorage` 还会再换一次，但已同步的数据不受影响。
- 理由：不同域名之间无法由前端读取对方的 `localStorage`，不存在可靠的自动迁移办法；用文档和操作清单即可降低风险。

### 8. 主站入口只在 Cloudflare 构建里显示：用构建变量 `VITE_NOTES_PATH` 控制
Header 的 `/note/` 入口仅当 `VITE_NOTES_PATH` 非空时渲染；`scripts/build-cloudflare.mjs` 在构建主站时设置它为 `/note/`，普通 `npm run build`、`build:pages`（GitHub Pages）和 Vercel 都不设置。
- 理由：GitHub Pages 构建的主站在 `/BusinessWeb/` 子路径下，没有 `/note/`，无条件显示会产生一个 404 入口，影响到"之前的访问"。已验证普通构建与 `build:pages` 的产物里都不含 `"/note/"`。
- 备选：无条件显示。放弃，原因同上。

### 9. 构建脚本以链接检查收尾，失败即终止构建
`build-cloudflare` 最后一步遍历 `dist/note/` 下的 HTML，检查以 `/note/` 开头的内部链接与资源引用是否存在；发现断链就让构建失败。
- 理由：构建失败时 Cloudflare 会保留上一个正常的部署，因此 notes 出问题不会把线上站点换成半成品。已用 notes 现有产物试跑，没有误报。

## 实测结论（本地 Cloudflare 运行时）

- `/note` 会 308 跳转到 `/note/`；`/note/notes`、`/note/lab/grid-trading` 等没有尾斜杠的链接同样 308 到带斜杠的地址，**查询参数会被保留**（`?id=abc&x=1` 跳转后原样带上）。这与 GitHub Pages 的行为一致，多一次跳转但不影响使用。
- 中文文件名的报告（`/note/reports/ETF网格交易总方案-20260923.html`）经 308 后最终返回 200。
- `/note/` 下不存在的路径返回 404（本地模拟器使用了 `dist/note/404.html`），主站的 `/no-such-page` 仍回退到入口页（200），两者互不影响。**此项为本地模拟器的行为，线上是否一致需要在上线后验证。**
- 从新域名对 Worker 发跨域预检返回 200，允许 `authorization` 头；不带令牌的请求返回 401。
- 用 notes 当前提交（`902f04b`）在新位置构建出的 HTML 与 RSS，在归一化 CSS 文件名后与 notes 原 `dist` 逐字节相同。CSS 仅少了一条 `.contents{display:contents}`：源码中没有任何地方使用该类，原 `dist` 的构建时间（13:16）早于最后一次提交（13:19），属于陈旧残留。
- 主站每次构建都会把当前分钟写进页脚（"更新于 …"），所以资源文件名的哈希每分钟都会变化；这是主站原有行为，与本变更无关。构建产物的文件数与改动前一致（616 个）。

## Risks / Trade-offs

- [两个前端技术栈长期并存，视觉不统一] → 本阶段接受；后续按价值逐块重写为 React，重写完一块就把对应的 `/note` 页面下线。
- [构建时间变长、构建多一个失败点] → 构建脚本分步执行并在任一步失败时立即退出；GitHub Pages 构建线不受影响，可作为对照。
- [`notes-site` 与根目录各有一份依赖，版本漂移] → 本阶段不合并依赖；两边的 `package.json` 各自独立，由 `notes-site` 单独安装。
- [notes 没有测试，复制后无法自动证明行为未变] → 本阶段是原样复制，用构建产物对比与线上冒烟验证（页面可访问、链接不失效、网格能回测并从 D1 同步）；补测试放到后续重写网格页面的变更里。
- [本地未同步的记录在新域名下为空] → 决策 7 的操作清单，并在任务中要求搬家前先同步或导出。
- [Pages 对 `/note`（无尾斜杠）与目录索引的处理方式未经核实] → 实施时实测 `/note`、`/note/`、`/note/lab/grid-trading` 等路径，不符合预期则在构建脚本或链接上调整。
- [Worker 仍是手动部署，且其源码现在存在于 `notes-site/workers/`] → 在文档中写明部署目录与命令，避免以为它会随 Pages 自动部署。

## Migration Plan

1. 复制 notes 源码到 `notes-site/`（排除缓存与构建产物），迁入 OpenSpec 规格与归档。
2. 修改 `notes-site/astro.config.mjs`，增加 Cloudflare 分支。
3. 新增构建脚本，本地跑通并核对 `dist/note/` 的结构、链接前缀与文件数。
4. 在 Header 增加 `/note/` 入口。
5. 使用者在旧站点同步或导出本地记录。
6. 使用者在 Cloudflare 后台把构建命令改为新脚本，触发部署。
7. 线上验证：`/note/` 各页可访问；`/note/lab/grid-trading` 能回测；填同步密钥后能从 D1 同步；主站路由与 `/api/*` 不受影响。

回滚：把 Cloudflare 构建命令改回 `npm run build` 并重新部署，`/note/` 即消失，主站不受影响；旧的 GitHub Pages 站点一直保留。

## Open Questions

- 已确定：用于 Astro `site` 的环境变量是 `SITE_URL`（Cloudflare 上优先读它，其次 `CF_PAGES_URL`，再退回旧地址）。建议在 Cloudflare 后台设置 `SITE_URL=https://businessweb-c0u.pages.dev`，否则 RSS 会使用每次部署各不相同的临时地址。
- 已实测：`/note` 无尾斜杠会 308 跳转到带斜杠的地址并保留查询参数（见"实测结论"）。
- 线上 `/note/` 下未知路径是否同样使用 `dist/note/404.html`，上线后验证。
- 使用者是否在搬家前已经同步过全部记录，需要使用者自行确认。
- RSS 的 `guid` 随站点地址变化：新站点的订阅源对阅读器来说是一份新的订阅。旧站点保留，现有订阅者不受影响。
