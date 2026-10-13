import type { DailySnapshot } from '../src/features/daily-analysis/types'
export function readDailyArchive(): Promise<DailySnapshot[]>
export function buildDailyAnalysis(options?: { fetchImpl?: typeof fetch; now?: Date; history?: DailySnapshot[] }): Promise<DailySnapshot>
export function handleDailyAnalysis(req: { method?: string; query?: Record<string, unknown> }, res: { setHeader(key: string, value: string): void; status(code: number): any; json(body: unknown): any; end(): any }, builder?: () => Promise<DailySnapshot>): Promise<unknown>
export function dailyAnalysisMiddleware(req: unknown, res: unknown, next: () => void): void
