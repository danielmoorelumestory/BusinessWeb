// notes 站点在 Cloudflare 构建里放在 /note/ 下（见 scripts/build-cloudflare.mjs），那个构建会设置 VITE_NOTES_PATH=/note/；
// Vercel 与 GitHub Pages 的构建没有 /note/，该变量为空。
export const NOTES_PATH: string = (import.meta.env.VITE_NOTES_PATH || '').trim()

/** 网格交易入口：有 notes 的构建直接指向 notes 的计算器，否则指向主站的 /grid-trading（显示迁移说明） */
export const GRID_TRADING_PATH: string = NOTES_PATH ? `${NOTES_PATH}lab/grid-trading/` : '/grid-trading'

/** 以 /note/ 开头的路径由静态托管提供，不属于前端路由，必须整页加载 */
export const isNotesPath = (path: string): boolean => path === '/note' || path.startsWith('/note/')
