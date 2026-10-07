import handler from '../../api/candidates-sync.ts'
import { toPagesFunction } from '../../server/edge/adapter.mjs'

export const onRequest = toPagesFunction(handler)
