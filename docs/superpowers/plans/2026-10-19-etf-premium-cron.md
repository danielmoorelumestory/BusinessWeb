# ETF 溢价定时入库 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cron 抓腾讯 ETF 折溢价写入 D1，复盘页历史日期可从云端读到溢价。

**Architecture:** Worker `runSync` 末尾批量拉 `qt.gtimg.cn`，upsert 进 `etf_premiums`；新增 `GET /premium`；前端 `fetchCloudPremiums` + 复盘页本地 meta 优先、云端回退。

**Tech Stack:** Cloudflare Worker + D1、腾讯行情、Astro notes-site、Vitest。

**Spec:** `docs/superpowers/specs/2026-10-19-etf-premium-cron-design.md`

## Global Constraints

- 数据源仅腾讯 `qt.gtimg.cn`，字段口径同前端：`61===ETF`、77 折溢价%、78 参考净值。
- 表名 `etf_premiums`，主键 `(code, date)`，`date` 存 `YYYYMMDD`。
- 标的集 = `trackedCodes()`；失败不阻断分钟线/日 K。
- `GET /premium` 需 Bearer sync key；响应 `date` 为 `YYYY-MM-DD`。
- 复盘展示顺序：本地 `dailyPremiums` → 云端 `/premium` →「—」。
- 不回填上线前历史；不接付费数据源。

## File Structure

| 文件 | 职责 |
| --- | --- |
| `notes-site/workers/grid-trading-sync/schema.sql` | 建表 DDL |
| `notes-site/workers/grid-trading-sync/src/tencent-quote.ts` | GBK 报价解析 + 溢价行构造（纯函数，可测） |
| `notes-site/workers/grid-trading-sync/src/tencent-quote.test.ts` | 解析单测 |
| `notes-site/workers/grid-trading-sync/src/index.ts` | ensure 表、`syncPremiums`、挂 cron、`GET /premium` |
| `notes-site/src/lib/grid-trading.ts` | `fetchCloudPremiums` |
| `notes-site/src/lib/etf-review.ts` / page | 展示回退拉云端 |

---

### Task 1: 腾讯报价解析纯函数 + 表 DDL

**Files:**
- Create: `notes-site/workers/grid-trading-sync/src/tencent-quote.ts`
- Create: `notes-site/workers/grid-trading-sync/src/tencent-quote.test.ts`
- Modify: `notes-site/workers/grid-trading-sync/schema.sql`
- Modify: `vite.config.js`（若尚未 include workers 测试，加入 `notes-site/workers/**/*.test.ts`）

**Interfaces:**
- Produces:
  - `type PremiumRow = { code: string; date: string; premiumRate: number; referenceNav?: number; price: number }`（`date` = `YYYYMMDD`）
  - `parseTencentQuoteBody(bytes: ArrayBuffer): PremiumRow[]` — 只返回有有效 ETF 溢价的行；`premiumRate===0` 保留
  - `symbolOf(code: string): string` — 与网格一致：`^[569]` → `sh` 否则 `sz`

- [ ] **Step 1: 扩展 vitest include**（若需要）并写失败测试

```ts
// tencent-quote.test.ts
import { describe, expect, it } from 'vitest';
import { parseTencentQuoteBody } from './tencent-quote';

const line = (code: string, type: string, premium: string, nav: string, price = '0.513') => {
  const fields = Array<string>(88).fill('');
  Object.assign(fields, { 1: 'ETF', 3: price, 30: '20261019161458', 33: '0.514', 34: '0.510', 61: type, 77: premium, 78: nav });
  return `v_sh${code}="${fields.join('~')}";`;
};

describe('parseTencentQuoteBody', () => {
  it('keeps ETF premium including zero; skips empty premium and stocks', () => {
    const body = line('513180', 'ETF', '-0.14', '0.5137') + line('510300', 'ETF', '0', '0.513')
      + line('510500', 'ETF', '', '0.513') + line('600989', 'GP-A', '3', '20');
    const rows = parseTencentQuoteBody(new TextEncoder().encode(body).buffer);
    expect(rows).toEqual([
      { code: '513180', date: '20261019', premiumRate: -0.14, referenceNav: 0.5137, price: 0.513 },
      { code: '510300', date: '20261019', premiumRate: 0, referenceNav: 0.513, price: 0.513 },
    ]);
  });
});
```

- [ ] **Step 2: Run fail**

Run: `npm test -- --run notes-site/workers/grid-trading-sync/src/tencent-quote.test.ts`  
Expected: FAIL module missing

- [ ] **Step 3: Implement parse + schema**

`tencent-quote.ts`：用 `TextDecoder('gbk')` 解码；正则同前端 `v_(?:sh|sz)(\d{6})="([^"]*)"`；规则同 `fetchQuotes` 溢价分支。

