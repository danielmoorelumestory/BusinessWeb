# ETF 复盘列表设计（2026-10-18）

## 目标与现状

现有 `/note/lab/grid-trading/saved` 已是网格交易的「复盘列表」：展示已保存回测标的的行情、网格状态、参数与盈亏，并支持同一同步密钥的云端同步。

用户需要一个**新的主入口复盘页**，在相近的标的纵览体验上增加：

1. **每日每只 ETF 的结构化复盘笔记**
2. **多标签分组**（如「重点观察」），一只 ETF 可同时属于多个分组

旧网格复盘页降级为「网格列表」，不再作为复盘主入口。

## 选择的方案

采用**同同步通道、独立复盘工作区文档**（方案 2）：

- 网格 `SavedRecord` 与回测引擎保持不动
- 分组、观察池、每日笔记存放在固定 id 的 meta 文档中，经现有 sync key / D1 `records` 表同步
- ETF 池 = 网格复盘标的 ∪ 手动添加的观察标的

曾考虑把笔记/分组字段直接塞进 `SavedRecord`：同步改动最小，但会污染网格模型、放大每条回测记录体积，且旧页必须额外过滤。也曾考虑 D1 专表与新 API：边界最清晰，但工期大，且与「跟网格同一套同步」的约束不一致。

## 信息架构与路由

### 新主入口

| 项 | 值 |
| --- | --- |
| 路径 | `/note/lab/etf-review/` |
| 标题 | ETF 复盘 |
| labs | 登记并作为复盘主入口突出展示 |
| 站内导航 | 原指向「复盘列表 / grid-trading/saved」的链接改指本页 |

### 旧页降级

- 路径仍为 `/note/lab/grid-trading/saved`
- 标题改为 **网格列表**
- 文案说明：仅网格回测标的；顶栏提供「← ETF 复盘」回到主入口
- 计算器「加入复盘」行为不变：仍写入网格 `SavedRecord`；新页自动收录其 code

### 新页布局（自上而下）

1. 同步条（复用同一 sync key UI）
2. 分组筛选：全部 | 各分组 chip +「管理分组」
3. ETF 表
4. 行操作：写今日笔记 · 编辑分组 · 打开网格详情（有关联时）· 移除观察

## 数据模型

云端仍使用现有 `records` 表。复盘工作区为特殊 payload，固定：

```text
id = meta:etf-review-v1
```

### 类型（语义）

```ts
type EtfReviewMeta = {
  id: 'meta:etf-review-v1';
  kind: 'etf-review-meta';
  savedAt: string;
  updatedAt: string;
  groups: { id: string; name: string; order: number }[];
  /** 手动加入、且当前没有对应网格 SavedRecord 的标的 */
  watchlist: { code: string; name: string; addedAt: string }[];
  /** 多标签：code → groupIds */
  memberships: Record<string, string[]>;
  /** key = `${code}|${YYYY-MM-DD}`（北京交易日口径） */
  notes: Record<string, DailyNote>;
};

type DailyNote = {
  emotion: '冷静' | '犹豫' | 'FOMO' | '恐慌' | '';
  conclusion: '看多' | '中性' | '看空' | '';
  action: '加仓' | '减仓' | '观望' | '调参' | '';
  risk: string;   // 建议 ≤200
  remark: string; // 建议 ≤500
  updatedAt: string;
};
```

### 池合成与删除语义

- `codes = unique(gridRecords.codes ∪ watchlist.codes)`
- 有网格记录 → 行挂载 `SavedRecord`（状态 / 盈亏 / 跳转详情）
- 仅 watchlist → 行情 + 笔记 + 分组；状态列显示「未挂网格」
- 新页「移除」：
  - 仅 watchlist（无网格记录）：从 `watchlist` 与 `memberships` 去掉，标的离开池
  - 已有网格记录：不提供「移出池」；可清除该 code 的分组标签，并提示「来自网格列表，需在网格列表删除才会离开本池」；**绝不**在新页删除网格 `SavedRecord`
