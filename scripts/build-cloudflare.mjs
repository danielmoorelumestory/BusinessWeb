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
  if (!existsSync(join(notesDist, 'index.html'))) throw new Error(`notes 构建产物不完整，缺少 index.html：${notesDist}`)
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
  // 让主站 Header 显示进入 notes 的入口；其他构建（Vercel、GitHub Pages）没有 /note/，不设置此变量
  run(npm, ['run', 'build'], root, { VITE_NOTES_PATH: '/note/' })
  console.log('[2/4] 安装并构建 notes-site')
  run(npm, ['ci', '--no-audit', '--no-fund'], notesSite)
  run(npm, ['run', 'build'], notesSite)
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
