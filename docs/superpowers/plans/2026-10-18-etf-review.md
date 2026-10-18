# ETF 复盘列表 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 新增 `/note/lab/etf-review/` 作为复盘主入口，支持每日结构化笔记与多标签分组；旧 `/lab/grid-trading/saved` 降级为「网格列表」。

**Architecture:** 复盘工作区以固定 id `meta:etf-review-v1` 的文档经现有 sync key / D1 `records` 同步；本机用独立 localStorage key，不写入网格 `SavedRecord` 数组。ETF 池 = 网格复盘标的 ∪ 手动 watchlist。Worker 无需改 schema（payload 不透明；`trackedCodes` 靠 `row.code`，meta 自动忽略）。

**Tech Stack:** Astro notes-site、TypeScript、localStorage、现有 `grid-trading` sync（GET/PUT）、Vitest（经根目录 `npm test`）、腾讯报价 / `review-analysis`。

**Spec:** `docs/superpowers/specs/2026-10-18-etf-review-design.md`

## Global Constraints

- 路径主入口：`/note/lab/etf-review/`；旧页路径不变，标题改为「网格列表」。
- Meta id 固定：`meta:etf-review-v1`；`kind: 'etf-review-meta'`。
- 笔记字段：情绪 / 结论 / 计划动作 / 风险点 / 备注；枚举与截断见 spec。
- 分组多标签；预置：重点观察、已持仓、备选。
- 新页「移除」不删网格 `SavedRecord`；有网格时不可移出池。
- 不新建 D1 表、不改 Worker schema；不把 meta 混入 `readGridRecords()`。
- 实施范围仅复盘相关文件与导航；不顺手改无关功能。

## File Structure

| 文件 | 职责 |
| --- | --- |
| `notes-site/src/lib/etf-review-meta.ts` | 类型、`isEtfReviewMeta`、`defaultMeta`、`mergeMeta`、`splitCloudItems` 等无 storage 纯函数（供 grid-trading 安全 import） |
| `notes-site/src/lib/etf-review.ts` | 本机 meta CRUD、池合成、笔记/分组、`pushMeta` |
| `notes-site/src/lib/etf-review.test.ts` | 域逻辑与存储/同步辅助单测 |
| `notes-site/src/lib/grid-trading.ts` | `syncAll` / `pushRecord` 路径剥离或附带 meta；防御性过滤 |
| `notes-site/src/pages/lab/etf-review/index.astro` | 新主页 UI |
| `notes-site/src/pages/lab/grid-trading/saved.astro` | 降级文案 + 回链 |
| `notes-site/src/lib/labs.ts` | 登记新 lab、旧标题 |
| `notes-site/src/pages/lab/grid-trading.astro` | 按钮文案/链到新主入口（可选保留「网格列表」链） |
| `src/data/notesLinks.ts` | 新增 `ETF_REVIEW_PATH`；`GRID_SAVED_PATH` 保留给网格列表 |
| `src/data/siteMap.ts` + `siteMap.test.ts` | 观察盘「复盘列表」改指新页 |
| `vite.config.js` | vitest `include` 增加 `notes-site/src/**/*.test.ts` |

---

### Task 1: ETF review 域模块（纯函数 + 本机 meta）

**Files:**
- Create: `notes-site/src/lib/etf-review-meta.ts`
- Create: `notes-site/src/lib/etf-review.ts`
- Create: `notes-site/src/lib/etf-review.test.ts`
- Modify: `vite.config.js`（vitest include）

**Interfaces:**
- Produces（`etf-review-meta.ts`）：
  - `ETF_REVIEW_META_ID = 'meta:etf-review-v1'`
  - `type DailyNote`, `type ReviewGroup`, `type EtfReviewMeta`
  - `isEtfReviewMeta(item: unknown): item is EtfReviewMeta`
  - `defaultMeta(nowIso: string): EtfReviewMeta` — 含三分组，group id 固定 `g-focus` / `g-held` / `g-backup`
  - `noteKey(code: string, date: string): string` — `${code}|${date}`
  - `truncateNote(note: DailyNote): DailyNote` — risk≤200, remark≤500
  - `mergeMeta(local: EtfReviewMeta | null, remote: EtfReviewMeta | null): EtfReviewMeta` — LWW by `updatedAt`，双方空则 `defaultMeta`
  - `poolCodes(gridCodes: string[], watchlist: { code: string }[]): string[]`
  - `filterByGroups(codes: string[], memberships: Record<string, string[]>, selectedGroupIds: string[]): string[]` — 空 selected = 全部；OR 语义
  - `splitCloudItems(items: unknown[]): { meta; records; tombstones }`
