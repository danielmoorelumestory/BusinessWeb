# 免费部署与可选云同步

> 当前线上部署在 Cloudflare Pages，见 [cloudflare-pages.md](cloudflare-pages.md)。本文描述的 Vercel + Supabase 流程仍然有效，作为回退部署与 Supabase 同步的配置参考。

## 当前技术栈

React + Vite + TypeScript + React Router；Vercel 托管静态页面及 Node 24 Functions。Supabase 仅用于可选的独立同步：网格记录（`/api/grid-sync`）和经济脉搏每日复盘（`/api/pulse-sync`）。记录默认保存在浏览器，启用同步前建议导出 JSON 备份。

R2 暂未接入：当前没有附件上传业务。将来需要图片、PDF 等文件时，再接入 R2 并在 Supabase 保存文件元数据。

## 本地开发

```bash
npm ci
npm run dev
```

使用 Node 24。Vite 开发服务器实现 `/api/grid-market`，可直接运行网格行情。`/api/grid-sync` 是 Vercel Function，本地调试该接口需使用 Vercel CLI 的 `vercel dev`，并将服务端变量保存在忽略的 `.env.local`。普通 `npm run dev` 不启动 Supabase 同步接口。

```bash
npm test -- --run
npm run test:functions
npm run typecheck
npm run build
```

## 部署 Vercel 免费项目

1. 将代码推送到自己的 BusinessWeb GitHub 仓库。
2. 在 Vercel 导入该仓库，Root Directory 选择包含 `package.json` 的目录。
3. Framework 为 Vite；Build Command 为 `npm run build`；Output 为 `dist`；Node 为 24.x。
4. 初次部署不用填写 Supabase 变量，页面和本地记录即可工作。
5. 验证首页、`/grid-trading`、`/grid-trading/records` 和详情链接直接访问及刷新。
6. 打开 `/api/grid-market?kind=quotes&symbols=sh510300`，应返回腾讯行情文本。错误 `/api/...` 应为 404，而不是页面 HTML。

Vercel Hobby 适用个人非商业用途；实际额度和用途限制以官方页面为准：
https://vercel.com/docs/plans/hobby

## 启用自有 Supabase 免费同步

这是单人/同一拥有者多设备的手动同步，使用专用 token；目前不是多用户登录系统。

1. 新建**独立 BusinessWeb** Supabase Free 项目，不使用其他项目的数据库或 token。
2. 在 SQL Editor 执行 `supabase/migrations/202610020001_grid_sync.sql`。脚本幂等，重复执行不清空记录。
3. 在 Supabase 的 API Keys 中取得服务端 secret key（`sb_secret_...`）；也兼容 legacy service_role JWT。不要使用 publishable/anon key 代替。
4. 为同步创建随机 token，可本地运行：

   ```bash
   node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
   ```

5. 在 Vercel Environment Variables 中设置以下**服务端变量**，然后重新部署：

   | 变量 | 内容 |
   |---|---|
   | `SUPABASE_URL` | 新项目的 `https://<project-ref>.supabase.co` 地址 |
   | `SUPABASE_SECRET_KEY` | 新项目 secret key |
   | `GRID_SYNC_TOKEN` | 随机专用 token，至少 32 字符 |

   不要加 `VITE_` 前缀，不要将密钥提交 Git。建议只为 Production 设置凭证，避免 Preview 与正式站点共用交易数据。

6. 网站的网格记录页中，手动填写独立同步地址 `https://<你的站点>/api/grid-sync` 与专用 token，确认目标域名并保存。
7. 点击立即同步。新设备使用相同地址/token。Supabase key 不进入浏览器；token 保存在本机，JSON 导出不包含 token。

同步 GET 返回快照与 ETag，PUT 使用 If-Match 进行原子版本检查。发生并发更新时返回 409，本地数据保留，重新同步即可。相同时间但内容不同的记录仍需按照界面提示解决冲突。每次同步最多 500 条记录（含删除标记），请求体最多 3 MB；达到限制时先导出备份。

表启用 RLS，匿名与登录用户没有直接读取权限，只有服务端 service_role 可以读写。不要将同步 token 分享给其他用户：持有者拥有该独立快照的读写权限。

## GitHub Actions 定时检查与数据库活动

`.github/workflows/cloud-keepalive.yml` 每天 UTC 00:23、08:23、16:23（马来西亚时间 08:23、16:23、次日 00:23）运行，也支持在 Actions 中手动运行 **Cloud keepalive**。

启用前，在 GitHub 仓库 Settings → Secrets and variables → Actions 添加仓库 Secret `GRID_SYNC_TOKEN`，值与 Vercel Production 的同名变量相同。无需向 GitHub 提供 Supabase 服务端密钥。

任务检查正式站点，再通过已认证的 `GET /api/grid-sync` 实际读取 Supabase 快照；不写入数据，不在日志输出 token 或交易记录。缺少 Secret、非 200 响应或网络错误会使任务失败。站点域名变更时更新 workflow 的 `SITE_URL`。

Supabase 免费项目会因一周内数据库活动不足而暂停；此任务产生数据库读取活动，但不保证永不暂停，也不能恢复已暂停项目（需在 Supabase Dashboard 手动 Resume）。GitHub 定时任务可能延迟，公开仓库连续 60 天没有活动时定时任务可能自动停用，届时需在 Actions 中重新启用。

