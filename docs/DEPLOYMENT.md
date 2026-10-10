# 云同步配置与 Vercel 停用说明

> 当前线上部署在 Cloudflare Pages，见 [cloudflare-pages.md](cloudflare-pages.md)。Vercel 部署已停用；本文说明云同步（复盘与候选池用 Cloudflare D1，评论用 Supabase）的配置，以及如何彻底下线 Vercel。

## 当前技术栈

React + Vite + TypeScript + React Router；Cloudflare Pages 托管静态页面与 Pages Functions。经济脉搏每日复盘（`/api/pulse-sync`）与候选池（`/api/candidates-sync`）的可选云同步存储在 Cloudflare D1（GitHub Pages 构建线没有 D1，这两个接口在那里返回 503）；章节评论（`/api/comments`）使用 Supabase。网格交易已迁到 notes 站点（`/note/lab/grid-trading/`），它的同步走自己的 Worker 与 D1，不使用 Supabase。记录默认保存在浏览器，启用同步前建议导出 JSON 备份。

R2 暂未接入：当前没有附件上传业务。将来需要图片、PDF 等文件时，再接入 R2 并在 Supabase 保存文件元数据。

## 本地开发

```bash
npm ci
npm run dev
```

使用 Node 24。Vite 开发服务器实现 `/api/grid-market`（热力图的行情代理）。`/api/pulse-sync`、`/api/candidates-sync` 需要 D1，普通 `npm run dev` 把它们代理到线上的 Cloudflare 站点；需要本地 D1 时用 `npx wrangler pages dev dist --d1 DB=businessweb`（见 cloudflare-pages.md）。

```bash
npm test -- --run
npm run test:functions
npm run typecheck
npm run build
```

## 停用 Vercel（需要你在 Vercel 控制台操作）

仓库里的 `vercel.json`、`.vercelignore` 与旧的 `DEPLOY.md` 已删除，代码里的 Vercel 域名也已换成 Cloudflare 域名。但 Vercel 项目本身还在，并且仍连着 GitHub 仓库，**每次推送仍会触发一次构建**。请在 Vercel 控制台二选一：

1. **删除项目（推荐）**：打开项目 → Settings → 最下方 **Delete Project**，输入项目名确认。这会让 `business-web-pi-eight.vercel.app` 不再可访问，并停止构建。
2. **只断开 Git**：Settings → Git → **Disconnect**，保留项目但不再自动部署。

删除前请确认：线上站点用的是 `https://businessweb-c0u.pages.dev`；Vercel 上没有你还需要的环境变量（上线时核对过为空）。删除后，浏览器里保存在 Vercel 域名下的本地数据（复盘、候选池、同步设置）也随域名不再可用——请先在新站点里同步到云端或导出。

GitHub Pages 构建线以前通过 `VITE_API_BASE` 调用 Vercel 上的接口；Vercel 停用后它没有任何后端，行情走浏览器直连，云同步不可用。

## 创建自有 Supabase 免费项目（仅章节评论需要）

只有启用章节评论（`/api/comments`）才需要 Supabase。复盘与候选池用 Cloudflare D1，网格交易用 notes 的 Worker + D1，都不需要它。

1. 新建**独立 BusinessWeb** Supabase Free 项目，不使用其他项目的数据库或 token。
2. 按需要在 SQL Editor 执行 `supabase/migrations/` 下对应的脚本（均幂等，重复执行不清空数据）：`202610090001_comments.sql`（评论）、`202610020004_sector_history.sql`（板块历史缓存）。
3. 在 Supabase 的 API Keys 中取得服务端 secret key（`sb_secret_...`）；也兼容 legacy service_role JWT。不要使用 publishable/anon key 代替。
4. 创建随机 token，可本地运行：

   ```bash
   node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
   ```

5. 在 Cloudflare Pages 的 Variables and Secrets 中设置**服务端变量**，然后重新部署：

   | 变量 | 内容 |
   |---|---|
   | `SUPABASE_URL` | 新项目的 `https://<project-ref>.supabase.co` 地址 |
   | `SUPABASE_SECRET_KEY` | 新项目 secret key |
   | `COMMENTS_ADMIN_TOKEN` | 评论管理员操作的随机 token，至少 32 字符 |

   不要加 `VITE_` 前缀，不要将密钥提交 Git。建议只为 Production 设置凭证，避免 Preview 与正式站点共用数据。


## 保留 GitHub Pages

```bash
npm run build:pages
```

本地仅用于验证构建；线上由 `.github/workflows/pages.yml` 发布。此构建显式使用 `/BusinessWeb/` 资源和 Router 路径，并生成详情路由回退页面。GitHub Pages 不运行 Functions，所以热力图行情保留直接访问腾讯（受浏览器 CORS 限制），本次 Vercel 同步接口仅支持同源访问，Pages 网站不能直接跨域使用该接口；如保留 Pages 并需要云同步，需另外配置支持 CORS 的独立同步服务。

