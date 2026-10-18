# Task 3 Report — ETF 复盘主页面

## 完成内容

- 新增 `notes-site/src/pages/lab/etf-review/index.astro`
  - Base 页面、同步面板、网格列表/计算器入口
  - 分组 chip 多选筛选（OR 语义）
  - ETF 池合并网格代码与手动观察代码
  - 日/周/月分析、实时报价、网格状态、盈亏、分组与今日笔记
  - 添加/移除纯观察标的
  - 每日结构化笔记（日期、情绪、结论、动作、风险、备注）
  - 行级分组编辑、清除分组
  - 分组新增、改名、删除、上下排序
  - 与网格共用同步密钥；修改后推送 meta；全量同步后重绘
  - 用户文本输出统一 HTML 转义；启用 `blockCopy()`
- 更新 `notes-site/src/lib/labs.ts`
  - 首项登记 ETF 复盘
  - 原复盘列表改名为“网格列表”并收窄描述

## 验证

- `npm --prefix notes-site run build`：通过，生成 `/lab/etf-review/index.html`
- `npm test -- --run`：126 个测试文件、860 个测试全部通过
- `git diff --check`：通过
- 启动 Astro dev server 后请求 `/lab/etf-review/`：HTTP 请求成功，页面包含“ETF 复盘”
- `astro check` 未执行：项目未安装 `@astrojs/check`，命令进入交互式安装提示；构建本身通过

## 已知限制

- 当前环境未进行真实浏览器点击测试，dialog、localStorage 持久化和远端同步交互基于构建、现有 API 与代码路径验证。
- 本任务按边界未修改旧网格页文案/回链；该部分属于后续 Task 4。

## Review 修复

- 分组管理拒绝保存空分组列表，并提示“至少保留一个分组。”
- `readMeta()` 遇到合法 meta 的空分组时仅恢复默认分组，保留观察池、笔记和成员关系；JSON 缺失或无效时才完整初始化。
- 补充 `SavedRecord` 类型导入。
- 新增空分组恢复时保留工作区数据的回归测试。
- `npm test -- --run notes-site/src/lib/etf-review.test.ts`：14 个测试全部通过。
- `npm --prefix notes-site run build`：通过。
