---
name: dev-team
description: 用 Orca 组织可迁移的多执行器开发团队：一个 manager 入口协调 Codex、Claude、Kimi、Antigravity 和 OpenCode MiniMax M3，执行 Android、Web 前端、后端或全栈开发，并在额度不足时交接与替换执行器。用户提到 dev_team、开发团队、多 harness 协作或跨项目迁移这套开发流程时使用。
---

# dev_team

当前对话 agent 就是唯一 manager。用户只需给开发目标；manager 发现项目、拆任务、通过 **真实 Orca** 派工、处理问题、验收、整合并交付。岗位和 harness 分离，额度变化不改变任务职责。技能名用标准连字符 `dev-team`，团队也可称 `dev_team`。

## 开始

1. 读取项目适用的 AGENTS.md/CLAUDE.md、工作区状态及已有 `.dev-team/`。保留用户已有改动。确定 android / frontend / backend / fullstack；Android 客户端属于 android。
2. 首次使用运行 `node <本技能路径>/scripts/dev-team.mjs init --project <项目根目录>`，再 `doctor --models`。Node 20+；打 ZIP 另需 Python 3；没有 npm 依赖。初始化只安装项目技能/链接和配置，不改全局设置、根说明或权限。
3. 选定本会话 Orca 可执行文件，后续保持一致。加载版本匹配的 `orca skills get orca-cli --json` 和 `orca skills get orchestration --json`。环境使用其他可执行文件时按 [运行与迁移](references/operations.md) 解析；不要在 Linux 非 Orca 终端运行系统屏幕阅读器 `orca`。
4. 核对 `.dev-team/config.json` 的 paths/checks 候选，补充 `.dev-team/PROJECT.md`。读取 [通用规则](references/common.md) 和 [角色与边界](references/roles.md)，再按下表自动选场景，**不要加载无关平台文档**。
5. 用 `plan --workflow <类型> --goal <目标> --id <短名>` 生成任务卡。**计划是起点**：manager 在登记前补全具体文件、行为验收、共享文件 owner、必要联调任务，删去不受影响的端和无效依赖。小改动可以缩为实现与一次验收，无需固定凑齐所有角色。

用户示例：`$dev-team 为 Android 登录页增加验证码倒计时，并联调后端限流接口。` Claude Code 可用 `/dev-team`，Kimi 用 `/skill:dev-team`，其他 harness 可直接要求读取本文件。

| 任务场景 | 自动选读 | 平台流程差异 |
|---|---|---|
| Android / Kotlin / Compose / Views | [android.md](references/android.md) | 系统与生命周期需求 → 原生 UI/状态 → 模块实现 → JVM 检查 / 设备验证 |
| Web 页面、交互或组件 | [frontend.md](references/frontend.md) | 浏览器/响应式需求 → UI/交互状态/a11y → 实现 → 浏览器与视觉验收 |
| 接口、服务或数据库 | [backend.md](references/backend.md) | 业务/失败需求 → API 契约 → 数据与迁移设计 → 服务实现 → 接口/授权/迁移验收；无 UI 阶段 |
| 同时涉及服务端与客户端 | [fullstack.md](references/fullstack.md) | 只协调契约、各端并行、联调与端到端验收；worker 只再读自己负责的端 |

不能因为流程都有“实现/验收”就统一其需求、UI 和测试要求。manager 按任务内容选场景；不确定是否跨端时先查调用关系，再决定需读哪些文件。researcher 只读问题所需资料。

## 管理与执行

- 路由以配置为准：manager/架构/Android/后端优先 Codex，主要前端/设计/交叉审查优先 Claude；Kimi、AGY、OpenCode M3 参与辅助或替补。配置是团队默认分工，不宣称某模型必然更强。没有指定模型时继承用户默认；OpenCode M3 使用经该主机模型列表确认的完整 ID。
- `route --role <角色> [--avoid <上次实现的 harness>]` 给候选。review 优先不同 harness；仅一家有额度时新会话独立审查，注明独立性降低。不能因少了某一家而放弃整个流程。
- `register --id <短名>` 把计划登记为 Orca Run 与有依赖的 Tasks；`start --id <短名> --task <任务键>` 创建一轮原生 worker-start。启动全部独立可就绪任务后再等结果，最多 config.maxParallel 个。脚本**只负责首次派工**，失败重试与后续修复按原生 Orca recovery 流程处理。
- 执行者默认在当前 Orca 工作区的新会话中工作。写入范围不能重叠，共享文件单 owner；不同分支、相互干扰的构建/生成任务才用 Orca 独立 worktree，先加载 placement 文档。新 checkout 不包含未提交/未跟踪的技能和上下文，派工前须把这些材料显式复制到该 checkout 或提供可读路径。
- 任务授权覆盖范围内的可逆实现、修复、检查与文档。worker 只问 manager，manager 仅就真正缺失的信息或超出现有授权的动作问用户。不要把示例文章中的“每次修改正式文件先批准”移植为开发的额外审批。
- 用原生 `orchestration check --run <run_id> --wait --types "worker_done,escalation,question" --timeout-ms 30000 --json` 协调。处理整个 Delivery：回答问题、匹配 Task/Dispatch、验收真实 diff/报告/测试，再 reuse/release，最后 ack。超时继续检查，不代表失败。保持简短进度沟通。
- worker_done succeeded 只表示该执行阶段结束。manager 仍检查验收、未测项和问题；需要修复时派新 follow-up Task，再审查/验证。不要把审查发现问题却正常结束，误报成整个功能完成。
- 最终交付必须说明做了什么、验证证据和未验证项，原生任务均有明确结果，settled terminal 有归属决策，无 reclaimable 资源遗留。

## 额度与接力

安装成功、登录成功、模型可列出、有剩余额度是四件事；CLI 没有统一的剩余 token API，禁止编造。`doctor` 不调用收费模型；[故障与接力](references/recovery.md) 定义耗尽、429、登录失效、未知执行状态和 manager 更换的处理。

每个阶段更新 `.dev-team/runs/<id>/MANAGER.md` 与 worker 报告，保留 Task/Dispatch、终端/工作区、变更、实际命令、未完成项。额度不足先确认旧 attempt 已终止/结算，再在**同一 Task** 用原生 `--retry-of` 替换；不确定存活状态不能再开第二个编辑者。所有执行器都不可用时保存可恢复的未完成任务并报告，不能声称已完成。

## 复用与共享

完整操作、命令示例、跨项目安装、限制和来源在 [运行与迁移](references/operations.md)。`pack` 只包含技能实体，排除项目运行状态和凭据。下载 ZIP 后对目标项目执行一次 init，即可生成配置和相对链接。迁移时只带技能与人工维护的 PROJECT/config；**不能迁移活跃 Run/Dispatch 或 terminal handle 当作新机上的身份**。外部项目不需要当前网站、股票技能或其他全局技能。

本工具是由 manager 驱动的团队工作流；不是无人值守守护进程。Orca 原生 Run/Task/Dispatch 是运行状态权威，本地 state.json 保存回执和恢复索引，不能手动将它改成“完成”。
