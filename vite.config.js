import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { marketMiddleware } from './server/market.mjs'
import { macroMiddleware } from './server/macro.mjs'
import { indexesMiddleware } from './server/indexes.mjs'
import { sentimentMiddleware } from './server/sentiment.mjs'
import { knowledgeProxyGuard } from './server/knowledge/local-access.mjs'
import { knowledgePrivateDeny } from './server/knowledge/private-files.mjs'

// 本地开发（vite dev，非测试）：把 /note/ 代理到本机的 notes-site 开发服务器，入口就和线上一样留在本站同域。
// 先运行 npm run dev:notes（构建并预览 notes-site，端口 4322；Astro 开发服务器的脚本在根路径，不能挂在 /note 下，所以用构建产物，改了 notes 代码需重跑），再运行 npm run dev。
const NOTES_DEV_PORT = process.env.NOTES_DEV_PORT || 4322

export default defineConfig(({ command, mode }) => {
  if (command === 'serve' && mode === 'development' && process.env.VITE_NOTES_PATH === undefined) process.env.VITE_NOTES_PATH = '/note/'
  return {
  plugins: [react(), { name: 'businessweb-market-api', configureServer(server) { server.middlewares.use(marketMiddleware) } },
    { name: 'businessweb-macro-api', configureServer(server) { server.middlewares.use(macroMiddleware) } },
    { name: 'businessweb-indexes-api', configureServer(server) { server.middlewares.use(indexesMiddleware) } },
    { name: 'businessweb-sentiment-api', configureServer(server) { server.middlewares.use(sentimentMiddleware) } },
    { name: 'private-knowledge-api', configureServer(server) { server.middlewares.use((req, res, next) => knowledgeProxyGuard(req, res, next, process.env.KNOWLEDGE_TOKEN)) } }],
  base: process.env.VITE_BASE_PATH || '/',
  define: {
    __BUILD_TIME__: JSON.stringify(new Date().toLocaleString('zh-CN', { 
      timeZone: 'Asia/Shanghai',
      year: 'numeric',
      month: '2-digit', 
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    })),
    __VERSION__: JSON.stringify(process.env.npm_package_version || '0.1.0')
  },
  server: { 
    host: true,
    fs: { deny: knowledgePrivateDeny(process.env.KNOWLEDGE_VAULT) },
    proxy: {
      '/note': { target: `http://localhost:${NOTES_DEV_PORT}`, changeOrigin: true, ws: true },
      '/api/knowledge': { target: `http://127.0.0.1:${process.env.KNOWLEDGE_PORT || 8789}`, changeOrigin: true,
        headers: { Authorization: `Bearer ${process.env.KNOWLEDGE_TOKEN || ''}` } },
      // Read-only access to the synced cloud library from a local dev page (same-origin for the browser, so no CORS).
      '/remote-knowledge': { target: 'https://business-web-pi-eight.vercel.app', changeOrigin: true, rewrite: path => path.replace(/^\/remote-knowledge/, '/api/knowledge') },
      '/api/valuation': { target: `http://127.0.0.1:${process.env.VALUATION_PORT || 8788}`, changeOrigin: true },
      '/api/cls-plate': { target: 'https://business-web-pi-eight.vercel.app', changeOrigin: true },
      '/api/candidates-sync': { target: 'https://business-web-pi-eight.vercel.app', changeOrigin: true },
      '/api/proxy': {
        target: 'https://hq.sinajs.cn',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/proxy/, ''),
        configure: (proxy, _options) => {
          proxy.on('proxyReq', (proxyReq, req, _res) => {
            // 设置请求头，模拟浏览器请求
            proxyReq.setHeader('Referer', 'https://finance.sina.com.cn')
            proxyReq.setHeader('User-Agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36')
          })
        }
      }
    }
  },
  test: {
    environment: 'jsdom',
    environmentOptions: { jsdom: { url: 'http://localhost' } },
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    passWithNoTests: true,
    globals: true,
    setupFiles: ['src/testSetup.ts'],
    restoreMocks: true,
    clearMocks: true
  }
}
})
