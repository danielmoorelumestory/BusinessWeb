import React from 'react'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

async function mountLoggedIn() {
  vi.stubEnv('VITE_SUPABASE_URL', 'https://example.supabase.co')
  vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'anon')
  sessionStorage.setItem('askLab.accessToken', 'token')
  vi.resetModules()
  const { default: AskLab } = await import('./AskLab')
  render(<AskLab />)
}

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })
const quota = (remaining: number) => json({ limit: 2, remaining })

// 按服务端 NDJSON 协议构造流；push 一行即推送一个事件。
function ndjsonStream() {
  let controller!: ReadableStreamDefaultController<Uint8Array>
  const body = new ReadableStream<Uint8Array>({ start: c => { controller = c } })
  const encoder = new TextEncoder()
  return {
    response: new Response(body, { headers: { 'content-type': 'application/x-ndjson; charset=utf-8' } }),
    push: (event: unknown) => controller.enqueue(encoder.encode(JSON.stringify(event) + '\n')),
    close: () => controller.close(),
  }
}

beforeEach(() => sessionStorage.clear())
afterEach(() => { cleanup(); vi.unstubAllEnvs(); vi.unstubAllGlobals() })

describe('试问 AI', () => {
  it('显示服务端返回的今日剩余次数与字数；不足 2 个字不能提交', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => quota(1)))
    await mountLoggedIn()
    expect(await screen.findByText('今日剩余 1 / 2')).toBeTruthy()
    const input = screen.getByLabelText('你的问题')
    expect(screen.getByText('0 / 500')).toBeTruthy()
    expect((screen.getByRole('button', { name: '提问' }) as HTMLButtonElement).disabled).toBe(true)
    fireEvent.change(input, { target: { value: '怎么估值' } })
    expect(screen.getByText('4 / 500')).toBeTruthy()
    expect((screen.getByRole('button', { name: '提问' }) as HTMLButtonElement).disabled).toBe(false)
    expect(screen.getByRole('button', { name: '退出登录' })).toBeTruthy()
  })

  it('次数用完时按钮变为“明天再来”且不可提交', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => quota(0)))
    await mountLoggedIn()
    const button = await screen.findByRole('button', { name: '明天再来' })
    fireEvent.change(screen.getByLabelText('你的问题'), { target: { value: '怎么估值' } })
    expect((button as HTMLButtonElement).disabled).toBe(true)
  })

  it('流式回答：阶段进度持续更新，逐段显示回答，结束后刷新剩余次数', async () => {
    const stream = ndjsonStream()
    vi.stubGlobal('fetch', vi.fn(async (_url: string, init?: RequestInit) => (init?.method === 'POST' ? stream.response : quota(2))))
    await mountLoggedIn()
    expect(await screen.findByText('今日剩余 2 / 2')).toBeTruthy()
    const input = screen.getByLabelText('你的问题')
    fireEvent.change(input, { target: { value: '怎么估值' } })
    fireEvent.keyDown(input, { key: 'Enter', metaKey: true })
    expect(await screen.findByLabelText('正在思考…')).toBeTruthy()
    stream.push({ type: 'phase', phase: 'thinking' })
    expect((await screen.findByText('思考中')).className).toBe('is-active')
    stream.push({ type: 'delta', text: '先拆' })
    expect(await screen.findByText('先拆')).toBeTruthy()
    stream.push({ type: 'delta', text: '驱动因素。' })
    expect(await screen.findByText('先拆驱动因素。')).toBeTruthy()
    stream.push({ type: 'done', remaining: 1 })
    stream.close()
    expect(await screen.findByText('仅供参考，不构成投资建议。')).toBeTruthy()
    expect(screen.getByText('今日剩余 1 / 2')).toBeTruthy()
  })

  it('流中途出错时用提示框显示错误', async () => {
    const stream = ndjsonStream()
    vi.stubGlobal('fetch', vi.fn(async (_url: string, init?: RequestInit) => (init?.method === 'POST' ? stream.response : quota(2))))
    await mountLoggedIn()
    fireEvent.change(screen.getByLabelText('你的问题'), { target: { value: '怎么估值' } })
    fireEvent.click(await screen.findByRole('button', { name: '提问' }))
    stream.push({ type: 'error', error: 'AI 回答中断，这次不扣次数' })
    stream.close()
    expect((await screen.findByRole('alert')).textContent).toBe('AI 回答中断，这次不扣次数')
  })

  it('次数用完的 429 显示错误，并把剩余次数置 0', async () => {
    vi.stubGlobal('fetch', vi.fn(async (_url: string, init?: RequestInit) => (init?.method === 'POST' ? json({ error: '今天的 2 次试问已用完，明天再来', remaining: 0 }, 429) : quota(1))))
    await mountLoggedIn()
    fireEvent.change(screen.getByLabelText('你的问题'), { target: { value: '怎么估值' } })
    fireEvent.click(await screen.findByRole('button', { name: '提问' }))
    const alert = await screen.findByRole('alert')
    expect(alert.textContent).toBe('今天的 2 次试问已用完，明天再来')
    expect(alert.className).toContain('ui-callout--warn')
    expect(screen.getByText('今日剩余 0 / 2')).toBeTruthy()
  })
})
