import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { Marked } from 'marked'

const root = fileURLToPath(new URL('../', import.meta.url))
const slug = 'fibonacci-etf-grid-research'
const markdown = readFileSync(`${root}public/notes/${slug}.md`, 'utf8')
const outline = []
const escape = text => text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;')
const parser = new Marked({ renderer: {
  heading({ tokens, depth, text }) {
    const content = this.parser.parseInline(tokens)
    if (depth !== 2) return `<h${depth}>${content}</h${depth}>`
    const id = `section-${outline.length + 1}`
    outline.push({ id, title: text })
    return `<h2 id="${id}">${content}</h2>`
  }
}})
const body = parser.parse(markdown.replace(/^# .*\n\n[^\n]*\n\n/, ''))
  .replaceAll('<table>', '<div class="table-scroll" tabindex="0" role="region" aria-label="研究报告表格，可横向滚动"><table>')
  .replaceAll('</table>', '</table></div>')
const nav = outline.map(({ id, title }) => `<a href="#${id}">${escape(title.split('：')[0])}</a>`).join('\n')

const html = `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>斐波那契与 ETF 网格交易：验证、纠错与体系升级｜研究报告</title>
<meta name="description" content="完整核验 Fibonacci 回撤与扩展的证据和公式，结合估值、趋势、ATR、资金管理与 ETF 执行规则，设计可验证的网格交易研究框架。含交互计算示例。">
<meta name="theme-color" content="#25715c">
<link rel="stylesheet" href="fibonacci-etf-grid.css">
<script src="fibonacci-etf-grid.js" defer></script>
</head>
<body>
<a class="skip" href="#report">跳至完整报告</a>
<header class="topbar"><div class="bar-inner"><a class="brand" href="../notes"><span>↗</span>投资研究 / RESEARCH</a><div class="actions"><a class="back-link" href="../notes/${slug}">研究笔记</a><a href="../notes/${slug}.md" download>下载正文 ↓</a><button class="print-button" id="print-report" type="button">打印 / PDF</button></div></div><div class="progress" id="reading-progress" aria-hidden="true"></div></header>
<div class="hero"><div><p class="eyebrow">FIBONACCI × ETF GRID · RESEARCH REPORT</p><h1>斐波那契是坐标，<br><span>交易纪律需要证据。</span></h1><p class="subtitle">斐波那契在股票与 ETF 网格交易中的应用：<br>证据核验、公式纠错与策略升级。</p><div class="metadata"><span>核验于 2026.10.14</span><span>13 个研究章节</span><span>2 个交互计算示例</span></div></div><aside class="hero-note"><div class="big">61.8<span style="font-size:30px">%</span></div><div class="label">深回撤观察区</div><p>这个比例描述波段回吐的幅度。<br>能否增加仓位，还要检查持有理由、<br>市场状态与剩余风险预算。</p></aside></div>
<div class="layout">
<details class="sidebar" id="report-outline" open><summary>报告目录 / CONTENTS</summary><nav aria-label="报告章节"><a href="#overview">核心结论</a><a href="#calculation">交互计算示例</a>${nav}<a href="#sources">来源与核验范围</a></nav><p class="side-note">研究对象：一般股票与非杠杆 ETF。<br>示例参数未经独立回测。<br>计算工具仅展示数学关系。</p></details>
<main class="content">
<section class="takeaway" id="overview"><h2>用价格坐标组织计划，用风险预算约束交易。</h2><p>61.8% 不自动触发重仓，1.618 不保证下跌终结。四因子框架需要样本外验证，Fibonacci 的独立贡献需要对照实验。</p><div class="factor-flow"><div><strong>估值与基本面</strong><span>持有理由</span></div><div><strong>趋势</strong><span>运行模式</span></div><div><strong>Fibonacci</strong><span>观察区域</span></div><div><strong>ATR</strong><span>网格尺度</span></div></div></section>
<section class="lab" id="calculation" aria-labelledby="lab-title"><div class="section-kicker">EXPLORE THE MATH</div><h2 id="lab-title">把比例换成价格，检查计算口径</h2><p class="intro">可修改下方参数。输入均为假设值，未连接行情，也不生成买卖建议。</p><noscript><p>计算工具需要 JavaScript。下方完整报告和公式可以直接阅读。</p></noscript>
<div class="lab-panel"><h3>01 / Fibonacci 价格坐标</h3><form id="fib-form"><div class="fields"><label>波段低点 L（元）<input id="fib-low" type="number" value="1" min="0.000001" step="any" required></label><label>波段高点 H（元）<input id="fib-high" type="number" value="2" min="0.000001" step="any" required></label><label>计算口径<select id="fib-scale"><option value="linear">线性价格</option><option value="log">对数价格</option></select></label><label class="wide">计算类型<select id="fib-mode"><option value="retracement-up">上涨后的回撤 · H 向 L</option><option value="retracement-down">下跌后的反弹 · L 向 H</option><option value="two-up">两点上行扩展 · 从 L 计算</option><option value="two-down">两点下行扩展 · 从 H 计算</option><option value="three-up">三点上行扩展 · A=L，B=H</option><option value="three-down">三点下行扩展 · A=H，B=L</option></select></label><label id="fib-c-label" hidden>调整终点 C（元）<input id="fib-c" type="number" value="1.5" min="0.000001" step="any" required><small>使用已确认的调整终点</small></label></div></form><p id="fib-message" class="calc-message" role="status"></p><div class="fib-results" id="fib-results" hidden><div class="table-scroll" tabindex="0" role="region" aria-label="Fibonacci 计算结果"><table><thead><tr><th scope="col">比例 / 倍数</th><th scope="col">对应价格</th></tr></thead><tbody id="fib-table-body"></tbody></table></div><div class="fib-chart"><div id="fib-chart"></div><p id="fib-chart-note"></p></div></div></div>
<div class="lab-panel"><h3>02 / ATR 网格间距</h3><form id="atr-form"><div class="fields"><label>参考价格 P（元）<input id="atr-price" type="number" value="1.5" min="0.000001" step="any" required></label><label>ATR（元）<input id="atr-value" type="number" value="0.03" min="0" step="any" required></label><label>ATR 倍数 k<input id="atr-multiple" type="number" value="1.5" min="0.000001" step="any" required></label><label>往返成本门槛（%）<input id="atr-cost" type="number" value="0.2" min="0" step="any" required><small>示例值，需包含佣金、滑点等</small></label><label>报价单位（元）<input id="atr-tick" type="number" value="0.001" min="0.000001" step="any" required></label></div></form><div class="result-cards" id="atr-results" hidden><div><small>ATR 基础间距</small><strong id="atr-basic"></strong></div><div><small>对齐报价后的候选间距</small><strong id="atr-candidate"></strong></div><div><small>候选单格价差</small><strong id="atr-gap"></strong></div></div><p id="atr-message" class="calc-message" role="status"></p></div>
</section>
<article class="report" id="report" aria-label="完整研究报告">${body}</article>
<section class="sources" id="sources"><h2>来源与核验范围</h2><p>文献结果仅适用于其研究范围。2026 年 SSRN 工作论文只核验了页面与摘要，全文未获取。本文没有执行 ETF 策略回测，也没有认证任何资金比例或最优参数。</p><ol>
<li><a href="https://www.sciencedirect.com/science/article/pii/S0957417421012495">Tsinaslanidis、Guijarro、Voukelatos：Fibonacci 回撤实证研究</a> · 2022 · DOI: 10.1016/j.eswa.2021.115893</li>
<li><a href="https://papers.ssrn.com/sol3/papers.cfm?abstract_id=7429819">中国股票 ETF 网格交易工作论文</a> · SSRN · 2026.09.07</li>
<li><a href="https://www.tradingview.com/support/solutions/43000518137-trend-based-fib-extension-drawing-tool/">TradingView：三点趋势扩展</a></li>
<li><a href="https://www.tradingview.com/support/solutions/43000518158-fibonacci-retracement-drawing-tool/">TradingView：回撤工具与对数选项</a></li>
<li><a href="https://www.fidelity.com/learning-center/trading-investing/technical-analysis/technical-indicator-guide/atr">Fidelity：ATR 定义与 Wilder 平滑</a></li>
<li><a href="https://www.sse.com.cn/assortment/fund/etf/question/c/c_20240118_5734755.shtml">上交所：ETF T+0 / T+1 说明</a></li>
<li><a href="https://www.sse.com.cn/lawandrules/sselawsrules2025/trade/universal/c/c_20260424_10816492.shtml">上交所：交易规则（2026 年修订）</a> · 2026.07.06 生效</li>
</ol></section>
</main></div><footer class="footer"><span>个人研究与方法讨论 · 示例不构成交易指令</span><a href="#overview">返回核心结论 ↑</a></footer>
</body></html>`
writeFileSync(`${root}public/research/fibonacci-etf-grid-2026-10-14.html`, html)
console.log(`Generated Fibonacci report: ${outline.length} chapters`)
