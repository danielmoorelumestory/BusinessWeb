# 开发上下文

本项目是 React 18 / TypeScript / Vite 5 的 Web 项目；后端包含 server/、api/ 和 supabase/。依据：package.json 与目录布局。包管理器 npm，项目声明 Node 24。

前端入口 src/，后端候选范围在 config.json。现有检查：npm run typecheck、npm run test、npm run test:knowledge、npm run test:valuation-server；只运行与实际变更相关的检查。npm run build 带 prebuild，会生成 changelog/sitemap，执行前核对已有改动。

这里没有 Android 工程，android.paths/checks 留空；迁移到 Android 仓库后从其 Gradle 模块、variant 与 CI 重新发现，不能沿用本项目命令。SDK、模拟器、真机目前未验证。

manager 开工后按实际目标补充业务入口、API 契约位置、验收和发布方式。范围内可逆开发可执行，外部发布动作遵循用户已有授权。技能本身独立于本项目业务。

`.dev-team/config.json` 的 paths/checks 是探测候选，派工前按任务核对。既有 AGENTS.md/CLAUDE.md 仍是项目约束来源。本文件不存账号、密钥或剩余额度。
