import type { DailySnapshot } from '../src/features/daily-analysis/types'
export function buildBackfill(options?: { fetchImpl?: typeof fetch; days?: number; now?: Date; history?: DailySnapshot[] }): Promise<{ snapshots: DailySnapshot[]; skipped: Array<{ date: string; reason: string }> }>
