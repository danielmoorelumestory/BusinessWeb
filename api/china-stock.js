// Vercel Serverless Function - 代理新浪财经 API
// 部署后访问地址：https://<你的站点>/api/china-stock?symbol=sh000001

export default async function handler(req, res) {
  // 设置 CORS 头
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  // 处理 OPTIONS 请求
  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET, OPTIONS')
    return res.status(405).json({ error: '只支持 GET 请求' })
  }

  const { symbol } = req.query

  if (typeof symbol !== 'string' || !/^(sh|sz)\d{6}$/.test(symbol)) {
    return res.status(400).json({ error: 'symbol 参数必须为 sh/sz 加六位代码' })
  }

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 7_000)
  try {
    // 请求新浪财经 API
    const response = await fetch(`https://hq.sinajs.cn/list=${symbol}`, {
      signal: controller.signal,
      redirect: 'error',
      headers: {
        'Referer': 'https://finance.sina.com.cn',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    })

    if (!response.ok) {
      return res.status(502).json({ error: '行情源暂时不可用' })
    }

    const text = new TextDecoder('gbk').decode(await response.arrayBuffer())
    
    // 返回原始数据，让前端解析
    res.setHeader('Content-Type', 'text/plain; charset=utf-8')
    res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=30')
    return res.status(200).send(text)
  } catch {
    return res.status(controller.signal.aborted ? 504 : 502).json({ error: '代理请求失败' })
  } finally {
    clearTimeout(timer)
  }
}
