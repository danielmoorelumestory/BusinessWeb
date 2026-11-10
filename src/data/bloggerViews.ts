import jinrongjieXiaolongnv from '../content/blogger-views/jinrongjie-xiaolongnv.md?raw'
import xinfaSidao from '../content/blogger-views/xinfa-sidao.md?raw'

export interface BloggerView {
  slug: string
  /** 账号昵称，按平台上的写法 */
  name: string
  platform: string
  account: string
  homepage: string
  /** 一句话说明这个人讲什么 */
  summary: string
  /** 整理覆盖了多少条、哪段时间 */
  coverage: string
  updated: string
  markdown: string
}

// 新增一位博主：正文放 src/content/blogger-views/<slug>.md，再在这里登记一条。
export const BLOGGER_VIEWS: BloggerView[] = [
  {
    slug: 'jinrongjie-xiaolongnv',
    name: '金融街小龙女',
    platform: '抖音',
    account: '79842472707',
    homepage: 'https://www.douyin.com/user/MS4wLjABAAAA_XPOOXl2qR1TbXtRXRGDquVLEWU-729Gzii94rTTS57whbQ7HeeDxwt5G2ErFghV',
    summary: '持牌投顾账号。现在每天一条「操盘手」系列，讲怎么从量价和换手识别主力的吸筹、洗盘、拉升、出货；早期讲打板等超短线战法。',
    coverage: '135 条公开作品中的 133 条，2024-11-08 至 2026-11-09',
    updated: '2026-11-10',
    markdown: jinrongjieXiaolongnv,
  },
  {
    slug: 'xinfa-sidao',
    name: '心法思道（虔诚版）',
    platform: '抖音',
    account: '50251741729',
    homepage: 'https://www.douyin.com/user/MS4wLjABAAAAAbitsZkRsbiDJrLEiOEIPuTbCZuMy1HNDL7F3fRtzvU',
    summary: '《盘口黑匣子》系列：从对手盘角度解释量价、换手、洗盘、出货与主力成本，主张少动、等确认、会空仓。',
    coverage: '26 条公开作品中的 25 条，2026-09-09 至 2026-11-08',
    updated: '2026-11-10',
    markdown: xinfaSidao,
  },
]

export function findBloggerView(slug: string | undefined): BloggerView | undefined {
  return BLOGGER_VIEWS.find(view => view.slug === slug)
}
