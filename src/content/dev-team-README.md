# dev-team 使用说明（可迁移包）

用 **Orca** 组织多执行器开发团队：当前对话的 agent 是唯一 manager，负责拆任务、通过真实 Orca 派工给
Codex / Claude / Kimi / Antigravity / OpenCode(MiniMax M3)、验收、整合；适用于 Android、前端、后端、全栈项目。

本包 = `dev-team/`（技能本体）+ 本说明。技能本体不含任何项目名称、绝对路径、对话记录、凭据或活跃的 Orca 身份。

## 1. 前置条件

| 项 | 要求 |
|---|---|
| Node.js | 20+（无 npm 依赖） |
| Orca | 已启动，且版本支持 orchestration（实测 1.4.224） |
| 执行器 | 至少一个已登录、有额度的 CLI：`codex` / `claude` / `kimi` / `opencode` / `agy` |
| Python 3 | 仅 `pack` 打包时需要 |

注意：**命令存在、能登录、有额度是三件事**。`doctor` 只能确认前者，登录与额度只有真实派一次任务才知道。

## 2. 安装到一个项目（每个项目一次）

```bash
# 1) 解压本包，然后在目标项目根目录执行：
node /解压位置/dev-team/scripts/dev-team.mjs init --project .

# 2) 自检（不调用收费模型，不派任务）
node .agents/skills/dev-team/scripts/dev-team.mjs doctor --models
```

`init` 会复制技能到 `.agents/skills/dev-team/`，为各 harness 建立相对链接，并生成
`.dev-team/config.json` 与 `.dev-team/PROJECT.md`。它**不会**修改项目根的说明文件、全局设置或权限。
已有同名技能时只报告冲突、不覆盖；重复初始化请从目标项目已安装的脚本执行，以保留配置。

## 3. 必做：补全 `.dev-team/config.json`

`init` 会自动猜目录，但可能猜错（例如把 Node 后端识别成前端，`backend.paths` 留空）。
路径为空时 `plan` 会拒绝出计划并提示 `先在 config.json 中设置目标平台 paths`，这是故意的保护，不是故障。

```json
{
  "paths":  { "backend": ["src"], "frontend": [], "android": [] },
  "checks": { "backend": ["npm test"], "frontend": [], "android": [] }
}
```

- `paths` 是写入范围的**候选**，派工前 manager 会再缩到具体文件。
- `checks` 是候选命令，不是每次全量执行清单；小改动不应默认跑全量测试。
- 建议同时在 `.dev-team/PROJECT.md` 补充该项目的构建/测试约定、共享文件 owner 等（本包不带这些）。

### 可选：让别人评审、自己不评审自己

默认评审顺序是 Claude 优先。想"谁写代码就别让谁评审"，改 `routing`：

```json
"routing": {
  "reviewer": ["codex", "kimi", "opencode-m3", "agy", "claude"],
  "backend":  ["claude", "codex", "opencode-m3", "kimi", "agy"]
}
```

## 4. 日常使用

在会话里直接说（Claude Code 用 `/dev-team`，Kimi 用 `/skill:dev-team`，其他 harness 直接要求读取 SKILL.md）：

```
$dev-team 为订单接口增加幂等键，并补接口测试
$dev-team 只读审查最近一次提交，重点看资金相关接口，不要改任何文件
```

manager 的流程：`plan` 生成任务卡 → 按任务缩减（小改动只留一两个任务）→ `register` 登记到 Orca Run →
`start` 首次派工 → 用原生 `orca orchestration check --wait` 等回执 → 核对真实 diff / 报告 / 测试 →
有问题派 follow-up → 释放 worker 并 ack。

常用命令（均在目标项目内执行）：

```bash
S=.agents/skills/dev-team/scripts/dev-team.mjs
node $S route --role reviewer              # 看会选哪个执行器
node $S plan --workflow backend --id x --goal "..."   # android|frontend|backend|fullstack
node $S register --id x                    # 登记到真实 Orca Run
node $S start --id x --task review --dry-run   # 先看启动命令，确认后去掉 --dry-run
node $S status --id x                      # 本地回执 + Orca Tasks/Workers
```

## 5. 使用中的经验（来自一次真实跑通）

- **只读评审是最安全的起步用法**：任务卡写明"禁止修改文件、禁止运行构建"，worker 会遵守并只写报告。
- **默认计划是完整流水线**（需求→设计→实现→评审→QA），小任务请缩减，不要照单全跑。
- **worker_done succeeded 只代表该阶段结束**，manager 仍须对照源码核实发现，不可直接采信。
- **等待超时不代表失败**：继续 `check --wait`；连续多次为空再用 `worker-list` 查存活状态。
- **验证与额度都不要编造**：没跑过的写"未验证"；CLI 没有统一的剩余额度接口，只能看各执行器自己的界面。
- 同一 checkout 只让一个角色跑 Gradle/构建/生成命令，避免产物互相覆盖。

## 6. 本包的验证范围（诚实声明）

已验证：打包、解压、在全新空项目中 `init`、`doctor`、后端与前端 `plan` 出图、技能自带 13 个单测通过；
在一个 Android 项目中用 Codex 完成过一次真实的只读评审（派工→回执→核实→释放→ack 全链路）。

**未验证**：后端/前端项目里的真实派工；让执行器改代码的任务；多任务并行；独立 worktree；额度耗尽后的接力；
Kimi / OpenCode / Antigravity 的实际派工（只确认了命令存在与模型列表）。

## 7. 升级与再打包

```bash
node .agents/skills/dev-team/scripts/dev-team.mjs pack --output dev-team.zip
```

升级技能时先比较差异再选择合并或替换，避免丢掉本地调整。运行测试（不调用付费模型）：

```bash
node --test .agents/skills/dev-team/scripts/dev-team.test.mjs
```