- 网格列表删除网格记录：若 code 仍在 watchlist，新页保留为纯观察；否则从池消失
- `readGridRecords()`（及一切网格列表数据源）必须过滤 `kind === 'etf-review-meta'`，禁止 meta 出现在网格表

### 预置分组

首次无 meta 时写入：`重点观察` · `已持仓` · `备选`（可增删改名、排序）。

### 同步

- 与网格共用 sync key
- `syncAll` merge 时对 meta 按 `updatedAt` 做 last-write-wins（LWW）
- 笔记写入、改分组均更新 meta.`updatedAt`，并走现有 `pushRecord`（或等价单条推送）路径

## UI 与交互

### 笔记字段（select + 文本）

| 字段 | 控件 | 取值 |
| --- | --- | --- |
| 情绪 | select | 冷静 / 犹豫 / FOMO / 恐慌 |
| 结论 | select | 看多 / 中性 / 看空 |
| 计划动作 | select | 加仓 / 减仓 / 观望 / 调参 |
| 风险点 | 文本 | ≤200 |
| 备注 | 文本 | ≤500 |

- 行内「写笔记」打开抽屉/弹层；默认日期 = 北京今日；可切换日期查看/编辑历史
- 「今日笔记」列展示 `结论·动作`；无则「未写」；有风险点时小标点提示
- 同一 `code|date` 覆盖保存，不堆多版本行

### 分组

- 顶栏 chip 多选筛选，OR 语义（命中任一标签即显示）；「全部」清空筛选
- 「管理分组」：增删改名、拖拽排序；删除分组只去标签，不删 ETF
- 行内「编辑分组」：多选 checkbox

### 添加 ETF

- 「添加标的」：6 位代码（可选名称）；格式校验后写入 watchlist
- 若已有网格记录：不重复写入 watchlist，只保证出现在池中并可打标签

### 与网格页关系

- 有网格：可进 `grid-trading/detail`；另提供「网格列表」链接
- 无网格：链到计算器（带 code 若现有支持），或提示先回测

### 表格列（相对旧表做减法）

代码 · 名称 · 日/周/月（复用 `review-analysis`）· 现价 · 网格状态（或未挂网格）· 盈亏（无网格为 —）· 分组 · 今日笔记 · 操作

网格参数编辑、四年高低等仍留在「网格列表」。

## 组件与接点

| 位置 | 变更 |
| --- | --- |
| `notes-site/src/lib/etf-review.ts` | 新建：meta CRUD、池合成、笔记/分组 API、同步接入 |
| `notes-site/src/pages/lab/etf-review/index.astro` | 新建主页 |
| `notes-site/src/lib/grid-trading.ts` | 过滤 meta；sync merge 识别 meta |
| `notes-site/src/pages/lab/grid-trading/saved.astro` | 降级文案与回链 |
| `notes-site/src/lib/labs.ts` | 登记新 lab；调整旧条目标题 |
| 主站导航 / `notesLinks` 等 | 原「复盘列表」指向新页 |

## 错误处理与边界

- meta 缺失或损坏：回退空工作区 + 预置三分组；不阻断网格读写
- 云端与本地冲突：`updatedAt` LWW；同步后提示使用了哪一侧较新版本
- 字段超长：前端截断；空枚举存 `''`
- 非法 code：拒绝添加；名称拉取失败仍可只存 code
- 存储满：沿用 `evictCaches` + 写失败提示；meta 优先于行情缓存
- 新页「清空」不清网格记录；「清空笔记与分组」需二次确认

## 测试与验收

1. 单测：池合成、多标签筛选、笔记 key、LWW、meta 不进入 `readGridRecords`
2. 手测：双设备同 key 同步分组与笔记；仅 watchlist ETF；有网格 ETF 跳转详情；删分组；移除观察不删网格
3. 回归：计算器加入复盘、网格列表刷新/改参/同步仍正常

## 首版边界

- 不做独立后端笔记表或搜索全文
- 不做笔记导出/分享
- 不做自动根据行情生成笔记
- 不做分组权限或多用户协作（仍是单 sync key 工作区）
