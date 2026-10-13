const availability = status => status === 'ready' || status === 'undated' ? 2 : status === 'partial' ? 1 : 0
const partialSize = (snapshot, id) => id === 'indices' ? snapshot.indices.length : id === 'amountRank' ? snapshot.rankings.amount.length : id === 'turnoverRank' ? snapshot.rankings.turnover.length : 0

// 同交易日保留整份快照及原采集时间，任何已成功的来源都不能因另一来源恢复而被清空。
export function canReplaceSnapshot(previous, next) {
  if (next.fetchedAt <= previous.fetchedAt) return false
  return previous.sources.every(source => {
    const replacement = next.sources.find(candidate => candidate.id === source.id)
    const before = availability(source.status), after = availability(replacement?.status)
    return after > before || (after === before && (source.status !== 'partial' || partialSize(next, source.id) >= partialSize(previous, source.id)))
  })
}
