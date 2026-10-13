# AI 试问部署配置记录

更新：2026-10-12。功能代码原在 `ask-lab-wip` 分支，提交 `603e60b`，已选择性合入 main，保留 main 的其他改动。

## 已执行

- Supabase 项目：`wrcxymsdfpgontzbxozt`（BusinessWeb）。已执行 `202610120001_ask_usage.sql`。
- 在数据库事务内验证用户、IP、全站额度及退款；验证三张表启用 RLS，anon/authenticated 无表读取和 RPC 执行权限。测试数据已回滚。
- Site URL：`https://business-web-black.vercel.app`。
- Redirect URLs：Vercel `/ai`、GitHub Pages `/BusinessWeb/ai` 和 `/BusinessWeb/ai/`（Pages 会自动补斜杠）、本地 `http://localhost:5173/ai`。
- GitHub OAuth 应用：Live AI 实验室；应用设置 `https://github.com/settings/applications/3925201`。凭证已配置到 Supabase，未写入仓库。
- Google Cloud：项目 `ace-line-426620-v8`，应用 Live AI 实验室，Web 客户端已创建，Supabase Google provider 已配置。受众已切换“正式版”。
- OAuth 回调：`https://wrcxymsdfpgontzbxozt.supabase.co/auth/v1/callback`。
- Supabase `/auth/v1/settings` 实测 HTTP 200，Google/GitHub 均为 true。
- Vercel business-web 生产环境已设置 `VITE_SUPABASE_URL`、`VITE_SUPABASE_ANON_KEY`、`SUPABASE_ANON_KEY`、`ASK_IP_LIMIT=6`、`ASK_GLOBAL_LIMIT=300`。保留原有服务端 Supabase Secret。

## 发布与验收

- 用户已在 Vercel 新建 `MINIMAX_API_KEY`，类型为保密变量；密钥值未读取；已通过登录用户的真实提问验证 MiniMax 返回回答。
- Google 品牌页面隐私链接已设为 `https://business-web-black.vercel.app/ai-privacy.html`；对应 `public/ai-privacy.html` 已随网站部署，线上实测 HTTP 200。
- GitHub Pages 构建已补公开 Supabase 配置；本地开发已补公开配置和问答接口代理。前端环境变量需要重新构建后生效。
- 已修复模型超时退款与跨北京时间零点退款；退款使用独立超时和原扣款日期。补充迁移 `202610120002_ask_usage_day.sql` 已执行，事务测试验证按日期扣款、退款及 RPC 权限，测试写入已回滚。
- Vercel 上实际验证 Google 和 GitHub 登录回跳，两次模型回答成功，第三次被每日额度拦截。GitHub Pages 上验证 Google 回跳和跨站提交，收到相同的每日额度提示。
- 模型超时退款由自动回归测试和真实数据库事务测试覆盖；未刻意使线上模型调用失败。
- 验收产生的两次额度已恢复；数据库复查当前验收账号、IP 与全站测试计数均为 0。
- 因 Vercel Hobby 限制 12 个函数，四个只读行情函数合并到 `api/market-data/[marketRoute].js`；原 `/api/macro`、`/api/indexes`、`/api/sentiment`、`/api/daily-analysis` 地址通过重写保留。线上四个地址的 OPTIONS 均验证成功。
- 功能发布提交：`fc1be60`，Vercel READY，GitHub Pages 部署成功；本地全量 940 个测试、48 个同步测试、5 个行情入口测试、类型检查、函数冒烟检查和构建通过。

密钥只保存在服务端平台或 OAuth 配置中，本文不记录密钥值。
