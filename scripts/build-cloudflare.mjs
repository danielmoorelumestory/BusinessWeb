// Cloudflare Pages 构建：先构建 BusinessWeb，再构建 notes-site，最后把 notes 的静态产物放进 dist/note/。
// 复制必须在 Vite 构建之后，因为 Vite 会清空输出目录。任一步失败都立即以非零状态退出，
// 这样 Cloudflare 会保留上一个正常的部署，不会把半成品发布出去。
import { spawnSync } from 'node:child_process'
import { cpSync, existsSync, mkdirSync, rmSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { findBrokenNoteLinks } from './check-note-links.mjs'

/** 把 notes 的构建产物复制为 dist/note；先清掉旧的 dist/note，不动 dist 里的其他文件。 */
export function copyNotesDist({ notesDist, target }) {
  // notes 只保留 lab 页面（笔记、首页、RSS 已迁入主站），以 lab/index.html 判断构建产物是否完整
  if (!existsSync(join(notesDist, 'lab', 'index.html'))) throw new Error(`notes 构建产物不完整，缺少 lab/index.html：${notesDist}`)
  rmSync(target, { recursive: true, force: true })
  mkdirSync(target, { recursive: true })
  cpSync(notesDist, target, { recursive: true })
}

function run(command, args, cwd, extraEnv = {}) {
  const result = spawnSync(command, args, { cwd, stdio: 'inherit', env: { ...process.env, ...extraEnv } })
  if (result.error) throw result.error
  if (result.status !== 0) throw new Error(`命令失败（退出码 ${result.status}）：${command} ${args.join(' ')}`)
}

function main() {
  const root = resolve('.')
  const notesSite = join(root, 'notes-site')
  const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm'
  if (!existsSync(join(notesSite, 'package.json'))) throw new Error('缺少 notes-site/，无法构建 notes')

  console.log('[1/4] 构建 BusinessWeb')
  // 让主站的网格交易、股市分析入口指向站内的 /note/；其他构建（GitHub Pages、本地开发）没有 /note/，不设置此变量
  run(npm, ['run', 'build'], root, { VITE_NOTES_PATH: '/note/' })
  console.log('[2/4] 安装并构建 notes-site')
  run(npm, ['ci', '--no-audit', '--no-fund'], notesSite)
  // MAIN_SITE：notes 页面里「返回主站」等链接的前缀；同域托管时就是站点根
  run(npm, ['run', 'build'], notesSite, { MAIN_SITE: '/' })
  console.log('[3/4] 复制 notes 产物到 dist/note')
  copyNotesDist({ notesDist: join(notesSite, 'dist'), target: join(root, 'dist', 'note') })
  console.log('[4/4] 检查 notes 内部链接')
  const broken = findBrokenNoteLinks(join(root, 'dist', 'note'))
  if (broken.length) {
    for (const { page, link } of broken) console.error(`断链：${page} -> ${link}`)
    throw new Error(`notes 存在 ${broken.length} 处断链，构建终止`)
  }
  console.log('完成：dist/note 已就绪')
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try { main() } catch (error) { console.error(error.message); process.exit(1) }
}
