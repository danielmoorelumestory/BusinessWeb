const VALID_SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

export function blogPaths(entries) {
  return [...new Set(entries.filter(entry => entry.status === 'published' && VALID_SLUG.test(entry.slug || '')).map(entry => `/blog/${entry.slug}`))]
}

export function blogBaseUrl(builtHtml) {
  return builtHtml.match(/\bsrc="(\/[^" ]*?)assets\//)?.[1] || '/'
}

export function blogHref(path, baseUrl) {
  return `${baseUrl.replace(/\/$/, '')}${path}`
}
