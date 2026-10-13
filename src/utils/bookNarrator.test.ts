import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AudioChapter, AudioState, BookNarrator, idleAudioState } from './bookNarrator'
import { bookSections, speechChunks } from './bookSpeech'

function harness(loadMarkdown: (chapter: AudioChapter, signal: AbortSignal) => Promise<string> = async () => '# 下一篇\n\n下一篇的正文。') {
  const load = vi.fn(loadMarkdown)
  const utterances: SpeechSynthesisUtterance[] = []
  const synth = { cancel: vi.fn(), resume: vi.fn(), speak: vi.fn(), paused: false } as unknown as SpeechSynthesis
  let state: AudioState = idleAudioState
  const narrator = new BookNarrator(synth, text => {
    const utterance = { text, onend: null, onerror: null, onstart: null } as unknown as SpeechSynthesisUtterance
    utterances.push(utterance)
    return utterance
  }, load, next => { state = next })
  const end = async () => {
    const current = utterances[utterances.length - 1]
    current.onend?.call(current, {} as SpeechSynthesisEvent)
    await vi.runOnlyPendingTimersAsync()
  }
  return { narrator, synth, load, utterances, end, state: () => state }
}
const chapter = { file: '第一章.md', title: '第一章' }
const nextChapter = { file: '第二章.md', title: '第二章' }

beforeEach(() => vi.useFakeTimers())
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks() })

describe('书稿朗读文本', () => {
  it('小节不包含下一节；表格读出列名，保留财务数字并去掉网址和排版符号', () => {
    const markdown = '# 书名\n\n## 估值\n**毛利率**为 12.5%，变化 -3.2%。[原始资料](https://example.com)\n| 年份 | 增速 |\n| --- | ---: |\n| 2025 | -4.5% |\n\n## 决策\n这是下一节。'
    const sections = bookSections(markdown)
    expect(sections.map(section => section.title)).toEqual(['估值', '决策'])
    const text = speechChunks(sections[0].markdown).join('')
    expect(text).toContain('毛利率为 12.5%，变化 -3.2%')
    expect(text).toContain('年份：2025；增速：-4.5%')
    expect(text).not.toMatch(/https|\*\*|\||这是下一节/)
    expect(speechChunks('`2 * 3 = 6`。').join('')).toBe('2 乘以 3 = 6。')
  })

  it('长段落拆成有界短段，既不遗漏也不重复正文', () => {
    const text = '这是一次长期投资练习，'.repeat(45) + '请回到生活。'
    const chunks = speechChunks(text)
    expect(chunks.length).toBeGreaterThan(2)
    expect(chunks.every(chunk => chunk.length <= 150)).toBe(true)
    expect(chunks.join('')).toBe(text)
  })
})

