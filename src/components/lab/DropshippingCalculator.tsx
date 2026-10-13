import React, { useState } from 'react'
import '../../styles/dropshipping.css'

const fields = [
  ['price', '实际售价（元／单）', '65'],
  ['purchase', '采购成本（元／单）', '26'],
  ['shipping', '物流费用（元／单）', '5'],
  ['fees', '平台及支付费用（元／单）', '3'],
  ['promotion', '分摊推广费用（元／单）', '8'],
  ['afterSales', '售后净损耗（元／单）', '3'],
  ['orders', '预计完成订单（月）', '30'],
  ['fixed', '本月固定及一次性费用（元）', '500'],
  ['hours', '本月全部经营工时', '30'],
] as const
type Field = typeof fields[number][0]
const defaults = Object.fromEntries(fields.map(([key, , value]) => [key, value])) as Record<Field, string>
const currency = new Intl.NumberFormat('zh-CN', { style: 'currency', currency: 'CNY' })
const money = (value: number) => currency.format(value)

export default function DropshippingCalculator(): JSX.Element {
  const [values, setValues] = useState(defaults)
  const valid = (key: Field) => values[key].trim() !== '' && Number.isFinite(Number(values[key])) && Number(values[key]) >= 0 && Number(values[key]) <= 100000000 && (key !== 'orders' || Number.isInteger(Number(values[key])))
  const hasError = fields.some(([key]) => !valid(key))
  const n = (key: Field) => Number(values[key])
  const beforePromotion = n('price') - n('purchase') - n('shipping') - n('fees') - n('afterSales')
  const contribution = beforePromotion - n('promotion')
  const surplus = contribution * n('orders') - n('fixed')

  return <section className="dropshipping-calculator" aria-labelledby="dropshipping-calculator-title">
    <h2 id="dropshipping-calculator-title">先算一笔账</h2>
    <p>调整成本、订单量和工时，观察利润变化。默认值只是算术示例，不代表订单预测；税费与自己的劳动报酬尚未扣除。</p>
    <div className="dropshipping-calculator__fields">
      {fields.map(([key, label]) => <label key={key}>
        <span>{label}</span>
        <input type="number" min="0" max="100000000" step={key === 'orders' ? '1' : '0.01'} value={values[key]} aria-invalid={!valid(key)}
          onChange={event => setValues(current => ({ ...current, [key]: event.target.value }))} />
      </label>)}
    </div>
    <button type="button" className="dropshipping-calculator__reset" onClick={() => setValues(defaults)}>恢复示例</button>
    {hasError ? <p role="alert">请完整填写 0～1 亿之间的有效数值，订单数需为整数。</p> : <>
      <dl className="dropshipping-calculator__results" aria-live="polite" aria-atomic="true">
        {([
          ['单笔贡献利润', money(contribution)],
          ['贡献率', n('price') > 0 ? `${(contribution / n('price') * 100).toFixed(1)}%` : '—'],
          ['税前经营结余（月）', money(surplus)],
          ['税前每小时收益', n('hours') > 0 ? money(surplus / n('hours')) : '—（需记录工时）'],
          ['覆盖固定支出所需订单', contribution > 0 ? `${Math.ceil(n('fixed') / contribution)} 单` : '单笔无正贡献'],
          ['推广费盈亏线／单', beforePromotion >= 0 ? money(beforePromotion) : '基础成本已超售价'],
        ] as const).map(([label, result]) => <div key={label}><dt>{label}</dt><dd><output aria-label={label}>{result}</output></dd></div>)}
      </dl>
      {contribution <= 0 && <p className="dropshipping-calculator__notice">单笔贡献未转正，增加订单无法改善经营结果。先调整成本、商品或售价。</p>}
    </>}
    <p className="dropshipping-calculator__note">推广盈亏线未覆盖固定费用及税费。完整退款订单造成的净损失需摊入售后损耗；实账改用退款后收入与实际支出，避免重复扣减。未结算、未完成售后的订单仍有不确定性。</p>
  </section>
}
