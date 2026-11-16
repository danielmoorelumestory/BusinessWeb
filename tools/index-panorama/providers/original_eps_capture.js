/* 在已打开的 https://lishenqi.vip/#/panorama 页面里执行（DevTools / chrome-devtools MCP evaluate_script）。
   只调用页面自身只读的 PANO_IX.panel() 与 PANO_IX.series(code,'all',PANO_IX.FIELDS)
   （= 详情页点「全部」区间时页面发出的同一请求），顺序执行、每次间隔 1.5 秒、遇错即停；
   只保留 d/eps 与采样元数据，不读取任何 cookie/token/请求头。输出保存为
   data/providers/original_eps_raw/capture.json，再由 providers/original_eps.py 离线解析。
   可选参数 onlyCodes（本地代码数组）只抓其中几只，用于冒烟；不传时与原来一样抓全部映射。
   无人值守：refresh_runner.py 用 Playwright Chromium 正常打开页面后 page.evaluate(本函数, onlyCodes)。 */
async (onlyCodes) => {
  const MAP = {
    '000001.SH': '000001.SH', '399001.SZ': '399001.SZ', '399006.SZ': '399006.SZ', '000688.SH': '000688.SH',
    '000016.SH': '000016.SH', '000300.SH': '000300.SH', '000905.SH': '000905.SH', '000852.SH': '000852.SH',
    '000903.SH': '000903.SH', '000906.SH': '000906.SH', '000922.CSI': '000922.SH', '399967.SZ': '399967.SZ',
    '399975.SZ': '399975.SZ', '399986.SZ': '399986.SZ', '000827.SH': '000827.SH',
    'HSI.HK': 'HSI.HI', 'HSTECH.HK': 'HSTECH.HI', 'HSCEI.HK': 'HSCEI.HI', 'SPX.US': 'SPX.GI', 'IXIC.US': 'IXIC.GI'
  };
  const p = await PANO_IX.panel();
  const roster = {};
  (p.roster || []).forEach(x => { roster[x.code] = x.name; });
  const out = { capturedAt: new Date().toISOString(), page: location.href, range: 'all',
    via: "PANO_IX.series(code,'all',PANO_IX.FIELDS) → Cloud.call('lsqSiteAdmin',{action:'ixSeries'})",
    panelDay: p.day, unitEps: p.u && p.u.eps, roster, series: {}, errors: [] };
  const keys = Array.isArray(onlyCodes) && onlyCodes.length ? Object.keys(MAP).filter(k => onlyCodes.includes(k)) : Object.keys(MAP);
  if (Array.isArray(onlyCodes) && onlyCodes.length) out.onlyCodes = keys;
  for (const local of keys) {
    const code = MAP[local];
    if (!(code in roster)) { out.errors.push(local + ': 原站名册无 ' + code); continue; }
    try {
      const s = await PANO_IX.series(code, 'all', PANO_IX.FIELDS);
      out.series[local] = { origCode: code, origName: roster[code], freq: s.freq, step: s.step, first: s.first,
        last: s.last, points: s.points, dailyPoints: s.dailyPoints, shards: s.shards,
        errors: s.errors, d: s.d, eps: s.eps };
    } catch (e) {
      out.errors.push(local + ': ' + String(e));
      break; /* 遇错（含限流）即停，不重试 */
    }
    await new Promise(r => setTimeout(r, 1500));
  }
  return out;
}
