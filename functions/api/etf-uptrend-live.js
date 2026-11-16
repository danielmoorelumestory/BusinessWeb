import handler from '../../server/etf-uptrend-live.mjs'
import { toPagesFunction } from '../../server/edge/adapter.mjs'

export const onRequest = toPagesFunction(handler)
