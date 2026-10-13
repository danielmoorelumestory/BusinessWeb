# 安装、运行与迁移

## 快速开始

依赖：Node.js 20+、正在运行且支持 orchestration 的 Orca，至少一个已登录、有额度的 coding harness。ZIP 打包需要 Python 3，其余命令无 npm 依赖。本技能不会统一代理各家的 API，也不读取账号密钥。

在项目根目录：

```sh
node .agents/skills/dev-team/scripts/dev-team.mjs init --project .
node .agents/skills/dev-team/scripts/dev-team.mjs doctor --models
```

然后对当前 agent 说：

```text
$dev-team 开发一个订单列表，包含 Web 前端、后端分页接口与权限校验。
```

本对话是 manager；执行会话由 Orca 按需启动。无需每次打开五家工具常驻。Claude Code `/dev-team`、Kimi `/skill:dev-team`；菜单未刷新时开新会话，或直接指定 SKILL.md 路径读取。

初始化探测 `src/`、`server/`、`api/`、`supabase/` 与 Android module manifest，保存**候选路径**。Monorepo、非 JS 后端、自定义 Android 模块务必修改 config.paths/checks。空路径禁止派工；不要把目标项目中未受影响的端加入 fullstack 计划。检查命令来自清单，但 build 可能有 prebuild 副作用，manager 核对后再运行。

## manager 的一次完整工作

```sh
node .agents/skills/dev-team/scripts/dev-team.mjs plan --workflow fullstack --goal "订单列表、后端分页与权限校验" --id orders
```

此时编辑 `.dev-team/runs/orders/tasks/*.md`：补全端点/字段/状态、具体模块、验收、共享文件 owner。模板 contract 阶段默认代码只读，产出报告内的契约；正式 schema 文件的提交需要 manager 指定 owner（自己或一个单独写入 Task）。如需更细的分工，可在 register **之前**编辑 state.json.tasks（key/role/deps/access/scope/title）并创建对应 tasks/<key>.md；保持 key 唯一、依赖拓扑顺序、无循环。register 后的 Task spec 已固定，修改文件不自动改变原生 Task，后续用原生 follow-up 或新 Task。

```sh
node .agents/skills/dev-team/scripts/dev-team.mjs register --id orders
node .agents/skills/dev-team/scripts/dev-team.mjs start --id orders --task contract
node .agents/skills/dev-team/scripts/dev-team.mjs status --id orders
```

登记/启动回执都保存在 state.json。`--dry-run` 可在 start 时查看拟执行 argv；它仍读取真实状态，不创建 Dispatch。所有参数直接传进子进程，不通过 shell 拼接用户目标。

manager 按当前 Orca 版本操作（将下列 `orca` 换为选定的可执行文件；尖括号从真实回执取得）：

```sh
orca orchestration check --run <run_id> --wait --types "worker_done,escalation,question" --timeout-ms 30000 --json
orca orchestration reply --id <question_message_id> --body "具体答复" --json
orca orchestration worker-release --dispatch <settled_dispatch_id> --json
orca orchestration check --run <run_id> --ack <delivery_id> --json
```

收到 contract 的真实报告后核对，再启动 ready 的 backend/frontend/android；无依赖项先全启动再等待。共享写入/生成目录重叠则串行，默认 maxParallel=3。每项完成处理报告、真实 diff、后续修复决定和终端归属，再 ack；不能 ack 掉没处理的消息。需要 follow-up 的同一个已结算执行者可原生 `worker-start --task <new_task> --terminal <proven_handle> --worktree <明确位置>` 复用，禁止同时传 agent/model。

使用 `route --role reviewer --avoid <implementation_harness>` 优先跨 harness 审查。模板的 review 正常完成可能报告缺陷；manager 必须派修复/重新验证，不能把阶段完成当作交付。Android 计划有 requirements/ui-design/android/android-tests/device-check；Web 有 requirements/ui-design/frontend/browser-check；后端有 contract/data-design/backend/api-tests；全栈有 contract、各端实现、integration/review/e2e。每类的需求、设计与测试要求都不同，平台文档按需加载。

一个 coordinator 同时只绑定一个 Run；需要回到已有 Run 时先 `orca orchestration run-use --id <run_id> --json`，再消费 check/reply/release，不能仅加 `--run` 就宣称已经绑定。不要在未记录交接点时新建 Run 覆盖管理者当前绑定。helper 在 mutation 前用精确项目 path 查询 Orca workspace，未注册的目标目录会在派工前拒绝；先在 Orca 打开或按 placement 文档注册该项目。

## OpenCode M3 的兼容启动

一些 OpenCode TUI（本机核对版本为 1.18.35）支持 CLI `--model`，但 Orca 无法核实其原生 launch override；此时 worker-start --model 会 preflight 拒绝。默认配置的 `opencode-m3.launchMode` 因此为 `terminal`，由 manager 自动执行这条官方支持的路径：

