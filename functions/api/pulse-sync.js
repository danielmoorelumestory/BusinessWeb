import handler from '../../api/pulse-sync.ts'
import { toPagesFunction } from '../../server/edge/adapter.mjs'

export const onRequest = toPagesFunction(handler)
