# Company Research Notes Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox syntax for tracking.

**Goal:** 公司笔记公开阅读，主人以 token 上传、新建、编辑云端 Markdown。

**Architecture:** 独立 Supabase 表与 API，复用云数据库连接和 Markdown 展示。笔记按 market/code 关联，版本比较在数据库原子执行。

**Tech Stack:** React / TypeScript / Vercel Functions / Supabase PostgreSQL / Vitest。

**Spec:** `docs/superpowers/specs/2026-10-09-company-research-notes-design.md`

## Global Constraints

- 私人知识库权限与 Obsidian 同步不变。
- 正文最多 1 MiB UTF-8，标题 1–200 字符，列表每页 50 条。
- 独立 `COMPANY_NOTES_WRITE_TOKEN`，至少 32 字符，仅服务端配置；浏览器凭据仅会话存储。
- 无 token 可读，每次写入服务端鉴权；保存即公开；不删除笔记。
- 本次在用户当前工作区完成，不自动提交、推送或发布；用户已要求实施，按当前会话执行。

## Review Focus

- 无效 token 与非 POST 请求必须拒绝写入。
- 中文字节超限、非法 UTF-8、空文件不能绕过限制。
- URL 切换与读请求竞争不能使其他公司的笔记被保存到当前公司。
- 冲突或网络失败必须保留编辑内容。
- 缺少写 token 不能阻断公开读取；Markdown 不执行脚本。

### Task 1: Cloud API and migration

**Files:** `api/company-notes.ts`, `server/company-notes.ts`, `src/features/company-notes/types.ts`, `src/features/company-notes/handler.test.ts`, `supabase/migrations/202610090001_company_notes.sql`.

**Interfaces:** metadata `{id,market,code,title,revision,createdAt,updatedAt}`, full note adds `content`; list returns `{items,hasMore}`. API actions list/note/unlock/create/update as in spec. SQL RPC create and update return a note JSON object or a conflict/missing status.

- [x] Write tests for public reads, token enforcement, malformed input, UTF-8 size, unknown actions/methods, conflict and missing record, missing configuration.
- [x] Run `npm test -- --run src/features/company-notes/handler.test.ts`, observe missing implementation failure.
- [x] Implement validation and API with injectable database boundary for tests; auth before database writes, bounded responses, same allowed CORS origins as knowledge API.
- [x] Add SQL migration with restricted table/RPC grants and atomic version updates; duplicate create does not overwrite.
- [x] Repeat handler tests and server type check.

### Task 2: Client and company notes page

**Files:** `src/features/company-notes/api.ts`, `api.test.ts`, `CompanyNotes.tsx`, `CompanyNotes.test.tsx`, `company-notes.css`.

**Interfaces:** `companyNotesApi.list(market,code,offset)`, `read(id)`, `unlock(token)`, `create(note,token)`, `update(note,token)`. Shared types from Task 1. UI route parameters market/code and query parameter note UUID.

- [x] Write tests for unauthenticated list/read, Bearer write headers, errors, file validation, unlocking, edit/save/reload, failed save retains draft, conflict, download and locking.
- [x] Run new tests to observe missing implementation failure.
- [x] Implement fetch client with timeout and no-store, token session helpers, strict UTF-8 upload, metadata validation.
- [x] Implement list pagination, read/edit preview, template, upload draft, explicit save, draft navigation warning, direct note link and download.
- [x] Use request generations and company checks to avoid stale responses and cross-company writes.
- [x] Run client/UI tests and a dedicated company-notes type check.

### Task 3: Integration and delivery

**Files:** `src/App.tsx`, `src/components/CandidatePool.tsx`, `src/pages/CompanyDetail.tsx`, `vite.config.js`, `tsconfig.company-notes.json`, `package.json`, `scripts/check-functions.mjs`, `docs/company-notes-cloud-setup.md`.

**Interfaces:** route `/research-notes/company/:market/:code/notes`; cloud API `/api/company-notes`; existing Vite server proxies remote API.

- [x] Add entry links, lazy page route and local proxy; extend type and native Function checks.
- [x] Verify existing candidate UI tests, private knowledge tests, full Vitest suite, `npm run typecheck`, `npm run test:functions`, `npm run build`.
- [x] Document migration, token setup, deployment, public visibility and manual cloud round-trip check.
- [x] Review diff for permission leaks, missing loading/error states, untracked generated files; report verified code versus deployment state accurately.

## Execution ledger

- User approved spec and requested implementation in this session; proceed inline without additional plan approval.
- Pre-flight: Task 1 types are consumed by Task 2; Task 2 exports page used by Task 3. Shared shape and routes agree with spec.

- Task 1: complete — 20 handler tests passed; migration prepared, remote database execution is a deployment step.
- Task 2: complete — client/file tests and 9 UI tests passed, including real BrowserRouter cancellation and create-conflict recovery.
- Task 3: complete — links/proxy/native function checks/type checks/build verified; deployment instructions delivered. No cloud migration, token configuration or publication executed.
- Review: independent review found proxy Origin and draft recovery/history defects; fixed with regression tests. Original private knowledge permissions unchanged.
- Verification limitations: cloud DB round-trip awaits migration and deployment; browser preview correctly reports API not yet deployed. Existing test scroll/navigation notices and bundle-size warnings remain.
- Final verification: 107 Vitest files / 682 tests passed; complete typecheck, native Function checks, production build and final company-notes typecheck passed.
