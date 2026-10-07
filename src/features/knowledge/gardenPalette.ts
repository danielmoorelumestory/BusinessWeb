// 知识图谱 3D 花园场景的颜色。WebGL / canvas 里不能使用 CSS 变量，所以这里集中保存字面值；
// 取值对应 src/index.css 的令牌：主色 --accent、强调色 --accent-warm、文字 --text-primary、页面底色 --bg-primary 等。
export const GARDEN_PALETTE = {
  /** 节点分类色（按分类轮换）：蓝、琥珀、青、金、紫、玫、青蓝、青柠 */
  categories: ['#1d4ed8', '#d97706', '#0d9488', '#e0a21b', '#7c6bc4', '#be5b8a', '#0891b2', '#65a30d'],
  /** 标签文字（--text-primary） */
  label: '#172033',
  /** 标签光晕，与页面底色（--bg-primary）一致 */
  labelHalo: 'rgba(245,247,250,1)',
  /** 中心光晕（--accent-warm 的浅色） */
  heart: '#f0b860',
  /** 飘散的光点（--system-gray2） */
  fluff: '#b6bfcc',
  /** 连线：高亮（--accent-warm）、弱化（--border-subtle）、普通 */
  linkActive: '#d97706',
  linkDim: '#dde3ec',
  linkIdle: '#a8b3c4',
  /** 沿连线移动的粒子：高亮（--accent-warm）、普通（--accent） */
  particleActive: '#d97706',
  particleIdle: '#1d4ed8',
} as const
