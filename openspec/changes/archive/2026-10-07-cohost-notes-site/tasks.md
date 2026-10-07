## 1. 复制 notes 源码

- [x] 1.1 在 notes 仓库确认工作区干净、已全部提交（`git status`），记录当前提交号，作为复制来源写入迁移文档
- [x] 1.2 把 notes 的 `src/`、`public/`、`workers/`、`docs/`、`astro.config.mjs`、`package.json`、`package-lock.json`、`tsconfig.json`、`README.md`、`.gitignore` 复制到 `notes-site/`；不复制 `node_modules/`、`dist/`、`.astro/`、`.git/`、`.github/`、`openspec/`
- [x] 1.3 核对复制结果：`notes-site/` 内文件清单与来源一致（排除项除外），确认没有把缓存与构建产物带进来
- [x] 1.4 在 `notes-site/` 内执行 `npm ci`，确认依赖可安装，并确认本仓库根目录的 `.gitignore` 已覆盖 `notes-site/node_modules`、`notes-site/dist`、`notes-site/.astro`

## 2. 迁入 OpenSpec 规格

- [x] 2.1 把 notes 的 7 个主规格原样复制到根目录 `openspec/specs/`（`daily-bar-client`、`daily-bar-store`、`four-year-extremes`、`local-cache-eviction`、`minute-bar-health`、`minute-bar-sync`、`records-sync`），确认与现有的 `cloudflare-pages-hosting`、`workers-api-runtime` 不重名
- [x] 2.2 把 notes 的 4 个已归档变更原样复制到 `openspec/changes/archive/`，保留原有的日期前缀目录名
- [x] 2.3 运行 `openspec validate --specs`，确认迁入后的全部主规格通过校验

## 3. 构建集成

- [x] 3.1 修改 `notes-site/astro.config.mjs`：增加 Cloudflare Pages 分支（`CF_PAGES=1`），`base` 保持 `/note`，`site` 取自构建环境变量，不写死域名；非 Cloudflare 环境下行为与原来完全一致
- [x] 3.2 新增构建脚本（如 `scripts/build-cloudflare.mjs`）并在 `package.json` 增加 `build:cloudflare`：依次 `npm run build`、在 `notes-site` 内安装依赖并构建、把 `notes-site/dist/` 复制为 `dist/note/`；任一步失败立即以非零状态退出；复制前先清掉旧的 `dist/note/`
- [x] 3.3 为构建脚本写测试（node:test）：用小型假目录验证复制位置、已有 `dist/note/` 被替换、来源目录不存在时失败
- [x] 3.4 本地执行 `npm run build:cloudflare`，核对 `dist/note/` 结构（首页、`notes/`、`lab/grid-trading*`、`reports/`、`rss.xml`、`_astro/`）与文件数，并确认原有 `dist/` 的内容未受影响
- [x] 3.5 编写链接检查脚本（可并入测试）：遍历 `dist/note/` 下所有 HTML，检查以 `/note/` 开头的内部链接与资源引用都能在 `dist/note/` 中找到目标，运行并确认无断链
- [x] 3.6 确认 `.github/workflows/pages.yml` 与 `build:pages` 未被改动，GitHub Pages 构建线不受影响

## 4. 主站入口

- [x] 4.1 在 `src/components/Header` 增加指向 `/note/` 的入口，使用普通 `<a href>`，保持与现有导航的样式一致（桌面与移动菜单都要有）
- [x] 4.2 为该入口补充组件测试：链接目标为 `/note/`，且不是 React Router 的 `Link`
- [x] 4.3 运行 `npm test -- --run`、`npm run typecheck`、`npm run build`，确认主站不受影响

## 5. 本地用 Cloudflare 运行时冒烟

- [x] 5.1 用 `npx wrangler pages dev dist --compatibility-date=2026-10-07 --compatibility-flag=nodejs_compat` 提供 `build:cloudflare` 的产物，实测 `/note`、`/note/`、`/note/notes`、`/note/lab/grid-trading`、`/note/rss.xml`、`/note/reports/` 下的报告
- [x] 5.2 实测主站不受影响：`/grid-trading/records` 返回入口页，`/api/does-not-exist` 返回 404 JSON，`/no-such-page` 返回入口页
- [x] 5.3 记录 `/note`（无尾斜杠）的行为；若不符合预期，在构建脚本或链接上调整，并把结论写回 `design.md`

## 6. 迁移文档

- [x] 6.1 新增 `docs/notes-cohosting.md`：说明目录结构、构建流程、如何本地调试、`notes-site` 的来源提交号，以及 Worker 仍需手动部署（在 `notes-site/workers/grid-trading-sync` 下用 wrangler 部署）
- [x] 6.2 在 `docs/notes-cohosting.md` 写明"搬家前"操作清单：在旧站点（`danielmoorelumestory.github.io/note/`）打开"已保存标的"页并同步或导出；新站点填同样的同步密钥再同步；说明接入自有域名后需要再做一次
- [x] 6.3 更新 `docs/cloudflare-pages.md` 与 `README.md`：Cloudflare 构建命令改为 `npm run build:cloudflare`，并说明 `/note/` 来自 `notes-site/`

## 7. 上线与验证

- [x] 7.1 推送本身是惰性的（Cloudflare 构建命令未改之前不会产生 `/note/`，Vercel 与 GitHub Pages 构建线也不受影响），可以先推送；但在**开始使用新站点、或下线旧站点之前**，使用者必须先在旧站点同步或导出本地记录，并确认已完成（旧域名的 localStorage 不会消失，只是新域名下看不到）。使用者已确认：新站点同步下载的云端数据正确（云端记录完整可用）；旧浏览器里是否还有从未同步的本地记录未逐条核实，使用者在不再使用旧站点之前自行再同步一次即可
- [x] 7.2 使用者在 Cloudflare 后台把构建命令改为 `npm run build:cloudflare`，并确认 `NODE_VERSION=24` 仍设置；推送后等待部署完成
- [x] 7.3 线上验证 `/note/`、`/note/notes`、`/note/lab/grid-trading`、`/note/lab/grid-trading/saved`、`/note/lab/grid-trading/minute`、`/note/rss.xml`、`/note/reports/` 下的报告均可访问，且 RSS 与规范链接使用当前站点地址
- [x] 7.4 线上验证主站不受影响：路由刷新、未知 `/api/*` 返回 404、已迁移的 `/api/*` 接口输出不变
- [x] 7.5 使用者在 `/note/lab/grid-trading` 实测回测，并在新域名下填同步密钥同步，确认能从 D1 取回此前已同步的记录
- [x] 7.6 确认回退办法可用：把构建命令改回 `npm run build` 后，`/note/` 消失且主站正常（只在文档中确认，不实际回退线上）
