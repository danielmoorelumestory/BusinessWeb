# ETF 复盘清单 seed + 操作栏外链 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把宽基、行业二级分类、其他 ETF 灌进 etf-review 系统分组，并在行操作增加「分析报告」「基金档案」。

**Architecture:** `etf-catalog-seed.ts` 从主站 json 构建清单；`ensureCatalogSeed` 在 `readMeta` 末尾幂等补组/补 watchlist/补 membership；UI 禁删系统组并渲染两个外链按钮。`/industry-etf` 不动。

**Tech Stack:** TypeScript、Vitest（根目录 `npm test`）、Astro notes-site、现有 `etf-review` meta / `latestInvestmentNote`。

**Spec:** `docs/superpowers/specs/2026-10-20-etf-review-catalog-seed-design.md`

## Global Constraints

- 系统组 id：`g-catalog-broad`、`g-catalog-{industryGroup.id}`、`g-catalog-other`；无 `g-catalog-industry` 总组。
- 债基 `bond-funds` 永不 seed。
- 已有 `membershipUpdatedAt[code]` → 不补该 code 的系统组 membership。
- `deletedWatchlist` 有效 tombstone → 不复活该 code。
- 清单 seed 不抬 `updatedAt` / `workspaceUpdatedAt`（保住 `SEED_TS` 与云端 LWW）；用户编辑仍 `touch`。
- `/industry-etf`、sitemap、D1 schema 零改动。

## File Structure

| 文件 | 职责 |
| --- | --- |
| `notes-site/src/lib/etf-catalog-seed.ts` | 清单定义、`ensureCatalogSeed`、`isCatalogGroupId`、`fundProfileUrl` |
| `notes-site/src/lib/etf-catalog-seed.test.ts` | seed 单测 |
| `notes-site/src/lib/etf-review.ts` | `readMeta` 接入 seed |
| `notes-site/src/lib/etf-review.test.ts` | 空库 / opt-out / 删除不复活 |
| `notes-site/src/pages/lab/etf-review/index.astro` | 操作栏外链；管理分组禁删系统组 |

---

### Task 1: `etf-catalog-seed` 模块

**Files:**
- Create: `notes-site/src/lib/etf-catalog-seed.ts`
- Create: `notes-site/src/lib/etf-catalog-seed.test.ts`

**Interfaces:**
- Produces:
  - `CATALOG_GROUP_IDS` / `isCatalogGroupId(id: string): boolean`
  - `type CatalogItem = { code: string; name: string; sourceUrl?: string }`
  - `type CatalogGroupDef = { id: string; name: string; order: number; items: CatalogItem[] }`
  - `buildCatalogGroups(): CatalogGroupDef[]`
  - `ensureCatalogSeed(meta: EtfReviewMeta): { meta: EtfReviewMeta; changed: boolean }`
  - `fundProfileUrl(code: string): string` — 清单 `sourceUrl` 优先，否则 eastmoney `jbgk_`

- [ ] **Step 1: 写失败测试**