- Produces（`etf-review.ts`）：
  - `ETF_REVIEW_META_KEY = 'etf-review-meta-v1'`
  - `readMeta(): EtfReviewMeta` / `writeMeta(meta: EtfReviewMeta): void`
  - `upsertDailyNote(code, date, fields): EtfReviewMeta`
  - `setMemberships(code, groupIds): EtfReviewMeta`
  - `addWatch(code, name): EtfReviewMeta` — 非法 code 抛错；已在 watchlist 则只更新 name
  - `removeWatch(code): EtfReviewMeta` — 去掉 watchlist + memberships[code]
  - `clearReviewWorkspace(): EtfReviewMeta` — 重置为 defaultMeta（二次确认由 UI 做）

- [ ] **Step 1: 扩展 vitest include**

在 `vite.config.js` 的 `test.include` 增加 `'notes-site/src/**/*.test.ts'`。

- [ ] **Step 2: 写失败测试**

```ts
// notes-site/src/lib/etf-review.test.ts
import { describe, expect, it, beforeEach } from 'vitest';
import {
  noteKey, truncateNote, mergeMeta, poolCodes, filterByGroups,
  defaultMeta, isEtfReviewMeta, readMeta, writeMeta, addWatch, removeWatch,
  upsertDailyNote, setMemberships, ETF_REVIEW_META_ID,
} from './etf-review';

describe('etf-review domain', () => {
  beforeEach(() => localStorage.clear());

  it('noteKey joins code and date', () => {
    expect(noteKey('510300', '2026-10-18')).toBe('510300|2026-10-18');
  });

  it('truncateNote cuts risk and remark', () => {
    const note = truncateNote({
      emotion: '冷静', conclusion: '看多', action: '观望',
      risk: 'x'.repeat(250), remark: 'y'.repeat(600), updatedAt: '2026-10-18T00:00:00.000Z',
    });
    expect(note.risk).toHaveLength(200);
    expect(note.remark).toHaveLength(500);
  });

  it('mergeMeta prefers newer updatedAt', () => {
    const older = { ...defaultMeta('2026-01-01T00:00:00.000Z'), updatedAt: '2026-01-01T00:00:00.000Z' };
    const newer = { ...defaultMeta('2026-02-01T00:00:00.000Z'), updatedAt: '2026-02-01T00:00:00.000Z',
      notes: { '510300|2026-02-01': { emotion: '冷静', conclusion: '看多', action: '加仓', risk: '', remark: 'n', updatedAt: '2026-02-01T00:00:00.000Z' } } };
    expect(mergeMeta(older, newer).notes['510300|2026-02-01']?.remark).toBe('n');
    expect(mergeMeta(newer, older).notes['510300|2026-02-01']?.remark).toBe('n');
  });

  it('poolCodes unions grid and watchlist uniquely', () => {
    expect(poolCodes(['510300', '159915'], [{ code: '159915' }, { code: '588000' }]).sort())
      .toEqual(['159915', '510300', '588000']);
  });

  it('filterByGroups OR-matches selected tags', () => {
    const memberships = { a: ['g1'], b: ['g2'], c: ['g1', 'g2'] };
    expect(filterByGroups(['a', 'b', 'c'], memberships, []).sort()).toEqual(['a', 'b', 'c']);
    expect(filterByGroups(['a', 'b', 'c'], memberships, ['g1']).sort()).toEqual(['a', 'c']);
  });

  it('isEtfReviewMeta recognizes meta id and kind', () => {
    expect(isEtfReviewMeta({ id: ETF_REVIEW_META_ID, kind: 'etf-review-meta' })).toBe(true);
    expect(isEtfReviewMeta({ id: 'x', row: {}, result: {} })).toBe(false);
  });

  it('readMeta seeds default groups when empty', () => {
    const meta = readMeta();
    expect(meta.groups.map(g => g.name)).toEqual(['重点观察', '已持仓', '备选']);
  });

  it('addWatch rejects bad code; removeWatch drops memberships', () => {
    expect(() => addWatch('12', 'x')).toThrow();
    addWatch('510300', '沪深300');
    setMemberships('510300', [readMeta().groups[0].id]);
    removeWatch('510300');
    expect(readMeta().watchlist).toEqual([]);
    expect(readMeta().memberships['510300']).toBeUndefined();
  });

  it('upsertDailyNote overwrites same code|date', () => {
    upsertDailyNote('510300', '2026-10-18', { emotion: '冷静', conclusion: '看多', action: '观望', risk: 'r', remark: 'a' });
    upsertDailyNote('510300', '2026-10-18', { emotion: '犹豫', conclusion: '中性', action: '减仓', risk: '', remark: 'b' });
    const note = readMeta().notes['510300|2026-10-18'];
    expect(note?.remark).toBe('b');
    expect(note?.emotion).toBe('犹豫');
  });
});
```

