// notes 站点在 Cloudflare 构建里放在 /note/ 下（见 scripts/build-cloudflare.mjs），那个构建会设置 VITE_NOTES_PATH=/note/；
// Vercel 与 GitHub Pages 的构建没有 /note/，该变量为空。
//
// 这个模块会被 Node 里运行的构建步骤（seo、站点地图相关）间接导入，纯 Node 里 import.meta.env 是 undefined，
// 直接读取它的属性会抛 TypeError，所以先用 typeof 判断。保留 import.meta.env.VITE_xxx 的完整写法，
// 这样 Vite 构建与 vitest 的 stubEnv 仍能识别并替换它。
export const NOTES_PATH: string = (typeof import.meta.env !== 'undefined' ? import.meta.env.VITE_NOTES_PATH || '' : '').trim()

/** 部署了 notes 站点的地址（Cloudflare Pages）。没有 /note/ 的构建（本地开发、Vercel、GitHub Pages）靠它直接跳过去 */
export const NOTES_ORIGIN = 'https://businessweb-c0u.pages.dev'

/**
 * 网格交易入口：有 notes 的构建（Cloudflare）用站内路径；没有 /note/ 的构建直接指向部署了 notes 的站点上的计算器，
 * 点击后整页跳转到那里，不再经过中间页。
 */
export const GRID_TRADING_PATH: string = NOTES_PATH ? `${NOTES_PATH}lab/grid-trading/` : `${NOTES_ORIGIN}/note/lab/grid-trading/`

/** 以 /note/ 开头的路径由静态托管提供，不属于前端路由，必须整页加载 */
export const isNotesPath = (path: string): boolean => path === '/note' || path.startsWith('/note/')

/** 完整的 http(s) 地址：不属于前端路由，也必须整页加载 */
export const isAbsoluteUrl = (path: string): boolean => /^https?:\/\//i.test(path)