`schema.sql` 追加：

```sql
CREATE TABLE IF NOT EXISTS etf_premiums (
  code TEXT NOT NULL,
  date TEXT NOT NULL,
  premium_rate REAL NOT NULL,
  reference_nav REAL,
  price REAL,
  fetched_at INTEGER NOT NULL,
  PRIMARY KEY (code, date)
) WITHOUT ROWID;
```

- [ ] **Step 4: Tests pass + commit**

```bash
git add notes-site/workers/grid-trading-sync/src/tencent-quote.ts \
  notes-site/workers/grid-trading-sync/src/tencent-quote.test.ts \
  notes-site/workers/grid-trading-sync/schema.sql vite.config.js
git commit -m "$(cat <<'EOF'
feat(premium): add Tencent quote parser and etf_premiums schema

EOF
)"
```

---

### Task 2: Worker syncPremiums + GET /premium + cron 挂载

**Files:**
- Modify: `notes-site/workers/grid-trading-sync/src/index.ts`

**Interfaces:**
- Consumes: `parseTencentQuoteBody`, `symbolOf`, `trackedCodes`
- Produces:
  - `ensureEtfPremiumsTable(env)`
  - `syncPremiums(env, codes: string[]): Promise<{ ok: number; skipped: number; failed: number }>`
  - `readPremiums(env, url): Response` — `GET /premium?codes=&from=&to=`
  - `runSync` 末尾调用 `syncPremiums`（try/catch 隔离）

- [ ] **Step 1: 实现 ensure + syncPremiums**

```ts
async function ensureEtfPremiumsTable(env: Env) {
  await env.DB.prepare(`CREATE TABLE IF NOT EXISTS etf_premiums (
    code TEXT NOT NULL, date TEXT NOT NULL, premium_rate REAL NOT NULL,
    reference_nav REAL, price REAL, fetched_at INTEGER NOT NULL,
    PRIMARY KEY (code, date)
  ) WITHOUT ROWID`).run();
}

async function syncPremiums(env: Env, codes: string[]) {
  await ensureEtfPremiumsTable(env);
  const unique = [...new Set(codes.filter(c => /^\d{6}$/.test(c)))];
  let ok = 0, skipped = unique.length, failed = 0;
  const fetchedAt = Date.now();
  // 每批最多 40 个 code，控制子请求
  for (let i = 0; i < unique.length; i += 40) {
    const batch = unique.slice(i, i + 40);
    try {
      const response = await fetch(`https://qt.gtimg.cn/q=${batch.map(symbolOf).join(',')}`);
      if (!response.ok) { failed += batch.length; continue; }
      const rows = parseTencentQuoteBody(await response.arrayBuffer());
      for (const row of rows) {
        await env.DB.prepare(
          `INSERT INTO etf_premiums (code, date, premium_rate, reference_nav, price, fetched_at)
           VALUES (?, ?, ?, ?, ?, ?)
           ON CONFLICT (code, date) DO UPDATE SET
             premium_rate = excluded.premium_rate,
             reference_nav = excluded.reference_nav,
             price = excluded.price,
             fetched_at = excluded.fetched_at`,
        ).bind(row.code, row.date, row.premiumRate, row.referenceNav ?? null, row.price, fetchedAt).run();
        ok++;
      }
    } catch (error) {
      failed += batch.length;
      console.error('溢价抓取失败', error);
    }
  }
  skipped = unique.length - ok; // 或按「无溢价字段」语义调整日志即可
  return { ok, skipped, failed };
}
```

在 `runSync` return 前：

```ts
try {
  const premium = await syncPremiums(env, codes);
  console.log('ETF 溢价同步', premium);
} catch (error) {
  console.error('ETF 溢价同步异常', error);
}
```

- [ ] **Step 2: 实现 readPremiums + 路由**

```ts
async function readPremiums(env: Env, url: URL) {
  await ensureEtfPremiumsTable(env);
  const codes = [...new Set((url.searchParams.get('codes') ?? '').split(',')
    .map(c => c.trim()).filter(c => /^\d{6}$/.test(c)))].slice(0, 50);
  if (!codes.length) return json({ premiums: [] });
  const from = (url.searchParams.get('from') ?? '').replace(/\D/g, '') || '00000000';
  const to = (url.searchParams.get('to') ?? '').replace(/\D/g, '') || '99999999';
  const dateText = "substr(date, 1, 4) || '-' || substr(date, 5, 2) || '-' || substr(date, 7, 2)";
  const { results } = await env.DB.prepare(
    `SELECT code, ${dateText} AS date, premium_rate AS premiumRate, reference_nav AS referenceNav, price
     FROM etf_premiums WHERE code IN (${codes.map(() => '?').join(',')})
       AND date >= ? AND date <= ? ORDER BY code, date`,
  ).bind(...codes, from, to).all();
  return json({ premiums: results });
}
```

在 `fetch` 鉴权分支中、`/daily` 旁：

```ts
if (request.method === 'GET' && url.pathname === '/premium') return readPremiums(env, url);
```

- [ ] **Step 3: 本地/部署说明**

实现后需 `wrangler deploy`（或项目既有流程）才生效；本 task 只改代码。若仓库有 `wrangler d1 execute` 迁移习惯，可再执行 schema（`CREATE IF NOT EXISTS` 已在 ensure 里兜底）。

- [ ] **Step 4: Commit**

```bash
git add notes-site/workers/grid-trading-sync/src/index.ts
git commit -m "$(cat <<'EOF'
feat(premium): cron sync ETF premiums to D1 and expose GET /premium

