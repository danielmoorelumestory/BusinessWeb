import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  buildDcfLink, calculateMultiples, calculateSheetDcf, calculateWacc, dcfMarketOf, findDcfRecord, formatPrice, formatSignedPct,
  makeDcfKey, makeDcfRecord, parseNumber, saveDcfRecord, type DcfSheetInput,
} from '../features/dcf'
import type { CandidateMarket } from '../features/candidates/validation'
import { Card } from './ui'
import '../styles/research.css'

type Field = 'baseFcf' | 'growth' | 'perpetualGrowth' | 'discountRate' | 'cash' | 'debt' | 'shares'
const FIELDS: Array<{ id: Field; label: string; hint: string }> = [
  { id: 'baseFcf', label: '起始自由现金流（亿）', hint: '最近一年经营现金流 − 资本开支' },
  { id: 'growth', label: '未来 5 年成长率（%）', hint: '按财报与行业增速保守估计' },
  { id: 'perpetualGrowth', label: '永续增长率（%）', hint: '通常不超过名义 GDP 增速' },
  { id: 'discountRate', label: '折现率（%）', hint: '你要求的回报率' },
  { id: 'cash', label: '现金及投资（亿）', hint: '没有填 0' },
  { id: 'debt', label: '总负债（亿）', hint: '没有填 0' },
  { id: 'shares', label: '流通股数（亿股）', hint: '最新股本' },
]

/** 个股页内嵌的简版 DCF：七个输入，结果可存入本机 DCF 记录（候选池、综合筛选里的 DCF 列随之更新）。WACC 与倍数留给完整 DCF 页。 */
export default function QuickDcf({ market, code, name, price }: { market: CandidateMarket; code: string; name: string; price?: number }): JSX.Element {
  const { market: dm, currency } = dcfMarketOf(market)
  const base: DcfSheetInput = {
    company: name, code, market: dm, currency, moneyUnit: 'yi', shareUnit: 'yi', baseYear: new Date().getFullYear() - 1,
    baseFcf: null, growth: null, perpetualGrowth: null, discountRate: null, cash: null, debt: null, shares: null,
    currentPrice: price ?? null, marketCap: null, beta: null, interestExpense: null, pretaxIncome: null, taxPaid: null,
    riskFreeRate: null, marketReturn: null, ebitda: null,
  }
  // 本机已有这家公司的记录就接着用，和完整 DCF 页共用同一条
  const saved = findDcfRecord(makeDcfKey(base))
  const [vals, setVals] = useState<Record<Field, string>>(() => Object.fromEntries(FIELDS.map(f => [f.id, saved?.input[f.id] != null ? String(saved.input[f.id]) : ''])) as Record<Field, string>)
  const [notice, setNotice] = useState('')

  const input: DcfSheetInput = { ...(saved?.input ?? base), ...base, ...Object.fromEntries(FIELDS.map(f => [f.id, parseNumber(vals[f.id])])) } as DcfSheetInput
  const result = calculateSheetDcf(input)
  const anyFilled = FIELDS.some(f => vals[f.id].trim() !== '')

  const save = (): void => {
    const out = saveDcfRecord(makeDcfRecord(input, { result, wacc: calculateWacc(input), multiples: calculateMultiples(input) }))
    setNotice(out.ok ? '已保存到本机 DCF 记录，候选池与综合筛选里会显示这次的安全边际。' : (out.error ?? '保存失败'))
  }

  return (
    <Card title="快速 DCF（简版）" className="rn-card">
      <p className="rn-text">只填七项就能得到一个合理价和安全边际，结果是你自己假设的推演，不是预测。更细的 WACC、倍数交叉与敏感性在完整 DCF 页。</p>
      <div className="ui-cluster rn-filters">
        {FIELDS.map(f => (
          <label key={f.id} className="rn-select-label" title={f.hint}>
            {f.label}
            <input inputMode="decimal" aria-label={f.label} value={vals[f.id]} onChange={e => setVals(v => ({ ...v, [f.id]: e.target.value }))} className="rn-input" />
          </label>
        ))}
      </div>
      {anyFilled && (result.status === 'calculated' ? (
        <p role="status" className="rn-text">
          合理价 <strong>{formatPrice(result.price, currency)}</strong>
          {price != null && <> · 现价 {formatPrice(price, currency)} · 安全边际 <strong className={result.mos !== null && result.mos >= 0 ? 'rn-dcf is-good' : 'rn-dcf is-bad'}>{formatSignedPct(result.mos)}</strong></>}
          {result.terminalShare != null && result.terminalShare > 0.75 && <> · 终值占 EV {(result.terminalShare * 100).toFixed(0)}%，结果对永续假设很敏感</>}
        </p>
      ) : <p role="status" className="rn-text">{result.reason}</p>)}
      {result.warnings.map(w => <p key={w} className="rn-small">⚠ {w}</p>)}
      <div className="ui-cluster">
        <button type="button" className="tool-btn tool-btn--primary" disabled={result.status !== 'calculated'} onClick={save}>保存到 DCF 记录</button>
        <Link className="tool-btn" to={buildDcfLink({ company: name, code, researchMarket: market, price })}>去完整 DCF →</Link>
        {notice && <span className="rn-pool-msg">{notice}</span>}
      </div>
    </Card>
  )
}