- [ ] **Step 3: 跑测确认失败**

Run: `npm test -- --run notes-site/src/lib/etf-review.test.ts`  
Expected: FAIL（模块或导出不存在）

- [ ] **Step 4: 实现 `etf-review-meta.ts` + `etf-review.ts`**

实现上述接口。要点：

- 纯函数全部放 `etf-review-meta.ts`（含 `splitCloudItems`，供 Task 2 复用）。
- `writeMeta`：写满时先尝试调用 `evictCaches`（从 `./grid-trading` 导入），再重试；仍失败则抛错。
- 所有变更函数更新 `updatedAt = new Date().toISOString()` 后 `writeMeta` 并返回新 meta。
- `addWatch`：`/^\d{6}$/`；code trim。

- [ ] **Step 5: 跑测确认通过**

Run: `npm test -- --run notes-site/src/lib/etf-review.test.ts`  
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add vite.config.js notes-site/src/lib/etf-review-meta.ts notes-site/src/lib/etf-review.ts notes-site/src/lib/etf-review.test.ts
git commit -m "$(cat <<'EOF'
feat(etf-review): add domain module for notes, groups, and meta storage

EOF
)"
```

---

### Task 2: 同步路径接入 meta（不污染网格列表）

**Files:**
- Modify: `notes-site/src/lib/grid-trading.ts`（`CloudItem`、`syncAll`、`pushRecord` 周边）
- Modify: `notes-site/src/lib/etf-review.ts`（增加 `pushMeta`）
- Modify: `notes-site/src/lib/etf-review.test.ts`

**Interfaces:**
- Consumes: Task 1 的 `isEtfReviewMeta` / `mergeMeta` / `readMeta` / `writeMeta`
- Produces:
  - `syncAll`：从云端列表剥离 meta → LWW 写入 `ETF_REVIEW_META_KEY`；写回云端时附带当前 meta；`writeRecords` 只含网格/关注 `SavedRecord`
  - `pushMeta(what?: string): Promise<string>` — 与 `pushRecord` 同语义的提示字符串
  - `readGridRecords`：额外排除 `isEtfReviewMeta`（防御）

- [ ] **Step 1: 写同步相关失败测试**

在 `etf-review.test.ts` 增加（用 vitest mock `fetch` 或抽出可测的 `splitCloudItems`）：

```ts
import { splitCloudItems } from './etf-review';

it('splitCloudItems separates meta from records and tombstones', () => {
  const meta = defaultMeta('2026-10-18T00:00:00.000Z');
  const record = { id: 'r1', savedAt: '2026-10-18T00:00:00.000Z', row: { code: '510300' }, result: {}, watch: undefined };
  const tomb = { id: 'r2', savedAt: 't', updatedAt: 't', deleted: true as const };
  const { meta: m, records, tombstones } = splitCloudItems([meta, record as never, tomb]);
  expect(m?.id).toBe(ETF_REVIEW_META_ID);
  expect(records).toHaveLength(1);
  expect(tombstones).toHaveLength(1);
});
```

- [ ] **Step 2: 跑测确认新断言失败**（若 Task 1 已实现 `splitCloudItems` 则本步应已 PASS，直接改 sync）

Run: `npm test -- --run notes-site/src/lib/etf-review.test.ts`

- [ ] **Step 3: 改 syncAll + pushMeta**

在 `grid-trading.ts` 的 `syncAll` 中（保持现有 LWW Map 逻辑后）：

1. `const localMetaBefore = readMeta()`
2. 对 merged values 调用 `splitCloudItems`
3. `writeMeta(mergeMeta(localMetaBefore, split.meta))`
4. `writeRecords` 仅写入 `SavedRecord`（不含 meta）
5. PUT body：`[...records, ...aliveTombstones, readMeta()]`

在 `grid-trading.ts` 新增：

```ts
export async function pushCloudPayload(item: { id: string; updatedAt?: string; savedAt: string }, what: string): Promise<string>
```

`pushRecord` 改为调用它；`etf-review.ts` 的 `pushMeta` 同样调用它。

`readGridRecords`：

```ts
export const readGridRecords = () =>
  readRecords().filter(item => !item.watch && !isEtfReviewMeta(item));