1. 读取版本匹配的 `orca skills get orchestration --reference references/low-level-topology.md --json` 与 `opencode --help`，确认 CLI 支持模型参数；`opencode models` 确认完整 ID。
2. 用 `orca terminal create --worktree <精确项目选择器> --title "dev-team M3" --command "opencode --model minimax-cn/MiniMax-M3" --json` 新建一个专用终端。此 command 仅使用经核对的固定命令/模型；自定义路径/参数须按该主机 shell 正确引用，禁止拼入用户目标。
3. 保存返回的唯一 handle；wait tui-idle，read 确认模型 M3 与没有登录/升级/权限弹窗。wait satisfied 本身不能证明弹窗已关闭；升级提示选择跳过，不安装更新。未知启动结果只检查原终端，不重复创建。
4. `node .agents/skills/dev-team/scripts/dev-team.mjs start --id <plan> --task <key> --harness opencode-m3 --terminal <handle>`：helper 核对终端 agent、workspace、就绪与模型屏幕证据，再用原生 worker-start --terminal 获得当前 Task/Dispatch。模型不再与 --terminal 同传。
5. 按原生 lifecycle 处理报告及 release。预先创建的 terminal 可能被 Orca 保留为 pre_existing/user_owned，不要为此强关用户已接管的会话。手动创建终端尚未派工就失败时，manager 记录并决定该终端归属，不能遗忘。

脚本不会自动把 M3 换成 OpenCode 默认模型。新版本若已经支持原生 override，可将 launchMode 改为 native；仍以 requested/effective 回执和真实模型证据为准。只有确证 preflight 拒绝且没有 Dispatch/残留资源时，才可把该本地 start 操作归档为 rejected-before-dispatch 并尝试兼容路径；未知失败继续按 recovery 处理。

最后检查：

```sh
orca orchestration worker-list --run <run_id> --terminal-state reclaimable --json
```

没有待回收资源，再向用户交付结果、验证、未测项。`status` 不消费 inbox，不会自己验收/release；超过 100 workers 时按 Orca page.nextCursor 分页。helper 默认只管理本机当前工作区首次启动，remote/worktree/retry/接管等由 manager 按版本匹配的原生指南完成。

## 配置与运行文件

```text
.agents/skills/dev-team/          技能唯一实体，适合进 Git/打 ZIP
.claude/skills/dev-team           相对链接到该实体
.opencode/skills/dev-team         相对链接到该实体
.dev-team/config.json            项目路径、检查命令、角色路由、并行数（适合共享）
.dev-team/PROJECT.md              人工维护的项目事实与约束（适合共享）
.dev-team/local/availability.json 本机额度/登录观察；忽略 Git
.dev-team/runs/<id>/              任务卡、报告、MANAGER.md、操作回执；默认忽略 Git
```

实体不复制五份；Codex/Kimi/AGY 读 `.agents/skills`，Claude 读 `.claude/skills`，OpenCode 原生/兼容目录都指向同一份。Windows junction 记录绝对路径，搬家后重建链接；链接创建受限时手动复制技能到 provider 目录，并自行同步更新。脚本不会替换已有的其他 skill、根 AGENTS.md/CLAUDE.md、权限或登录配置。

选定 Orca CLI：优先 ORCA_CLI_COMMAND，其次 dev 会话 ORCA_DEV_REPO_ROOT→orca-dev；Linux 非 Orca 终端用 orca-ide；其余用 orca。选中的文件失败时报告原错误，不换另一套 runtime。Windows 要让 Node 能直接执行选定命令，脚本不通过 shell 执行 .cmd 内容；若只有 .cmd shim，用原生 Orca 命令协调，或配置真正可执行的 launcher。

## 迁移到另一个项目

已有技能实体时，只需：

```sh
node /path/to/dev-team/scripts/dev-team.mjs init --project /path/to/other-project
```

命令复制完整实体、建立相对链接，并从目标项目重新发现路径。已有目标技能不覆盖，升级时先比较并由用户选择合并/替换。重复初始化时从**目标项目已安装的脚本**执行 init，可保留配置；从外部源脚本再次向已有目标安装会拒绝覆盖。Kimi 的自动发现依赖最近 Git 根；普通非 Git folder 用明确 SKILL.md 路径读取，或 CLI 支持的 --skills-dir，而不要保证自动发现。

对外发包：

```sh
node .agents/skills/dev-team/scripts/dev-team.mjs pack --output /tmp/dev-team.zip
```

ZIP 顶层是 dev-team/。他人解压后运行 `node /解压位置/dev-team/scripts/dev-team.mjs init --project /目标项目`。包里只有技能，不带本项目名称、绝对路径、任务对话、凭据或活跃 Orca 身份；项目配置由接收者新生成。在公开链接发布或上传 Orca skills 前核对包内容并遵守 Orca publishing 权限，用户只是要求可分享文件时交付本地 ZIP 即可。

## 验证与资料

运行 `node --test .agents/skills/dev-team/scripts/dev-team.test.mjs` 测试迁移、路由和首次派工保护；不调用付费模型。实际 harness 可用性需要真实 Orca worker 的回执与报告，不由单测保证。Android 工程的 SDK/模拟器与后端数据库由目标项目决定。

参考（2026-10-11 核对）：

- [用户给定的 Herdr 示例](https://xiangyugongzuoliu.com/41-herdr-ai-company/)：借鉴单入口、岗位与任务产物的结构，本文为开发场景重新实现。
- Orca 安装版的 `skills get orca-cli`、`skills get orchestration` 与命令 `--help`：运行时语义与生命周期以本机版本为准。
- [Claude Code skills](https://code.claude.com/docs/en/skills)、[Kimi Code skills](https://moonshotai.github.io/kimi-code/en/customization/skills.html)、[Antigravity skills](https://www.antigravity.google/docs/skills)、[OpenCode skills](https://opencode.ai/docs/skills/)：项目发现目录/链接方式。
- Codex 在本机安装的 skill-creator 与 CLI skill 发现上下文中确认 `.agents/skills`；其他机器以其 CLI 文档为准。
