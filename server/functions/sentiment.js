// Vercel 函数：情绪工具读数（期权 P/C、VIX 期限结构、GEX、金银比），并行拉取，供「2026 投资计划 → 情绪工具」使用。
import { buildSentiment } from '../sentiment.mjs'

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET, OPTIONS')
    return res.status(405).json({ error: '只支持 GET 请求' })
  }
  try {
    const result = await buildSentiment()
    const values = [result.equityPC, result.spxPC, result.vix, result.vix3m, result.gexBn, result.goldSilver]
    if (values.every(v => v === null)) return res.status(502).json({ error: '数据源暂时不可用', warnings: result.warnings })
    // 这些读数一天变化有限：CDN 缓存 10 分钟，避免频繁刷新打到数据源
    res.setHeader('Cache-Control', 's-maxage=600, stale-while-revalidate=3600')
    return res.status(200).json(result)
  } catch {
    return res.status(502).json({ error: '数据源暂时不可用' })
  }
}