```

从 `./etf-review-meta` import `isEtfReviewMeta`（无循环依赖）。

- [ ] **Step 4: 跑测通过**

Run: `npm test -- --run notes-site/src/lib/etf-review.test.ts`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add notes-site/src/lib/etf-review.ts notes-site/src/lib/etf-review-meta.ts notes-site/src/lib/etf-review.test.ts notes-site/src/lib/grid-trading.ts
git commit -m "$(cat <<'EOF'
feat(etf-review): sync workspace meta beside grid records

EOF
)"
```

---

### Task 3: ETF 复盘主页面

**Files:**
- Create: `notes-site/src/pages/lab/etf-review/index.astro`
- Modify: `notes-site/src/lib/labs.ts`

**Interfaces:**
- Consumes: `etf-review` API、`readGridRecords` / `gridStatus` / `formatMoney` / `formatPrice` / `fetchQuotes` / `marketToday` / `syncAll` / `SYNC_KEY_STORAGE` / `blockCopy`、`renderReviewAnalysis`
- Produces: 可浏览的复盘主页

- [ ] **Step 1: 登记 lab**

在 `labs.ts` **最前**插入：

```ts
{
  slug: 'etf-review',
  title: 'ETF 复盘',
  summary: '按分组观察 ETF：每日结构化笔记、行情摘要；有网格的标的显示状态与盈亏。',
},
```

将原 `grid-trading/saved` 的 title/summary 改为「网格列表」/「仅网格回测标的的参数、成交与盈亏」。

- [ ] **Step 2: 实现页面骨架**

`etf-review/index.astro` 结构对齐 `saved.astro`（Base、sync-panel、content-area），差异：

1. 标题「ETF 复盘」；链到 `lab/grid-trading/saved`（网格列表）与计算器
2. 分组 chip 栏 +「管理分组」+「添加标的」
3. 表列：代码 · 名称 · 日/周/月 · 现价 · 网格状态 · 盈亏 · 分组 · 今日笔记 · 操作
4. 行数据：`poolCodes` + `recordByCode`；无网格则状态「未挂网格」、盈亏「—」、无「移出池」按钮（仅「清除分组」可选）
5. 仅 watchlist：操作含「移除」→ `removeWatch` + `pushMeta`
6. 写笔记：dialog/drawer，日期默认 `marketToday()`，字段按 spec 枚举；保存 → `upsertDailyNote` + `pushMeta`
7. 编辑分组：checkbox → `setMemberships` + `pushMeta`
8. 同步按钮：`syncAll` 后 `render()`（meta 已在 syncAll 内合并）
9. 报价：对池内 codes 调 `fetchQuotes` 填现价（有网格可用 `result.current`）
10. `blockCopy()` 与 saved 一致

关键行渲染伪代码（实现时写成完整模板字符串）：

```ts
const meta = readMeta();
const grid = readGridRecords();
const codes = filterByGroups(
  poolCodes(grid.map(r => r.row.code.trim()), meta.watchlist),
  meta.memberships,
  selectedGroupIds,
);
// for each code: record = recordByCode(code); note = meta.notes[noteKey(code, marketToday())]
```

- [ ] **Step 3: 本地手测**

Run: `npm --prefix notes-site run dev`（或根目录既有 notes 预览方式）  
打开 `/lab/etf-review/`（或构建后 `/note/lab/etf-review/`）：

- 空池可添加 6 位 code
- 若 localStorage 已有网格记录，应自动出现
- 写笔记、打分组、刷新后仍在
- 点同步不报错；网格列表页不应出现 meta 行

- [ ] **Step 4: Commit**

```bash
git add notes-site/src/pages/lab/etf-review/index.astro notes-site/src/lib/labs.ts
git commit -m "$(cat <<'EOF'
feat(etf-review): add ETF review hub page with notes and groups

EOF
)"
```

---

### Task 4: 降级旧页 + 主站导航

**Files:**
- Modify: `notes-site/src/pages/lab/grid-trading/saved.astro`
- Modify: `notes-site/src/pages/lab/grid-trading.astro`
- Modify: `notes-site/src/pages/lab/grid-trading/detail.astro`（返回文案：可改为「← 网格列表」，另可选加链到 ETF 复盘）
- Modify: `notes-site/src/pages/lab/grid-trading/minute.astro`（同步密钥提示可改为「ETF 复盘或网格列表」）
- Modify: `src/data/notesLinks.ts`
- Modify: `src/data/siteMap.ts`
- Modify: `src/data/siteMap.test.ts`

