// Vercel 函数：实时拉取指数价格与成分股 PE，供「宏观温度 → 估值位置」手动刷新（GitHub Pages 通过 VITE_API_BASE 调用）。
import { buildIndexSnapshot } from '../server/indexes.mjs'

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET, OPTIONS')
    return res.status(405).json({ error: '只支持 GET 请求' })
  }
  try {
    const { snapshot, warnings } = await buildIndexSnapshot()
    if (!Object.keys(snapshot.indexes).length) return res.status(502).json({ error: '数据源暂时不可用', warnings })
    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=1800')
    return res.status(200).json({ ...snapshot, fetchedAt: new Date().toISOString(), warnings })
  } catch (error) {
    return res.status(502).json({ error: '数据源暂时不可用' })
  }
}
