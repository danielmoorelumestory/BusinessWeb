import { describe, expect, it } from 'vitest';
import { panViewport, zoomViewport } from './chart-viewport';

describe('zoomViewport', () => {
  it('以中心放大、缩小', () => {
    expect(zoomViewport(1000, { start: 400, end: 599 }, .5)).toEqual({ start: 450, end: 549 });
    expect(zoomViewport(1000, { start: 400, end: 599 }, 2)).toEqual({ start: 300, end: 699 });
  });
  it('以右端为不动点放大时最右一根不变', () => {
    expect(zoomViewport(1000, { start: 800, end: 999 }, .5, 1)).toEqual({ start: 900, end: 999 });
  });
  it('不少于最少根数，不超过总数', () => {
    expect(zoomViewport(1000, { start: 0, end: 29 }, .1)).toEqual({ start: 5, end: 24 });
    expect(zoomViewport(1000, { start: 100, end: 899 }, 5)).toEqual({ start: 0, end: 999 });
    expect(zoomViewport(10, { start: 0, end: 9 }, .2)).toEqual({ start: 0, end: 9 });
  });
  it('靠边缩小时整体挪回范围内', () => {
    expect(zoomViewport(1000, { start: 900, end: 999 }, 3, .5)).toEqual({ start: 700, end: 999 });
  });
});

describe('panViewport', () => {
  it('平移并保持长度', () => {
    expect(panViewport(1000, { start: 100, end: 199 }, 30)).toEqual({ start: 130, end: 229 });
    expect(panViewport(1000, { start: 100, end: 199 }, -30.4)).toEqual({ start: 70, end: 169 });
  });
  it('到头为止', () => {
    expect(panViewport(1000, { start: 10, end: 109 }, -50)).toEqual({ start: 0, end: 99 });
    expect(panViewport(1000, { start: 880, end: 979 }, 50)).toEqual({ start: 900, end: 999 });
  });
  it('空数据', () => {
    expect(panViewport(0, { start: 0, end: 0 }, 1)).toEqual({ start: 0, end: -1 });
  });
});
