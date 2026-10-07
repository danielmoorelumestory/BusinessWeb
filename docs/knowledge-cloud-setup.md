# 私人云端资料库

本地 `.local/SecondBrain` 是原始数据；Supabase 的正文、元数据和链接都是可重建副本。图片/PDF 暂不上传，附件引用在 Obsidian 查看。

## 服务配置

1. 在既有 Supabase `BusinessWeb` 项目运行 `supabase/migrations/202610050001_knowledge.sql`。迁移不修改交易数据；新表启用 RLS，禁止 anon/authenticated，只有服务端可访问。
2. Vercel `business-web` 复用已有 `SUPABASE_URL`、`SUPABASE_SECRET_KEY`，增加三个互不相同、至少 32 字符的 Production 环境变量：
   - `KNOWLEDGE_READ_TOKEN`：网页主人访问码。
   - `KNOWLEDGE_MCP_TOKEN`：第三方 AI 只读凭据。持有者可以读取同步范围的全部笔记，不要提供上传凭据。
   - `KNOWLEDGE_UPLOAD_TOKEN`：本机同步凭据。
3. 环境变量变更后重新部署。不得使用 `VITE_` 前缀保存服务端凭据。

## 本地同步

`npm run knowledge:cloud -- --prepare` 只生成 `.local/knowledge-cloud/snapshot.json` 与数量汇总，不联网。

在已忽略的 `.local/knowledge-cloud/config.json` 写入：

```json
{ "endpoint": "https://business-web-pi-eight.vercel.app/api/knowledge", "uploadToken": "你的独立上传凭据" }
```

`npm run knowledge:cloud -- --upload` 重新读取本地文件，批量上传后以乐观版本发布。所有批次完整且图节点匹配才切换 head；失败保持旧版。同步脚本不自动重试冲突。原始 Markdown 不进入 Git。

网页 `/knowledge` 输入主人访问码即可搜索、读取、浏览真实蒲公英。访问码仅保留在本会话，点击“锁定资料库”清除。首版云端只读，本地修改后再次同步。

## 第三方 AI

Streamable HTTP MCP endpoint：

```text
https://business-web-pi-eight.vercel.app/api/knowledge?action=mcp
Authorization: Bearer <KNOWLEDGE_MCP_TOKEN>
```

使用支持自定义 Bearer header 的 MCP 客户端。提供 `list_notes`、`search_knowledge`、`read_note`、`find_related_notes`、`search_investment`，不提供写入。无状态 POST、JSON 响应，不使用持久 session id。要求 OAuth 的连接器暂不兼容，包括需要 OAuth 的 ChatGPT 连接流程。

第一版 AI 凭据读取同步范围内全部笔记；如需不同 Agent 的细粒度权限，先按用途拆分导出范围再扩展服务端授权。不要把凭据放在聊天、URL 或公开仓库。

## 容量与版本

列表显式按 500 条读取，避免 Supabase 默认返回上限截断。请求/普通响应限制 3 MB，正文单篇 1 MiB，最多 10,000 篇的首版目录；超过限制需进一步分页。现有批次由本地脚本按实际字节拆分。旧 generation 保留用于恢复，长期频繁同步需增加保留策略，避免持续占用数据库空间。
