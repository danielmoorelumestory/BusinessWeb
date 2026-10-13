import { test } from 'node:test'
import assert from 'node:assert/strict'
import { blogPaths, blogBaseUrl, blogHref } from './blog-routes.mjs'

test('only published entries with valid slugs become public blog routes', () => {
  assert.deepEqual(blogPaths([
    { slug: 'first', status: 'published' },
    { slug: 'review-notes', status: 'draft' },
    { slug: '../escape', status: 'published' },
    { slug: 'second', status: 'published' },
  ]), ['/blog/first', '/blog/second'])
})

test('prerendered blog assets use the base path of the built site', () => {
  assert.equal(blogBaseUrl('<script src="/BusinessWeb/assets/index.js"></script>'), '/BusinessWeb/')
  assert.equal(blogBaseUrl('<script src="/assets/index.js"></script>'), '/')
})

test('prerendered blog links stay inside a GitHub Pages subdirectory', () => {
  assert.equal(blogHref('/first-book', '/BusinessWeb/'), '/BusinessWeb/first-book')
  assert.equal(blogHref('/blog/first', '/'), '/blog/first')
})
