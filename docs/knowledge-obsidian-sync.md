# Obsidian 使用自己的服务器同步

首版支持桌面电脑和 Markdown 笔记。图片/PDF 原件、Obsidian 设置和插件目录不上传；已有附件仍需另外保留。

## 服务端启用

1. 先通过现有只读凭据导出生产 Markdown 和当前 head，校验数量与正文 SHA-256，保留独立备份。
2. 在同一个 Supabase 项目运行 `supabase/migrations/202610050002_knowledge_sync.sql`。原有知识表、网页只读和 MCP 均继续保留；新快照表记录历史版本。
3. 在现有 Vercel 项目增加 `KNOWLEDGE_SYNC_TOKEN`：随机生成至少 32 字符，必须不同于网页、AI 和旧上传凭据。不要使用 Supabase 管理密钥作为同步凭据。
4. 部署本次接口更新。原有客户端继续可用，新插件通过独立同步接口访问。

## 构建和安装

在 `obsidian-plugin/` 运行 `npm ci`、`npm run typecheck` 和 `npm run build`。
把 `main.js`、`manifest.json` 放入每台电脑的 `<资料库>/.obsidian/plugins/businessweb-knowledge-sync/`。
在 Obsidian 设置 → 第三方插件中启用“知识同步 · 自己的服务器”。若开启了受限模式，需要按 Obsidian 提示允许本地插件。

插件设置填写 `https://business-web-pi-eight.vercel.app/api/knowledge` 和专用同步凭据，点击“测试连接”。确认服务器版本后开启自动同步。
新仓库首次同步只下载；下一轮才上传本地变化。每 30 秒检查远端，笔记修改后 2 秒触发同步。

新电脑也安装同一插件、连接同一服务器。首次下载完成后，笔记和链接即可使用；离线时可继续编辑，联网后重新同步。

## 冲突、删除和恢复

两台设备修改不同笔记会合并；同一篇不同修改、删除与编辑冲突会暂停发布，并把双方版本保存到 `Sync-Conflicts/`。读完副本后在插件设置中选择“保留本地”或“采用服务器”。冲突副本不自动上传，处理结果在下一轮同步发布。

服务端删除同步到本地时进入 Obsidian 的本地 `.trash` 回收站；云端旧快照保留。出现同步错误时先保留 `sync-state.json`，不要删除它来强行重试：它保存同步基线和待恢复事务。

插件 `data.json` 包含同步凭据，`sync-state.json` 包含正文基线和事务；两者位于插件目录。不要提交 Git 或分享这些文件。切换到其他服务器应使用独立 Vault，避免把旧基线写进新库。

## 验证

`node scripts/run-vitest.mjs --run --config vitest.sync.config.ts` 验证协议、合并、下载、事务、文件保护和调度。
`node scripts/test-knowledge-sync-db.mjs` 使用独立 `businessweb-sync-test` PostgreSQL 容器，在每次运行新建的测试数据库中验证 SQL，不访问生产。

完整启用需要成功完成生产备份、迁移、部署和首次下载。仅安装插件不意味着线上同步已启用。

## 当前交付状态（2026-10-05）

代码已完成独立审查，审查指出的文件名碰撞、删除竞态、连接测试取消和旧接口改写空快照问题已修复。370 项原有前端/API 测试、48 项同步测试、21 项知识服务测试通过，真实临时 PostgreSQL 还验证了 227 篇分页与发布权限。插件类型检查、插件构建和原生 Node 接口加载通过。

2026-10-05 继续部署时已确认 Vercel 与 Supabase 后台登录。通过现有只读接口备份生产 revision 1 的 1,227 篇笔记，逐篇校验 SHA-256 后恢复到本机 SecondBrain；备份位于 `.local/knowledge-backups/2026-10-05/complete.json`。其中 1,220 篇在 `Notion/`，其余在 Inbox、Projects、Attachments 与 Templates。Vercel `business-web` 已增加 Secret 类型的 `KNOWLEDGE_SYNC_TOKEN`。插件仍未启用/连接，数据库迁移和新接口部署尚未完成，自动同步保持关闭。SQL 编辑器的焦点与输入不稳定，未执行未验证的迁移。

同步实现分支 `feat/knowledge-own-server-sync` 已合并到 `main`，保留了主分支已有的花园页面调整。插件压缩包位于工作区 `output/obsidian/businessweb-knowledge-sync-0.1.0.zip`。