```ts
// notes-site/src/lib/etf-catalog-seed.test.ts
import { describe, expect, it } from 'vitest';
import { defaultMeta } from './etf-review-meta';
import {
  buildCatalogGroups, ensureCatalogSeed, isCatalogGroupId, fundProfileUrl,
} from './etf-catalog-seed';
import industry from '../../../src/data/industryEtf.json';
import broad from '../../../src/data/broadEtf.json';

describe('etf-catalog-seed', () => {
  it('buildCatalogGroups: broad + each industry subgroup + other, no bond, no industry总组', () => {
    const groups = buildCatalogGroups();
    expect(groups.map(g => g.id)).toContain('g-catalog-broad');
    expect(groups.map(g => g.id)).not.toContain('g-catalog-industry');
    for (const g of industry as { id: string; name: string; items: unknown[] }[]) {
      expect(groups.some(x => x.id === `g-catalog-${g.id}` && x.name === g.name && x.items.length === g.items.length)).toBe(true);
    }
    expect(groups.find(g => g.id === 'g-catalog-broad')!.items).toHaveLength((broad as unknown[]).length);
    const other = groups.find(g => g.id === 'g-catalog-other')!;
    expect(other.items.map(i => i.code).sort()).toEqual(['511880', '512890', '513630', '518880']);
    expect(other.items.some(i => i.code === '000015')).toBe(false);
  });

  it('ensureCatalogSeed fills empty meta; respects membershipUpdatedAt and deletedWatchlist', () => {
    const empty = defaultMeta('2026-10-20T00:00:00.000Z');
    const { meta: filled, changed } = ensureCatalogSeed(empty);
    expect(changed).toBe(true);
    expect(filled.groups.filter(g => isCatalogGroupId(g.id))).toHaveLength(9);
    expect(filled.watchlist.some(w => w.code === '510300')).toBe(true);
    expect(filled.memberships['510300']).toContain('g-catalog-broad');
    expect(filled.membershipUpdatedAt?.['510300']).toBeUndefined();

    const opted = {
      ...filled,
      memberships: { ...filled.memberships, '588200': ['g-focus'] },
      membershipUpdatedAt: { '588200': '2026-10-20T12:00:00.000Z' },
    };
    const again = ensureCatalogSeed(opted);
    expect(again.meta.memberships['588200']).toEqual(['g-focus']);
    expect(again.meta.memberships['588200']).not.toContain('g-catalog-ETF-01_TMT科技');

    const removed = {
      ...filled,
      watchlist: filled.watchlist.filter(w => w.code !== '510300'),
      memberships: Object.fromEntries(Object.entries(filled.memberships).filter(([c]) => c !== '510300')),
      deletedWatchlist: { '510300': '2026-10-20T12:00:00.000Z' },
    };
    expect(ensureCatalogSeed(removed).meta.watchlist.some(w => w.code === '510300')).toBe(false);
  });

  it('fundProfileUrl prefers sourceUrl then eastmoney', () => {
    expect(fundProfileUrl('510300')).toMatch(/jbgk_510300/);
    expect(fundProfileUrl('512890')).toBe('https://fundf10.eastmoney.com/jbgk_512890.html');
  });

  it('noop when already seeded', () => {
    const { meta } = ensureCatalogSeed(defaultMeta('2026-10-20T00:00:00.000Z'));
    const second = ensureCatalogSeed(meta);
    expect(second.changed).toBe(false);
  });
});
```

- [ ] **Step 2: 跑测确认失败**

Run: `cd BusinessWeb && npm test -- notes-site/src/lib/etf-catalog-seed.test.ts`

Expected: FAIL（模块不存在）

- [ ] **Step 3: 实现 `etf-catalog-seed.ts`**

```ts
import broadRaw from '../../../src/data/broadEtf.json';
import industryRaw from '../../../src/data/industryEtf.json';
import strategyRaw from '../../../src/data/strategyAssetEtf.json';
import type { EtfReviewMeta, ReviewGroup } from './etf-review-meta';

export type CatalogItem = { code: string; name: string; sourceUrl?: string };
export type CatalogGroupDef = { id: string; name: string; order: number; items: CatalogItem[] };

const OTHER_IDS = new Set(['strategy-etf', 'commodity-etf', 'money-etf']);
const EASTMONEY = (code: string) => `https://fundf10.eastmoney.com/jbgk_${code}.html`;

export function buildCatalogGroups(): CatalogGroupDef[] {
  const broad = (broadRaw as { code: string; name: string; sourceUrl?: string }[]).map(i => ({
    code: i.code, name: i.name, sourceUrl: i.sourceUrl,
  }));
  const industry = (industryRaw as { id: string; name: string; items: { code: string; name: string }[] }[])
    .map((g, idx) => ({
      id: `g-catalog-${g.id}`,
      name: g.name,
      order: 11 + idx,
      items: g.items.map(i => ({ code: i.code, name: i.name })),
    }));
  const otherItems: CatalogItem[] = [];
  for (const g of strategyRaw as { id: string; items: CatalogItem[] }[]) {
    if (!OTHER_IDS.has(g.id)) continue;
    for (const i of g.items) otherItems.push({ code: i.code, name: i.name, sourceUrl: i.sourceUrl });
  }
  return [
    { id: 'g-catalog-broad', name: '宽基 ETF', order: 10, items: broad },
    ...industry,
    { id: 'g-catalog-other', name: '其他 ETF', order: 11 + industry.length, items: otherItems },
  ];
}

export function isCatalogGroupId(id: string): boolean {
  return id.startsWith('g-catalog-');
}

const sourceUrlByCode = () => {
  const map = new Map<string, string>();
  for (const g of buildCatalogGroups()) for (const i of g.items) if (i.sourceUrl) map.set(i.code, i.sourceUrl);
  return map;
};
let cachedUrls: Map<string, string> | null = null;

