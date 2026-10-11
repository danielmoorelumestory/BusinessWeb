## Why

各只 ETF/个股的分析笔记（`/notes/<代码>-…-analysis`）里，「结论速览」表给出了短期（1–5 日）和中期（数周）的最终判断，但这些结论只在笔记正文里，看「已保存标的」列表时没法一眼对照每只标的的当前研判。需要把结论存进数据库，并在已保存标的页直接显示。

## What Changes

- 云端 D1 新增一张表 `note_analysis`，按标的代码保存：对应笔记的 slug、标题、数据基准日、短期最终判断、中期最终判断。
- 新增解析与入库脚本：读取 `public/notes/*-analysis.md` 的「结论速览」表，取出「短期」「中期」两行的「最终判断」（去掉粗体等 Markdown 标记），生成 upsert 语句写入 D1；支持先预览（dry-run）再写入，笔记更新后可重复运行。
- Worker 新增只读接口 `GET /analysis?codes=…`（需要同步密钥，与其他读取接口一致），返回所请求代码的判断。
- 已保存标的页在「名称」后新增两列「短期判断」「中期判断」：显示判断文字，鼠标悬停显示数据基准日，点击可打开对应笔记；没有对应笔记的标的显示「—」。
- 判断内容是笔记的派生数据，不放进用户的回测记录里，因此不会和记录的编辑、同步产生冲突。

## Capabilities

### New Capabilities
- `note-analysis-store`: 笔记结论的解析、入库与读取接口。
- `saved-analysis-columns`: 已保存标的页显示短期、中期判断两列。

### Modified Capabilities

（无。）

## Impact

- 新增 `scripts/` 下的解析模块、入库脚本与测试，`package.json` 增加运行命令。
- `notes-site/workers/grid-trading-sync`：`schema.sql` 增加表，`src/index.ts` 增加 `GET /analysis`；需要用 `wrangler deploy` 重新部署 Worker，并对线上 D1 建表、入库。
- `notes-site/src/lib/grid-trading.ts` 增加读取函数；`notes-site/src/pages/lab/grid-trading/saved.astro` 增加两列与样式。
- 不改动现有回测记录、同步协议与其他接口。
