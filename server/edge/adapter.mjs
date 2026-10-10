// 把 Vercel 风格的 handler(req, res) 适配为 Cloudflare Pages Functions 的 onRequest(context)，
// 让 api/* 的处理函数不用改写即可在 Workers 运行时里使用。
// 只实现现有接口用到的 req/res 能力：method、query、headers、body、setHeader、status、json、send、end。

const JSON_TYPE = 'application/json; charset=utf-8'

// Workers 在较新的兼容日期下会自动填充 process.env；这里再兜底一次，避免因兼容日期较旧而读不到密钥。
export function populateProcessEnv(env) {
  if (typeof process === 'undefined' || !process.env || !env) return
  for (const [key, value] of Object.entries(env)) {
    if (typeof value === 'string' && process.env[key] === undefined) process.env[key] = value
  }
}

// Workers 的 fetch 不支持 redirect: 'error'（会直接抛错），而现有接口依赖它来避免把凭据转发到其他域名。
// 在 Workers 里改用 'manual'，遇到 3xx 响应就抛错，语义与 'error' 一致：从不跟随重定向，也不会转发凭据。
const wrapped = Symbol.for('businessweb.edge.fetchRedirectCompat')

export function wrapFetch(fetchImpl) {
  if (fetchImpl[wrapped]) return fetchImpl
  const compat = async (input, init) => {
    if (init?.redirect !== 'error') return fetchImpl(input, init)
    const response = await fetchImpl(input, { ...init, redirect: 'manual' })
    if (response.status >= 300 && response.status < 400) throw new TypeError('fetch failed: unexpected redirect')
    return response
  }
  compat[wrapped] = true
  return compat
}

const inWorkers = () => typeof navigator !== 'undefined' && navigator.userAgent === 'Cloudflare-Workers'

export function installFetchCompat() {
  if (inWorkers()) globalThis.fetch = wrapFetch(globalThis.fetch)
}

function queryOf(url) {
  const query = {}
  for (const [key, value] of url.searchParams) {
    if (!(key in query)) query[key] = value
    else query[key] = Array.isArray(query[key]) ? [...query[key], value] : [query[key], value]
  }
  return query
}

// 与 Vercel 一致：JSON 请求体解析成对象；解析失败时保留原始字符串，由处理函数自行返回 400。
async function bodyOf(request) {
  if (request.method === 'GET' || request.method === 'HEAD') return undefined
  const text = await request.text()
  if (!text) return undefined
  if (!(request.headers.get('content-type') || '').includes('application/json')) return text
  try { return JSON.parse(text) } catch { return text }
}

// 客户端 IP：Vercel 的 x-real-ip / x-forwarded-for 由平台设置，客户端无法改写；
// 在 Cloudflare 上这两个头可以由客户端随便发送，限流之类依赖 IP 的逻辑会被伪造绕过。
// 因此统一用 Cloudflare 可信的 cf-connecting-ip 覆盖它们（拿不到时用 'unknown'，绝不信任客户端自己发来的值）。
export function trustedClientHeaders(headers) {
  const trusted = headers['cf-connecting-ip']
  if (trusted === undefined && !inWorkers()) return headers // 非 Workers 环境（本地单测）保持原样
  const ip = trusted || 'unknown'
  return { ...headers, 'x-real-ip': ip, 'x-forwarded-for': ip }
}

export async function toNodeRequest(request) {
  const url = new URL(request.url)
  // 保留一份未被读取的标准请求，供需要 Web 标准 API 的处理函数使用
  const webRequest = request.method === 'GET' || request.method === 'HEAD' ? request : request.clone()
  return {
    method: request.method,
    url: url.pathname + url.search,
    headers: trustedClientHeaders(Object.fromEntries(request.headers)),
    query: queryOf(url),
    body: await bodyOf(request),
    webRequest,
  }
}

export function createResponseCollector() {
  const headers = new Headers()
  const state = { statusCode: 200, body: null, ended: false, webResponse: null }
  const res = {
    get statusCode() { return state.statusCode },
    get ended() { return state.ended },
    setHeader(name, value) { headers.set(name, Array.isArray(value) ? value.join(', ') : String(value)); return res },
    getHeader(name) { return headers.get(name) ?? undefined },
    status(code) { state.statusCode = code; return res },
    json(payload) {
      if (!headers.has('content-type')) headers.set('content-type', JSON_TYPE)
      return res.end(JSON.stringify(payload))
    },
    send(payload) {
      if (payload !== null && typeof payload === 'object' && !(payload instanceof Uint8Array)) return res.json(payload)
      return res.end(payload)
    },
    end(payload) {
      state.body = payload ?? null
      state.ended = true
      return res
    },
    // 处理函数已经生成了完整的标准 Response，直接采用
    sendWebResponse(response) {
      state.webResponse = response
      state.ended = true
      return res
    },
    toResponse(method) {
      if (state.webResponse) return state.webResponse
      const noBody = method === 'HEAD' || [101, 204, 205, 304].includes(state.statusCode)
      return new Response(noBody ? null : state.body, { status: state.statusCode, headers })
    },
  }
  return res
}

const failure = status => new Response(JSON.stringify({ error: '服务内部错误' }), {
  status,
  headers: { 'content-type': JSON_TYPE, 'cache-control': 'no-store' },
})

// 与 vercel.json 里 /api/* 的 X-Robots-Tag 一致。Pages 的 _headers 只作用于静态文件，不作用于函数响应，所以在这里加。
const withRobotsTag = response => {
  const out = new Response(response.body, response)
  if (!out.headers.has('x-robots-tag')) out.headers.set('x-robots-tag', 'noindex, nofollow')
  return out
}

export function toPagesFunction(handler) {
  return async ({ request, env }) => {
    populateProcessEnv(env)
    installFetchCompat()
    const res = createResponseCollector()
    try {
      await handler(await toNodeRequest(request), res)
    } catch {
      // 不向客户端暴露内部错误细节
      return withRobotsTag(failure(500))
    }
    // 处理函数没有结束响应（Vercel 上会一直挂起），这里明确返回 500，避免静默的空响应
    return withRobotsTag(res.ended ? res.toResponse(request.method) : failure(500))
  }
}
