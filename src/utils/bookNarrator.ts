import { bookSections, speechChunks } from './bookSpeech'

export type AudioChapter = { file: string; title: string; no?: string }
export type AudioRequest = { chapters: readonly AudioChapter[]; mode: 'section' | 'chapter' | 'book'; markdown?: string; sectionIndex?: number; startIndex?: number }
export type AudioState = {
  status: 'idle' | 'loading' | 'playing' | 'paused' | 'finished' | 'error'
  mode: AudioRequest['mode']
  chapter: AudioChapter | null
  chapterIndex: number
  chapterCount: number
  sectionTitle: string
  chunkIndex: number
  chunkCount: number
  text: string
  error: string
}
export const idleAudioState: AudioState = { status: 'idle', mode: 'chapter', chapter: null, chapterIndex: 0, chapterCount: 0, sectionTitle: '', chunkIndex: 0, chunkCount: 0, text: '', error: '' }

type Session = {
  request: AudioRequest
  chapterIndex: number
  chunks: string[]
  chunkIndex: number
  sectionTitle: string
  paused: boolean
  loading: boolean
  abort: AbortController | null
  utterance: SpeechSynthesisUtterance | null
  timer: ReturnType<typeof setTimeout> | null
}

/** Owns one speech session. Identity checks isolate cancelled fetches and speech callbacks. */
export class BookNarrator {
  private session: Session | null = null
  private rate = 1
  private voice: SpeechSynthesisVoice | null = null
  private state = idleAudioState

  constructor(
    private synth: SpeechSynthesis,
    private createUtterance: (text: string) => SpeechSynthesisUtterance,
    private loadMarkdown: (chapter: AudioChapter, signal: AbortSignal) => Promise<string>,
    private notify: (state: AudioState) => void,
  ) {}

  private publish(status: AudioState['status'], error = ''): void {
    const session = this.session
    this.state = session ? {
      status, mode: session.request.mode, chapter: session.request.chapters[session.chapterIndex],
      chapterIndex: session.chapterIndex, chapterCount: session.request.chapters.length,
      sectionTitle: session.sectionTitle, chunkIndex: session.chunkIndex, chunkCount: session.chunks.length,
      text: session.chunks[Math.min(session.chunkIndex, session.chunks.length - 1)] ?? '', error,
    } : { ...idleAudioState }
    this.notify(this.state)
  }

  private cancelUtterance(session: Session): void {
    const utterance = session.utterance
    session.utterance = null // invalidate callbacks before cancel() can synchronously fire them
    if (session.timer !== null) clearTimeout(session.timer)
    session.timer = null
    if (utterance) {
      utterance.onend = null
      utterance.onerror = null
      utterance.onstart = null
      this.synth.cancel()
    }
  }

  private clear(): void {
    const session = this.session
    this.session = null
    if (!session) return
    session.abort?.abort()
    this.cancelUtterance(session)
  }

  start(request: AudioRequest): void {
    this.clear()
    if (!request.chapters.length) { this.publish('idle'); return }
    const session: Session = { request, chapterIndex: Math.max(0, Math.min(request.chapters.length - 1, request.startIndex ?? 0)), chunks: [], chunkIndex: 0, sectionTitle: '', paused: false, loading: true, abort: null, utterance: null, timer: null }
    this.session = session
    void this.load(session, request.markdown)
  }

  private async load(session: Session, markdown?: string): Promise<void> {
    session.abort?.abort()
    this.cancelUtterance(session)
    const controller = new AbortController()
    session.abort = controller
    session.loading = true
    session.chunks = []
    session.chunkIndex = 0
    session.sectionTitle = ''
    this.publish(session.paused ? 'paused' : 'loading')
    try {
      const content = markdown ?? await this.loadMarkdown(session.request.chapters[session.chapterIndex], controller.signal)
      if (this.session !== session || controller.signal.aborted) return
      const section = session.request.mode === 'section' ? bookSections(content)[session.request.sectionIndex ?? 0] : null
      if (session.request.mode === 'section' && !section) throw new Error('empty')
      session.sectionTitle = section?.title ?? ''
      session.chunks = speechChunks(section?.markdown ?? content)
      if (!session.chunks.length) throw new Error('empty')
      session.loading = false
      if (session.paused) this.publish('paused')
      else this.speak(session)
    } catch (error) {
      if (this.session !== session || controller.signal.aborted) return
      session.loading = false
      this.publish('error', error instanceof Error && error.message === 'empty' ? '这篇内容暂时没有可朗读的正文。' : '正文加载失败，请检查网络后重试。')
    }
  }

