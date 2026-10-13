# 额度不足、替补与管理者接力

## 先识别再处理

| 现象 | 标记 | 行为 |
|---|---|---|
| CLI 不存在、配置显式关闭 | not_installed / disabled | 路由跳过，不安装新工具来绕过既有环境 |
| 401、登录失效或待设备登录 | auth_required | 保存现场并选其他已登录工具；需要本人登录时向用户说明 |
| 明确预算/余额/订阅限额耗尽 | exhausted | 跳过直到真实 reset 时间或用户恢复；不推测恢复、不切收费账号 |
| 明确 429、Retry-After | rate_limited | 按实际时间冷却，可替补；短等待不能造成重复任务 |
| 超时、网络断开、没输出、状态未知 | unverifiable | 检查原 attempt；不能当成额度耗尽，也不能创建重复编辑者 |
| 确定 agent 已退出且未报告 | 原生 failed/stopped 恢复 | 按 Orca recovery 指令结算，再替补 |

用 helper 标记路由状态，例如：

```sh
node .agents/skills/dev-team/scripts/dev-team.mjs availability --harness claude --state exhausted --reason "执行器明确报告订阅额度耗尽"
node .agents/skills/dev-team/scripts/dev-team.mjs route --role frontend
```

只有确知 reset 时间才传 `--until <未来 ISO 时间>`；没有 until 的不可用标记持续有效。恢复后设 `--state unknown`，再次实际成功后可记 available；这仍不等于知道剩余 token。

## 替补执行者

1. manager 保存 `.dev-team/runs/<id>/MANAGER.md`、原 Task/Dispatch、报告、diff 与最后验证。worker 如果还能响应，先让其写 checkpoint 并用当前 preamble 发 failed；失去模型响应时 manager 从文件/日志补全。
2. 加载 `orca skills get orchestration --reference references/recovery-and-cleanup.md --json`。用 `worker-list --run <run> --include-remote` 与 `worker-show/worker-read` 核实。旧 agent 活着、等待权限或 unverifiable 时，不启动第二个写者。旧 agent 的终端 idle 也不是失败凭据。
3. 按当前版本文档与回执完成失败结算/stop 决策。failed 的执行者也要 release；`worker-stop` 只针对已证明身份和退出/终止条件的那个 attempt。不能凭日志里的词直接 kill 所有终端。
4. 选新的路由，缩小任务时不降低验收，把交接文件路径通过原生 follow-up/task 上下文给替补。用**同一 Task**：

```sh
orca orchestration worker-start --run <run_id> --task <task_id> --retry-of <failed_dispatch_id> --worktree <明确原工作区选择器> --agent <agent_id> --json
```

`opencode` 替补指定 M3 时追加 `--model minimax-cn/MiniMax-M3`，先用该执行主机 `opencode models` 确认，且只能针对 existing/current worktree 使用此 override。其他项目的 provider ID 不同就改 config，不能静默换 OpenCode 默认模型。

5. 保存新的回执并以新 Dispatch 为权威，旧 completion 不再验收。helper 的 `start` 不提供盲目 retry；手动恢复后在 MANAGER.md 记新 Dispatch，并用原生 Orca 状态继续协调。

同一 Task 连续三次失败会触发 Orca circuit breaker。保留阻塞原因，请求所缺信息/环境或调整方案，不能新建 Run/Task 绕过。全部 harness 不可用时提交准确的未完成状态与恢复步骤。

## mutation 回执丢失

helper 在操作前保存 UUID requestId，再提交 `--retry-request`。一个操作只发一次；未知状态保留 receipt/diagnostic 并拒绝重新 start。

```sh
orca orchestration request-show --request <记录的 requestId> --json
```

根据当前文档区分 completed/pending/absent。completed 读取原回执；pending 只可重放**同一参数、同一 requestId**；absent 也不证明未执行，检查 Run/Task/Dispatch。确认结果后修复本地索引时只复制原始回执，不能伪造完成状态。

## manager 耗尽/更换

持久上下文在 PROJECT.md、任务卡、MANAGER.md、报告和原生 Run 中。替补 manager 优先 Claude，再 Kimi/AGY/OpenCode；用户始终只面对当前唯一 manager。

1. 确定原 manager 已停止协调，留下最后交接点。不要在它仍协调时争抢 Run。
2. 新会话先只读 `run-show/task-list/worker-list` 和本地文件，加载本版本 `run-use --help` 及 legacy-contract-migration 指南，按运行时支持的身份绑定/接管方式恢复。**不能把旧 handle 写成自己的身份**。不能凭一份文本 checkpoint 宣称获得 live Dispatch 权限。
3. 若当前 runtime 支持并授权接管则按其精确命令执行；仅有 `--takeover-legacy` 时不要把它推断为可接管所有 current Run。接管不支持或身份无法证明时保留原运行，等其可安全结算；已全部结算后新 manager 可新建 Run 做剩余工作。
4. Orca 重启后 helper 检测 runtimeId 变化会停止 mutation，manager 核对持久 Run/Dispatch、重新发现 handle 并按回执恢复；项目搬到新机器时不重放旧运行状态。

不要自动买 token、改账号、导出凭据、降权限或设置 skip-permissions。此技能提供确定的接力流程，不承诺模型已经无法输出时还能自动无缝保存它的私有思考。
