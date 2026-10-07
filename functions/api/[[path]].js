// Cloudflare Pages Function：兜底处理所有 /api/*。
// Pages 默认会对找不到的路径返回 index.html，这里改为明确的 404 JSON，避免接口错误被页面 HTML 掩盖。
// 第 2 步迁移接口时，在 functions/api/ 下新增具体文件即可优先匹配，不会被这里拦截。
export function onRequest() {
  return new Response(JSON.stringify({ error: '接口不存在' }), {
    status: 404,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
  })
}
