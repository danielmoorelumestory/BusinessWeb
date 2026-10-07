import handler from '../../api/grid-sync.ts'
import { toPagesFunction } from '../../server/edge/adapter.mjs'

export const onRequest = toPagesFunction(handler)