参考：[Supabase project pausing](https://supabase.com/docs/guides/platform/free-project-pausing)、[GitHub scheduled workflows](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#schedule)。

## 保留 GitHub Pages

```bash
npm run build:pages
```

本地仅用于验证构建；线上由 `.github/workflows/pages.yml` 发布。此构建显式使用 `/BusinessWeb/` 资源和 Router 路径，并生成详情路由回退页面。GitHub Pages 不运行 Functions，所以网格行情保留直接访问腾讯（受浏览器 CORS 限制），本次 Vercel 同步接口仅支持同源访问，Pages 网站不能直接跨域使用该接口；如保留 Pages 并需要云同步，需另外配置支持 CORS 的独立同步服务。

## 仍需独立处理的接口

- 首页/市场脉搏等原有 `src/services/api.ts` 中的 Yahoo、东方财富等接口仍沿用公共代理；本次替换的是网格交易行情。不保证所有公开数据源长期稳定。
- AKTools 需要 Python 服务，当前未部署，Vercel 不会自动运行本地的 `127.0.0.1:8080`。如需使用，配置可访问的 `VITE_AKTOOLS_BASE_URL`。
- 免费 Supabase 的暂停与用量限制可能影响同步，失败时本地记录继续可用。
- 当前交付代码与配置，未创建云账号、执行远端 SQL、设置线上密钥或发布站点。实际云端路由与数据库权限需部署后按上文验证。

参考：
https://vercel.com/docs/frameworks/frontend/vite
https://supabase.com/docs/guides/getting-started/api-keys
https://supabase.com/docs/guides/database/postgres/row-level-security
https://developers.cloudflare.com/r2/pricing/


## 启用每日复盘云同步（经济脉搏）

复用上面的同一个 Supabase 项目，但**使用独立的 token 和独立的表**，两处同步互不影响。

1. 在 SQL Editor 执行 `supabase/migrations/202610020002_pulse_reviews.sql`（幂等）。它创建 `businessweb_pulse_snapshot`（当前快照）、`businessweb_pulse_history`（最近 30 个历史版本）和写入函数，所有表对 `anon`/`authenticated` 全部撤权并开启 RLS，仅服务端密钥可访问。
2. 生成另一个随机 token（不要复用 `GRID_SYNC_TOKEN`）：

   ```bash
   node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
   ```

3. 在 Vercel Environment Variables 增加服务端变量 `PULSE_SYNC_TOKEN`（至少 32 字符），`SUPABASE_URL`、`SUPABASE_SECRET_KEY` 与网格同步共用；重新部署。
4. 打开 Vercel 站点的「经济脉搏」→「云端设置」，填 `https://<你的站点>/api/pulse-sync` 与该 token，确认目标域名并保存，再点「同步」。

### 增删改的安全措施

| 风险 | 措施 |
|---|---|
| 未授权读写 | 专用 Bearer token，常量时间比较；token ≥ 32 位；未配置时返回 503，不访问数据库 |
| 密钥泄露 | 数据库密钥只在服务端环境变量；浏览器只持有同步 token，不接触 Supabase 密钥；数据库表对 anon/authenticated 撤权 |
| 跨站调用 | 接口不发 CORS 头，仅同源可调；GitHub Pages 没有后端，不能同步 |
| 脏数据/注入 | 服务端与客户端共用严格校验：未知字段、非法日期、负数/小数/NaN、超长字符串、重复日期、超过 500 条、超过 1 MB 一律拒绝；上游地址固定为 `*.supabase.co` 的 HTTPS 根域名 |
| 多设备互相覆盖 | 读取时返回版本号（ETag），写入必须带 `If-Match`，数据库内用行锁校验，版本不符返回 409，本地数据保持不变 |
| 误删/误覆盖 | 删除以「墓碑」同步，同步前列出新增/覆盖/删除并要求确认；写入前把旧版本存入历史表（保留 30 份）；有效记录减少超过一半（现有 ≥ 6 条）时服务端拒绝（422），需二次确认才强制写入；同步成功覆盖本地前先备份本地（`pulse_reviews_backup`） |
| 同步中途本地被改 | 写回前比对本地快照，已变化则放弃覆盖 |
| 旧凭证残留 | 页面不再使用 GitHub Gist，并会清除浏览器里遗留的 `pulse_gist_token` |

### 找回误删的数据

在 Supabase SQL Editor 中查看历史版本，选择想恢复的一份：

```sql
select id, revision, saved_at, jsonb_array_length(payload -> 'reviews') as n
from public.businessweb_pulse_history order by id desc;
```

恢复需把对应 `payload` 写回 `businessweb_pulse_snapshot`（同时把 `revision` 加 1），然后各设备重新同步。

### 已知限制

- 同步是整份快照 + 手动触发，不是实时多人协作；适合单人多设备。
- 同步 token 保存在浏览器 localStorage，请勿在公共电脑使用；token 泄露后请在 Vercel 更换 `PULSE_SYNC_TOKEN` 并在设备上重新配置。
- 暂无请求频率限制；token 为 256 位随机值，暴力破解不可行。如需限流可加 Vercel Firewall 规则。
