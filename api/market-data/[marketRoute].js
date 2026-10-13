// 四个只读数据接口共用一个函数部署，保留原有公开 URL。
import macro from '../../server/functions/macro.js'
import indexes from '../../server/functions/indexes.js'
import sentiment from '../../server/functions/sentiment.js'
import dailyAnalysis from '../../server/functions/daily-analysis.js'

const handlers = new Map([
  ['macro', macro], ['indexes', indexes],
  ['sentiment', sentiment], ['daily-analysis', dailyAnalysis],
])

export default function handler(req, res) {
  const route = req.query?.marketRoute
  const selected = typeof route === 'string' ? handlers.get(route) : undefined
  if (!selected) return res.status(404).json({ error: '接口不存在' })
  return selected(req, res)
}
