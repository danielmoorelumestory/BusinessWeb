import { calculateFee } from './fees'
import type { Adjustments, Candle, GridParams, GridResult, ManualTrade, SavedRecord, Trade } from './types'

const tick = (price: number): number => Math.round(price * 1_000) / 1_000

export const adjustmentsOf = (record: Pick<SavedRecord, 'priceOverrides' | 'amountOverrides' | 'sharesOverrides' | 'paramHistory' | 'manualTrades' | 'removedTrades'>): Adjustments => ({
  price: record.priceOverrides,
  amount: record.amountOverrides,
  shares: record.sharesOverrides,
  params: record.paramHistory,
  manual: record.manualTrades,
  removed: record.removedTrades,
})

function validateParams(row: GridParams): void {
  if (!/^\d{6}$/.test(row.code.trim())) throw new Error('证券代码必须为六位数字')
  if (!row.date || !/^\d{4}-\d{2}-\d{2}$/.test(row.date)) throw new Error('建仓日期格式无效')
  for (const [name, value] of Object.entries({
    initialPrice: row.initialPrice,
    initialAmount: row.initialAmount,
    step: row.step,
    rebound: row.rebound,
    pullback: row.pullback,
    gridAmount: row.gridAmount,
  })) {
    if (!Number.isFinite(value) || value < 0 || (name !== 'rebound' && name !== 'pullback' && value === 0)) {
      throw new Error(`${name} 参数无效`)
    }
  }
  for (const [name, value] of Object.entries({ floorPrice: row.floorPrice, budget: row.budget })) {
    if (value !== undefined && (!Number.isFinite(value) || value <= 0)) throw new Error(`${name} 参数无效`)
  }
}

function validCandles(candles: Candle[]): { candles: Candle[]; warnings: string[] } {
  const warnings: string[] = []
  const seen = new Set<string>()
  const valid = candles
    .filter(candle => {
      const okay = /^\d{4}-\d{2}-\d{2}$/.test(candle.date)
        && Number.isFinite(candle.close) && candle.close > 0
        && Number.isFinite(candle.high) && candle.high > 0
        && Number.isFinite(candle.low) && candle.low > 0
        && candle.low <= candle.high
      if (!okay) warnings.push(`${candle.date || '未知日期'} 的行情数据无效，已跳过`)
      if (!okay || seen.has(candle.date)) return false
      seen.add(candle.date)
      return true
    })
    .sort((a, b) => a.date.localeCompare(b.date))
  return { candles: valid, warnings }
}

function positiveOverride(map: Record<string, number> | undefined, date: string): number | undefined {
  const value = map?.[date]
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : undefined
}

