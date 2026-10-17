import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { aggregateBars, technicalState } from './etf-technical.mjs'
const bars = closes => closes.map((close, i) => [new Date(Date.UTC(2025, 0, i + 1)).toISOString().slice(0, 10), String(close), String(close), String(close), String(close), '100'])
const ema = (values, a) => values[0] * (1-a)**(values.length-1) + values.slice(1).reduce((sum, value, i) => sum + a*value*(1-a)**(values.length-i-2), 0)

test('单边上涨、下跌及横盘的MA/MACD/RSI与边界', () => {
  const up = technicalState(bars(Array.from({length:80}, (_,i) => 1+i*.01)))
  assert.equal(up.ma, '多头'); assert.equal(up.macd, '偏多'); assert.equal(up.rsi, 100); assert.equal(up.rsiState, '超买')
  const down = technicalState(bars(Array.from({length:80}, (_,i) => 2-i*.01)))
  assert.equal(down.ma, '空头'); assert.equal(down.macd, '偏空'); assert.equal(down.rsi, 0); assert.equal(down.rsiState, '超卖')
  const flat = technicalState(bars(Array(80).fill(1)))
  assert.equal(flat.ma, '震荡'); assert.equal(flat.macd, '中性'); assert.equal(flat.rsi, 50)
  assert.equal(technicalState(bars(Array(14).fill(1))).rsi, null)
  assert.equal(technicalState(bars(Array(25).fill(1))).dif, null)
  assert.equal(technicalState([]), null)
  assert.throws(() => technicalState(bars([NaN])), /Invalid close/)
})

test('MACD与独立EMA加权展开一致，金叉仅标本期交叉', () => {
  const closes = [...Array.from({length:45},(_,i)=>2-i*.02), ...Array.from({length:45},(_,i)=>1.1+i*.03)]
  const state=technicalState(bars(closes))
  assert.ok(Math.abs(state.dif-(ema(closes,2/13)-ema(closes,2/27)))<1e-12)
  const difs = closes.map((_,i) => ema(closes.slice(0,i+1),2/13)-ema(closes.slice(0,i+1),2/27))
  assert.ok(Math.abs(state.dea-ema(difs,.2))<1e-12)
  const cross = closes.findIndex((_,i)=>i>=26 && technicalState(bars(closes.slice(0,i+1))).macd==='金叉')
  assert.ok(cross>0)
  assert.equal(technicalState(bars(closes.slice(0,cross+2))).macd,'偏多')
})

test('周线跨年、月线聚合正确；独立使用各周期收盘', () => {
  const input=[['2025-12-31','1','2','3','1','10'],['2026-01-02','2','3','4','2','20'],['2026-01-05','3','4','5','3','30']]
  assert.deepEqual(aggregateBars(input,'week'),[['2026-01-02','1','3','4','1','30'],input[2]])
  assert.deepEqual(aggregateBars(input,'month'),[input[0],['2026-01-05','2','4','5','2','50']])
})

test('全清单覆盖，A50与已复核报告相符，暂态和不足不伪装完整信号', () => {
  const snapshot=JSON.parse(readFileSync('src/data/etfTechnical.json','utf8'))
  const archive=JSON.parse(readFileSync(`public${snapshot.archivePath}`,'utf8'))
  const reference=JSON.parse(readFileSync('public/data/159593-technical-analysis-2026-10-16.json','utf8'))
  assert.equal(Object.keys(snapshot.records).length,80)
  assert.equal(archive.records.length,72)
  assert.equal(snapshot.records['511880'].applicable,false)
  assert.equal(snapshot.records['000015'].applicable,false)
  for (const record of archive.records) {
    for (const [key,rows] of [['day',record.dailyBars],['week',aggregateBars(record.dailyBars,'week')],['month',aggregateBars(record.dailyBars,'month')]]) {
      assert.deepEqual(technicalState(rows,record[key].complete),snapshot.records[record.code][key])
    }
  }
  const a50=snapshot.records['159593']
  for (const [key,list] of [['day',reference.dailyIndicators],['week',reference.weeklyIndicators],['month',reference.monthlyIndicators]]) {
    const expected=list.at(-1)
    assert.ok(Math.abs(a50[key].rsi-expected.rsi14)<1e-10)
    assert.ok(Math.abs(a50[key].dif-expected.dif)<1e-10)
    assert.ok(Math.abs(a50[key].dea-expected.dea)<1e-10)
  }
  assert.equal(a50.month.complete,false)
  assert.equal(a50.month.limitedMacdHistory,true)
  assert.equal(a50.week.complete,true)
  const short=archive.records.find(r=>r.month.count<15)
  assert.ok(short);assert.equal(short.month.rsi,null);assert.equal(short.month.macd,'不足')
})
