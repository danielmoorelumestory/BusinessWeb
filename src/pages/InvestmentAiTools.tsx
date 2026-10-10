import React from 'react'
import { Download } from 'lucide-react'
import { INVESTMENT_SKILLS, INVESTMENT_SKILL_TAG, investmentSkillDownloadUrl } from '../data/investmentSkills'
import { WRITING_SKILLS } from '../data/writingSkills'

export default function InvestmentAiTools(): JSX.Element {
  return (
    <main className="container animate-fade-in investment-ai-tools">
      <header className="page-head">
        <h1>AI 工具</h1>
        <p>投资分析、视频创作与小说写作 Skills，按任务挑选。下载包包含 SKILL.md 和配套参考资料。</p>
        <div className="skill-download-actions">
          <span className="tag">{INVESTMENT_SKILL_TAG}</span>
          <a className="skill-download" href={investmentSkillDownloadUrl('investment-analysis-skills.zip')} download="investment-analysis-skills.zip">
            <Download size={16} aria-hidden="true" /> 下载投资分析合集（{INVESTMENT_SKILLS.length} 套 ZIP）
          </a>
        </div>
      </header>

      <section className="skill-grid" aria-label="投资分析 Skill 专家">
        {INVESTMENT_SKILLS.map(skill => (
          <article className="skill-card" key={skill.id}>
            <span className="tag">{INVESTMENT_SKILL_TAG}</span>
            <h2>{skill.name}</h2>
            <p className="skill-card__alias">{skill.alias}</p>
            <p className="skill-card__focus">{skill.focus}</p>
            <p>{skill.description}</p>
            <p><strong>产出：</strong>{skill.outputs}</p>
            <details className="skill-example">
              <summary>试一句提示词</summary>
              <p>{skill.example}</p>
            </details>
            <a className="skill-download" href={investmentSkillDownloadUrl(`${skill.id}.zip`)} download={`${skill.id}.zip`} aria-label={`下载${skill.name}完整 ZIP`}>
              <Download size={16} aria-hidden="true" /> 下载完整 ZIP
            </a>
          </article>
        ))}
      </section>

      <section className="hub-group" aria-labelledby="video-skills-title">
        <h2 id="video-skills-title">视频创作</h2>
        <div className="skill-grid">
          <article className="skill-card">
            <span className="tag">视频提示词 Skill</span>
            <h2>视频提示词构建器</h2>
            <p className="skill-card__alias">chatGPT_video_prompt_builder.skill</p>
            <p className="skill-card__focus">Seedance 分镜 · 特效与节奏设计</p>
            <p>把场景、产品或广告创意整理成逐镜头的视频生成提示词，细化运镜、转场、慢动作与视觉效果。原包面向 Seedance 2.0，适合视频概念、产品短片和品牌广告的分镜规划。</p>
            <p><strong>产出：</strong>镜头特效时间线、特效总清单、特效密度图和整体节奏弧线。</p>
            <details className="skill-example">
              <summary>试一句提示词</summary>
              <p>用 video-prompt-builder 为一双越野跑鞋写 15 秒视频提示词：山地、日落、单人跑步，包含分镜、运镜、转场和节奏设计。</p>
            </details>
            <div className="skill-download-actions">
              <a className="skill-download" href={`${import.meta.env.BASE_URL}ai-skills/chatGPT_video_prompt_builder.skill`} download="chatGPT_video_prompt_builder.skill">
                <Download size={16} aria-hidden="true" /> 下载原始 .skill
              </a>
              <a className="skill-download" href={`${import.meta.env.BASE_URL}ai-skills/video-prompt-builder.zip`} download="video-prompt-builder.zip">
                <Download size={16} aria-hidden="true" /> 下载完整 ZIP
              </a>
            </div>
          </article>
        </div>
      </section>

      <section className="hub-group" aria-labelledby="writing-skills-title">
        <h2 id="writing-skills-title">小说与写作</h2>
        <div className="skill-grid">
          {WRITING_SKILLS.map(skill => (
            <article className="skill-card" key={skill.id}>
              <span className="tag">{skill.tag}</span>
              <h2>{skill.name}</h2>
              <p className="skill-card__alias">{skill.id}</p>
              <p className="skill-card__focus">{skill.focus}</p>
              <p>{skill.description}</p>
              <p><strong>产出：</strong>{skill.outputs}</p>
              {'note' in skill && <p>{skill.note}</p>}
              <details className="skill-example">
                <summary>试一句提示词</summary>
                <p>{skill.example}</p>
              </details>
              <a className="skill-download" href={`${import.meta.env.BASE_URL}ai-skills/${skill.id}.zip`} download={`${skill.id}.zip`} aria-label={`下载${skill.name}完整 ZIP`}>
                <Download size={16} aria-hidden="true" /> 下载完整 ZIP
              </a>
            </article>
          ))}
        </div>
        <div className="skill-download-actions">
          <a className="skill-download" href={`${import.meta.env.BASE_URL}ai-skills/writing-skills.zip`} download="writing-skills.zip">
            <Download size={16} aria-hidden="true" /> 下载写作合集（3 套 ZIP）
          </a>
          <a className="skill-guide" href={`${import.meta.env.BASE_URL}ai-skills/writing-skills-README.md`} download="小说与写作Skills-使用说明.md">下载写作使用说明</a>
        </div>
      </section>

      <section className="road__item skill-install" aria-labelledby="skill-install-title">
        <h2 id="skill-install-title">下载后怎么用</h2>
        <ol>
          <li>解压 ZIP，保留每套 Skill 的整个文件夹，包括 SKILL.md 和 references。</li>
          <li>放到项目的 <code>.agents/skills/</code>（Codex / Antigravity CLI）、<code>.claude/skills/</code>（Claude Code）、<code>.opencode/skills/</code>（OpenCode）或 <code>.codebuddy/skills/</code>（CodeBuddy Code）目录。</li>
          <li>重新打开会话，在提问时写出 Skill 名称和任务背景：投资研究提供代码、市场和问题；视频创作提供主体、场景、风格和时长；小说写作提供设定、稿件和创作目标。</li>
        </ol>
        <p>Skill 是供 AI 助手读取的任务流程。投资分析需准备公开数据查询能力；团队类 Skill 还需助手支持子代理编排。具体要求见包内说明。</p>
        <p>视频提示词构建器的 .skill 为原始打包文件；支持该格式的工具可导入，否则下载 ZIP 按上述目录方式安装。它用于编写提示词，生成视频需另用视频生成工具。</p>
        <a className="skill-guide" href={investmentSkillDownloadUrl('README.md')} download="投资分析Skill-使用说明.md">下载使用说明</a>
      </section>
      <p className="skill-disclaimer">这些工具用于辅助研究，AI 输出需核对数据来源与日期，不构成投资建议。</p>
    </main>
  )
}