**Interfaces:**
- Produces: `ETF_REVIEW_PATH`；观察盘「复盘列表」→ 新页；旧 saved 标题「网格列表」

- [ ] **Step 1: notesLinks + siteMap**

```ts
// notesLinks.ts
export const ETF_REVIEW_PATH: string = NOTES_PATH
  ? `${NOTES_PATH}lab/etf-review/`
  : `${NOTES_ORIGIN}/note/lab/etf-review/`
// GRID_SAVED_PATH 保留；注释改为「网格列表」
```

`siteMap.ts` watch 组：

```ts
{ path: ETF_REVIEW_PATH, label: '复盘列表', desc: 'ETF 分组观察、每日复盘笔记；有网格的标的显示状态与盈亏' },
```

（可另加一条「网格列表」→ `GRID_SAVED_PATH`，或只改主入口、网格从 ETF 复盘页进入——**按 spec：主入口改指新页即可**；网格列表不强制进 siteMap。）

- [ ] **Step 2: 更新 siteMap.test.ts**

把期望路径中 `.../lab/grid-trading/saved` 作为「复盘列表」的断言改为 `.../lab/etf-review/`（注意有无尾斜杠与 `ETF_REVIEW_PATH` 一致）。  
若测试里还有绝对 URL 列表，同步替换。

- [ ] **Step 3: 跑主站测试**

Run: `npm test -- --run src/data/siteMap.test.ts`  
Expected: PASS

- [ ] **Step 4: 降级 saved.astro / 计算器入口文案**

- `saved.astro`：title/h1「网格列表」；lede 说明仅网格；actions 增加 `<a href={etfReviewUrl}>← ETF 复盘</a>`
- `grid-trading.astro`：主按钮「ETF 复盘」→ `lab/etf-review`；次按钮或文字链「网格列表」→ saved；加入成功提示改为「可在 ETF 复盘 / 网格列表查看」

- [ ] **Step 5: Commit**

```bash
git add notes-site/src/pages/lab/grid-trading/saved.astro \
  notes-site/src/pages/lab/grid-trading.astro \
  notes-site/src/pages/lab/grid-trading/detail.astro \
  notes-site/src/pages/lab/grid-trading/minute.astro \
  src/data/notesLinks.ts src/data/siteMap.ts src/data/siteMap.test.ts
git commit -m "$(cat <<'EOF'
feat(etf-review): point nav to new hub and demote grid saved list

EOF
)"
```

---

### Task 5: 回归与收尾

**Files:**
- 按需小修 Task 3–4 发现的问题
- 无新功能

- [ ] **Step 1: 跑相关测试**

Run:

```bash
npm test -- --run notes-site/src/lib/etf-review.test.ts src/data/siteMap.test.ts
```

Expected: PASS

- [ ] **Step 2: 手测清单（打勾）**

- [ ] ETF 复盘：添加非网格 ETF → 写今日笔记 → 打「重点观察」→ 刷新仍在
- [ ] 计算器加入复盘后，ETF 复盘池出现该 code 且显示网格状态
- [ ] 有网格行无「移出池」；仅 watchlist 可移除且网格记录仍在
- [ ] 同步云端后另一浏览器同 key 可见分组与笔记
- [ ] 网格列表无 meta 幽灵行；改参/删除仍正常
- [ ] 主站观察盘「复盘列表」跳到 `/note/lab/etf-review/`

- [ ] **Step 3: 最终 commit（仅当有修复时）**

```bash
git add -A
git commit -m "$(cat <<'EOF'
fix(etf-review): polish review hub after acceptance checks

EOF
)"
```

---

## Self-Review (plan vs spec)

| Spec 要求 | Task |
| --- | --- |
| 新路径 `/note/lab/etf-review/` | 3 |
| 旧页降级「网格列表」+ 回链 | 4 |
| 结构化笔记五字段 + 按日覆盖 | 1, 3 |
| 多标签分组 + 预置三组 | 1, 3 |
| 池 = 网格 ∪ watchlist | 1, 3 |
| 移除语义（有/无网格） | 1, 3 |
| 同 sync key、meta LWW、不进 readGridRecords | 2 |
| 表列减法 + review-analysis | 3 |
| 导航改指新页 | 4 |
| 单测 + 手测 | 1, 2, 5 |
| 不做导出/专表/自动生成笔记 | 遵守边界，无对应 task |
