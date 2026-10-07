import React from 'react'
import { Files, GitBranch, Database, Cloud, Network } from 'lucide-react'
export default function KnowledgeSetup(): JSX.Element {
  return <section className="kb-setup">
    <div className="kb-setup-intro"><span className="kb-eyebrow">YOUR FILES, YOUR KNOWLEDGE</span><h2>数据握在自己手里。</h2><p>笔记只在 Obsidian 里写和改；这个网页和 AI 读取同一份 Markdown，网页端只读，不会和 Obsidian 冲突。AI 可以更换，知识一直留下。</p><p className="kb-muted">Notion 里的旧资料已于 2026-10-05 一次性导入，之后以 Obsidian 为准，不再与 Notion 同步。</p></div>
    <div className="kb-layer-grid">
      {[{ icon: Files, title: 'Markdown + Obsidian', state: '唯一编辑入口', desc: '笔记保存在本地 Vault，在 Obsidian 里编辑；网页只负责阅读、搜索和蒲公英网络。' },
        { icon: GitBranch, title: 'Git 多设备同步', state: '已启用', desc: 'Vault 单独放在私有 GitHub 仓库，Obsidian Git 插件定时提交、拉取，多台电脑共用一份笔记。' },
        { icon: Network, title: 'Personal MCP', state: '本机可读写 · HTTP 只读', desc: '本地 Agent 通过 stdio 读写；HTTP 客户端使用凭据只读访问，可按目录限制资料范围。' },
        { icon: Database, title: 'Supabase / pgvector', state: '云端只读副本', desc: '供线上网页和远程 AI 读取；由本地上传快照生成，不在云端修改。语义索引后续加入。' },
        { icon: Cloud, title: 'Cloudflare R2', state: '后续接入', desc: '附件增加以后，再扩展云存储与恢复。' }].map(item => <article key={item.title} className="kb-layer"><item.icon size={20} /><span className="kb-layer-state">{item.state}</span><h3>{item.title}</h3><p>{item.desc}</p></article>)}
    </div>
    <div className="kb-setup-guide"><h3>给第三方 AI 使用资料库</h3><p>支持 MCP 的 Codex、Claude 和自建 Agent 可搜索、读取并查找关联笔记，返回真实 Markdown 来源。</p><p>本机 stdio：<code>npm run knowledge:mcp</code>；只读 HTTP：设置至少 32 字符的 <code>KNOWLEDGE_MCP_TOKEN</code> 后运行 <code>npm run knowledge:mcp:http</code>，地址为 <code>http://127.0.0.1:8790/mcp</code>。</p><p>HTTP 请求需要 <code>Authorization: Bearer 凭据</code>。可通过 <code>KNOWLEDGE_MCP_SCOPE</code> 指定允许目录，以分号分隔。凭据放在客户端配置中。</p><p>远程只读 MCP 地址：https://business-web-pi-eight.vercel.app/api/knowledge?action=mcp。使用独立 AI 只读凭据发送 Authorization: Bearer 凭据。要求 OAuth 的客户端还需适配，当前不能直接作为 ChatGPT OAuth 连接器使用。</p></div>
    <div className="kb-setup-guide"><h3>开始使用</h3><ol><li>在 BusinessWeb 目录运行 <code>npm run knowledge:app</code>。</li><li>默认 Vault 在 <code>BusinessWeb/.local/SecondBrain</code>，将它作为 Obsidian Vault 打开。</li><li>使用现有 Vault：<code>KNOWLEDGE_VAULT='/绝对路径/SecondBrain' npm run knowledge:app</code>。</li><li>本地 Agent 的 MCP 命令为 <code>node /绝对路径/BusinessWeb/server/knowledge/mcp.mjs</code>，配置相同的 <code>KNOWLEDGE_VAULT</code>。</li><li>其他电脑：克隆私有仓库 <code>TurboSnails/SecondBrain</code> 后用 Obsidian 打开，并安装 Obsidian Git 插件，步骤见 Vault 根目录的 <code>README-新电脑接入.md</code>。</li></ol><p>完整步骤见项目文档 <code>docs/knowledge-local-setup.md</code>。更新云端只读副本：在 Obsidian 修改并推送后，运行 <code>npm run knowledge:cloud -- --prepare</code> 生成本地快照，再按 <code>docs/knowledge-cloud-setup.md</code> 上传。</p></div>
  </section>
}
