import { handleSync } from '../server/knowledge/cloud-sync.js'
import { authenticated, cloudDatabase, cloudVault, CloudError, object, readHead, uuid, validPath } from '../server/knowledge/cloud.js'
export type Request = { method?: string; headers: Record<string, string | string[] | undefined>; query?: Record<string, string | string[] | undefined>; body?: unknown }
export type Response = { setHeader(k: string, v: string): unknown; status(n: number): Response; json(b: unknown): unknown }
export default async function handler(req: Request, res: Response): Promise<unknown> {
  res.setHeader('Cache-Control', 'private, no-store')
  res.setHeader('Vary', 'Origin')
  const origin = req.headers.origin
  const allowed = ['https://business-web-black.vercel.app', 'https://turbosnails.github.io', 'https://businessweb-c0u.pages.dev']
  if (typeof origin === 'string' && allowed.includes(origin)) { res.setHeader('Access-Control-Allow-Origin', origin); res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type'); res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS') }
  if (req.method === 'OPTIONS') return res.status(typeof origin === 'string' && allowed.includes(origin) ? 200 : 403).json({})
  if (origin && (typeof origin !== 'string' || !allowed.includes(origin))) return res.status(403).json({ error: '访问来源不允许' })
  const action = req.query?.action || 'status'
  try {
    const db = cloudDatabase()
    const tokens = [process.env.KNOWLEDGE_READ_TOKEN, process.env.KNOWLEDGE_MCP_TOKEN, process.env.KNOWLEDGE_UPLOAD_TOKEN]
    if (tokens.some(t => !t || t.length < 32) || new Set(tokens).size !== 3) throw new CloudError(503, '私人资料库访问凭据尚未配置')
    if (typeof action === 'string' && action.startsWith('sync-') && action !== 'sync-status') return await handleSync(req,res,db,tokens)
    const writing = action === 'batch' || action === 'commit' || action === 'sync-status'
    const valid = writing ? authenticated(req.headers.authorization, tokens[2]) : tokens.slice(0, 2).some(t => authenticated(req.headers.authorization, t))
    if (!valid) throw new CloudError(401, '请输入有效的资料库访问码')
    if (action === 'mcp') {
      if (req.method !== 'POST') throw new CloudError(405, 'MCP 使用 POST 请求')
      if (Buffer.byteLength(typeof req.body === 'string' ? req.body : JSON.stringify(req.body) || '') > 65_536) throw new CloudError(413, 'MCP 请求超过 64 KB')
      const { handleCloudMcp } = await import('../server/knowledge/cloud-mcp.js')
      return await handleCloudMcp(req, res, cloudVault(db, await readHead(db)))
    }
    if (writing && action !== 'sync-status') {
      if (req.method !== 'POST') throw new CloudError(405, '同步使用 POST 请求')
      let body = req.body
      if (Buffer.byteLength(typeof body === 'string' ? body : JSON.stringify(body) || '') > 3_000_000) throw new CloudError(413, '同步批次超过 3 MB')
      if (typeof body === 'string') { try { body = JSON.parse(body) } catch { throw new CloudError(400, '无效 JSON') } }
      if (!object(body) || !uuid(body.generation)) throw new CloudError(400, '同步版本无效')
      if (action === 'batch') {
        if (!Array.isArray(body.notes) || !body.notes.length || body.notes.length > 100 || !body.notes.every(n => object(n) && object(n.note) && validPath(n.note.path) && typeof n.note.title === 'string' && typeof n.note.content === 'string' && Buffer.byteLength(n.note.content) <= 1024 * 1024 && typeof n.note.version === 'string' && /^[a-f0-9]{64}$/.test(n.note.version) && typeof n.note.vaultId === 'string' && /^[a-f0-9]{64}$/.test(n.note.vaultId) && object(n.relations))) throw new CloudError(400, '同步笔记格式无效')
        // RPC refuses inserts into an already-published generation.
        await db('rpc/businessweb_upload_knowledge_batch', 'POST', { next_generation: body.generation, notes: body.notes })
        return res.status(200).json({ ok: true, count: body.notes.length })
      }
      if (!Number.isSafeInteger(body.expectedRevision) || Number(body.expectedRevision) < 0 || !object(body.graph) || !Array.isArray(body.graph.nodes) || !Array.isArray(body.graph.edges) || typeof body.vaultId !== 'string' || !/^[a-f0-9]{64}$/.test(body.vaultId) || body.graph.vaultId !== body.vaultId) throw new CloudError(400, '发布快照格式无效')
      const ok = await db('rpc/businessweb_publish_knowledge', 'POST', { expected_revision: body.expectedRevision, next_generation: body.generation, next_vault_id: body.vaultId, next_graph: body.graph })
      if (ok !== true) throw new CloudError(409, '同步版本冲突或上传未完成，旧版仍然可用')
      return res.status(200).json({ ok: true })
    }
    if (req.method !== 'GET') throw new CloudError(405, '只读资料库使用 GET 请求')
    const head = await readHead(db)
    if (action === 'sync-status') return res.status(200).json({ revision: head.revision, generation: head.generation })
    const vault = cloudVault(db, head)
    const path = req.query?.path, query = req.query?.q
    let result: unknown
    switch (action) {
      case 'status': result = await vault.status(); break
      case 'notes': result = await vault.list(); break
      case 'graph': result = await vault.graph(); break
      case 'search': if (typeof query !== 'string') throw new CloudError(400, '缺少搜索词'); result = await vault.search(query); break
      case 'note': if (typeof path !== 'string') throw new CloudError(400, '缺少笔记路径'); result = await vault.read(path); break
      case 'related': if (typeof path !== 'string') throw new CloudError(400, '缺少笔记路径'); result = await vault.related(path); break
      default: throw new CloudError(404, '资料库接口不存在')
    }
    if (Buffer.byteLength(JSON.stringify(result)) > 3_000_000) throw new CloudError(413, '资料响应过大，需要分页')
    return res.status(200).json(result)
  } catch (e) { return res.status(e instanceof CloudError ? e.status : 500).json({ error: e instanceof CloudError ? e.message : '资料库请求失败' }) }
}
