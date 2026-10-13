export interface SiteUpdate {
  id: string
  date: string
  title: string
  description: string
  href: string
}

// 仅记录已上线、用户可感知的需求；同一需求合并为一条，按上线日期倒序维护。
// 使用中文描述结果和使用方式，不从 Git 提交、构建或日常数据刷新自动生成。
export const SITE_UPDATES: readonly SiteUpdate[] = [
  {
    id: 'dropshipping-strategy',
    date: '2026-10-11',
    title: '无货源电商：30 天实施方案',
    description: '补充一件代发的选品、供应商与平台规则说明，提供利润测算、预算与周转金拆分、30 天任务和继续或停止条件，可下载订单记账模板。',
    href: '/ai/dropshipping',
  },
  {
    id: 'mindful-investing-book',
    date: '2026-10-11',
    title: '《正念投资》书稿与听书更新',
    description: '新增导读与公司研究实战，提供阅读路线、章节搜索和字号调节；普通话听书支持本节、本章与全书，播放器可收起悬浮，书评独立放在书籍页底部。',
    href: '/first-book/slow-is-fast',
  },
  {
    id: 'dev-team',
    date: '2026-10-11',
    title: 'Orca 开发团队 Skill 上线',
    description: '更新包含独立 README 的完整 ZIP，使用说明可直接在线阅读，补充安装、自检、项目配置与验证范围；建议从只读评审开始。',
    href: '/ai#lab-skills',
  },
  {
    id: 'national-team-holdings',
    date: '2026-10-11',
    title: '新增国家队持仓看板',
    description: '按机构、行业和个股查看 A 股与 ETF 持仓，了解季度持仓变化。',
    href: '/invest/national-team',
  },
  {
    id: 'about-comments',
    date: '2026-10-11',
    title: '关于页开放留言',
    description: '可以在关于页提交使用反馈和功能建议，留言审核后公开展示。',
    href: '/about#about-comments',
  },
  {
    id: 'company-notes',
    date: '2026-10-11',
    title: '新增公司研究笔记',
    description: '公司研究页支持阅读笔记，获得编辑授权后可修改并保存到云端。',
    href: '/research-notes',
  },
  {
    id: 'ai-applications-and-materials',
    date: '2026-10-10',
    title: '扩充 AI 应用与新材料研究',
    description: '未来趋势与产业格局增加相关赛道、产业链和公司研究入口。',
    href: '/future-trends',
  },
]
