/*
 * 指数全景 · 首页模块（PanoHome）
 * 契约：window.PanoHome = {render(container, indices, options), dispose()}
 * options: {range:'10', anchor:'YYYY-MM-DD', anchorNote:'锚点说明文字', onSelect(code), favorites:[codes],
 *           onToggleFavorite(code)->codes, onRangeChange(range)}
 * 所有统计调用 window.PanoMath（stats/compare），本模块不另起一套统计口径；
 * PanoMath 未加载时相应区块显示空态。不生成任何演示/假数据。
 */
(function (root) {
  'use strict';

  var CATEGORIES = ['全局坐标', '核心宽基', '宽基谱系', '行业与主题', '行业指数', '跨境对照'];
  var RANGES = [['1', '近1年'], ['3', '近3年'], ['5', '近5年'], ['10', '近10年'], ['all', '全部']];
  var RANGE_LABEL = { '1': '近1年', '3': '近3年', '5': '近5年', '10': '近10年', 'all': '全部历史' };
  // 四条大盘主线：按代码精确匹配，代码不在数据里则显示缺失卡
  var MAIN_LINES = [
    { code: '000001.SH', name: '上证指数', hint: '全市场方向' },
    { code: '399001.SZ', name: '深证成指', hint: '深市权重' },
    { code: '399006.SZ', name: '创业板指', hint: '成长风向' },
    { code: '000688.SH', name: '科创50', hint: '硬科技' }
  ];
  var PALETTE = ['#1d5c9e', '#a8741a', '#0f6e56', '#c0392b', '#6b5ca5', '#1f8fb5', '#c8692f', '#5b6b7f'];
  var MAX_OVERLAY = 8;
  var SORTS = [['default', '默认'], ['chg', '按涨跌'], ['pct', '按PE分位'], ['dy', '按股息率']];

  // ---------------- 工具 ----------------
  // 以外部值（代码/分类）为键的字典一律无原型，避免 constructor/toString 等键命中继承属性
  function dict() { return Object.create(null); }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function isNum(v) { return typeof v === 'number' && isFinite(v); }
  function fmtNum(v, dp) {
    if (!isNum(v)) return '—';
    dp = dp == null ? 2 : dp;
    return v.toLocaleString('zh-CN', { minimumFractionDigits: dp, maximumFractionDigits: dp });
  }
  function fmtPct(v, dp, signed) {
    if (!isNum(v)) return '—';
    dp = dp == null ? 2 : dp;
    var s = v.toFixed(dp);
    if (signed !== false && v > 0) s = '+' + s;
    return s + '%';
  }
  function fmtYi(v) {
    if (!isNum(v)) return '—';
    if (Math.abs(v) >= 10000) return fmtNum(v / 10000, 2) + '万亿';
    return fmtNum(v, Math.abs(v) >= 100 ? 0 : 1) + '亿';
  }
  function cls(v) { return !isNum(v) ? 'flat' : v > 0 ? 'up' : v < 0 ? 'down' : 'flat'; }
  function arr(s, f) { return s && Array.isArray(s[f]) ? s[f] : []; }
  function lastValid(s, field) {
    var a = arr(s, field), d = arr(s, 'd');
    for (var i = Math.min(a.length, d.length) - 1; i >= 0; i--) {
      if (isNum(a[i])) return { value: a[i], date: d[i], index: i };
    }
    return { value: null, date: null, index: -1 };
  }
  // 最新收盘与同日涨跌（涨跌只取与收盘同一日期的值，不跨日拼接）
  function latestQuote(s) {
    var p = lastValid(s, 'price');
    var chg = null;
    if (p.index >= 0) {
      var c = arr(s, 'chg')[p.index];
      if (isNum(c)) chg = c;
    }
    return { price: p.value, date: p.date, chg: chg, index: p.index };
  }
  function math() { return root.PanoMath || null; }
  function safeStats(s, metric, range, anchor) {
    var M = math();
    if (!M || typeof M.stats !== 'function') return null;
    try { return M.stats(s, metric, range, anchor) || null; } catch (e) { return null; }
  }
  function safeCompare(list, range, anchor) {
    var M = math();
    if (!M || typeof M.compare !== 'function') return { error: 'nomath' };
    try { return M.compare(list, range, anchor) || { error: 'empty' }; } catch (e) { return { error: 'fail', message: e && e.message }; }
  }
  // ---- 稀疏样本门槛（金融呈现；不改 PanoMath）：有效观测 < MIN_HIST 时单期 ECDF 恒为 100%，不当作长期分位 ----
  var MIN_HIST = 2;
  var FREQ_CN = { daily: '日频', weekly: '周频', monthly: '月频', quarterly: '季频', annual: '年频', single: '单期', irregular: '不定期' };
  var FREQ_ALIAS = {
    daily: 'daily', day: 'daily', trading_day: 'daily', '日': 'daily', '日频': 'daily',
    weekly: 'weekly', week: 'weekly', '周': 'weekly', '周频': 'weekly',
    monthly: 'monthly', month: 'monthly', month_end: 'monthly', '月': 'monthly', '月频': 'monthly',
    quarterly: 'quarterly', quarter: 'quarterly', '季': 'quarterly', '季频': 'quarterly',
    annual: 'annual', yearly: 'annual', '年': 'annual', '年频': 'annual',
    single: 'single', snapshot: 'single', latest: 'single', '单期': 'single',
    irregular: 'irregular', '不定期': 'irregular'
  };
  // 来源声明频率：sources[f].frequency 优先，其次 availability[f].frequency
  function declaredFreq(s, f) {
    var src = s && s.sources && s.sources[f], av = s && s.availability && s.availability[f];
    var cands = [src && typeof src === 'object' ? src.frequency : null, av && typeof av === 'object' ? av.frequency : null];
    for (var i = 0; i < cands.length; i++) {
      var k = cands[i] == null ? '' : String(cands[i]).trim().toLowerCase();
      if (k && Object.prototype.hasOwnProperty.call(FREQ_ALIAS, k)) return FREQ_ALIAS[k];
    }
    return null;
  }
  // 分位展示状态：none（无观测）/ sparse（单期或来源声明单期）/ ok
  function pctView(s, f, stt) {
    var n = stt && isNum(stt.count) ? stt.count : 0;
    var fq = declaredFreq(s, f);
    if (!n) return { kind: 'none', n: 0, freq: fq };
    if (n < MIN_HIST || fq === 'single' || !isNum(stt.percentile)) return { kind: 'sparse', n: n, freq: fq };
    return { kind: 'ok', n: n, freq: fq, pct: stt.percentile };
  }
  var SPARSE_TXT = '仅单期·历史样本不足';
  function freqTag(fq) { return fq && fq !== 'daily' ? ' ' + FREQ_CN[fq] : ''; }
  function emptyBox(title, text) {
    return '<div class="empty"><strong>' + esc(title) + '</strong>' + esc(text || '') + '</div>';
  }
  function findByCode(indices, code) {
    for (var i = 0; i < indices.length; i++) if (indices[i] && indices[i].code === code) return indices[i];
    return null;
  }
  function chartsAvailable() { return !!(root.echarts && typeof root.echarts.init === 'function'); }
  function oneYearAgo(iso) {
    var y = +iso.slice(0, 4) - 1, md = iso.slice(5);
    if (md === '02-29') md = '02-28';
    return y + '-' + md;
  }

  // ---------------- 模块状态 ----------------
  var st = {
    container: null, indices: [], opts: {}, charts: {}, sort: 'default', dir: 1,
    cat: 'all', overlay: null, onClick: null, onChange: null, onResize: null, resizeTimer: 0
  };

  function rangeOf() { return st.opts.range || '10'; }
  function favSet() {
    var f = dict(); (st.opts.favorites || []).forEach(function (c) { f[c] = true; }); return f;
  }

  // ---------------- 区块：页头 ----------------
  function headerHTML() {
    var r = rangeOf();
    var seg = RANGES.map(function (x) {
      return '<button type="button" data-action="range" data-key="' + x[0] + '" aria-pressed="' + (x[0] === r) + '">' + x[1] + '</button>';
    }).join('');
    var note = st.opts.anchorNote || (st.opts.anchor ? '统计截至 ' + st.opts.anchor : '');
    return '<div class="page-hd"><div><div class="title-row"><h1 id="homeTitle" tabindex="-1">指数全景</h1>' +
      '<span class="tag plain">收盘数据 · 静态数据包</span></div>' +
      '<span class="upd">' + (note ? esc(note) + ' · ' : '') + '各指数最新日期可能不同，均标注在数值旁' +
      (st.opts.notesCount ? ' · <button type="button" class="link-btn" data-action="notes">数据说明 ' + st.opts.notesCount + ' 条 ↓</button>' : '') + '</span></div>' +
      '<div class="range-pick">分位统计区间 <span class="seg seg-gold" role="group" aria-label="统计区间">' + seg + '</span></div></div>';
  }

  // ---------------- 区块：四大盘 ----------------
  function sparkSVG(s) {
    var q = lastValid(s, 'price');
    if (q.index < 1) return '';
    var cut = oneYearAgo(q.date), d = arr(s, 'd'), p = arr(s, 'price'), pts = [];
    for (var i = 0; i <= q.index; i++) if (d[i] >= cut && isNum(p[i])) pts.push(p[i]);
    if (pts.length < 2) return '';
    var min = Math.min.apply(null, pts), max = Math.max.apply(null, pts), span = max - min || 1;
    var W = 200, H = 30, step = W / (pts.length - 1);
    var path = pts.map(function (v, k) {
      return (k ? 'L' : 'M') + (k * step).toFixed(1) + ' ' + (H - 2 - (v - min) / span * (H - 4)).toFixed(1);
    }).join('');
    var color = pts[pts.length - 1] >= pts[0] ? 'var(--up)' : 'var(--down)';
    return '<svg viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="none" aria-hidden="true" focusable="false">' +
      '<path d="' + path + '" fill="none" stroke="' + color + '" stroke-width="1.5" vector-effect="non-scaling-stroke"/></svg>';
  }
  function mainLinesHTML() {
    var cards = MAIN_LINES.map(function (m) {
      var s = findByCode(st.indices, m.code);
      if (!s) {
        return '<div class="line-card missing" role="group" aria-label="' + esc(m.name) + ' 无数据">' +
          '<div class="lc-top"><span class="lc-name">' + esc(m.name) + '</span><span class="lc-code">' + esc(m.code) + '</span></div>' +
          '<div class="lc-hint">数据包中没有该指数，暂无行情。</div></div>';
      }
      var q = latestQuote(s);
      var y1 = safeStats(s, 'price', '1');
      var pe = safeStats(s, 'pe', rangeOf(), st.opts.anchor);
      var pv = pctView(s, 'pe', pe);
      var peTxt = pv.kind === 'ok' ?
        'PE ' + fmtNum(pe.latest, 2) + ' · ' + RANGE_LABEL[rangeOf()] + '分位 ' + fmtPct(pv.pct, 1, false) + '（n=' + pv.n + freqTag(pv.freq) + '）' :
        pv.kind === 'sparse' ? 'PE ' + fmtNum(pe.latest, 2) + '（' + pe.latestDate + '）· ' + SPARSE_TXT :
        'PE 暂无数据';
      return '<button type="button" class="line-card" data-action="open" data-code="' + esc(s.code) + '" aria-label="查看' + esc(s.name) + '详情">' +
        '<span class="lc-top"><span class="lc-name">' + esc(s.name || m.name) + '</span><span class="lc-code">' + esc(s.code) + '</span></span>' +
        '<span class="lc-hint">' + esc(m.hint) + '</span>' +
        '<span class="lc-q"><span class="lc-price">' + fmtNum(q.price, 2) + '</span><span class="lc-chg ' + cls(q.chg) + '">' + fmtPct(q.chg) + '</span></span>' +
        '<span class="lc-row"><span>' + (q.date ? esc(q.date) + ' 收盘' : '无收盘数据') + '</span>' +
        '<span class="' + cls(y1 && y1.changePct) + '">近1年 ' + fmtPct(y1 && y1.count > 1 ? y1.changePct : null) + '</span></span>' +
        '<span class="lc-pe" style="display:block">' + esc(peTxt) + '</span>' + sparkSVG(s) +
        '<span class="lc-go">查看详情 ›</span></button>';
    }).join('');
    return '<section aria-labelledby="hMain"><h2 class="sec-t" id="hMain" style="margin-top:6px">四条大盘主线 <span>先看方向，再决定往哪一块走 · 迷你线为近1年收盘点位</span></h2>' +
      '<div class="mainlines">' + cards + '</div></section>';
  }

  // ---------------- 区块：全景榜 ----------------
  function buildRows() {
    var r = rangeOf(), anchor = st.opts.anchor;
    var mainOrder = dict(); MAIN_LINES.forEach(function (m, i) { mainOrder[m.code] = i; });
    return st.indices.map(function (s, i) {
      var q = latestQuote(s);
      var pe = lastValid(s, 'pe');
      var peSt = safeStats(s, 'pe', r, anchor);
      var pv = pctView(s, 'pe', peSt);
      return {
        s: s, order: (s.code in mainOrder) ? mainOrder[s.code] - 100 : i, q: q,
        pe: pe, pct: pv.kind === 'ok' ? pv.pct : null, pctKind: pv.kind, pctFreq: pv.freq,
        pctN: pv.n,
        pb: lastValid(s, 'pb'), dy: lastValid(s, 'dy'), amt: lastValid(s, 'amt')
      };
    });
  }
  function sortRows(rows) {
    var k = st.sort, dir = st.dir;
    function cmpNull(a, b) {
      var an = isNum(a), bn = isNum(b);
      if (!an && !bn) return 0; if (!an) return 1; if (!bn) return -1;
      return (a - b) * dir;
    }
    rows.sort(function (a, b) {
      var c = 0;
      if (k === 'chg') c = cmpNull(a.q.chg, b.q.chg);
      else if (k === 'pct') c = cmpNull(a.pct, b.pct);
      else if (k === 'dy') c = cmpNull(a.dy.value, b.dy.value);
      return c || (a.order - b.order);
    });
    return rows;
  }
  function defaultDir(k) { return k === 'pct' ? 1 : -1; } // 分位默认由低到高，涨跌/股息率默认由高到低
  function pctCell(row) {
    if (row.pctKind === 'sparse') {
      return '<span class="muted pct-sparse" title="有效观测不足 ' + MIN_HIST + ' 个，单期分位恒为100%，不代表长期位置">' + SPARSE_TXT + '</span>' +
        '<span class="date">n=' + row.pctN + freqTag(row.pctFreq) + '</span>';
    }
    if (!isNum(row.pct)) return '<span class="muted">—</span>';
    var c = row.pct >= 80 ? 'hot' : row.pct <= 20 ? 'cold' : '';
    return '<span class="pct-bar"><span class="num">' + fmtPct(row.pct, 1, false) + '</span><span class="bar" aria-hidden="true"><i class="' + c + '" style="width:' + Math.max(2, Math.min(100, row.pct)).toFixed(0) + '%"></i></span></span>' +
      '<span class="date">n=' + row.pctN + freqTag(row.pctFreq) + (row.pctN < 60 ? ' 样本少' : '') + '</span>';
  }
  function rankHTML() {
    var favs = favSet();
    var rows = buildRows();
    if (st.cat === 'fav') rows = rows.filter(function (r) { return favs[r.s.code]; });
    else if (st.cat !== 'all') rows = rows.filter(function (r) { return r.s.category === st.cat; });
    sortRows(rows);
    var cats = [['all', '全部']].concat(CATEGORIES.filter(function (c) {
      return st.indices.some(function (s) { return s.category === c; });
    }).map(function (c) { return [c, c]; }));
    var extra = st.indices.filter(function (s) { return CATEGORIES.indexOf(s.category) < 0; }).map(function (s) { return s.category || '未分类'; });
    extra.filter(function (c, i) { return extra.indexOf(c) === i; }).forEach(function (c) { cats.push([c, c]); });
    cats.push(['fav', '★ 收藏']);
    var catSeg = cats.map(function (c) {
      return '<button type="button" data-action="cat" data-key="' + esc(c[0]) + '" aria-pressed="' + (st.cat === c[0]) + '">' + esc(c[1]) + '</button>';
    }).join('');
    var sortSeg = SORTS.map(function (x) {
      var on = st.sort === x[0];
      var arrow = on && x[0] !== 'default' ? (st.dir > 0 ? ' ↑' : ' ↓') : '';
      return '<button type="button" data-action="sort" data-key="' + x[0] + '" aria-pressed="' + on + '">' + x[1] + arrow + '</button>';
    }).join('');
    var head = '<div class="card-hd"><h2 id="hRank">指数全景榜</h2>' +
      '<div class="tools"><span class="seg" role="group" aria-label="排序">' + sortSeg + '</span></div></div>' +
      '<p class="cs">同一天横向比较：谁强谁弱、谁贵谁便宜。点行进入详情，再次点击排序可反向。</p>' +
      '<div class="rank-filter"><span class="seg" role="group" aria-label="按分类筛选">' + catSeg + '</span></div>';
    if (!st.indices.length) return '<section class="card" aria-labelledby="hRank">' + head + emptyBox('暂无指数数据', '数据包未加载或为空，可通过顶部“导入 CSV”补充本次会话数据。') + '</section>';
    if (!rows.length) return '<section class="card" aria-labelledby="hRank">' + head + emptyBox(st.cat === 'fav' ? '还没有收藏' : '该分类暂无指数', st.cat === 'fav' ? '点击行首或左侧导航的 ☆ 收藏常看的指数。' : '') + '</section>';
    var body = rows.map(function (r) {
      var s = r.s, on = !!favs[s.code];
      return '<tr data-action="open" data-code="' + esc(s.code) + '">' +
        '<td><button type="button" class="star-btn" data-action="fav" data-code="' + esc(s.code) + '" aria-pressed="' + on + '" aria-label="' + (on ? '取消收藏 ' : '收藏 ') + esc(s.name) + '">' + (on ? '★' : '☆') + '</button> ' +
        '<button type="button" class="name-btn" data-action="open" data-code="' + esc(s.code) + '">' + esc(s.name || s.code) + '</button><span class="code">' + esc(s.code) + '</span></td>' +
        '<td><span class="num">' + fmtNum(r.q.price, 2) + '</span><span class="date">' + esc(r.q.date || '无数据') + '</span></td>' +
        '<td class="num ' + cls(r.q.chg) + '">' + fmtPct(r.q.chg) + '</td>' +
        '<td><span class="num">' + fmtNum(r.pe.value, 2) + '</span>' + (r.pe.date && r.pe.date !== r.q.date ? '<span class="date">' + esc(r.pe.date) + '</span>' : '') + '</td>' +
        '<td class="pct-col">' + pctCell(r) + '</td>' +
        '<td><span class="num">' + fmtNum(r.pb.value, 2) + '</span>' + (r.pb.date && r.pb.date !== r.q.date ? '<span class="date">' + esc(r.pb.date) + '</span>' : '') + '</td>' +
        '<td><span class="num">' + fmtPct(r.dy.value, 2, false) + '</span>' + (r.dy.date && r.dy.date !== r.q.date ? '<span class="date">' + esc(r.dy.date) + '</span>' : '') + '</td>' +
        '<td><span class="num">' + fmtYi(r.amt.value) + '</span>' + (r.amt.date && r.amt.date !== r.q.date ? '<span class="date">' + esc(r.amt.date) + '</span>' : '') + '</td>' +
        '<td><span class="go" aria-hidden="true">详情 ›</span></td>' +
        '</tr>';
    }).join('');
    var note = math() ? 'PE 分位 = ' + RANGE_LABEL[rangeOf()] + '内实际非空 PE 观测中 ≤ 最新值的占比，n 为区间内实际样本数（非日频标注来源声明频率；选择区间长度不代表数据已覆盖该区间）；不足 ' + MIN_HIST + ' 个观测标“' + SPARSE_TXT + '”、不评冷热、排序置后。低于 20% 绿色、高于 80% 红色。灰色小字为该字段自身日期（与收盘日不同）。成交额统一为人民币亿元，港股按来源注明的同日参考汇率换算（详见各指数详情“来源与覆盖”）。' :
      '统计模块 analytics.js 未加载，PE 分位暂不可用。';
    return '<section class="card" aria-labelledby="hRank">' + head +
      '<div class="table-wrap" tabindex="0" role="region" aria-label="指数全景榜，可横向滚动"><table class="grid"><thead><tr>' +
      '<th scope="col">指数</th><th scope="col">收盘(点)</th><th scope="col">涨跌</th>' +
      '<th scope="col">PE(倍)</th><th scope="col">PE分位·' + esc(RANGE_LABEL[rangeOf()]) + '</th><th scope="col">PB(倍)</th><th scope="col">股息率</th><th scope="col">成交额</th><th scope="col"><span class="visually-hidden">详情</span></th>' +
      '</tr></thead><tbody>' + body + '</tbody></table></div>' +
      '<details class="note-more"><summary>共 ' + rows.length + ' 只 · 分位与日期口径说明</summary><p>' + esc(note) + '</p></details></section>';
  }

  // ---------------- 区块：分类平均涨跌 ----------------
  // 红涨绿跌连续色阶（±3% 封顶）：绿 #0f6e56 → 米 #e8d9a8 → 红 #c0392b
  function mix(a, b, t) { return a.map(function (x, i) { return Math.round(x + (b[i] - x) * t); }); }
  function heatColor(v) {
    if (!isNum(v)) return { bg: '#eef1f5', light: true };
    var t = Math.max(-1, Math.min(1, v / 3)), mid = [232, 217, 168];
    var rgb = t >= 0 ? mix(mid, [192, 57, 43], t) : mix(mid, [15, 110, 86], -t);
    return { bg: 'rgb(' + rgb.join(',') + ')', light: Math.abs(t) < 0.45 };
  }
  function heatHTML() {
    var groups = dict(), order = [];
    st.indices.forEach(function (s) {
      var c = s.category || '未分类';
      if (!groups[c]) { groups[c] = []; order.push(c); }
      groups[c].push(s);
    });
    order.sort(function (a, b) {
      var ia = CATEGORIES.indexOf(a), ib = CATEGORIES.indexOf(b);
      return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
    });
    var head = '<div class="card-hd"><h2 id="hHeat">风格轮动</h2></div><p class="cs">按分类看各组平均涨跌（同日收盘等权）；点色块筛选上方榜单</p>';
    if (!order.length) return '<section class="card" aria-labelledby="hHeat">' + head + emptyBox('暂无数据', '') + '</section>';
    var cells = order.map(function (c) {
      var mem = groups[c].map(function (s) { return { s: s, q: latestQuote(s) }; });
      var D = null;
      mem.forEach(function (m) { if (isNum(m.q.chg) && (!D || m.q.date > D)) D = m.q.date; });
      var used = mem.filter(function (m) { return D && m.q.date === D && isNum(m.q.chg); });
      var avg = used.length ? used.reduce(function (t, m) { return t + m.q.chg; }, 0) / used.length : null;
      var skipped = mem.length - used.length;
      var col = heatColor(avg);
      var excluded = mem.filter(function (m) { return used.indexOf(m) < 0; }).map(function (m) { return m.s.name + '（' + (m.q.date || '无数据') + '）'; });
      var title = c + '：' + (D ? D + ' 收盘，计入 ' + used.length + ' 只' + (skipped ? '；未计入（非本组同日）：' + excluded.join('、') : '') : '无同日涨跌数据');
      return '<button type="button" class="heat-cell' + (col.light ? ' light' : '') + '" style="background:' + col.bg + '" data-action="cat" data-key="' + esc(c) + '" aria-pressed="' + (st.cat === c) + '" title="' + esc(title) + '" aria-label="' + esc(title + '，平均涨跌 ' + fmtPct(avg)) + '">' +
        '<span class="hn">' + esc(c) + '</span><span class="hv">' + fmtPct(avg) + '</span>' +
        '<span class="hm">' + (D ? esc(D.slice(5)) + ' · ' + used.length + '/' + mem.length + ' 只' + (skipped ? ' · ' + skipped + ' 只异日' : '') : '无同日数据') + '</span></button>';
    }).join('');
    return '<section class="card" aria-labelledby="hHeat">' + head + '<div class="heat">' + cells + '</div>' +
      '<div class="hlegend"><span>跌</span><span class="gb" aria-hidden="true"></span><span>涨</span><span style="margin-left:auto">色深按 ±3% 封顶；“异日”成员不计入平均</span></div></section>';
  }

  // ---------------- 区块：跨境对照 ----------------
  function crossHTML() {
    var r = rangeOf();
    var list = st.indices.filter(function (s) { return s.category === '跨境对照'; });
    var ref = findByCode(st.indices, '000300.SH');
    var head = '<div class="card-hd"><h2 id="hCross">跨境对照</h2></div><p class="cs">看外面的水位；以沪深300为本地参照，各市场收盘日不同，日期分别标注</p>';
    if (!list.length) return '<section class="card" aria-labelledby="hCross">' + head + emptyBox('暂无跨境指数', '数据包中没有“跨境对照”分类的指数。') + '</section>';
    var rows = (ref ? [ref] : []).concat(list).map(function (s) {
      var q = latestQuote(s);
      var y1 = safeStats(s, 'price', '1');
      var pe = lastValid(s, 'pe');
      var peSt = safeStats(s, 'pe', r, st.opts.anchor);
      var pv = pctView(s, 'pe', peSt);
      var pctTd = pv.kind === 'ok' ? fmtPct(pv.pct, 1, false) + '<span class="date">n=' + pv.n + freqTag(pv.freq) + '</span>' :
        pv.kind === 'sparse' ? '<span class="muted pct-sparse">' + SPARSE_TXT + '</span><span class="date">n=' + pv.n + freqTag(pv.freq) + '</span>' : '—';
      var dy = lastValid(s, 'dy');
      var isRef = s === ref;
      return '<tr data-action="open" data-code="' + esc(s.code) + '"><td><button type="button" class="name-btn" data-action="open" data-code="' + esc(s.code) + '">' + esc(s.name || s.code) + '</button>' + (isRef ? ' <span class="tag gold">本地参照</span>' : '') + '<span class="date">' + esc(s.code) + '</span></td>' +
        '<td><span class="num">' + fmtNum(q.price, 2) + '</span><span class="date">' + esc(q.date || '无数据') + '</span></td>' +
        '<td class="num ' + cls(q.chg) + '">' + fmtPct(q.chg) + '</td>' +
        '<td class="num ' + cls(y1 && y1.changePct) + '">' + fmtPct(y1 && y1.count > 1 ? y1.changePct : null) + '</td>' +
        '<td><span class="num">' + fmtNum(pe.value, 2) + '</span>' + (pe.date ? '<span class="date">' + esc(pe.date) + '</span>' : '') + '</td>' +
        '<td class="num">' + pctTd + '</td>' +
        '<td><span class="num">' + fmtPct(dy.value, 2, false) + '</span>' + (dy.date ? '<span class="date">' + esc(dy.date) + '</span>' : '') + '</td></tr>';
    }).join('');
    return '<section class="card" aria-labelledby="hCross">' + head +
      '<div class="table-wrap" tabindex="0" role="region" aria-label="跨境对照表，可横向滚动"><table class="grid compact"><thead><tr><th scope="col">指数</th><th scope="col">收盘</th><th scope="col">涨跌</th><th scope="col">近1年</th><th scope="col">PE</th><th scope="col">PE分位·' + esc(RANGE_LABEL[r]) + '</th><th scope="col">股息率</th></tr></thead><tbody>' +
      rows + '</tbody></table></div><details class="note-more"><summary>口径说明</summary><p>近1年为收盘点位首末变化（价格指数，不含分红）。跨市场估值口径可能不同，仅作水位参考；样本不足的分位不评冷热。</p></details></section>';
  }

  // ---------------- 区块：多指数叠加 + 相关性 ----------------
  function initOverlay() {
    // 只在首次（null）给默认选择；用户“清空”后保持空，不在重绘时被默认值顶回
    if (st.overlay) {
      st.overlay = st.overlay.filter(function (c) { return findByCode(st.indices, c); });
      return;
    }
    var sel = MAIN_LINES.map(function (m) { return m.code; }).filter(function (c) { return findByCode(st.indices, c); });
    if (!sel.length) sel = st.indices.slice(0, 4).map(function (s) { return s.code; });
    st.overlay = sel;
  }
  function overlayHTML() {
    initOverlay();
    var head0 = '<div class="card-hd"><h2 id="hOverlay">多指数叠加对比</h2>';
    var sub = '<p class="cs">统一起点 = 100（所选指数共同有收盘价的首日）· ' + esc(RANGE_LABEL[rangeOf()]) + ' · 最多 ' + MAX_OVERLAY + ' 只，点标签上的 × 移除</p>';
    if (!st.indices.length) return '<section class="card" aria-labelledby="hOverlay">' + head0 + '</div>' + sub + emptyBox('暂无数据', '') + '</section>';
    var chips = st.overlay.map(function (c, i) {
      var s = findByCode(st.indices, c);
      return '<span class="pick on"><span class="dot" style="background:' + PALETTE[i % PALETTE.length] + '"></span>' + esc(s ? s.name : c) +
        '<button type="button" class="star-btn" style="color:var(--hint)" data-action="ov-remove" data-code="' + esc(c) + '" aria-label="从叠加中移除 ' + esc(s ? s.name : c) + '">×</button></span>';
    }).join('');
    var full = st.overlay.length >= MAX_OVERLAY;
    var groups = dict(), order = [];
    st.indices.forEach(function (s) {
      if (st.overlay.indexOf(s.code) >= 0) return;
      var c = s.category || '未分类'; if (!groups[c]) { groups[c] = []; order.push(c); } groups[c].push(s);
    });
    var opts = '<option value="">' + (full ? '已达 ' + MAX_OVERLAY + ' 只上限' : '+ 添加指数…') + '</option>' + order.map(function (c) {
      return '<optgroup label="' + esc(c) + '">' + groups[c].map(function (s) { return '<option value="' + esc(s.code) + '">' + esc(s.name + ' ' + s.code) + '</option>'; }).join('') + '</optgroup>';
    }).join('');
    var tools = '<div class="tools picker-tools"><label><span class="visually-hidden">添加指数到叠加对比</span><select name="overlayAdd" data-action="ov-add"' + (full ? ' disabled' : '') + '>' + opts + '</select></label>' +
      '<span class="seg" role="group" aria-label="快捷组合">' +
      '<button type="button" data-action="ov-preset" data-key="main">四大盘</button>' +
      '<button type="button" data-action="ov-preset" data-key="core">核心宽基</button>' +
      '<button type="button" data-action="ov-preset" data-key="fav">我的收藏</button>' +
      '<button type="button" data-action="ov-preset" data-key="clear">清空</button></span></div>';
    return '<h2 class="sec-t">组合视角 <span>谁跑赢、谁和谁同涨同跌</span></h2>' +
      '<section class="card" aria-labelledby="hOverlay">' + head0 + tools + '</div>' + sub +
      '<div id="ovBody"></div>' +
      '<div class="picker" aria-label="已选指数">' + (chips || '<span class="muted small">尚未选择指数。</span>') + '</div></section>' +
      '<section class="card" style="margin-top:12px" aria-labelledby="hCorr"><div class="card-hd"><h2 id="hCorr">相关性矩阵</h2></div>' +
      '<p class="cs">与上方叠加同一组指数和区间；颜色越深，两只指数走势越同步（周收益率 Pearson，缺周不当 0，n 为配对周数）</p><div id="corrBody"></div></section>';
  }
  function fmtCorr(v) { if (!isNum(v)) return '—'; var t = v.toFixed(2); return t === '-0.00' ? '0.00' : t; }
  function corrColor(v) {
    if (!isNum(v)) return { bg: 'var(--card-soft)', fg: 'var(--muted)' };
    var a = Math.min(1, Math.abs(v));
    var rgb = v >= 0 ? [18, 63, 109] : [200, 105, 47];
    return { bg: 'rgba(' + rgb.join(',') + ',' + (0.08 + a * 0.82).toFixed(3) + ')', fg: a > 0.55 ? '#fff' : 'var(--text)' };
  }
  function drawOverlay() {
    var ov = st.container && st.container.querySelector('#ovBody');
    var cb = st.container && st.container.querySelector('#corrBody');
    if (!ov || !cb) return;
    disposeChart('overlay');
    var list = st.overlay.map(function (c) { return findByCode(st.indices, c); }).filter(Boolean);
    if (!list.length) { ov.innerHTML = emptyBox('未选择指数', '用上方下拉框或快捷按钮添加指数。'); cb.innerHTML = emptyBox('无相关性', '至少选择 2 只指数。'); return; }
    var res = safeCompare(list, rangeOf(), st.opts.anchor);
    if (res.error === 'nomath') {
      ov.innerHTML = emptyBox('统计模块未加载', 'analytics.js（PanoMath.compare）不可用，暂无法计算共同起点叠加。');
      cb.innerHTML = emptyBox('统计模块未加载', '暂无法计算相关性。'); return;
    }
    if (res.error || !res.dates || !res.dates.length || !res.lines) {
      ov.innerHTML = emptyBox('没有共同有效收盘日', '所选指数在' + RANGE_LABEL[rangeOf()] + '内没有共同的正收盘价日期，请换区间或减少指数。' + (res.message ? '（' + res.message + '）' : ''));
      cb.innerHTML = emptyBox('无相关性', '缺少共同日期。'); return;
    }
    var colorOf = dict(); st.overlay.forEach(function (c, i) { colorOf[c] = PALETTE[i % PALETTE.length]; });
    var meta = '<p class="chart-meta">共同区间 ' + esc(res.startDate || res.dates[0]) + ' 至 ' + esc(res.endDate || res.dates[res.dates.length - 1]) + '，共 ' + res.dates.length + ' 个共同交易日；' + esc(res.startDate || res.dates[0]) + ' = 100。末值：' +
      res.lines.map(function (l) { var v = l.values[l.values.length - 1]; return '<span style="color:' + (colorOf[l.code] || 'inherit') + '">' + esc(l.name) + ' ' + fmtNum(v, 1) + '</span>'; }).join('，') + '</p>';
    if (!chartsAvailable()) {
      ov.innerHTML = emptyBox('图表库未加载', 'assets/echarts.min.js 不可用。') + meta;
    } else {
      ov.innerHTML = '<div class="chart" id="ovChart" role="img" aria-label="多指数共同起点叠加走势图"></div>' + meta;
      var ch = root.echarts.init(ov.querySelector('#ovChart'));
      st.charts.overlay = ch;
      ch.setOption({
        animation: false,
        color: res.lines.map(function (l) { return colorOf[l.code] || '#5b6b7f'; }),
        grid: { left: 46, right: 16, top: 30, bottom: 52 },
        tooltip: { trigger: 'axis', confine: true, axisPointer: { type: 'cross', crossStyle: { color: '#718096', type: 'dashed', width: 1 } }, valueFormatter: function (v) { return isNum(v) ? v.toFixed(2) : '—'; } },
        xAxis: { type: 'category', data: res.dates, boundaryGap: false, axisLabel: { color: '#94a3b8' }, axisLine: { lineStyle: { color: '#e2e8f0' } } },
        yAxis: { type: 'value', scale: true, name: '起点=100', nameTextStyle: { color: '#94a3b8' }, axisLabel: { color: '#94a3b8' }, splitLine: { lineStyle: { color: '#f0f3f7' } } },
        dataZoom: [{ type: 'inside' }, { type: 'slider', height: 18, bottom: 10 }],
        series: res.lines.map(function (l) {
          return { name: l.name, type: 'line', data: l.values, showSymbol: false, lineStyle: { width: 1.6 }, emphasis: { focus: 'series' } };
        })
      });
    }
    // 相关性
    var corr = res.corr;
    if (!corr || !corr.matrix || !corr.codes || corr.codes.length < 2) {
      cb.innerHTML = emptyBox('无相关性', '至少选择 2 只有共同日期的指数。'); return;
    }
    var names = corr.names || corr.codes;
    var th = '<tr><td></td>' + names.map(function (n, j) { return '<th scope="col" title="' + esc(corr.codes[j]) + '">' + esc(n) + '</th>'; }).join('') + '</tr>';
    var trs = corr.matrix.map(function (row, i) {
      return '<tr><th scope="row" title="' + esc(corr.codes[i]) + '">' + esc(names[i]) + '</th>' + row.map(function (v, j) {
        var n = corr.counts && corr.counts[i] ? corr.counts[i][j] : null;
        var c = corrColor(v);
        var label = names[i] + ' 与 ' + names[j] + ' 相关系数 ' + (isNum(v) ? fmtCorr(v) : '无法计算') + '，样本 ' + (n == null ? '—' : n) + ' 周';
        return '<td style="background:' + c.bg + ';color:' + c.fg + '" title="' + esc(label) + '" aria-label="' + esc(label) + '">' + fmtCorr(v) + '<span class="n">n=' + (n == null ? '—' : n) + '</span></td>';
      }).join('') + '</tr>';
    }).join('');
    cb.innerHTML = '<div class="table-wrap" style="border:0" tabindex="0" role="region" aria-label="相关性矩阵，可横向滚动"><table class="corr">' + th + trs + '</table></div>' +
      '<div class="hlegend"><span>-1 负相关</span><span class="gb corr" aria-hidden="true"></span><span>+1 同涨同跌</span><span style="margin-left:auto">“—”= 样本不足 3 周或方差为 0，无法计算</span></div>';
  }

  // ---------------- 渲染 & 事件 ----------------
  function disposeChart(k) {
    if (st.charts[k]) { try { st.charts[k].dispose(); } catch (e) { /* ignore */ } delete st.charts[k]; }
  }
  function disposeAllCharts() { Object.keys(st.charts).forEach(disposeChart); }

  function renderAll(keepFocus) {
    if (!st.container) return;
    var focusKey = keepFocus ? focusSignature() : null;
    disposeAllCharts();
    st.container.innerHTML = '<div class="home">' + headerHTML() + mainLinesHTML() +
      '<h2 class="sec-t">横向比较 <span>同一天，谁强谁弱、谁贵谁便宜</span></h2>' +
      '<div id="rankSlot">' + rankHTML() + '</div>' +
      '<div class="cgrid g2 g2-cross" style="margin-top:12px"><div id="heatSlot">' + heatHTML() + '</div>' + crossHTML() + '</div>' +
      '<div id="ovSlot">' + overlayHTML() + '</div></div>';
    drawOverlay();
    restoreFocus(focusKey);
  }
  function renderRank(keepFocus) {
    var slot = st.container && st.container.querySelector('#rankSlot');
    if (!slot) return;
    var focusKey = keepFocus ? focusSignature() : null;
    slot.innerHTML = rankHTML();
    restoreFocus(focusKey);
  }
  function renderOverlay(keepFocus) {
    var slot = st.container && st.container.querySelector('#ovSlot');
    if (!slot) return;
    var focusKey = keepFocus ? focusSignature() : null;
    disposeChart('overlay');
    slot.innerHTML = overlayHTML();
    drawOverlay();
    restoreFocus(focusKey);
  }
  function focusSignature() {
    var a = document.activeElement;
    if (!a || !st.container || !st.container.contains(a) || !a.getAttribute) return null;
    var act = a.getAttribute('data-action');
    if (!act) return null;
    return { action: act, key: a.getAttribute('data-key'), code: a.getAttribute('data-code') };
  }
  function restoreFocus(sig) {
    if (!sig || !st.container) return;
    var els = st.container.querySelectorAll('[data-action="' + sig.action + '"]');
    for (var i = 0; i < els.length; i++) {
      var e = els[i];
      if ((sig.key == null || e.getAttribute('data-key') === sig.key) && (sig.code == null || e.getAttribute('data-code') === sig.code)) { e.focus(); return; }
    }
    if (els.length) els[0].focus();
  }

  function handleClick(ev) {
    var t = ev.target && ev.target.closest ? ev.target.closest('[data-action]') : null;
    if (!t || !st.container.contains(t) || t.tagName === 'SELECT') return;
    var act = t.getAttribute('data-action'), key = t.getAttribute('data-key'), code = t.getAttribute('data-code');
    if (act === 'notes') {
      if (typeof st.opts.onOpenNotes === 'function') st.opts.onOpenNotes();
    } else if (act === 'open' && code) {
      if (typeof st.opts.onSelect === 'function') st.opts.onSelect(code);
    } else if (act === 'fav' && code) {
      var next = typeof st.opts.onToggleFavorite === 'function' ? st.opts.onToggleFavorite(code) : null;
      if (Array.isArray(next)) st.opts.favorites = next.slice();
      else {
        var f = (st.opts.favorites || []).slice(), i = f.indexOf(code);
        if (i >= 0) f.splice(i, 1); else f.push(code);
        st.opts.favorites = f;
      }
      renderRank(true);
    } else if (act === 'sort' && key) {
      if (st.sort === key && key !== 'default') st.dir = -st.dir;
      else { st.sort = key; st.dir = defaultDir(key); }
      renderRank(true);
    } else if (act === 'cat' && key) {
      // 色块再次点击同一分类时取消筛选
      var fromHeat = !!(t.classList && t.classList.contains('heat-cell'));
      var fk = fromHeat ? focusSignature() : null;
      st.cat = (fromHeat && st.cat === key) ? 'all' : key;
      renderRank(!fromHeat);
      var hs = st.container.querySelector('#heatSlot');
      if (hs) { hs.innerHTML = heatHTML(); if (fromHeat) restoreFocus(fk); }
    } else if (act === 'range' && key) {
      if (key === rangeOf()) return;
      st.opts.range = key;
      if (typeof st.opts.onRangeChange === 'function') st.opts.onRangeChange(key);
      renderAll(true);
    } else if (act === 'ov-remove' && code) {
      st.overlay = st.overlay.filter(function (c) { return c !== code; });
      renderOverlay(false);
      var sel = st.container.querySelector('select[data-action="ov-add"]'); if (sel) sel.focus();
    } else if (act === 'ov-preset' && key) {
      var pick = [];
      if (key === 'main') pick = MAIN_LINES.map(function (m) { return m.code; });
      else if (key === 'core') pick = st.indices.filter(function (s) { return s.category === '核心宽基'; }).map(function (s) { return s.code; });
      else if (key === 'fav') pick = (st.opts.favorites || []).slice();
      pick = pick.filter(function (c) { return findByCode(st.indices, c); }).slice(0, MAX_OVERLAY);
      st.overlay = pick;
      renderOverlay(true);
    }
  }
  function handleChange(ev) {
    var t = ev.target;
    if (!t || t.getAttribute('data-action') !== 'ov-add') return;
    var code = t.value;
    if (!code || st.overlay.indexOf(code) >= 0 || st.overlay.length >= MAX_OVERLAY) return;
    st.overlay.push(code);
    renderOverlay(false);
    var sel = st.container.querySelector('select[data-action="ov-add"]');
    if (sel && !sel.disabled) sel.focus();
  }

  function render(container, indices, options) {
    dispose();
    st.container = container;
    st.indices = Array.isArray(indices) ? indices.filter(function (s) { return s && s.code; }) : [];
    st.opts = {};
    var o = options || {};
    for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) st.opts[k] = o[k];
    st.opts.favorites = Array.isArray(o.favorites) ? o.favorites.slice() : [];
    if (!RANGE_LABEL[st.opts.range]) st.opts.range = '10';
    st.onClick = handleClick; st.onChange = handleChange;
    container.addEventListener('click', st.onClick);
    container.addEventListener('change', st.onChange);
    st.onResize = function () {
      clearTimeout(st.resizeTimer);
      st.resizeTimer = setTimeout(function () {
        Object.keys(st.charts).forEach(function (k) { try { st.charts[k].resize(); } catch (e) { /* ignore */ } });
      }, 120);
    };
    root.addEventListener('resize', st.onResize);
    renderAll(false);
  }

  function dispose() {
    disposeAllCharts();
    clearTimeout(st.resizeTimer);
    if (st.onResize) root.removeEventListener('resize', st.onResize);
    if (st.container) {
      if (st.onClick) st.container.removeEventListener('click', st.onClick);
      if (st.onChange) st.container.removeEventListener('change', st.onChange);
      st.container.innerHTML = '';
    }
    st.container = null; st.onClick = st.onChange = st.onResize = null;
  }

  root.PanoHome = {
    render: render,
    dispose: dispose,
    // 供 app.js 复用的展示工具（非契约接口）
    util: { esc: esc, isNum: isNum, fmtNum: fmtNum, fmtPct: fmtPct, fmtYi: fmtYi, cls: cls, lastValid: lastValid, latestQuote: latestQuote },
    CATEGORIES: CATEGORIES.slice(),
    MAIN_LINES: MAIN_LINES.map(function (m) { return m.code; })
  };
})(typeof window !== 'undefined' ? window : this);
