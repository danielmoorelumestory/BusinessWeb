import type { Period } from '../src/utils/etfTechnicalDescription';
export type TechnicalBar = (string | number)[];
export function technicalState(bars: TechnicalBar[], complete?: boolean): Period | null;
export function aggregateBars(bars: TechnicalBar[], period: 'week' | 'month'): TechnicalBar[];