export function fundProfileUrl(code: string): string {
  cachedUrls ??= sourceUrlByCode();
  return cachedUrls.get(code.trim()) ?? EASTMONEY(code.trim());
}

export function ensureCatalogSeed(meta: EtfReviewMeta): { meta: EtfReviewMeta; changed: boolean } {
  const defs = buildCatalogGroups();
  const catalogIds = new Set(defs.map(d => d.id));
  let groups = [...meta.groups];
  let watchlist = [...meta.watchlist];
  const memberships = { ...meta.memberships };
  const deletedGroups = { ...meta.deletedGroups };
  let changed = false;
  const maxOrder = groups.reduce((m, g) => Math.max(m, g.order), -1);

  for (const [i, def] of defs.entries()) {
    const existing = groups.find(g => g.id === def.id);
    if (!existing) {
      groups.push({ id: def.id, name: def.name, order: def.order ?? maxOrder + 1 + i });
      if (deletedGroups[def.id]) delete deletedGroups[def.id];
      changed = true;
    }
  }

  const deletedWatch = meta.deletedWatchlist ?? {};
  const touched = meta.membershipUpdatedAt ?? {};

  for (const def of defs) {
    for (const item of def.items) {
      const code = item.code.trim();
      if (deletedWatch[code]) continue;
      if (!watchlist.some(w => w.code === code)) {
        watchlist.push({ code, name: item.name, addedAt: '1970-01-01T00:00:00.000Z' });
        changed = true;
      }
      if (touched[code]) continue;
      const ids = memberships[code] ?? [];
      if (!ids.includes(def.id)) {
        memberships[code] = [...ids, def.id];
        changed = true;
      }
    }
  }

  if (!changed) return { meta, changed: false };
  // 不在此处写 localStorage；由 readMeta 决定 write
  return {
    meta: {
      ...meta,
      groups,
      watchlist,
      memberships,
      deletedGroups: Object.keys(deletedGroups).length ? deletedGroups : meta.deletedGroups,
    },
    changed: true,
  };
}
```

注意：`changed` 时由 Task 2 的 `readMeta` 调用 `touch`/`writeMeta` 并抬时间戳；本函数本身不写盘。若只补组壳不碰 watchlist，仍算 changed。

- [ ] **Step 4: 跑测通过**

Run: `cd BusinessWeb && npm test -- notes-site/src/lib/etf-catalog-seed.test.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add notes-site/src/lib/etf-catalog-seed.ts notes-site/src/lib/etf-catalog-seed.test.ts
git commit -m "feat(etf-review): 清单分类 seed 模块"
```

---

### Task 2: `readMeta` 接入 seed

**Files:**
- Modify: `notes-site/src/lib/etf-review.ts`（`readMeta`）
- Modify: `notes-site/src/lib/etf-review.test.ts`

**Interfaces:**
- Consumes: `ensureCatalogSeed` from `./etf-catalog-seed`
- Produces: `readMeta()` 返回已 seed 的 meta；有变更则 `writeMeta` 并更新 `updatedAt`/`workspaceUpdatedAt`

- [ ] **Step 1: 扩展失败测试**

在 `etf-review.test.ts` 增加：

```ts
it('readMeta seeds catalog groups into empty workspace', () => {
  const meta = readMeta();
  expect(meta.groups.some(g => g.id === 'g-catalog-broad')).toBe(true);
  expect(meta.groups.some(g => g.id === 'g-catalog-ETF-01_TMT科技')).toBe(true);
  expect(meta.groups.some(g => g.id === 'g-catalog-other')).toBe(true);
  expect(meta.groups.some(g => g.id === 'g-catalog-industry')).toBe(false);
  expect(meta.watchlist.some(w => w.code === '510300')).toBe(true);
  expect(meta.memberships['510300']).toContain('g-catalog-broad');
});

it('readMeta does not revive removeWatch codes', () => {
  readMeta();
  removeWatch('510300');
  expect(readMeta().watchlist.some(w => w.code === '510300')).toBe(false);
});

it('readMeta skips catalog membership after setMemberships opt-out', () => {
  readMeta();
  setMemberships('588200', ['g-held']);
  expect(readMeta().memberships['588200']).toEqual(['g-held']);
});
```

- [ ] **Step 2: 跑测确认新测失败或旧行为不符**

Run: `cd BusinessWeb && npm test -- notes-site/src/lib/etf-review.test.ts`

- [ ] **Step 3: 改 `readMeta`**

```ts
import { ensureCatalogSeed } from './etf-catalog-seed';