export function calculateGrid(row: GridParams, inputCandles: Candle[], adjustments: Adjustments = {}): GridResult {
  validateParams(row)
  const normalized = validCandles(inputCandles)
  const candles = normalized.candles.filter(candle => candle.date >= row.date)
  const openingCandle = candles.find(candle => candle.date >= row.date)
  const warnings = normalized.warnings
  const openDate = openingCandle?.date
  const openingPriceOverride = positiveOverride(adjustments.price, row.date)
  const openingPrice = openingPriceOverride ?? row.initialPrice
  const openingAmountOverride = positiveOverride(adjustments.amount, row.date)
  const openingSharesOverride = positiveOverride(adjustments.shares, row.date)
  const openingAmount = openingSharesOverride !== undefined
    ? openingSharesOverride * openingPrice
    : openingAmountOverride ?? row.initialAmount
  const openingQuantity = openingSharesOverride ?? openingAmount / openingPrice
  const openingFee = calculateFee(row.code, '建仓', openingAmount)

  let cash = -openingFee
  let shares = openingQuantity
  let cost = openingAmount + openingFee
  let capitalUsed = openingAmount
  let maxCapital = capitalUsed
  let lastTrade = openingPrice
  let lastTradeDate = row.date
  let realized = 0
  let buys = 0
  let sells = 0
  let anchored = !adjustments.anchor
  let buyingStopped = false
  let floorHitDate: string | undefined

  const openingTrade: Trade = {
    date: row.date,
    side: '建仓',
    price: openingPrice,
    amount: openingAmount,
    quantity: openingQuantity,
    shares,
    capitalUsed,
    pnl: cash + shares * (openingCandle?.close ?? openingPrice) - openingAmount,
    ...(openingPriceOverride === undefined ? {} : { modelPrice: row.initialPrice }),
    ...(openingSharesOverride !== undefined ? { modelAmount: row.initialAmount, modelQuantity: row.initialAmount / openingPrice } :
      openingAmountOverride !== undefined ? { modelAmount: row.initialAmount, modelQuantity: row.initialAmount / openingPrice } : {}),
  }
  const trades: Trade[] = [openingTrade]
  const series: GridResult['series'] = []

  const paramsAt = (date: string) => (adjustments.params ?? []).find(stage => date <= stage.until) ?? row
  const fillPrice = (date: string, modelPrice: number) => {
    const override = positiveOverride(adjustments.price, date)
    return override === undefined ? { price: modelPrice } : { price: override, modelPrice }
  }
  const fillAmount = (date: string, modelAmount: number, price: number) => {
    const quantity = positiveOverride(adjustments.shares, date)
    if (quantity !== undefined) return { amount: quantity * price, quantity, modelAmount, modelQuantity: modelAmount / price }
    const amount = positiveOverride(adjustments.amount, date)
    if (amount !== undefined) return { amount, quantity: amount / price, modelAmount }
    return { amount: modelAmount, quantity: modelAmount / price }
  }

  const buy = (date: string, modelPrice: number): void => {
    const price = fillPrice(date, modelPrice)
    const fill = fillAmount(date, row.gridAmount, price.price)
    const fee = calculateFee(row.code, '买入', fill.amount)
    shares += fill.quantity
    cost += fill.amount + fee
    cash -= fill.amount + fee
    capitalUsed += fill.amount
    maxCapital = Math.max(maxCapital, capitalUsed)
    lastTrade = price.price
    lastTradeDate = date
    buys += 1
    trades.push({
      date, side: '买入', ...price, ...fill, shares, capitalUsed,
      pnl: cash + shares * price.price - openingAmount,
    })
  }

  const sell = (date: string, modelPrice: number): void => {
    const price = fillPrice(date, modelPrice)
    const modelProceeds = Math.min(shares, row.gridAmount / price.price) * price.price
    const fill = fillAmount(date, modelProceeds, price.price)
    const quantity = Math.min(shares, fill.quantity)
    if (quantity <= 0) return
    const proceeds = quantity * price.price
    const fee = calculateFee(row.code, '卖出', proceeds)
    const unitCost = shares > 0 ? cost / shares : 0
    const netProceeds = proceeds - fee
    shares -= quantity
    cash += netProceeds
    capitalUsed -= proceeds
    realized += netProceeds - quantity * unitCost
    cost -= quantity * unitCost
    lastTrade = price.price
    lastTradeDate = date
    sells += 1
    trades.push({
      date, side: '卖出', ...price, ...fill, amount: proceeds, quantity, shares, capitalUsed,
      pnl: cash + shares * price.price - openingAmount,
    })
  }

  for (const candle of candles) {
    if (candle.date !== openDate) {
      if (!anchored && candle.date > adjustments.anchor!.after) {
        lastTrade = adjustments.anchor!.price
        anchored = true
      }
      const params = paramsAt(candle.date)
      const buyPrice = tick(lastTrade - params.step + params.rebound)
      const sellPrice = tick(lastTrade + params.step - params.pullback)
      const belowFloor = row.floorPrice !== undefined && buyPrice < row.floorPrice
      if (belowFloor && !buyingStopped) {
        buyingStopped = true
        floorHitDate = candle.date
      }
      if (!buyingStopped && candle.low <= buyPrice) buy(candle.date, buyPrice)
      else if (candle.high >= sellPrice) sell(candle.date, sellPrice)
    }
    series.push({
      date: candle.date,
      current: candle.close,
      positionValue: shares * candle.close,
      capitalUsed,
      pnl: cash + shares * candle.close - openingAmount,
    })
  }

  const current = candles[candles.length - 1]?.close ?? openingPrice
  const value = cash + shares * current
  const nextBuy = tick(lastTrade - row.step + row.rebound)
  const nextSell = tick(lastTrade + row.step - row.pullback)
  const result = applyLedger(row, {
    range: candles.length ? `${candles[0].date} ～ ${candles[candles.length - 1].date}` : row.date,
    current, lastTradeDate, lastTrade, nextBuy, nextSell, buyTrigger: nextBuy, sellTrigger: nextSell,
    pnl: value - openingAmount, value, realized, maxCapital, buys, sells, trades, series, position: shares,
    ...(floorHitDate ? { floorHitDate } : {}),
    ...(warnings.length ? { warnings } : {}),
  }, adjustments)
  return row.budget !== undefined && result.maxCapital > row.budget ? { ...result, budgetExceeded: true } : result
}

