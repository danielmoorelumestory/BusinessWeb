import { execFileSync } from 'node:child_process'
import { writeFileSync, mkdirSync, readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const argCwdIdx = process.argv.indexOf('--cwd')
const CWD = argCwdIdx > 0 ? resolve(process.argv[argCwdIdx + 1]) : resolve(__dirname, '..')
const OUT = resolve(CWD, 'public', 'changelog.json')

function runGit(args) {
  return execFileSync('git', args, { encoding: 'utf8', cwd: CWD }).trim()
}

function getTags() {
  const out = runGit(['tag', '--sort=-creatordate', '--sort=-refname:short', '--format=%(refname:short)|%(creatordate:short)'])
  if (!out) return []
  return out.split('\n').map((line) => {
    const [tag, date] = line.split('|')
    return { tag, date }
  })
}

function getCommits(limit = 30) {
  const fmt = '%h|%s|%an|%ad'
  const out = runGit(['log', `--pretty=format:${fmt}`, '--date=short', '-n', String(limit)])
  if (!out) return []
  return out.split('\n').map((line) => {
    const [hash, subject, author, date] = line.split('|')
    return { hash, subject, author, date }
  })
}

function buildVersions(tags, commits) {
  if (commits.length === 0) {
    return [{ tag: 'unreleased', date: null, commits: [] }]
  }
  if (tags.length === 0) {
    return [{ tag: 'unreleased', date: null, commits }]
  }
  const latest = tags[0]
  return [
    { tag: latest.tag, date: latest.date, commits },
    ...tags.slice(1).map((t) => ({ tag: t.tag, date: t.date, commits: [] })),
  ]
}

function main() {
  // CLI deployments contain source files without Git metadata. Preserve the
  // committed changelog instead of failing the production build or fabricating history.
  try {
    execFileSync('git', ['rev-parse', '--git-dir'], { cwd: CWD, stdio: 'pipe' })
  } catch (error) {
    const saved = JSON.parse(readFileSync(OUT, 'utf8'))
    if (!Array.isArray(saved.versions)) throw new Error('Saved changelog must contain versions', { cause: error })
    console.log('Git metadata unavailable; using saved public/changelog.json')
    return
  }
  const tags = getTags()
  const commits = getCommits(30)
  const versions = buildVersions(tags, commits)
  const payload = { generatedAt: new Date().toISOString(), versions }
  mkdirSync(dirname(OUT), { recursive: true })
  writeFileSync(OUT, JSON.stringify(payload, null, 2) + '\n', 'utf8')
}

main()