export function readMeta(): EtfReviewMeta {
  const raw = readJson<unknown>(ETF_REVIEW_META_KEY, null);
  let base: EtfReviewMeta;
  if (isEtfReviewMeta(raw) && hasUsableGroups(raw)) {
    base = raw;
  } else {
    const defaults = defaultMeta(new Date().toISOString());
    base = isEtfReviewMeta(raw) ? { ...raw, groups: defaults.groups } : defaults;
    writeMeta(base);
  }
  const { meta, changed } = ensureCatalogSeed(base);
  if (changed) writeMeta(meta); // 不抬 updatedAt
  return meta;
}
```

- [ ] **Step 4: 全绿**

Run: `cd BusinessWeb && npm test -- notes-site/src/lib/etf-review.test.ts notes-site/src/lib/etf-catalog-seed.test.ts`

- [ ] **Step 5: Commit**

```bash
git add notes-site/src/lib/etf-review.ts notes-site/src/lib/etf-review.test.ts
git commit -m "feat(etf-review): readMeta 自动灌入清单分组"
```

---

### Task 3: 操作栏外链 + 管理分组禁删系统组

**Files:**
- Modify: `notes-site/src/pages/lab/etf-review/index.astro`

**Interfaces:**
- Consumes: `latestInvestmentNote`（经现有路径或直接 `../../../../src/utils/etfJudgment`）、`fundProfileUrl`、`isCatalogGroupId`

- [ ] **Step 1: `rowHtml` 操作栏插入两链**

在「编辑分组」与「网格详情」之间：

```js
import { latestInvestmentNote } from '../../../../src/utils/etfJudgment';
import { fundProfileUrl, isCatalogGroupId } from '../../../lib/etf-catalog-seed';

// inside rowHtml action-cell:
const analysis = latestInvestmentNote(code);
const reportLink = analysis
  ? `<a href="${attr(notesBase + encodeURIComponent(analysis.slug) + '/')}" target="_blank" rel="noopener">分析报告</a>`
  : '';
const profileLink = `<a href="${attr(fundProfileUrl(code))}" target="_blank" rel="noopener">基金档案</a>`;
// ...
<div class="row-actions">
  <button data-action="groups" type="button">编辑分组</button>
  ${reportLink}
  ${profileLink}
  <a href="...网格详情...">网格详情</a>
  <button class="danger" data-action="remove" type="button">移出标的</button>
</div>
```

- [ ] **Step 2: 管理分组 UI 禁删系统组**

`renderGroupsEditor`：系统组显示「清单」角标，无删除按钮；click handler 对 `isCatalogGroupId` 忽略 delete；submit 时若编辑结果丢掉系统组 id，从 `readMeta().groups` 强制合并回系统组（双保险）。

```js
groupsEditor.innerHTML = editingGroups.map((group, index) => {
  const catalog = isCatalogGroupId(group.id);
  const del = catalog ? '' : `<button class="danger" data-delete type="button">删除</button>`;
  const badge = catalog ? '<span class="catalog-badge">清单</span>' : '';
  return `<div class="group-edit-row" data-id="${attr(group.id)}">${badge}<input ...>${/* move buttons */}${del}</div>`;
}).join('');
```

加少量 CSS：`.catalog-badge { font-size:11px; color:#0369a1; margin-right:6px; }`

- [ ] **Step 3: 手测 / 构建**

Run: `cd BusinessWeb/notes-site && npm run build`（或开 dev 看 `/lab/etf-review/`）

验收：空库 12 组；510300 有分析报告+基金档案；系统组无删按钮。

- [ ] **Step 4: Commit**

```bash
git add notes-site/src/pages/lab/etf-review/index.astro
git commit -m "feat(etf-review): 操作栏分析报告/基金档案与清单组禁删"
```

---

## Self-Review

1. Spec coverage：系统组分法、seed 规则、操作栏、非目标、验收 → Task 1–3 覆盖；无 `/industry-etf` 改动。
2. Placeholder：无 TBD。
3. Types：`ensureCatalogSeed` 返回 `{ meta, changed }` 在 Task 1/2 一致；`isCatalogGroupId` / `fundProfileUrl` 在 Task 1/3 一致。