function applyLedger(row: GridParams, base: GridResult, adjustments: Adjustments): GridResult {
  const manual = adjustments.manual ?? [], removed = new Set(adjustments.removed ?? []);
  const gridRemoved = base.trades.filter((trade, index) => index > 0 && !trade.manual && removed.has(trade.date));
  if (!manual.length && !gridRemoved.length) return base;
  const openingAmount = base.trades[0].amount;
  // 一笔成交对现金、持仓、占用本金的影响；sign = -1 表示撤销这笔成交。
  const effect = (side: string, amount: number, quantity: number, sign: 1 | -1) => {
    const buy = side === '买入';
    return {
      ds: (buy ? quantity : -quantity) * sign,
      dcash: (buy ? -amount - calculateFee(row.code, buy ? '买入' : '卖出', amount) : amount - calculateFee(row.code, buy ? '买入' : '卖出', amount)) * sign,
      dcap: (buy ? amount : -amount) * sign,
      dbuys: (buy ? 1 : 0) * sign, dsells: (buy ? 0 : 1) * sign,
    };
  };
  type Change = ReturnType<typeof effect> & { date: string; order: number; seq: number; manual?: ManualTrade };
  const changes: Change[] = [];
  gridRemoved.forEach(trade => changes.push({ ...effect(trade.side, trade.amount, trade.quantity ?? trade.amount / trade.price, -1), date: trade.date, order: 0, seq: changes.length }));
  manual.forEach(item => changes.push({ ...effect(item.side, item.price * item.shares, item.shares, 1), date: item.date, order: 1, seq: changes.length, manual: item }));
  changes.sort((a, b) => a.date.localeCompare(b.date) || a.order - b.order || a.seq - b.seq);

  // 模拟结果在某日的状态：取当日或此前最后一笔模拟成交的持仓、占用本金与现金。
  const baseAt = (date: string) => {
    let index = 0;
    base.trades.forEach((trade, i) => { if (trade.date <= date) index = i; });
    const trade = base.trades[index];
    return { shares: trade.shares, capitalUsed: trade.capitalUsed ?? 0, cash: index === 0 ? -calculateFee(row.code, '建仓', openingAmount) : trade.pnl + openingAmount - trade.shares * trade.price };
  };
  const manualRows: Trade[] = [];
  let cumulative = { ds: 0, dcash: 0, dcap: 0 };
  for (const change of changes) {
    cumulative = { ds: cumulative.ds + change.ds, dcash: cumulative.dcash + change.dcash, dcap: cumulative.dcap + change.dcap };
    const item = change.manual;
    if (!item) continue;
    const start = baseAt(item.date), sharesAfter = start.shares + cumulative.ds;
    manualRows.push({
      manual: true, id: item.id, date: item.date, side: item.side, price: item.price, amount: item.price * item.shares, quantity: item.shares,
      shares: sharesAfter, capitalUsed: start.capitalUsed + cumulative.dcap,
      pnl: start.cash + cumulative.dcash + sharesAfter * item.price - openingAmount,
    });
  }
  // 列表按日期排序：同一天模拟成交在前、手动记录在后。
  const trades = [...base.trades.filter((trade, index) => index === 0 || !removed.has(trade.date)), ...manualRows].sort((a, b) => a.date.localeCompare(b.date));

  const total = changes.reduce((sum, change) => ({ ds: sum.ds + change.ds, dcash: sum.dcash + change.dcash, dbuys: sum.dbuys + change.dbuys, dsells: sum.dsells + change.dsells }), { ds: 0, dcash: 0, dbuys: 0, dsells: 0 });
  // 曲线：自增删当日起逐日叠加累计影响。
  let pointer = 0, run = { ds: 0, dcash: 0, dcap: 0 };
  const series = base.series.map(point => {
    while (pointer < changes.length && changes[pointer].date <= point.date) {
      run = { ds: run.ds + changes[pointer].ds, dcash: run.dcash + changes[pointer].dcash, dcap: run.dcap + changes[pointer].dcap };
      pointer++;
    }
    return { ...point, positionValue: point.positionValue + run.ds * point.current, capitalUsed: point.capitalUsed + run.dcap, pnl: point.pnl + run.dcash + run.ds * point.current };
  });
  const delta = total.dcash + total.ds * base.current;

  // 下一格基准：列表最上面一条不是模拟的最后一笔时，以它的成交价为上次成交价。
  const top = trades[trades.length - 1]!;
  const topIsBaseLast = !top.manual && top.date === base.lastTradeDate;
  const lastTrade = topIsBaseLast ? base.lastTrade : top.price, lastTradeDate = topIsBaseLast ? base.lastTradeDate : top.date;
  const nextBuy = tick(lastTrade - row.step + row.rebound), nextSell = tick(lastTrade + row.step - row.pullback);
  return {
    ...base, trades, series, lastTrade, lastTradeDate, nextBuy, nextSell, buyTrigger: nextBuy, sellTrigger: nextSell,
    pnl: base.pnl + delta, value: base.value + delta, position: (base.position ?? 0) + total.ds,
    maxCapital: series.length ? Math.max(...series.map(point => point.capitalUsed)) : openingAmount,
    buys: base.buys + total.dbuys, sells: base.sells + total.dsells,
  };
}