EOF
)"
```

---

### Task 3: 前端 fetchCloudPremiums + 复盘页回退

**Files:**
- Modify: `notes-site/src/lib/grid-trading.ts`（或 `etf-review.ts` 若更合适放 REST）
- Modify: `notes-site/src/pages/lab/etf-review/index.astro`
- Create/Modify test: `notes-site/src/lib/etf-review.test.ts` 或新 `cloud-premium.test.ts`（mock fetch）

**Interfaces:**
- Produces:
  - `fetchCloudPremiums(codes: string[], from: string, to?: string): Promise<Map<string, { rate: number; referenceNav?: number; quoteDate: string }>>`  
    key = `${code}|${YYYY-MM-DD}`（与 `noteKey` 一致）
  - 页面：`premiumOf(code, date)` = 本地 meta → cloud cache map → undefined

- [ ] **Step 1: 写 fetchCloudPremiums 失败测试（mock fetch）**

```ts
it('fetchCloudPremiums maps cloud rows by noteKey', async () => {
  localStorage.setItem(SYNC_KEY_STORAGE, 'x'.repeat(16));
  vi.stubGlobal('fetch', vi.fn(async () => ({
    ok: true,
    json: async () => ({ premiums: [
      { code: '513180', date: '2026-10-17', premiumRate: -0.2, referenceNav: 0.5, price: 0.499 },
    ] }),
  })));
  const map = await fetchCloudPremiums(['513180'], '2026-10-01');
  expect(map.get('513180|2026-10-17')?.rate).toBe(-0.2);
});
```

- [ ] **Step 2: 实现 fetchCloudPremiums**

无 key / 失败 → 空 Map；`Authorization: Bearer`；URL `${SYNC_ENDPOINT}/premium?codes=...&from=...`。

- [ ] **Step 3: 改 etf-review 页面**

- 模块级 `cloudPremiums = new Map<...>()`
- `async function loadCloudPremiums()`：对池内 codes，`from` = 可见笔记日期最早与「今天往前 30 天」取较早者；合并进 `cloudPremiums`；`render()`
- `premiumLookup(code, date)`：`readMeta().dailyPremiums?.[key] ?? cloudPremiums.get(key)`
- `renderNotePremium` / 表格溢价列改用 `premiumLookup`
- 在 `render()` / `updateQuotes()` 后 `void loadCloudPremiums()`（避免每次 render 打爆：用 in-flight / 已加载 range 去重）

- [ ] **Step 4: 测试 + rebuild notes 手测提示 + commit**

```bash
npm test -- --run notes-site/workers/grid-trading-sync/src/tencent-quote.test.ts notes-site/src/lib/etf-review.test.ts
# 以及新增的 cloud premium 测试文件
git add notes-site/src/lib/grid-trading.ts notes-site/src/pages/lab/etf-review/index.astro notes-site/src/lib/*.test.ts
git commit -m "$(cat <<'EOF'
feat(premium): load historical ETF premiums from cloud into review UI

EOF
)"
```

---

### Task 4: 部署与验收清单

**Files:** 无代码或仅文档备注

- [ ] **Step 1:** 按仓库习惯 deploy Worker（`cd notes-site/workers/grid-trading-sync && npx wrangler deploy`），确认 `/premium` 401→有 key 200
- [ ] **Step 2:** 手测 — cron 后或手动触发 `runSync` 后 D1 有行；复盘页翻到该日显示溢价；无 key 时仍可用本地今日溢价
- [ ] **Step 3:** 若有修复再 commit；否则无需空 commit

---

## Self-Review (plan vs spec)

| Spec | Task |
| --- | --- |
| `etf_premiums` 表 | 1 |
| Cron 腾讯批量 + upsert | 2 |
| 失败不阻断分钟/日K | 2 |
| `GET /premium` | 2 |
| 复盘本地→云端→— | 3 |
| 保留 captureDailyPremiums | 3（不删） |
| 不回填上线前 | 遵守 |