describe('听书播放会话', () => {
  it('本节只读指定小节，结束后不会读下一节', async () => {
    const h = harness()
    h.narrator.start({ chapters: [chapter], mode: 'section', sectionIndex: 1, markdown: '# 书\n\n## 前节\n不要播放。\n\n## 当前节\n要播放。\n\n## 后节\n也不要播放。' })
    expect(h.utterances[0].text).toBe('当前节。要播放。')
    await h.end()
    expect(h.state().status).toBe('finished')
    expect(h.load).not.toHaveBeenCalled()
  })

  it('全书按顺序自动接下一篇，末篇结束，支持从中间开始', async () => {
    const h = harness()
    h.narrator.start({ chapters: [chapter, nextChapter], mode: 'book', markdown: '第一篇正文。' })
    await h.end()
    expect(h.load).toHaveBeenCalledWith(nextChapter, expect.any(AbortSignal))
    expect(h.state().chapterIndex).toBe(1)
    await h.end()
    expect(h.state().status).toBe('finished')
    const spoken = h.utterances.length
    h.narrator.start({ chapters: [chapter, nextChapter], mode: 'book', startIndex: 1, markdown: '从第二篇开始。' })
    expect(h.state().chapterIndex).toBe(1)
    expect(h.utterances[spoken].text).toBe('从第二篇开始。')
  })

  it('暂停取消当前段，继续时重读该段，迟到的取消回调不能跳段', async () => {
    const h = harness()
    h.narrator.start({ chapters: [chapter], mode: 'chapter', markdown: '第一句。'.repeat(50) })
    const first = h.utterances[0]
    const lateEnd = first.onend!
    h.narrator.pause()
    lateEnd.call(first, {} as SpeechSynthesisEvent)
    await vi.runOnlyPendingTimersAsync()
    expect(h.state().status).toBe('paused')
    expect(h.state().chunkIndex).toBe(0)
    h.narrator.resume()
    expect(h.utterances[1].text).toBe(first.text)
    expect(h.synth.cancel).toHaveBeenCalledTimes(1)
    await h.end()
    expect(h.state().chunkIndex).toBe(1)
  })

  it('暂停加载时不会自动开播，恢复后开始；停止取消待完成请求', async () => {
    let resolve!: (markdown: string) => void
    const load = vi.fn(() => new Promise<string>(done => { resolve = done }))
    const h = harness(load)
    h.narrator.start({ chapters: [chapter], mode: 'book' })
    h.narrator.pause()
    resolve('已经准备好的正文。')
    await Promise.resolve()
    expect(h.state().status).toBe('paused')
    expect(h.utterances).toHaveLength(0)
    h.narrator.resume()
    expect(h.utterances).toHaveLength(1)
    h.narrator.start({ chapters: [nextChapter], mode: 'book' })
    const signal = h.load.mock.calls[1][1]
    h.narrator.stop()
    expect(signal.aborted).toBe(true)
    resolve('停止后迟到的正文。')
    await Promise.resolve()
    expect(h.state().status).toBe('idle')
    expect(h.utterances).toHaveLength(1)
  })

  it('快速更换目标时忽略旧请求和旧朗读结束事件', async () => {
    let resolve!: (markdown: string) => void
    const h = harness(vi.fn(() => new Promise<string>(done => { resolve = done })))
    h.narrator.start({ chapters: [chapter], mode: 'chapter', markdown: '最初的朗读。' })
    const first = h.utterances[0]
    const lateEnd = first.onend!
    h.narrator.start({ chapters: [chapter], mode: 'book' })
    h.narrator.start({ chapters: [nextChapter], mode: 'chapter', markdown: '新的朗读。' })
    resolve('过时的加载结果。')
    lateEnd.call(first, {} as SpeechSynthesisEvent)
    await Promise.resolve()
    await vi.runOnlyPendingTimersAsync()
    expect(h.state().chapter).toEqual(nextChapter)
    expect(h.utterances.map(utterance => utterance.text)).toEqual(['最初的朗读。', '新的朗读。'])
  })

  it('更换语速和音色时重读当前段，暂停时更改不会自动播放', () => {
    const h = harness()
    const voice = { name: '中文', lang: 'zh-CN', voiceURI: 'zh' } as SpeechSynthesisVoice
    h.narrator.start({ chapters: [chapter], mode: 'chapter', markdown: '正在阅读的正文。' })
    h.narrator.configure(1, voice)
    expect(h.utterances).toHaveLength(1) // asynchronous initial voice discovery must not restart speech
    h.narrator.configure(1.5, voice)
    expect(h.utterances[1].rate).toBe(1.5)
    expect(h.utterances[1].voice).toBe(voice)
    h.narrator.configure(1.5, voice)
    expect(h.utterances).toHaveLength(2)
    h.narrator.pause()
    h.narrator.configure(0.75, null)
    expect(h.utterances).toHaveLength(2)
    h.narrator.resume()
    expect(h.utterances[2].rate).toBe(0.75)
  })

  it('正文加载和设备语音失败都可重试，失败不会跳过正文', async () => {
    const load = vi.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValue('重试后的正文。')
    const h = harness(load)
    h.narrator.start({ chapters: [chapter, nextChapter], mode: 'book' })
    await Promise.resolve()
    expect(h.state().status).toBe('error')
    expect(h.state().chapterIndex).toBe(0)
    h.narrator.retry()
    await Promise.resolve()
    const utterance = h.utterances[0]
    utterance.onerror?.call(utterance, { error: 'voice-unavailable' } as SpeechSynthesisErrorEvent)
    expect(h.state().error).toContain('中文音色不可用')
    h.narrator.retry()
    expect(h.utterances[1].text).toBe('重试后的正文。')
    expect(h.state().status).toBe('playing')
  })

  it('跳转篇章会取消旧加载；卸载播放器不会再发通知或接续朗读', async () => {
    let resolve!: (markdown: string) => void
    const h = harness(vi.fn(() => new Promise<string>(done => { resolve = done })))
    h.narrator.start({ chapters: [chapter, nextChapter], mode: 'book' })
    const oldSignal = h.load.mock.calls[0][1] as AbortSignal
    h.narrator.jumpChapter(1)
    expect(oldSignal.aborted).toBe(true)
    resolve('跳转后的正文。')
    await Promise.resolve()
    const current = h.utterances[0]
    const lateEnd = current.onend!
    h.narrator.destroy()
    lateEnd.call(current, {} as SpeechSynthesisEvent)
    await vi.runOnlyPendingTimersAsync()
    expect(h.utterances).toHaveLength(1)
    expect(h.synth.cancel).toHaveBeenCalledTimes(1)
  })
})
