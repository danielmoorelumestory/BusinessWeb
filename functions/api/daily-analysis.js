import handler from '../../server/functions/daily-analysis.js'
import { toPagesFunction } from '../../server/edge/adapter.mjs'

export const onRequest = toPagesFunction(handler)
