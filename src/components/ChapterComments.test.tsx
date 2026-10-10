import React from 'react'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import ChapterComments from './ChapterComments'

afterEach(() => {
  cleanup()
  sessionStorage.clear()
  vi.unstubAllGlobals()
})

const json = (status: number, body: unknown) => ({ ok: status < 400, status, json: async () => body })

describe('ChapterComments', () => {
  it('显示已审核评论，并按章节请求', async () => {
    const fetchMock = vi.fn(async () => json(200, { comments: [{ id: '1', nickname: '小王', content: '<b>写得好</b>', created_at: '2026-10-09T00:00:00Z' }] }))
    vi.stubGlobal('fetch', fetchMock)
    render(<ChapterComments slug="开篇.md" />)
    await waitFor(() => expect(screen.getByText('<b>写得好</b>')).toBeTruthy())
    expect(fetchMock.mock.calls[0][0]).toBe(`/api/comments?slug=${encodeURIComponent('开篇.md')}`)
    expect(fetchMock.mock.calls[0][1]).toBeUndefined()
  })

  it('接口未配置（503）时整块不显示', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => json(503, { error: '评论服务尚未配置' })))
    const { container } = render(<ChapterComments slug="开篇.md" />)
    await waitFor(() => expect(container.querySelector('.book-comments')).toBeNull())
  })

  it('提交评论后提示审核，并清空输入', async () => {
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) =>
      init?.method === 'POST' ? json(201, { ok: true, message: '已提交，审核通过后显示' }) : json(200, { comments: [] }))
    vi.stubGlobal('fetch', fetchMock)
    render(<ChapterComments slug="开篇.md" />)
    const box = (await screen.findByLabelText('评论内容')) as HTMLTextAreaElement
    fireEvent.change(box, { target: { value: '很有启发' } })
    fireEvent.click(screen.getByRole('button', { name: '提交评论' }))
    await waitFor(() => expect(screen.getByRole('status').textContent).toContain('审核通过后显示'))
    expect(box.value).toBe('')
    const post = fetchMock.mock.calls.find(c => c[1]?.method === 'POST')
    expect(JSON.parse(String(post?.[1]?.body))).toMatchObject({ slug: '开篇.md', content: '很有启发', website: '' })
  })

  it('提交失败时显示接口返回的错误', async () => {
    vi.stubGlobal('fetch', vi.fn(async (_url: string, init?: RequestInit) =>
      init?.method === 'POST' ? json(429, { error: '提交太频繁，请一小时后再试' }) : json(200, { comments: [] })))
    render(<ChapterComments slug="开篇.md" />)
    fireEvent.change(await screen.findByLabelText('评论内容'), { target: { value: '再来一条' } })
    fireEvent.click(screen.getByRole('button', { name: '提交评论' }))
    await waitFor(() => expect(screen.getByRole('status').textContent).toContain('提交太频繁'))
  })

  it('管理员：输入 token 后看到待审核评论，可通过和删除', async () => {
    sessionStorage.clear()
    let list = [{ id: '1', nickname: '甲', content: '待审评论', status: 'pending', created_at: '2026-10-09T00:00:00Z' }]
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (init?.method === 'PATCH') { list = list.map(c => ({ ...c, status: 'approved' })); return json(200, { ok: true }) }
      if (init?.method === 'DELETE') { list = []; return json(200, { ok: true }) }
      return json(200, { comments: list })
    })
    vi.stubGlobal('fetch', fetchMock)
    render(<ChapterComments slug="开篇.md" />)
    expect(screen.queryByText('待审评论')).toBeNull()
    fireEvent.click(await screen.findByRole('button', { name: '管理' }))
    fireEvent.change(screen.getByLabelText('管理员 token'), { target: { value: 'secret-token' } })
    fireEvent.click(screen.getByRole('button', { name: '进入' }))
    await waitFor(() => expect(screen.getByText('待审评论')).toBeTruthy())
    const adminGet = fetchMock.mock.calls.find(c => (c[1]?.headers as Record<string, string> | undefined)?.authorization === 'Bearer secret-token')
    expect(adminGet).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: '通过' }))
    await waitFor(() => expect(screen.getByText(/已显示/)).toBeTruthy())
    const patch = fetchMock.mock.calls.find(c => c[1]?.method === 'PATCH')
    expect(JSON.parse(String(patch?.[1]?.body))).toEqual({ id: '1', status: 'approved' })

    fireEvent.click(screen.getByRole('button', { name: '删除' }))
    await waitFor(() => expect(screen.queryByText('待审评论')).toBeNull())
    expect(fetchMock.mock.calls.some(c => c[1]?.method === 'DELETE' && String(c[0]).includes('id=1'))).toBe(true)
  })

  it('管理员 token 无效时退出管理状态', async () => {
    sessionStorage.setItem('comments-admin-token', 'bad')
    vi.stubGlobal('fetch', vi.fn(async () => json(401, { error: '管理员 token 无效' })))
    render(<ChapterComments slug="开篇.md" />)
    await waitFor(() => expect(screen.getByRole('status').textContent).toContain('token 无效'))
    expect(sessionStorage.getItem('comments-admin-token')).toBeNull()
    expect(screen.getByRole('button', { name: '管理' })).toBeTruthy()
  })
})
