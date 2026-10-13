import React from 'react'
import { Link } from 'react-router-dom'
import { Download } from 'lucide-react'

export default function DevTeamSkillCard(): JSX.Element {
  return (
    <article className="skill-card">
      <span className="tag">开发协作 Skill</span>
      <h3>Orca 开发团队 dev-team</h3>
      <p className="skill-card__alias">dev-team · 可迁移的多执行器开发团队</p>
      <p className="skill-card__focus">Android · Web 前端 · 后端 · 全栈协作</p>
      <p>当前对话的 agent 作为唯一管理入口，通过 Orca 协调 Codex、Claude、Kimi、Antigravity 与 OpenCode MiniMax M3，负责拆任务、派工、核实结果和整合交付。Android、前端、后端与全栈分别组织流程，小任务可精简计划。</p>
      <p>技能可独立安装到其他项目，按检查点保存进度，用于恢复、交接与执行器替补。完整 ZIP 包含 dev-team 文件夹和独立 README，运行记录与账号凭据不随包迁移。</p>
      <p><strong>产出：</strong>任务计划、设计与接口契约、代码改动、审查与测试记录、交接检查点。</p>
      <p><strong>运行要求：</strong>Node 20+、支持 orchestration 的 Orca，以及至少一个已安装、已登录且有可用额度的执行器。打包另需 Python 3；Android 构建与设备验证需目标项目的 SDK 和设备环境。</p>
      <details className="skill-example">
        <summary>试一句提示词</summary>
        <p><code>$dev-team 只读审查最近一次提交，重点看接口与授权，不要修改任何文件。</code></p>
      </details>
      <details className="skill-example skill-install">
        <summary>安装与使用</summary>
        <ol>
          <li>下载并解压 ZIP，保留 <code>README.md</code> 和整个 <code>dev-team</code> 文件夹。</li>
          <li>安装到目标项目：<code>node /path/to/dev-team/scripts/dev-team.mjs init --project /path/to/project</code>。这会创建项目配置与各执行器的技能入口；已有同名技能时报告冲突，不覆盖。</li>
          <li>在目标项目根目录自检：<code>node .agents/skills/dev-team/scripts/dev-team.mjs doctor --models</code>。自检不派任务、不调用收费模型；登录状态与额度仍需实际派工确认。</li>
          <li>核对 <code>.dev-team/config.json</code> 的 <code>paths</code> 与 <code>checks</code>，并补充 <code>.dev-team/PROJECT.md</code>。目标平台路径为空时，计划生成会提示先配置。</li>
          <li>在 Orca 打开目标项目并重新开启会话，使用 <code>$dev-team</code>（Codex）、<code>/dev-team</code>（Claude Code）或 <code>/skill:dev-team</code>（Kimi），加上开发目标。</li>
        </ol>
        <p>建议先做一次只读评审，再逐步扩大任务范围。详细步骤见包内 <code>README.md</code>、<code>dev-team/references/operations.md</code> 与 <code>dev-team/references/recovery.md</code>。</p>
      </details>
      <details className="skill-example">
        <summary>验证范围</summary>
        <p>包内 README 记录：已验证打包、解压、空项目初始化与自检、前后端计划生成和 13 项技能单测；在 Android 项目中完成过 Codex 只读评审的派工、回执、核实与释放全流程。</p>
        <p>尚未验证前后端真实派工、代码修改任务、多任务并行、独立 worktree、额度耗尽后的接力，以及 Kimi、OpenCode、Antigravity 的实际派工。</p>
      </details>
      <div className="skill-download-actions">
        <a className="skill-download" href={`${import.meta.env.BASE_URL}ai-skills/dev-team.zip`} download="dev-team.zip" aria-label="下载 Orca 开发团队 dev-team 完整 ZIP">
          <Download size={16} aria-hidden="true" /> 下载完整 ZIP
        </a>
        <Link className="skill-guide" to="/ai/dev-team">使用说明 README</Link>
      </div>
    </article>
  )
}