## 仍需独立处理的接口

- 首页/市场脉搏等原有 `src/services/api.ts` 中的 Yahoo、东方财富等接口仍沿用公共代理；本次替换的是网格交易行情。不保证所有公开数据源长期稳定。
- AKTools 需要 Python 服务，当前未部署，线上站点不会自动运行本地的 `127.0.0.1:8080`。如需使用，配置可访问的 `VITE_AKTOOLS_BASE_URL`。
- 免费 Supabase 的暂停与用量限制可能影响评论；复盘与候选池用 D1，不会因闲置暂停。失败时本地记录继续可用。
- 当前交付代码与配置，未创建云账号、执行远端 SQL、设置线上密钥或发布站点。实际云端路由与数据库权限需部署后按上文验证。

参考：
https://supabase.com/docs/guides/getting-started/api-keys
https://supabase.com/docs/guides/database/postgres/row-level-security
https://developers.cloudflare.com/r2/pricing/


## 启用复盘与候选池云同步（Cloudflare D1）

经济脉搏的每日复盘（`/api/pulse-sync`）与研究笔记候选池（`/api/candidates-sync`）共用一个 D1 数据库和同一个 `PULSE_SYNC_TOKEN`。

1. 创建数据库并建表（幂等，重复执行不清数据）：

   ```bash
   npx wrangler d1 create businessweb
   npx wrangler d1 execute businessweb --remote --file=d1/schema.sql
   ```

2. 在 Cloudflare Pages 项目 Settings → Bindings 添加 D1 绑定，变量名必须是 `DB`，Production 与 Preview 都加。
3. 生成 token 并添加为 Secret `PULSE_SYNC_TOKEN`（至少 32 字符）：

   ```bash
   node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
   ```

4. Deployments → Retry deployment。
5. 打开站点的「经济脉搏」→「云端设置」，填 `https://<你的站点>/api/pulse-sync` 与该 token，确认目标域名并保存，再点「同步」；候选池同理（`/api/candidates-sync`）。

### 增删改的安全措施

| 风险 | 措施 |
|---|---|
| 未授权读写 | 专用 Bearer token，常量时间比较；token ≥ 32 位；未绑定数据库或未配置令牌时返回 503；令牌校验先于任何数据库访问 |
| 密钥泄露 | 令牌只在服务端 Secret；浏览器只持有同步 token；数据库只能由绑定它的 Pages Functions 访问 |
| 跨站调用 | 接口不发 CORS 头，仅同源可调；GitHub Pages 没有后端，不能同步 |
| 脏数据/注入 | 服务端与客户端共用严格校验：未知字段、非法日期、负数/小数/NaN、超长字符串、重复日期、复盘超过 500 条、候选池超过 2000 条、超过 1 MB 一律拒绝；SQL 全部使用参数绑定 |
| 多设备互相覆盖 | 读取时返回版本号（ETag），写入必须带 `If-Match`，数据库用带版本号条件的更新保证原子性，版本不符返回 409，本地数据保持不变 |
| 误删/误覆盖 | 删除以「墓碑」同步，同步前列出新增/覆盖/删除并要求确认；写入前把旧版本存入历史表（保留 30 份）；有效记录减少超过一半（现有 ≥ 6 条）时服务端拒绝（422），需二次确认才强制写入；同步成功覆盖本地前先备份本地（`pulse_reviews_backup`） |
| 同步中途本地被改 | 写回前比对本地快照，已变化则放弃覆盖 |
| 旧凭证残留 | 页面不再使用 GitHub Gist，并会清除浏览器里遗留的 `pulse_gist_token` |

### 找回误删的数据

复盘历史在 D1 的 `pulse_history` 表，查看并选择想恢复的一份：

```bash
npx wrangler d1 execute businessweb --remote --command "select id, revision, saved_at, length(payload) as bytes from pulse_history order by id desc"
```

恢复需把对应 `payload` 写回 `sync_snapshot`（`kind = 'pulse'`，同时把 `revision` 加 1），然后各设备重新同步。

### 已知限制

- 同步是整份快照 + 手动触发，不是实时多人协作；适合单人多设备。
- 同步 token 保存在浏览器 localStorage，请勿在公共电脑使用；token 泄露后请在 Cloudflare 更换 `PULSE_SYNC_TOKEN` 并在设备上重新配置。
- 暂无请求频率限制；token 为 256 位随机值，暴力破解不可行。如需限流可加 Cloudflare 的速率限制规则。
