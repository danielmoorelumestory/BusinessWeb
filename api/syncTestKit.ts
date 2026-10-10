// 同步接口测试共用：模拟 Vercel 风格的 req/res，并带上 D1 的 req.env。
export type Reply = { status: number; body: any; headers: Record<string, string> }

export const TOKEN = 'x'.repeat(40)

export async function call(
  handler: (req: any, res: any) => Promise<unknown>,
  req: { method: string; headers?: Record<string, string>; body?: unknown; env?: unknown },
): Promise<Reply> {
  const reply: Reply = { status: 200, body: undefined, headers: {} }
  const res = {
    setHeader(name: string, value: string) { reply.headers[name.toLowerCase()] = value },
    status(code: number) { reply.status = code; return res },
    json(body: unknown) { reply.body = body; return res },
  }
  await handler({ headers: {}, ...req }, res)
  return reply
}

export const auth = (extra: Record<string, string> = {}) => ({ authorization: `Bearer ${TOKEN}`, ...extra })
