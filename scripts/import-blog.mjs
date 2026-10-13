import { readFile, realpath, lstat, mkdir, copyFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const markdownTarget = /^src\/content\/blog\/posts\/([a-z0-9-]+)\.md$/;

function inside(root, relative) {
  if (!relative || path.isAbsolute(relative)) throw new Error(`Invalid path: ${relative}`);
  const resolved = path.resolve(root, relative);
  if (!resolved.startsWith(`${path.resolve(root)}${path.sep}`)) throw new Error(`Path escapes root: ${relative}`);
  return resolved;
}

async function sourcePath(root, relative) {
  const requested = inside(root, relative);
  const actual = await realpath(requested);
  const actualRoot = await realpath(root);
  if (!actual.startsWith(`${actualRoot}${path.sep}`)) throw new Error(`Source path outside checkout: ${relative}`);
  return actual;
}

function validate(entries) {
  if (!Array.isArray(entries)) throw new Error('Blog manifest must be an array');
  const slugs = new Set();
  for (const entry of entries) {
    if (!slugPattern.test(entry.slug || '')) throw new Error(`Invalid slug: ${entry.slug}`);
    if (slugs.has(entry.slug)) throw new Error(`Duplicate slug: ${entry.slug}`);
    slugs.add(entry.slug);
    if (!['published', 'draft'].includes(entry.status)) throw new Error(`Invalid status: ${entry.slug}`);
    if (entry.status !== 'published') continue;
    if (!entry.title || !entry.summary || !entry.category || !Array.isArray(entry.tags)) throw new Error(`Missing metadata: ${entry.slug}`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(entry.publishedAt || '') || Number.isNaN(Date.parse(entry.publishedAt))) throw new Error(`Invalid publishedAt: ${entry.slug}`);
    const match = markdownTarget.exec(entry.file || '');
    if (!match || match[1] !== entry.slug) throw new Error(`Invalid file: ${entry.slug}`);
    if (entry.sourceFile) inside('.', entry.sourceFile);
  }
}

function localUrl(raw) {
  return !/^(?:[a-z][a-z\d+.-]*:|\/|#)/i.test(raw);
}

function hideCodeFences(markdown) {
  let fence = null;
  return markdown.split(/(?<=\n)/).map(line => {
    const marker = /^ {0,3}(`{3,}|~{3,})/.exec(line)?.[1];
    if (marker && !fence) { fence = marker; return line.replace(/[^\n]/g, ' '); }
    if (fence) {
      if (marker && marker[0] === fence[0] && marker.length >= fence.length) fence = null;
      return line.replace(/[^\n]/g, ' ');
    }
    return line;
  }).join('');
}

async function assertNoTargetSymlinks(root, target) {
  let current = root;
  for (const part of path.relative(root, target).split(path.sep)) {
    current = path.join(current, part);
    try {
      if ((await lstat(current)).isSymbolicLink()) throw new Error(`Target path contains symlink: ${current}`);
    } catch (error) {
      if (error.code === 'ENOENT') return;
      throw error;
    }
  }
}

export async function importBlog({ sourceRoot, targetRoot, manifestPath }) {
  const entries = JSON.parse(await readFile(manifestPath, 'utf8'));
  validate(entries);
  const canonicalSourceRoot = await realpath(sourceRoot);
  const published = entries.filter((entry) => entry.status === 'published' && entry.sourceFile);
  const bySource = new Map();
  for (const entry of published) bySource.set(await sourcePath(canonicalSourceRoot, entry.sourceFile), entry.slug);
  const changes = [];
  for (const entry of published) {
    const source = await sourcePath(canonicalSourceRoot, entry.sourceFile);
    let markdown = await readFile(source, 'utf8');
    const assets = [];
    const replacements = [];
    // Preserve Markdown syntax, changing only URLs in inline links and images.
    const scanned = hideCodeFences(markdown);
    const patterns = [
      /(!?\[[^\]\n]*\]\(\s*)(<[^>\n]+>|[^\s)\n]+)/g,
      /^( {0,3}\[[^\]\n]+\]:[ \t]*)(<[^>\n]+>|[^\s\n]+)/gm,
    ];
    for (const pattern of patterns) for (const match of scanned.matchAll(pattern)) {
      const wrapped = match[2];
      const url = wrapped.startsWith('<') && wrapped.endsWith('>') ? wrapped.slice(1, -1) : wrapped;
      if (!localUrl(url)) continue;
      const suffixAt = url.search(/[?#]/);
      const clean = decodeURIComponent(suffixAt < 0 ? url : url.slice(0, suffixAt));
      const suffix = suffixAt < 0 ? '' : url.slice(suffixAt);
      const relative = path.relative(canonicalSourceRoot, path.resolve(path.dirname(source), clean));
      const resolved = await sourcePath(canonicalSourceRoot, relative);
      let replacement;
      if (/\.md$/i.test(clean)) {
        const slug = bySource.get(resolved);
        if (!slug) throw new Error(`Unpublished or unregistered Markdown link: ${url}`);
        replacement = `/blog/${slug}${suffix}`;
      } else {
        let assetRelative = path.relative(path.dirname(source), resolved).replaceAll(path.sep, '/');
        if (assetRelative.startsWith('../')) assetRelative = `shared/${path.relative(canonicalSourceRoot, resolved).replaceAll(path.sep, '/')}`;
        assets.push({ source: resolved, target: `public/blog/assets/${entry.slug}/${assetRelative}` });
        replacement = `/blog/assets/${entry.slug}/${encodeURI(assetRelative)}${suffix}`;
      }
      replacements.push([match.index + match[1].length + (wrapped.startsWith('<') ? 1 : 0), url.length, replacement]);
    }
    for (const [start, length, replacement] of replacements.reverse()) {
      markdown = markdown.slice(0, start) + replacement + markdown.slice(start + length);
    }
    changes.push({ entry, markdown, assets: [...new Map(assets.map(asset => [asset.target, asset])).values()] });
  }
  for (const change of changes) {
    await assertNoTargetSymlinks(targetRoot, inside(targetRoot, change.entry.file));
    for (const asset of change.assets) await assertNoTargetSymlinks(targetRoot, inside(targetRoot, asset.target));
  }
  let assets = 0;
  for (const change of changes) {
    const target = inside(targetRoot, change.entry.file);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, change.markdown);
    for (const asset of change.assets) {
      const destination = inside(targetRoot, asset.target);
      await mkdir(path.dirname(destination), { recursive: true });
      await copyFile(asset.source, destination);
      assets++;
    }
  }
  return { articles: changes.length, assets };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const sourceIndex = process.argv.indexOf('--source');
  if (sourceIndex < 0 || !process.argv[sourceIndex + 1]) {
    console.error('Usage: npm run blog:import -- --source /path/to/gupiaoWS');
    process.exitCode = 1;
  } else {
    importBlog({ sourceRoot: path.resolve(process.argv[sourceIndex + 1]), targetRoot: process.cwd(), manifestPath: path.resolve('src/content/blog/manifest.json') })
      .then((result) => console.log(`Imported ${result.articles} articles and ${result.assets} assets.`))
      .catch((error) => { console.error(error.message); process.exitCode = 1; });
  }
}
