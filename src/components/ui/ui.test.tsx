import React from 'react'
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { fireEvent } from '@testing-library/react'
import { Badge, Callout, Card, Dialog, EmptyState, Field, Page, PageToolbar, Stat, StatGrid, TableWrap } from './index'

afterEach(cleanup)

describe('Page', () => {
  it('渲染唯一的 main#main-content，带 container page 类', () => {
    const { container } = render(<Page className="x-page">内容</Page>)
    const mains = container.querySelectorAll('main')
    expect(mains).toHaveLength(1)
    expect(mains[0].id).toBe('main-content')
    expect(mains[0].className).toBe('container page x-page')
  })
  it('reading 变体与视觉隐藏标题', () => {
    render(<Page variant="reading" title="公司详情">x</Page>)
    expect(screen.getByRole('main').className).toContain('page--reading')
    const h1 = screen.getByRole('heading', { level: 1, name: '公司详情' })
    expect(h1.className).toBe('visually-hidden')
  })
})

describe('PageToolbar', () => {
  it('左侧说明 + 右侧操作', () => {
    const { container } = render(<PageToolbar note="数据日期 2026-10-09"><button>刷新</button></PageToolbar>)
    expect(container.querySelector('.page-toolbar .page-toolbar__note')?.textContent).toBe('数据日期 2026-10-09')
    expect(screen.getByRole('button', { name: '刷新' })).toBeTruthy()
  })
})

describe('Card', () => {
  it('section + 标题时是带名字的 region，含操作与说明', () => {
    render(<Card as="section" title="资金三笔钱" description="说明" actions={<button>导出</button>}>正文</Card>)
    const region = screen.getByRole('region', { name: '资金三笔钱' })
    expect(region.className).toContain('ui-card')
    expect(region.textContent).toContain('说明')
    expect(screen.getByRole('button', { name: '导出' })).toBeTruthy()
  })
  it('label 覆盖区域名称', () => {
    render(<Card as="section" label="候选池" title="候选池 · 3 家">x</Card>)
    expect(screen.getByRole('region', { name: '候选池' })).toBeTruthy()
  })
  it('无标题时不渲染头部，flush 加修饰类', () => {
    const { container } = render(<Card flush>正文</Card>)
    expect(container.querySelector('.ui-card__head')).toBeNull()
    expect(container.firstElementChild?.className).toContain('ui-card--flush')
  })
})

describe('Callout', () => {
  it('role=note 与 tone 类，默认 info', () => {
    render(<><Callout>默认</Callout><Callout tone="warn" title="注意">内容</Callout></>)
    const notes = screen.getAllByRole('note')
    expect(notes[0].className).toContain('ui-callout--info')
    expect(notes[1].className).toContain('ui-callout--warn')
    expect(notes[1].textContent).toContain('注意')
  })
})

describe('Stat / StatGrid / Badge / EmptyState', () => {
  it('Stat 显示 label/value/sub', () => {
    const { container } = render(<StatGrid><Stat label="黄金" value="4144" sub="近 12 月 +4%" /></StatGrid>)
    expect(container.querySelector('.ui-stat-grid .ui-stat')).toBeTruthy()
    expect(container.querySelector('.ui-stat__label')?.textContent).toBe('黄金')
    expect(container.querySelector('.ui-stat__value')?.textContent).toBe('4144')
    expect(container.querySelector('.ui-stat__sub')?.textContent).toBe('近 12 月 +4%')
  })
  it('Badge tone 类，默认 neutral', () => {
    const { container } = render(<><Badge>a</Badge><Badge tone="up">b</Badge></>)
    const [a, b] = Array.from(container.querySelectorAll('.ui-badge'))
    expect(a.className).toContain('ui-badge--neutral')
    expect(b.className).toContain('ui-badge--up')
  })
  it('EmptyState 标题与操作', () => {
    render(<EmptyState title="暂无数据" action={<button>重试</button>}>稍后再来</EmptyState>)
    expect(screen.getByText('暂无数据')).toBeTruthy()
    expect(screen.getByRole('button', { name: '重试' })).toBeTruthy()
  })
})

describe('TableWrap', () => {
  it('可聚焦的滚动区域，带名字；stickyFirst 加修饰类', () => {
    render(<TableWrap label="公司列表" stickyFirst><table className="ui-table"><tbody><tr><td>x</td></tr></tbody></table></TableWrap>)
    const region = screen.getByRole('region', { name: '公司列表' })
    expect(region.getAttribute('tabindex')).toBe('0')
    expect(region.className).toContain('ui-table-wrap--sticky')
  })
})

describe('Dialog / Field', () => {
  it('打开时聚焦第一个控件并锁滚动；Esc 关闭后焦点归还', () => {
    const outside = document.createElement('button'); document.body.appendChild(outside); outside.focus()
    let open = true
    const close = () => { open = false }
    const { rerender } = render(<Dialog open={open} onClose={close} title="筛选" actions={<button>确定</button>}><Field label="日期"><input /></Field></Dialog>)
    const dialog = screen.getByRole('dialog', { name: '筛选' })
    expect(dialog.getAttribute('aria-modal')).toBe('true')
    expect(document.activeElement).toBe(screen.getByLabelText('日期'))
    expect(document.body.style.overflow).toBe('hidden')
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(open).toBe(false)
    rerender(<Dialog open={false} onClose={close} title="筛选"><input /></Dialog>)
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(document.body.style.overflow).toBe('')
    expect(document.activeElement).toBe(outside)
    outside.remove()
  })
  it('点遮罩关闭，点面板内部不关闭', () => {
    let closed = 0
    render(<Dialog open onClose={() => { closed++ }} title="设置"><p>内容</p></Dialog>)
    fireEvent.mouseDown(screen.getByText('内容'))
    expect(closed).toBe(0)
    fireEvent.mouseDown(document.querySelector('.ui-dialog-overlay') as Element)
    expect(closed).toBe(1)
  })
})

describe('Dialog 父组件重渲染', () => {
  it('onClose 每次都是新函数时，焦点不会被拉回第一个输入框', () => {
    function Host(): JSX.Element {
      const [a, setA] = React.useState('')
      const [b, setB] = React.useState('')
      return (
        <Dialog open onClose={() => {}} title="表单">
          <Field label="甲"><input value={a} onChange={e => setA(e.target.value)} /></Field>
          <Field label="乙"><input value={b} onChange={e => setB(e.target.value)} /></Field>
        </Dialog>
      )
    }
    render(<Host />)
    const second = screen.getByLabelText('乙')
    second.focus()
    fireEvent.change(second, { target: { value: 'x' } })
    expect(document.activeElement).toBe(second)
  })
})
