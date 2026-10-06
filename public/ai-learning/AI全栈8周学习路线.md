# AI 全栈 8 周实战学习路线

> 目标：以一个真实产品为主线，补齐 Web 前端、用户系统、AI 产品工程和部署能力，最终独立开发并上线一个 AI SaaS。
>
> 核心原则：**20% 学习、80% 实践；每学一个知识点，当天就把它用进项目。**

## 目录

- [1. 适用基础与执行方式](#1-适用基础与执行方式)
- [2. 总目标与核心技术栈](#2-总目标与核心技术栈)
- [3. 最终项目](#3-最终项目ai-investment-research-workspace)
- [4. 八周路线总览](#4-八周路线总览)
- [5. Week 1：TypeScript 与 Web 基础](#5-week-1typescript-与-web-基础)
- [6. Week 2：React、Tailwind 与 UI 组件](#6-week-2reacttailwind-与-ui-组件)
- [7. Week 3：Next.js 应用开发](#7-week-3nextjs-应用开发)
- [8. Week 4：PostgreSQL、Supabase 与用户系统](#8-week-4postgresqlsupabase-与用户系统)
- [9. Week 5：FastAPI 与 AI 流式输出](#9-week-5fastapi-与-ai-流式输出)
- [10. Week 6：AI Application、RAG、MCP 与 Agent](#10-week-6ai-applicationragmcp-与-agent)
- [11. Week 7：SaaS 产品化与支付](#11-week-7saas-产品化与支付)
- [12. Week 8：部署与完整交付](#12-week-8部署与完整交付)
- [13. 暂时不要学的技术](#13-暂时不要学的技术)
- [14. 每日执行与最终验收](#14-每日执行与最终验收)

## 1. 适用基础与执行方式

本路线基于原对话中的已有基础：Android / Kotlin / Compose、Python / FastAPI，以及 RAG / Agent。无需重新系统学习编程，重点补齐 Web 世界与你熟悉的 Android 开发之间的差异。

不要按照“前端课程全部学完 → 后端课程全部学完 → AI 课程全部学完”推进。围绕一个持续迭代的项目，**产品需要什么，就学习什么**。

- **20% 时间学习**：阅读文档、理解关键概念、看必要的示例。
- **80% 时间实践**：实现功能、排查问题、验证效果、整理可复用代码。
- 不以“看完课程”为验收标准，以“功能能运行、自己能修改、能解释关键选择”为标准。
- 前一周的项目直接成为下一周的基础，不每周另起一个 Demo。
- 八周是执行框架，遇到阻碍可以调整节奏；优先完成每阶段验收，再进入下一阶段。

**整理说明**：Week 1–3 的每日主题沿用原对话；Week 4–8 原文只列了周主题，本文件在保留这些主题的基础上补充了 Day 22–56 的建议分配。原文未明确列出的阶段验收也补成了可检查的执行清单。

## 2. 总目标与核心技术栈

八周后，能够独立完成下面的产品交付链路：

```text
产品想法
   ↓
Figma / AI 辅助设计
   ↓
Next.js + React 前端
   ↓
FastAPI 后端
   ↓
PostgreSQL / Supabase
   ↓
LLM / RAG / MCP / Agent
   ↓
登录 / 权限 / 支付
   ↓
Docker / Vercel / Cloudflare
   ↓
正式域名上线
```

### 固定主干

**TypeScript + React + Next.js + Tailwind CSS / shadcn/ui + Python / FastAPI + PostgreSQL / Supabase + AI + Docker。**

至少未来一年围绕这套主干积累，不来回更换技术栈。

| 层次 | 技术 | 本路线的学习重点 |
| --- | --- | --- |
| Web 基础 | HTML、CSS、JavaScript | 网页结构、布局、异步请求 |
| 前端语言 | TypeScript | 类型、联合类型、泛型、异步返回值 |
| UI 与应用框架 | React、Next.js | 组件、状态、路由、服务端与客户端边界 |
| 样式与组件 | Tailwind CSS、shadcn/ui | 响应式布局、复用成熟组件 |
| 后端 | Python、FastAPI | API 分层、校验、鉴权衔接、流式输出 |
| 数据与身份 | PostgreSQL、Supabase | SQL、关系、Auth、RLS、持久化 |
| AI | LLM API、Structured Output、Tool Calling、RAG、MCP、Agent | 可运行的研究流程 |
| 工作流 | LangGraph | State、Node、Edge、Checkpoint、Human in the Loop |
| 商业化 | Stripe | Webhook、订阅、配额、使用量 |
| 部署 | Docker、Vercel、云服务器、Cloudflare | 前后端上线、域名、HTTPS、存储 |
| 工程 | Git、GitHub、GitHub Actions | 版本管理、基本 CI/CD |

原对话还提到 Redis、WebSocket、SQLAlchemy / Prisma、向量数据库及 Hybrid Search。这些是按需求补充的能力，不作为八周内全部深入学习的前置条件。主流程优先使用 REST / SSE，后端继续使用熟悉的 Python / FastAPI。

## 3. 最终项目：AI Investment Research Workspace

**产品定位**：一个可以持续保存和更新股票研究结果的 AI 投资研究工作空间。

```text
输入股票代码
   ↓
自动获取资料
   ↓
AI 分析公司
   ↓
财报分析 → 估值 → 投资逻辑 → 风险分析
   ↓
保存研究报告
   ↓
后续持续更新
```

### 核心功能

- 股票搜索、Watchlist、排序、涨跌显示与详情页。
- 注册、登录、Google Login、退出，以及用户之间的数据隔离。
- AI 分析的流式输出、取消、重试、错误提示与超时处理。
- 财务数据、新闻、财报等工具调用。
- 财报和研究文档检索，以及 Research Agent 生成报告。
- 研究报告保存、历史记录、研究会话与后续更新入口。
- Free / Pro 套餐、订阅、额度和使用量显示。
- 正式域名访问、日志和基本自动部署。

### 建议的数据对象

```text
users
watchlists
stocks
research_reports
conversations

User
 ├── Watchlist
 ├── Research Report
 └── Conversation
```

`users` 表示产品中的用户概念；实际接入 Supabase Auth 时，根据其身份系统设计用户资料关联，避免重复实现一套身份系统。

## 4. 八周路线总览

| 周次 | 阶段 | 每周交付物 |
| --- | --- | --- |
| Week 1 | Web 基础补齐 | 不接后端的股票 Watchlist 页面 |
| Week 2 | React | React Dashboard、可复用组件、数据请求 |
| Week 3 | Next.js | 多页面应用、动态股票详情路由 |
| Week 4 | 数据库与用户系统 | 用户登录、Watchlist 持久化、数据隔离 |
| Week 5 | Python AI Backend | FastAPI AI 接口与流式分析页面 |
| Week 6 | AI Application | 一个真正跑通的 Research Agent |
| Week 7 | SaaS 化 | 套餐、支付测试流程、配额与产品状态 |
| Week 8 | 部署 | 正式域名可访问的完整 AI SaaS |

## 5. Week 1：TypeScript 与 Web 基础

**目标**：补齐 Web 与 Android 开发的差异，建立 Kotlin → TypeScript 的思维映射。不要追求精通 CSS。

### Day 1：HTML

- 学习 DOM、`div` / `span`、`button` / `input`、`form`、`img`、`a`、`table` 和 semantic HTML。
- 实践：搭建股票列表、搜索框、按钮和详情区域的静态结构。
- 当日目标：能够看懂一个网页的 HTML 结构，无需背诵所有标签。

### Day 2：CSS

- 学习 Box Model、margin / padding、width / height、position。
- 优先学习 **Flexbox**，其次学习 **Grid**。
- 学习响应式基础：media query、`rem`、`vh` / `vw`。
- 实践：完成列表布局、卡片间距，以及手机与桌面两种宽度下的展示。

| Compose 概念 | Web 近似映射 |
| --- | --- |
| Row | flex-row |
| Column | flex-col |
| Modifier.padding | padding |
| Arrangement | justify-content |
| Alignment | align-items |

这些映射用于辅助理解，具体布局行为仍需通过实际页面验证。

### Day 3：JavaScript

- 学习 `const` / `let`、object、array、`map`、`filter`、`reduce`。
- 学习解构、spread operator、Promise、`async` / `await`、`fetch`。
- 实践：对模拟股票数据进行筛选、排序与展示。
- 聚焦与 Kotlin 的差异，不花时间系统学习 JS 老语法。

### Day 4–5：TypeScript

- 掌握 `interface`、`type`、union、generic、enum、optional、`Record`、`Promise<T>`。
- Day 4：为股票、列表和函数参数建立类型。
- Day 5：为搜索、排序、异步请求补充类型，并处理可选值。

```typescript
interface Stock {
  symbol: string;
  name: string;
  price: number;
}
```

### Day 6–7：股票 Watchlist 小项目

先不接后端，完成搜索框、股票列表、添加、删除、排序、涨跌显示和响应式布局。

- Day 6：完成主要交互与列表操作。
- Day 7：调整布局，检查所有功能并整理代码。

### 阶段验收

- [ ] 能看懂 HTML、CSS 和 TypeScript，并能独立修改页面。
- [ ] Watchlist 的添加、删除、搜索和排序可运行。
- [ ] 涨跌显示清晰，页面能适应手机和桌面宽度。

## 6. Week 2：React、Tailwind 与 UI 组件

**目标**：把静态页面改造成声明式 UI，复用 Compose 的组件和状态管理经验。这是前端能力建设的重点周。

### Day 8：Component

- 理解 React 函数组件、JSX 和组件参数。
- 实践：拆分 `StockCard`、搜索框和 Watchlist。
- 思维映射：React 的 `StockCard({ stock })` 对应 Compose 中接收 `stock` 参数的 `@Composable fun StockCard(...)`。

### Day 9：State

- 学习 `useState`、props、state、event。
- 对照理解 Compose 的 `remember`、`mutableStateOf`、参数和事件回调。
- 实践：用状态驱动添加、删除与筛选，避免手动修改 DOM。

### Day 10：副作用与生命周期相关概念

- 优先理解 `useEffect`，了解 `useMemo` 和 `useCallback`。
- 实践：处理请求等副作用，并理解清理逻辑。
- 不为学习 Hook 而给所有计算和回调添加缓存。

### Day 11：数据请求

- 学习 `fetch`、`async` / `await`、loading、error、retry。
- 实践：跑通“前端 → 股票 API → 数据展示”。
- 在页面中呈现加载、失败和重试状态。

### Day 12：Tailwind CSS

- 掌握 Flex、Grid、Spacing、Typography、Responsive、Dark Mode。
- 实践：把主要布局和卡片样式迁移到 Tailwind。
- CSS 基础用于理解问题，日常页面优先使用 Tailwind，不深入传统 CSS 的全部体系。

### Day 13：shadcn/ui

- 学会使用 Button、Card、Dialog、Table、Tabs、Input、Dropdown、Sidebar。
- 实践：替换项目中的常见控件。
- 原则：**能用成熟 UI Component，就不自己重新造一套。**

### Day 14：Dashboard 项目整合

```text
Dashboard
 ├── Sidebar
 ├── Search
 ├── Watchlist
 ├── StockCard
 ├── Chart
 └── Detail
```

### 阶段验收

- [ ] 能解释 Component、props、state 与事件回调的关系。
- [ ] Dashboard 使用 React 组件组织，列表随状态变化更新。
- [ ] 数据请求具备 loading、error 和 retry。
- [ ] 使用 Tailwind 与成熟组件完成响应式界面。

## 7. Week 3：Next.js 应用开发

**目标**：理解 React 是 UI Library，Next.js 是 Application Framework；把 Dashboard 变成可导航的 Web 应用。

### Day 15：App Router

- 学习 App Router、`page.tsx`、`layout.tsx`。
- 实践：创建应用入口和共用布局。

### Day 16：路由与 Dynamic Route

- 理解 `/`、`/stocks`、`/stocks/AAPL`、`/research`、`/settings` 的页面组织。
- 实践：建立 `/stocks/[symbol]` 动态路由，从列表进入对应股票详情。

### Day 17：Server Component 与 Client Component

- 理解两类组件的运行位置和职责。
- 掌握 `"use client"` 什么时候需要、什么时候不需要。
- 实践：划分数据展示与交互组件的边界。

### Day 18：服务端入口

- 学习 Server Action、Route Handler，以及 API Route 的概念。
- 实践：写一个应用需要的服务端入口，理解它与 FastAPI 后端的职责关系。

### Day 19：页面渲染方式

- 理解 SSR、SSG、CSR、ISR。
- 不背定义，重点判断页面应该在哪里运行、什么时候获取或更新数据。
- 实践：为 Dashboard 和股票详情页选择合适的数据获取与渲染方式。

### Day 20–21：迁移与整合

将项目迁移到 Next.js，完成以下页面：

```text
/dashboard
/stocks/[symbol]
/research
/settings
```

- Day 20：迁移布局、组件和路由。
- Day 21：验证页面导航、直接访问详情地址和交互。

### 阶段验收

- [ ] 能独立增加一个页面和一个动态路由。
- [ ] 能解释 Server / Client Component 的分工。
- [ ] 能判断交互逻辑与数据请求应该放在哪里。
- [ ] Dashboard、详情、研究、设置页面连通。

## 8. Week 4：PostgreSQL、Supabase 与用户系统

**目标**：让网站成为有用户、有持久化数据、有权限隔离的 Web App。

### Day 22：SQL 基础

- 学习 `SELECT`、`INSERT`、`UPDATE`、`DELETE`、`WHERE`、`ORDER BY`。
- 实践：对股票与 Watchlist 数据执行增删改查。

### Day 23：关系与数据库设计

- 学习 `JOIN`、Primary Key、Foreign Key、Transaction、Index。
- 设计 users、watchlists、stocks、research_reports、conversations 之间的关系。
- 理解必要的索引，不系统学习完整数据库理论课程。

### Day 24：Supabase 数据库与持久化

- 接入 Supabase Database。
- 把 Watchlist 从前端内存迁移到数据库。
- 验证刷新页面后数据仍然存在。

### Day 25：Auth

- 接入注册、登录、退出与 Google Login。
- 将用户会话与应用页面连接。

### Day 26：RLS 与权限

- 重点掌握 **RLS：Row Level Security**。
- 给用户私有数据建立访问规则。
- 用两个账号检查彼此的数据隔离，不能只靠前端隐藏内容。

### Day 27：Storage 与 Realtime

- 了解 Supabase Storage 和 Realtime 的职责。
- 根据项目需求练习资料存储和数据变化订阅；优先保证 Auth、Database、RLS 主流程稳定。

### Day 28：整合与验收

```text
用户注册 → 登录 → 添加股票 → 保存数据库 → 下次登录依然存在
```

### 阶段验收

- [ ] 用户可以注册、登录和退出。
- [ ] Watchlist 保存到数据库，重新登录后仍可读取。
- [ ] 用户只能访问自己有权限访问的数据。
- [ ] 能解释主键、外键、索引与 RLS 的作用。

## 9. Week 5：FastAPI 与 AI 流式输出

**目标**：利用已有 Python / FastAPI 基础，补齐 AI 产品中的 API 分层与流式交互。

```text
Next.js → FastAPI → Service → AI → Database
```

### Day 29：API Architecture

- 明确前端、接口、服务层、AI 调用和数据库的职责。
- 接通 Next.js 与 FastAPI 的研究请求。

### Day 30：校验与依赖管理

- 学习或巩固 Pydantic、Dependency Injection。
- 为研究请求和响应定义模型，处理股票代码等输入。
- 将用户身份传入需要权限控制的后端流程。

### Day 31：统一请求与异常处理

- 学习 Middleware、Exception Handler、CORS。
- 统一接口错误，让前端能显示可理解的失败原因。

### Day 32：后端 SSE

- 理解 StreamingResponse 与 SSE。
- 把 AI 输出改为流式返回，让用户看到分析逐步生成。

### Day 33：前端流式读取

- 理解 ReadableStream。
- 展示“正在分析 Apple…”以及持续追加的分析内容。
- 避免等待 AI 全部生成完才一次展示结果。

### Day 34：取消、重试与超时

- 加入 Cancel generation、Retry、Error handling、Timeout。
- 检查中途取消、网络错误和接口超时后的页面状态。

### Day 35：完整研究链路

- 整合用户输入、后端调用、流式输出和报告保存。
- 对成功、失败、取消与重试各走一遍完整流程。

### 阶段验收

- [ ] Next.js 可以调用 FastAPI 的 AI 研究接口。
- [ ] 用户可以逐步看到生成内容。
- [ ] 取消、重试、超时和错误状态有明确反馈。
- [ ] 完成的报告可以保存并重新打开。

## 10. Week 6：AI Application、RAG、MCP 与 Agent

**目标**：从“调用模型 API”进入“构建可运行的 AI 应用”。本周不以深入 Prompt Engineering 为主，也不重新研究 RAG 算法。

### Day 36：Structured Output

- 让 AI 返回可校验的结构化结果，而非永远只返回 Markdown。
- 用结构化字段驱动公司概览、估值与风险卡片。

```json
{
  "company": "Apple",
  "growth": 8.2,
  "valuation": "fair",
  "risk": "medium"
}
```

以上只是输出格式示例，不代表真实公司分析结果。

### Day 37：Tool Calling

- 理解模型选择工具、应用执行工具、结果返回模型的过程。
- 接入实际需要的工具：

```text
get_stock_price()
get_financials()
search_news()
get_earnings()
calculate_valuation()
```

### Day 38：RAG 数据与检索

- 将已有 RAG 能力应用到 10-K、10-Q、Earnings Call、Research Report。
- 完成文档处理、Chunk、Embedding 和 Vector Search。

### Day 39：RAG 回答整合

- 理解并应用 Rerank，将检索内容传入 LLM。
- 检查回答是否能关联到实际检索出的资料。

```text
10-K / 10-Q / Earnings Call / Research Report
   ↓
Chunk → Embedding → Vector Search → Rerank → LLM
```

### Day 40：MCP

- 理解 MCP 如何连接 AI 与外部工具、数据源。
- 当天接入一个真实工具，优先选择项目用得到的股票数据或文件工具。

```text
AI → MCP → Stock Data / Browser / Files / Database / GitHub / Notion
```

无需同时接入以上所有系统，重点是理解并完成一次真实集成。

### Day 41：Research Agent

建立单个 Agent 的研究流程：

```text
Research Agent
   ↓
Financial Data → News Search → 10-K → Valuation → Risk Analysis → Report
```

LangGraph 暂时只学 State、Node、Edge、Checkpoint、Human in the Loop。简单流程可以先用 Tool Calling；出现状态管理、人工确认、失败恢复或多步骤长任务的需求时，再把相关能力用进项目。

### Day 42：端到端验收

- 输入股票代码，运行研究流程并保存报告。
- 检查数据获取、工具调用、检索与报告生成是否连通。
- 不深入复杂 Multi-Agent，先让**一个 Agent 真正跑通**。

### 阶段验收

- [ ] 能校验和展示 Structured Output。
- [ ] 至少一个真实工具可以完成调用闭环。
- [ ] 财报等文档可以进入 RAG 并参与回答。
- [ ] 至少完成一个真实 MCP 工具集成。
- [ ] 单个 Research Agent 能生成并保存研究报告。

## 11. Week 7：SaaS 产品化与支付

**目标**：把 Demo 变成有账户、套餐、使用限制和完整界面状态的产品。

### Day 43：套餐与权益

- 定义 Free / Pro 的功能和额度。
- 原对话的示例额度如下，实际可根据产品成本调整：

| 套餐 | AI Research 次数 |
| --- | --- |
| Free | 5 次 / 月 |
| Pro | 100 次 / 月 |

### Day 44：Quota 与 Usage Tracking

- 记录用户使用量，实现额度检查。
- 将套餐权限与已登录用户关联，后端执行配额规则。

### Day 45：Stripe 与 Subscription

- 学习 Stripe、Subscription。
- 接通测试环境中的订阅购买流程。

### Day 46：Webhook

- 学习 Webhook，将支付和订阅状态同步到产品。
- 验证重复通知不会重复发放权益，账户状态与订阅结果一致。

### Day 47：用户产品页面

- 完善用户 Dashboard、历史记录、使用量、账户设置和套餐页面。
- 让用户知道自己研究过什么、还剩多少额度、当前属于哪个套餐。

### Day 48：界面状态

- 完善错误提示、Loading、Empty State。
- 覆盖没有股票、没有研究报告、额度不足和生成失败等实际场景。

### Day 49：产品流程验收

- 走通注册、研究、查看历史、使用额度和测试订阅流程。
- 检查订阅变更后权益与页面是否一致。

### 阶段验收

- [ ] Free / Pro 权益与额度规则可运行。
- [ ] 使用量可记录、可展示，超额时有明确提示。
- [ ] 测试订阅与 Webhook 可以同步账户权益。
- [ ] Dashboard、历史记录、账户设置与套餐页面可使用。
- [ ] Loading、Empty State 和错误提示覆盖主要流程。

**会调用 AI API，不等于会开发 AI 产品。** 本周的用户体验与商业化流程是完整产品的一部分。

## 12. Week 8：部署与完整交付

**目标**：完成独立开发闭环，让用户通过正式域名使用产品。

### 部署结构

```text
前端：Next.js → Vercel
后端：FastAPI → Docker → 云服务器 / 容器平台
数据库与身份：Supabase
对象存储：Cloudflare R2
域名：yourdomain.com → Cloudflare → Vercel
```

### Day 50：Docker

- 学习 Dockerfile、docker compose。
- 将 FastAPI 打包，在容器中启动并验证接口。

### Day 51：配置与 Secrets

- 理解 `.env`、环境变量、Secrets 与不同运行环境的配置。
- 整理前端、后端、数据库和 AI 服务需要的配置。
- 密钥放在服务端与平台的 Secrets 配置中，避免进入前端资源或版本库。

### Day 52：后端上线

- 部署 FastAPI 容器，连接 Supabase 和 AI 服务。
- 检查外部访问、CORS、日志和流式接口。

### Day 53：前端上线

- 将 Next.js 部署到 Vercel。
- 接入线上后端，验证登录、Watchlist、研究生成与历史报告。

### Day 54：域名、HTTPS 与存储

- 学习 Domain、DNS、HTTPS、CDN。
- 配置正式域名与 Cloudflare。
- 接入 Cloudflare R2，验证资料存储与访问权限。

### Day 55：CI/CD 与 Logging

- 学习 GitHub Actions 和最基本的 CI/CD。
- 建立提交后检查、构建与部署的流程。
- 查看应用日志，确保能定位一次失败的研究请求。

```text
git push → CI → Build → Deploy
```

### Day 56：线上完整验收

- 用一个新账号从正式域名走通完整用户流程。
- 检查移动端、流式输出、权限、配额、报告保存和订阅测试。
- 记录部署方式、必要配置和已知问题，整理可复用的项目模板。

### 阶段验收

- [ ] 正式域名可以通过 HTTPS 访问。
- [ ] 前端、后端、数据库与存储在部署环境中连通。
- [ ] 新用户可以注册、登录、添加股票、研究并保存报告。
- [ ] 部署后的 SSE 流式输出、取消与错误处理正常。
- [ ] 日志可用于定位问题，基本自动部署流程可运行。

## 13. 暂时不要学的技术

暂时不要系统学习：

- Angular、Vue。
- Node / Express / NestJS 后端体系。
- 复杂 CSS 动画、Webpack 底层。
- Kubernetes、微服务、复杂 AWS、复杂 DevOps。
- GraphQL。
- 自研 UI Component Library。
- 复杂 Multi-Agent 系统。

这些技术有价值，但对当前“一个人做 AI 产品 / 海外 SaaS / AI Agent”的目标，投入优先级较低。

同时避免：

- 重新从头学习已有的 FastAPI、RAG、Agent 基础。
- 先看完整套 React 课程再启动项目。
- 为学习框架而引入 LangGraph 或复杂工作流。
- 为达到“全栈”标签而再深入学习另一套后端技术。
- 在功能尚未跑通时追求精通 CSS 或复杂架构。

**固定核心栈，先完成产品，再根据实际需求扩展。**

## 14. 每日执行与最终验收

### 每日执行模板

```text
今天的目标：
需要理解的知识点（约 20% 时间）：
要放进项目的功能（约 80% 时间）：
实际完成结果：
如何验证：
遇到的问题与处理：
下一步：
```

原对话中的实践方式：

```text
今天学 useState → 今天项目里用 useState
今天学 Supabase → 今天把 Watchlist 存进去
今天学 SSE → 今天让 AI 流式输出
今天学 MCP → 今天接一个真实 Tool
```

### 八周最终验收清单

- [ ] 能独立维护 TypeScript / React / Next.js 前端。
- [ ] 能完成响应式页面、组件复用、路由和数据请求。
- [ ] 用户身份、数据库持久化与权限隔离正常。
- [ ] FastAPI 与前端连通，AI 输出可以流式展示。
- [ ] Structured Output、Tool Calling、RAG、MCP 已在项目中实际使用。
- [ ] 单个 Research Agent 能完成公司、财报、估值与风险研究并生成报告。
- [ ] 报告可以保存、查看历史并重新发起更新。
- [ ] 套餐、使用量、配额和测试支付流程完整。
- [ ] 正式域名上线，具备基本日志与 CI/CD。
- [ ] 已整理可重复使用的技术骨架与部署说明。

### 最终得到什么

1. 一个完整的 **AI Investment Research Workspace / AI SaaS**。
2. 一套可以反复复用的产品技术模板。
3. 从界面、后端、数据库、AI 到上线的完整交付能力。

以后开发投资 AI、SEO 工具、跨境电商工具、AI 图片 / 视频产品、个人知识库、Android 配套 Web 或订阅工具，都可以从这套骨架出发。

**换业务，不换技术栈；每学习一个东西，当天必须进入项目。**
