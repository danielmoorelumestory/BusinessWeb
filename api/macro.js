// Vercel 函数：实时拉取中美宏观快照，供「宏观温度」页手动刷新（GitHub Pages 通过 VITE_API_BASE 调用）。
import { buildSnapshots } from '../server/macro.mjs'

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET, OPTIONS')
    return res.status(405).json({ error: '只支持 GET 请求' })
  }
  try {
    const result = await buildSnapshots()
    if (!Object.keys(result.us.series).length && !Object.keys(result.cn.series).length && !Object.keys(result.hk.series).length) {
      return res.status(502).json({ error: '数据源暂时不可用', warnings: result.warnings })
    }
    // 宏观数据一天最多变几次：CDN 缓存 10 分钟，避免频繁刷新打到数据源
    res.setHeader('Cache-Control', 's-maxage=600, stale-while-revalidate=3600')
    return res.status(200).json(result)
  } catch (error) {
    return res.status(502).json({ error: '数据源暂时不可用' })
  }
}