  private speak(session: Session): void {
    if (this.session !== session || session.paused || session.loading) return
    if (session.chunkIndex >= session.chunks.length) {
      if (session.chapterIndex + 1 < session.request.chapters.length) {
        session.chapterIndex += 1
        void this.load(session)
      } else this.publish('finished')
      return
    }
    const utterance = this.createUtterance(session.chunks[session.chunkIndex])
    session.utterance = utterance // retain it until end/error; some engines otherwise lose callbacks
    utterance.lang = 'zh-CN'
    utterance.voice = this.voice
    utterance.rate = this.rate
    const isCurrent = () => this.session === session && session.utterance === utterance
    utterance.onstart = () => { if (isCurrent() && !session.paused) this.publish('playing') }
    utterance.onend = () => {
      if (!isCurrent()) return
      session.utterance = null
      session.chunkIndex += 1
      // Yield between segments so pause/stop can interrupt a long book.
      session.timer = setTimeout(() => { session.timer = null; this.speak(session) }, 0)
    }
    utterance.onerror = event => {
      if (!isCurrent()) return
      session.utterance = null
      const message = event.error === 'not-allowed'
        ? '设备暂未允许播放语音，请点击重试。'
        : event.error === 'voice-unavailable' || event.error === 'language-unavailable'
          ? '当前中文音色不可用，请更换音色，或在设备设置中添加中文语音后重试。'
          : '朗读中断，请点击重试。'
      this.publish('error', message)
    }
    this.publish('playing')
    try {
      if (this.synth.paused) this.synth.resume()
      this.synth.speak(utterance)
    } catch {
      if (isCurrent()) {
        this.cancelUtterance(session)
        this.publish('error', '语音播放失败，请点击重试。')
      }
    }
  }

  pause(): void {
    const session = this.session
    if (!session || !['playing', 'loading'].includes(this.state.status)) return
    session.paused = true
    // Cancel and replay this short segment on resume. Mobile engines implement pause inconsistently.
    this.cancelUtterance(session)
    this.publish('paused')
  }

  resume(): void {
    const session = this.session
    if (!session || this.state.status !== 'paused') return
    session.paused = false
    if (session.loading) this.publish('loading')
    else this.speak(session)
  }

  stop(): void { this.clear(); this.publish('idle') }

  moveChunk(offset: number): void {
    const session = this.session
    if (!session || !['playing', 'paused'].includes(this.state.status) || session.loading) return
    this.cancelUtterance(session)
    session.chunkIndex = Math.max(0, Math.min(session.chunks.length, session.chunkIndex + offset))
    if (session.paused) this.publish('paused')
    else this.speak(session)
  }

  jumpChapter(index: number): void {
    const session = this.session
    if (!session || index < 0 || index >= session.request.chapters.length) return
    session.chapterIndex = index
    void this.load(session, index === (session.request.startIndex ?? 0) ? session.request.markdown : undefined)
  }

  retry(): void {
    const session = this.session
    if (!session) return
    session.paused = false
    if (this.state.status === 'finished') { this.start(session.request); return }
    if (session.chunks.length) this.speak(session)
    else void this.load(session, session.chapterIndex === (session.request.startIndex ?? 0) ? session.request.markdown : undefined)
  }

  configure(rate: number, voice: SpeechSynthesisVoice | null): void {
    const changedRate = this.rate !== rate
    const changedVoice = this.voice?.voiceURI !== voice?.voiceURI
    if (!changedRate && !changedVoice) return
    const hadVoice = this.voice !== null
    this.rate = rate
    this.voice = voice
    const session = this.session
    // Late discovery of the initial voice applies to the next segment, avoiding a false restart.
    if (session?.utterance && this.state.status === 'playing' && (changedRate || hadVoice)) {
      this.cancelUtterance(session)
      this.speak(session)
    }
  }

  destroy(): void { this.notify = () => {}; this.clear() }
}
