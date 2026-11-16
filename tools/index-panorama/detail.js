/*
 * 指数全景 · 指数详情子页 PanoDetail = {render, dispose}
 * 依赖：window.PanoMath（analytics.js），可选 window.echarts（缺失时图表区给出空态文字）。
 * 只渲染真实字段；缺数据显示明确空态，不推算、不前填、不伪造。
 */
(function (root) {
  'use strict';

  var METRICS = [
    { key: 'pe', label: '市盈率 PE', unit: '倍', valuation: true },
    { key: 'price', label: '收盘点位', unit: '点', valuation: false },
    { key: 'mcap', label: '市值（口径未注明）', unit: '亿元', valuation: false },
    { key: 'pb', label: '市净率 PB', unit: '倍', valuation: true },
    { key: 'dy', label: '股息率', unit: '%', valuation: true },
    { key: 'amt', label: '成交额', unit: '亿元', valuation: false }
  ];
  var RANGES = [['1', '近1年'], ['3', '近3年'], ['5', '近5年'], ['10', '近10年'], ['all', '全部']];
  var FIELD_INFO = {
    price: ['收盘点位', '点'], chg: ['涨跌幅', '%'], pe: ['市盈率', '倍'], pb: ['市净率', '倍'],
    dy: ['股息率', '%'], mcap: ['市值（口径未注明）', '亿元'], amt: ['成交额', '亿元'], turn: ['换手率', '%'],
    eps: ['每股收益', '按来源'], roe: ['ROE', '%'], bps: ['每股净资产', '按来源'], volume: ['成交量', '股']
  };
  var FIELDS = ['price', 'chg', 'pe', 'pb', 'dy', 'mcap', 'amt', 'turn', 'eps', 'roe', 'bps', 'volume'];
  var COLORS = {
    primary: '#1d5c9e', gold: '#a8741a', band: 'rgba(168,116,26,0.10)', grid: '#eef1f5',
    text: '#94a3b8', up: '#c0392b', down: '#0f6e56', dd: '#0f6e56', ddFill: 'rgba(15,110,86,0.14)',
    bar: 'rgba(107,92,165,0.55)', zoneLow: 'rgba(15,110,86,0.08)', zoneMid: 'rgba(232,217,168,0.22)', zoneHigh: 'rgba(192,57,43,0.07)'
  };

  var state = null;

  // ---------- 工具 ----------
  function M() { return root.PanoMath; }
  function isNum(v) { return typeof v === 'number' && isFinite(v); }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  // 市值口径：只按来源声明的 sources.mcap.marketCapBasis（或其 metadata）命名，未声明不默认“总市值”
  var MCAP_BASIS = { free_float: '自由流通市值', freefloat: '自由流通市值', 'free-float': '自由流通市值', total: '总市值' };
  function mcapBasis(series) {
    var src = series && series.sources && series.sources.mcap;
    if (!src || typeof src !== 'object') return null;
    var b = src.marketCapBasis;
    if (b == null && src.metadata && typeof src.metadata === 'object') b = src.metadata.marketCapBasis;
    b = String(b == null ? '' : b).trim().toLowerCase();
    return Object.prototype.hasOwnProperty.call(MCAP_BASIS, b) ? (b === 'total' ? 'total' : 'free_float') : null;
  }
  function mcapLabel(series) {
    var b = mcapBasis(series);
    return b ? MCAP_BASIS[b] : '市值（口径未注明）';
  }
  // 字段显示名：mcap 随当前指数的来源口径变化，其余固定
  function labelFor(key, series) {
    if (key === 'mcap') return mcapLabel(series || (state && state.series));
    return FIELD_INFO[key] ? FIELD_INFO[key][0] : key;
  }
  function metricInfo(key) {
    var m = METRICS[0];
    for (var i = 0; i < METRICS.length; i++) if (METRICS[i].key === key) { m = METRICS[i]; break; }
    if (m.key !== 'mcap') return m;
    return { key: m.key, label: labelFor('mcap'), unit: m.unit, valuation: m.valuation };
  }
  function fmtNum(v, digits) {
    if (!isNum(v)) return '—';
    var d = digits == null ? 2 : digits;
    var s = Math.abs(v).toFixed(d).split('.');
    s[0] = s[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return (v < 0 ? '-' : '') + s.join('.');
  }
  function fmtVal(v, metric) {
    if (!isNum(v)) return '—';
    if (metric === 'mcap' || metric === 'amt') {
      return Math.abs(v) >= 10000 ? fmtNum(v / 10000, 2) + ' 万亿元' : fmtNum(v, 2) + ' 亿元';
    }
    if (metric === 'dy' || metric === 'roe' || metric === 'turn' || metric === 'chg') return fmtNum(v, 2) + '%';
    if (metric === 'volume') return fmtNum(v, 0) + ' 股';
    if (metric === 'price') return fmtNum(v, 2);
    if (metric === 'pe' || metric === 'pb') return fmtNum(v, 2) + ' 倍';
    return fmtNum(v, 3);
  }
  function fmtPct(v, signed) {
    if (!isNum(v)) return '—';
    return (signed && v > 0 ? '+' : '') + fmtNum(v, 2) + '%';
  }
  function safeUrl(u) {
    return (typeof u === 'string' && /^https?:\/\//i.test(u)) ? u : null;
  }
  function daysBetween(a, b) {
    var pa = M().parseDate(a), pb = M().parseDate(b);
    if (!pa || !pb) return null;
    return Math.round((Date.UTC(pb.y, pb.m - 1, pb.d) - Date.UTC(pa.y, pa.m - 1, pa.d)) / 86400000);
  }
  function rangeLabel(r) {
    for (var i = 0; i < RANGES.length; i++) if (RANGES[i][0] === r) return RANGES[i][1];
    return r;
  }
  function validPairs(s, field) {
    var out = [];
    var arr = s[field] || [];
    for (var i = 0; i < s.d.length; i++) {
      var v = arr[i];
      if (isNum(v) && !(field === 'price' && v <= 0)) out.push([s.d[i], v]);
    }
    return out;
  }
  // ---------- 稀疏样本 / 频率 / 来源状态（金融呈现门槛；不改 PanoMath 数学） ----------
  // 有效观测少于 MIN_HIST 时，ECDF 分位恒为 100%（公式结果），不能当作长期分位展示。
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
  var STATUS_CN = { ok: '可用', unavailable: '未取得', rejected: '已拒收', missing: '未接入', invalid: '无效', partial: '部分', stale: '陈旧' };
  function availOf(series, field) {
    var a = series && series.availability && series.availability[field];
    return a && typeof a === 'object' ? a : null;
  }
  // 来源声明的频率：优先 sources[field].frequency，其次 availability[field].frequency；无声明返回 null
  function declaredFreq(series, field) {
    var src = sourceOf(series, field), av = availOf(series, field);
    var cands = [src && src.frequency, av && av.frequency];
    for (var i = 0; i < cands.length; i++) {
      var k = cands[i] == null ? '' : String(cands[i]).trim().toLowerCase();
      if (k && Object.prototype.hasOwnProperty.call(FREQ_ALIAS, k)) return FREQ_ALIAS[k];
    }
    return null;
  }
  function freqLabel(series, field, pairs) {
    var f = declaredFreq(series, field);
    if (f) return FREQ_CN[f] + '（来源声明）';
    if (!pairs || !pairs.length) return '';
    if (pairs.length < 2) return '仅 1 个观测，无法估计频率';
    return freqNote(pairs) + '（按观测间隔估计）';
  }
  // 是否可展示历史分位/20-80带/冷热：样本 ≥ MIN_HIST 且来源未声明为单期快照
  function histOk(series, field, count) {
    return count >= MIN_HIST && declaredFreq(series, field) !== 'single';
  }
  function histShortText(series, field, count) {
    if (count < MIN_HIST) return '仅单期 · 历史样本不足';
    return '来源声明为单期快照 · 不作长期分位';
  }
  function histLongText(series, field, count) {
    return count < MIN_HIST
      ? '所选区间只有 ' + count + ' 个有效观测，单期数据计算的分位恒为 100%，不代表长期位置；不显示分位、20/80 带与冷热评级。'
      : '来源声明该字段为单期快照，' + count + ' 个观测不构成可比的长期序列；不显示分位、20/80 带与冷热评级。';
  }
  function shortReason(text) {
    var t = String(text == null ? '' : text).trim();
    if (!t) return '';
    var first = t.split(/[；;\n]/)[0].trim() || t;
    return first.length > 48 ? first.slice(0, 47) + '…' : first;
  }
  function statusCn(s) {
    var k = String(s == null ? '' : s).toLowerCase();
    return STATUS_CN[k] || (k ? k : '未知');
  }
  // 缺失/拒收原因：主流程只给一句简短原因，全部候选与完整原因收在 <details> 内
  function reasonDetailsHtml(av) {
    if (!av) return '';
    var cands = Array.isArray(av.candidates) ? av.candidates : [];
    var full = String(av.reason || '').trim();
    var items = cands.map(function (c) {
      if (!c || typeof c !== 'object') return '';
      var cnt = isNum(c.count) ? c.count + ' 个观测' : '';
      var span = c.first ? (c.first + ' 至 ' + (c.last || c.first)) : '';
      return '<li><b>' + esc(c.provider || '来源') + '</b> · ' + esc(statusCn(c.status)) + (c.selected ? ' · 已选用' : '') +
        (cnt ? ' · ' + esc(cnt) : '') + (span ? ' · ' + esc(span) : '') +
        (c.frequency ? ' · ' + esc(FREQ_CN[FREQ_ALIAS[String(c.frequency).toLowerCase()]] || c.frequency) : '') +
        (c.reason ? '<div class="pd-muted">' + esc(c.reason) + '</div>' : '') + '</li>';
    }).join('');
    var rejected = Array.isArray(av.rejected) ? av.rejected.map(function (r) { return '<li>' + esc(r) + '</li>'; }).join('') : '';
    if (!items && !rejected && (!full || full === shortReason(full))) return '';
    return '<details class="pd-reason-more"><summary>查看原因</summary>' +
      (full ? '<p>' + esc(full) + '</p>' : '') +
      (items ? '<ul>' + items + '</ul>' : '') + (rejected ? '<ul>' + rejected + '</ul>' : '') + '</details>';
  }
  // 空态里附带的简短原因（若 availability 提供）
  function emptyReason(series, field) {
    var av = availOf(series, field);
    var r = av && av.status !== 'ok' ? shortReason(av.reason) : '';
    return r ? '原因：' + r : '';
  }
  // 区间覆盖说明：选择 N 年区间不代表数据已覆盖 N 年
  function coverNote(range, rangeStart, pairs) {
    if (!pairs.length) return '';
    var first = pairs[0][0], last = pairs[pairs.length - 1][0];
    var txt = '区间内实际 ' + pairs.length + ' 个样本，覆盖 ' + first + (first === last ? '' : ' 至 ' + last);
    var gap = rangeStart ? daysBetween(rangeStart, first) : null;
    if (range !== 'all' && isNum(gap) && gap > 31) txt += '；所选' + rangeLabel(range) + '，但样本自 ' + first + ' 才开始，不代表已覆盖整段区间';
    return txt;
  }

  // 观测频率描述：基于有效观测的日期间隔中位数
  function freqNote(pairs) {
    if (pairs.length < 2) return pairs.length ? '仅 1 个观测' : '';
    var gaps = [];
    for (var i = 1; i < pairs.length; i++) gaps.push(daysBetween(pairs[i - 1][0], pairs[i][0]));
    gaps.sort(function (a, b) { return a - b; });
    var med = gaps[Math.floor(gaps.length / 2)];
    if (med <= 4) return '约日频';
    if (med <= 10) return '约周频（稀疏）';
    if (med <= 40) return '约月频（稀疏）';
    return '稀疏观测（间隔中位 ' + med + ' 天）';
  }
  function fieldCoverage(series, field, anchor) {
    var s = M().sliceSeries(series, 'all', anchor);
    var pairs = validPairs(s, field);
    return {
      count: pairs.length,
      first: pairs.length ? pairs[0][0] : null,
      last: pairs.length ? pairs[pairs.length - 1][0] : null,
      lastValue: pairs.length ? pairs[pairs.length - 1][1] : null,
      freq: freqLabel(series, field, pairs)
    };
  }
  function sourceOf(series, field) {
    var src = series && series.sources && series.sources[field];
    return src && typeof src === 'object' ? src : null;
  }
  function sourceHtml(series, field) {
    var src = sourceOf(series, field);
    if (!src) return '<span class="pd-muted">未注明来源</span>';
    var url = safeUrl(src.url);
    var label = esc(src.label || '来源');
    var html = url ? '<a href="' + esc(url) + '" target="_blank" rel="noopener noreferrer">' + label + '</a>' : label;
    if (src.method) html += '<span class="pd-muted"> · ' + esc(src.method) + '</span>';
    return html;
  }
  // 小卡用的短来源：只显示来源名，口径放在 title（完整口径见“来源与覆盖”表）
  function shortSourceHtml(series, field) {
    var src = sourceOf(series, field);
    if (!src) return '<span class="pd-muted">未注明来源</span>';
    var url = safeUrl(src.url), label = esc(src.label || '来源'), tip = src.method ? ' title="' + esc(src.method) + '"' : '';
    return url ? '<a href="' + esc(url) + '" target="_blank" rel="noopener noreferrer"' + tip + '>' + label + '</a>' : '<span' + tip + '>' + label + '</span>';
  }
  function empty(msg) {
    return '<div class="pd-empty" role="status">' + esc(msg) + '</div>';
  }

  // ---------- 图表 ----------
  function hasCharts() { return !!(root.echarts && typeof root.echarts.init === 'function'); }

  function mountChart(el, option) {
    if (!el) return;
    if (!hasCharts()) {
      el.innerHTML = empty('图表库未加载，仅显示数值统计。');
      return;
    }
    var chart = root.echarts.init(el, null, { renderer: 'canvas' });
    chart.setOption(option);
    if (root.PanoChartEdge) root.PanoChartEdge.attach(chart); // 左右轴边距吸附可见区间首末观测
    state.charts.push(chart);
  }

  function baseOption() {
    return {
      animation: false,
      grid: { left: 52, right: 52, top: 26, bottom: 46, containLabel: false },
      tooltip: { trigger: 'axis', confine: true, axisPointer: { type: 'cross', snap: true, crossStyle: { color: '#718096', type: 'dashed', width: 1 } } },
      xAxis: {
        type: 'time', axisLine: { lineStyle: { color: COLORS.grid } },
        axisLabel: { color: COLORS.text, hideOverlap: true }, splitLine: { show: false }
      },
      dataZoom: [{ type: 'inside' }, { type: 'slider', height: 14, bottom: 6, showDetail: false, borderColor: '#e2e8f0', fillerColor: 'rgba(29,92,158,0.08)' }],
      textStyle: { fontFamily: 'inherit' }
    };
  }
  function valueAxis(name, fmt, pos) {
    return {
      type: 'value', name: name, scale: true, position: pos || 'left',
      nameTextStyle: { color: COLORS.text },
      axisLabel: { color: COLORS.text, formatter: fmt },
      splitLine: { lineStyle: { color: COLORS.grid } }
    };
  }
  function tooltipFmt(metric) {
    return function (params) {
      var arr = Array.isArray(params) ? params : [params];
      if (!arr.length) return '';
      var d = arr[0].value && arr[0].value[0];
      var lines = [esc(d)], seen = {};
      arr.forEach(function (p) {
        // lttb 抽样后末点可能出现两次（同一系列、同一日期），只列一次
        if (seen[p.seriesIndex]) return;
        seen[p.seriesIndex] = true;
        var v = p.value && p.value[1];
        var m = (p.seriesId && FIELD_INFO[p.seriesId]) ? p.seriesId : metric;
        lines.push(p.marker + esc(p.seriesName) + '：' + esc(fmtVal(v, m)));
      });
      return lines.join('<br>');
    };
  }

  function mainChartOption(metric, pairs, st) {
    var info = metricInfo(metric);
    var opt = baseOption();
    opt.yAxis = valueAxis(info.unit, function (v) { return fmtNum(v, metric === 'price' || metric === 'mcap' || metric === 'amt' ? 0 : 2); });
    opt.grid.right = 18; // 单轴图不留右轴空位
    opt.tooltip.formatter = tooltipFmt(metric);
    var marks = [];
    if (isNum(st.q20)) marks.push({ yAxis: st.q20, name: '20%分位', lineStyle: { color: COLORS.down, type: 'dashed', opacity: 0.6 }, label: { formatter: '20% ' + fmtNum(st.q20, 2), color: COLORS.down } });
    if (isNum(st.q80)) marks.push({ yAxis: st.q80, name: '80%分位', lineStyle: { color: COLORS.up, type: 'dashed', opacity: 0.6 }, label: { formatter: '80% ' + fmtNum(st.q80, 2), color: COLORS.up } });
    if (isNum(st.mean)) marks.push({ yAxis: st.mean, name: '均值', lineStyle: { color: '#8a94a6', type: 'dotted' }, label: { formatter: '均值 ' + fmtNum(st.mean, 2), color: '#8a94a6' } });
    opt.series = [{
      id: metric, name: info.label, type: 'line', data: pairs, showSymbol: pairs.length < 60, symbolSize: 4,
      sampling: 'lttb', lineStyle: { width: 1.6, color: COLORS.gold }, itemStyle: { color: COLORS.gold },
      markArea: (isNum(st.q20) && isNum(st.q80)) ? { silent: true, data: [
        [{ yAxis: 'min', itemStyle: { color: COLORS.zoneLow } }, { yAxis: st.q20 }],
        [{ yAxis: st.q20, itemStyle: { color: COLORS.zoneMid } }, { yAxis: st.q80 }],
        [{ yAxis: st.q80, itemStyle: { color: COLORS.zoneHigh } }, { yAxis: 'max' }]
      ] } : undefined,
      markLine: marks.length ? { silent: true, symbol: 'none', data: marks, label: { position: 'insideEndTop', fontSize: 11 } } : undefined
    }];
    return opt;
  }

  // ---------- 区块 ----------
  function headerHtml(series, anchor) {
    var pc = fieldCoverage(series, 'price', anchor);
    var warn = [];
    if (Array.isArray(series.warnings)) warn = series.warnings.filter(Boolean);
    // 最新收盘与同日涨跌（只取同一日期，不跨日拼接）
    var sl = M().sliceSeries(series, 'all', anchor), px = null, chg = null, pd = null;
    for (var i = sl.d.length - 1; i >= 0; i--) {
      var v = sl.price && sl.price[i];
      if (isNum(v) && v > 0) { px = v; pd = sl.d[i]; chg = sl.chg && isNum(sl.chg[i]) ? sl.chg[i] : null; break; }
    }
    var meta = [esc(series.code)];
    if (series.category) meta.push(esc(series.category));
    if (isNum(series.componentNum)) meta.push('成分股 ' + esc(series.componentNum) + ' 只');
    // 单行指数栏：名称 · 小字元信息 · 唯一提示入口 · 点位涨跌 ｜ 右侧收盘日；说明文字只放 title，不另起一行
    return '<header class="pd-head pd-idxbar">' +
      '<div class="pd-ib-l"><h2 class="pd-title"' + (series.description ? ' title="' + esc(series.description) + '"' : '') + '>' + esc(series.name || series.code) + '</h2>' +
      '<span class="pd-ib-meta" title="' + esc((series.description ? series.description + '；' : '') + (series.componentDate ? '成分股截至 ' + series.componentDate : '')) + '">' + meta.join(' · ') + '</span>' +
      '<span class="pd-ib-quote"><b>' + esc(fmtNum(px, 2)) + '</b><em class="' + signCls(chg) + '">' + esc(fmtPct(chg, true)) + '</em></span>' +
      (warn.length ? '<button type="button" class="pd-ib-flag" data-pd-warn="1" title="' + esc(warn.join('；')) + '">数据提示 ' + warn.length + ' 条 ↓</button>' : '') + '</div>' +
      '<span class="pd-ib-upd">收盘 ' + esc(pc.last || '无数据') + '</span>' +
      '</header>';
  }

  function toolbarHtml(series, st) {
    var anchor = st.anchor;
    var mBtns = METRICS.map(function (m) {
      var cov = fieldCoverage(series, m.key, anchor);
      var on = m.key === st.metric;
      return '<button type="button" class="pd-mtab' + (on ? ' is-on' : '') + (cov.count ? '' : ' is-nodata') +
        '" data-pd-metric="' + m.key + '" aria-pressed="' + on + '"' +
        (cov.count ? '' : ' title="数据源未提供该字段"') + '>' + esc(metricInfo(m.key).label) +
        (cov.count ? '' : '<span class="pd-nodata-tag">无数据</span>') + '</button>';
    }).join('');
    return '<div class="pd-mtabs" role="group" aria-label="指标">' + mBtns + '</div>';
  }
  function rangesHtml(st) {
    return '<div class="pd-ranges" role="group" aria-label="区间">' + RANGES.map(function (r) {
      var on = r[0] === st.range;
      return '<button type="button" class="' + (on ? 'is-on' : '') + '" data-pd-range="' + r[0] + '" aria-pressed="' + on + '">' + r[1] + '</button>';
    }).join('') + '</div>';
  }

  function statItem(label, value, sub, cls) {
    return '<div class="pd-stat' + (cls ? ' ' + cls : '') + '"><div class="pd-stat-label">' + esc(label) + '</div>' +
      '<div class="pd-stat-value">' + value + '</div>' + (sub ? '<div class="pd-stat-sub">' + sub + '</div>' : '') + '</div>';
  }

  function signCls(v) { return !isNum(v) || v === 0 ? '' : (v > 0 ? 'pd-up' : 'pd-down'); }

  function kpiItem(label, value, sub, cls) {
    return '<div class="pd-kpi' + (cls ? ' ' + cls : '') + '"><span class="pd-kpi-k">' + esc(label) + '</span>' +
      '<b class="pd-kpi-v">' + value + '</b>' + (sub ? '<span class="pd-kpi-s">' + sub + '</span>' : '') + '</div>';
  }
  function footItem(label, value, sub) {
    return '<span class="pd-fi">' + esc(label) + ' <b>' + value + '</b>' + (sub ? ' <small>' + sub + '</small>' : '') + '</span>';
  }

  function mainCardHtml(series, st) {
    var metric = st.metric, info = metricInfo(metric);
    var s = M().stats(series, metric, st.range, st.anchor);
    var sl = M().sliceSeries(series, st.range, st.anchor);
    var pairs = validPairs(sl, metric);
    var full = fieldCoverage(series, metric, st.anchor);
    var priceLast = fieldCoverage(series, 'price', st.anchor).last;
    var title = '<div class="pd-bc-head"><div><div class="pd-bc-sub">' + esc(series.name || series.code) + ' · 区间 ' + esc(s.rangeStart || (sl.d[0] || '—')) + ' 至 ' + esc(s.rangeEnd || '—') + '</div>' +
      '<h3>' + esc(info.label) + ' · ' + esc(rangeLabel(st.range)) + '历史</h3></div>' + rangesHtml(st) + '</div>';
    if (!s.count) {
      var msg = full.count
        ? '所选区间内没有' + info.label + '有效观测。该字段共 ' + full.count + ' 个观测，最后一次在 ' + full.last + '，可切换更长区间。'
        : '数据源未提供' + info.label + '字段，本页不推算、不填补。可通过导入 CSV 补充真实数据。';
      var why = full.count ? '' : emptyReason(series, metric);
      return '<section class="pd-card pd-main pd-bigcard">' + title + empty(msg + (why ? ' ' + why : '')) +
        (full.count ? '' : reasonDetailsHtml(availOf(series, metric))) + '</section>';
    }
    var stale = (priceLast && s.latestDate && s.latestDate < priceLast)
      ? '<span class="pd-badge pd-badge-warn">字段截至 ' + esc(s.latestDate) + '，早于收盘点位 ' + esc(priceLast) + '</span>' : '';
    var changeLabel = metric === 'price' ? '区间涨跌（收盘点位）' : '指标区间变化（非指数涨跌）';
    var fq = freqLabel(series, metric, pairs);
    var basisNote = metric === 'mcap'
      ? (mcapBasis(series) ? ' · 口径：' + mcapLabel(series) + '（来源声明）' : ' · 来源未注明总市值/自由流通口径，不按总市值解读')
      : '';
    var cover = '<p class="pd-cover-note">' + esc(coverNote(st.range, s.rangeStart, pairs)) + (fq ? ' · ' + esc(fq) : '') + esc(basisNote) + '</p>';
    if (!histOk(series, metric, s.count)) {
      // 单期/样本不足：只展示真实最新值与日期，不展示分位、20/80 带、均值等伪长期统计
      var few = [
        kpiItem('最新值', esc(fmtVal(s.latest, metric)), '日期 ' + esc(s.latestDate) + ' ' + stale, 'pd-kpi-lead'),
        kpiItem(metric === 'price' ? '点位历史分位' : '历史分位', '<span class="pd-insufficient">' + esc(histShortText(series, metric, s.count)) + '</span>', '不显示 20/80 分位带'),
        kpiItem('有效样本', esc(s.count) + ' 个', esc(fq))
      ].join('');
      return '<section class="pd-card pd-main pd-bigcard pd-main-sparse">' + title + '<div class="pd-bc-kpi">' + few + '</div>' + cover +
        empty(histLongText(series, metric, s.count)) + '</section>';
    }
    var kpis = [
      kpiItem('最新值', esc(fmtVal(s.latest, metric)), '日期 ' + esc(s.latestDate) + ' ' + stale, 'pd-kpi-lead'),
      kpiItem(metric === 'price' ? '点位历史分位' : '历史分位', esc(fmtPct(s.percentile)), '≤最新值样本 / 有效样本', 'pd-kpi-pct'),
      kpiItem(changeLabel, '<span class="' + signCls(s.changePct) + '">' + esc(fmtPct(s.changePct, true)) + '</span>', esc(s.firstDate) + ' → ' + esc(s.latestDate), 'pd-kpi-gain')
    ].join('');
    var foot = [
      footItem('20% / 80% 分位', esc(fmtVal(s.q20, metric)) + ' / ' + esc(fmtVal(s.q80, metric)), '三区分界'),
      footItem('最高', esc(fmtVal(s.max, metric)), esc(s.maxDate)),
      footItem('最低', esc(fmtVal(s.min, metric)), esc(s.minDate)),
      footItem('均值', esc(fmtVal(s.mean, metric)), '算术平均'),
      footItem('有效样本', esc(s.count) + ' 个', esc(fq))
    ].join('');
    return '<section class="pd-card pd-main pd-bigcard">' + title + '<div class="pd-bc-kpi">' + kpis + '</div>' + cover +
      '<div class="pd-chart pd-chart-main" data-pd-chart="main" role="img" aria-label="' + esc(info.label) + '历史走势与20/80分位带"></div>' +
      '<div class="pd-plot-legend"><span><i style="background:' + COLORS.gold + '"></i>' + esc(info.label) + '</span><span><i class="pd-zone-key pd-zk-low"></i>低于 20% 分位</span><span><i class="pd-zone-key pd-zk-mid"></i>20%–80% 分位</span><span><i class="pd-zone-key pd-zk-high"></i>高于 80% 分位</span><span><i style="background:#8a94a6"></i>均值</span></div>' +
      '<div class="pd-bc-foot">' + foot + '</div>' +
      '<p class="pd-foot">折线只连接有效观测，连线不代表中间缺失日期有数据；背景三区以所选区间真实样本的 20% / 80% 分位为界。</p></section>';
  }

  function thermoRow(series, metric, st) {
    var info = metricInfo(metric);
    var s = M().stats(series, metric, st.range, st.anchor);
    if (!s.count) {
      var why = fieldCoverage(series, metric, st.anchor).count ? '' : emptyReason(series, metric);
      return '<div class="pd-thermo-row"><div class="pd-thermo-name">' + esc(info.label) + '</div>' +
        '<div class="pd-thermo-empty">区间内无观测' + (why ? '<div class="pd-muted">' + esc(why) + '</div>' : '') + '</div></div>';
    }
    if (!histOk(series, metric, s.count)) {
      return '<div class="pd-thermo-row pd-thermo-sparse"><div class="pd-thermo-name">' + esc(info.label) +
        '<b class="pd-thermo-latest">' + esc(fmtVal(s.latest, metric)) + '</b></div>' +
        '<div class="pd-thermo-empty">' + esc(histShortText(series, metric, s.count)) + '，不评冷热</div>' +
        '<div class="pd-thermo-val pd-muted">' + esc(s.latestDate) + ' · ' + s.count + ' 样本' + (declaredFreq(series, metric) ? ' · ' + esc(FREQ_CN[declaredFreq(series, metric)]) : '') + '</div></div>';
    }
    var p = s.percentile;
    // 股息率：分位越高代表相对越便宜，温度方向相反
    var temp = metric === 'dy' ? 100 - p : p;
    var zone = temp < 20 ? ['偏冷', 'cold'] : (temp > 80 ? ['偏热', 'hot'] : ['中性', 'mid']);
    return '<div class="pd-thermo-row"><div class="pd-thermo-name">' + esc(info.label) +
      '<b class="pd-thermo-latest">' + esc(fmtVal(s.latest, metric)) + '</b>' +
      '<span class="pd-zone pd-zone-' + zone[1] + '">' + zone[0] + '</span>' +
      (metric === 'dy' ? '<span class="pd-muted pd-thermo-hint">分位高=偏冷</span>' : '') + '</div>' +
      '<div class="pd-thermo-bar" role="meter" aria-valuemin="0" aria-valuemax="100" aria-valuenow="' + temp.toFixed(1) + '" aria-label="' + esc(info.label) + '温度">' +
      '<span class="pd-thermo-pin" style="left:' + temp.toFixed(1) + '%"></span>' +
      '<i class="pd-thermo-tick" style="left:20%"></i><i class="pd-thermo-tick" style="left:80%"></i></div>' +
      '<div class="pd-thermo-val">分位 <b>' + esc(fmtPct(p)) + '</b>' +
      '<span class="pd-muted"> · ' + esc(s.latestDate) + ' · ' + s.count + ' 样本' + (declaredFreq(series, metric) ? ' · ' + esc(FREQ_CN[declaredFreq(series, metric)]) : '') + '</span></div></div>';
  }

  // 较上周：只在“最新观测往前 7–13 天内存在真实观测”时计算；月频/单期/缺口一律未取得，不插值
  function weekAgo(series, field, anchor) {
    var pairs = validPairs(M().sliceSeries(series, 'all', anchor), field);
    if (pairs.length < 2) return null;
    var last = pairs[pairs.length - 1];
    for (var i = pairs.length - 2; i >= 0; i--) {
      var gap = daysBetween(pairs[i][0], last[0]);
      if (gap >= 7 && gap <= 13) return { date: pairs[i][0], prev: pairs[i][1], diff: last[1] - pairs[i][1] };
      if (gap > 13) break;
    }
    return null;
  }
  function pctBrief(series, field, st) {
    var s = M().stats(series, field, st.range, st.anchor);
    if (!s.count) return '<span class="pd-muted">未取得</span>';
    if (!histOk(series, field, s.count)) return '<span class="pd-insufficient-s">仅单期</span>';
    return esc(fmtPct(s.percentile));
  }
  function thermoHtml(series, st) {
    var s = M().stats(series, 'pe', st.range, st.anchor), lab = rangeLabel(st.range);
    var fq = declaredFreq(series, 'pe');
    var head = '<div class="pd-card-head"><h3>估值温度计</h3></div><p class="pd-cs">市盈率当前值在' + esc(lab) + '真实样本中的位置</p>';
    var big, scale = '', concl, pctCell;
    var wk = s.count && histOk(series, 'pe', s.count) ? weekAgo(series, 'pe', st.anchor) : null;
    var wkCell = wk ? '<span class="' + signCls(wk.diff) + '">' + esc((wk.diff > 0 ? '+' : '') + fmtNum(wk.diff, 2)) + '</span><small>较 ' + esc(wk.date) + '</small>'
      : '<span class="pd-muted" title="仅当最新观测前 7–13 天内有真实观测时计算；月频、单期或缺口不插值">未取得</span>';
    if (!s.count) {
      var why = fieldCoverage(series, 'pe', st.anchor).count ? '所选区间内无市盈率观测' : (emptyReason(series, 'pe') || '数据源未提供市盈率');
      big = '<div class="pd-t-big"><span class="pd-t-v pd-muted">—</span><span class="pd-t-u">倍</span></div><div class="pd-t-sub">' + esc(why) + '</div>';
      pctCell = '<span class="pd-muted">未取得</span>';
      concl = '没有市盈率观测，不作历史位置描述。';
    } else if (!histOk(series, 'pe', s.count)) {
      big = '<div class="pd-t-big"><span class="pd-t-v">' + esc(fmtNum(s.latest, 2)) + '</span><span class="pd-t-u">倍</span></div>' +
        '<div class="pd-t-sub">' + esc(s.latestDate) + ' · ' + s.count + ' 样本' + (fq ? ' · ' + esc(FREQ_CN[fq]) : '') + ' · <span class="pd-insufficient-s">' + esc(histShortText(series, 'pe', s.count)) + '，不评冷热</span></div>';
      pctCell = '<span class="pd-insufficient-s">仅单期</span>';
      concl = '只有 ' + s.count + ' 个市盈率观测（' + s.latestDate + '），样本不足，不作历史位置描述。';
    } else {
      var p = s.percentile;
      var zone = p < 20 ? ['偏冷', 'cold'] : (p > 80 ? ['偏热', 'hot'] : ['中性', 'mid']);
      var pos = p < 20 ? '处于历史低位区间（低于 20% 分位）' : (p > 80 ? '处于历史高位区间（高于 80% 分位）' : '处于历史中段（20%–80% 分位之间）');
      big = '<div class="pd-t-big"><span class="pd-t-v">' + esc(fmtNum(s.latest, 2)) + '</span><span class="pd-t-u">倍</span><span class="pd-zone pd-zone-' + zone[1] + '">' + zone[0] + '</span></div>' +
        '<div class="pd-t-sub">' + esc(s.latestDate) + ' · ' + s.count + ' 样本' + (fq ? ' · ' + esc(FREQ_CN[fq]) : '') + '</div>';
      scale = '<div class="pd-thermo-bar pd-t-scale" role="meter" aria-valuemin="0" aria-valuemax="100" aria-valuenow="' + p.toFixed(1) + '" aria-label="市盈率 PE温度">' +
        '<span class="pd-thermo-pin" style="left:' + p.toFixed(1) + '%"></span><i class="pd-thermo-tick" style="left:20%"></i><i class="pd-thermo-tick" style="left:80%"></i></div>' +
        '<div class="pd-scale-lb" aria-hidden="true"><span>0%</span><span>50%</span><span>100%</span></div>';
      pctCell = esc(fmtPct(p));
      concl = '市盈率 ' + fmtNum(s.latest, 2) + ' 倍（' + s.latestDate + '），不低于' + lab + ' ' + s.count + ' 个观测中的 ' + fmtPct(p) + '，' + pos + '。仅描述自身历史位置。';
    }
    var row2 = '<div class="pd-t-row2"><div><div class="pd-k2">区间分位</div><div class="pd-v2">' + pctCell + '</div></div>' +
      '<div><div class="pd-k2">市净率百分位</div><div class="pd-v2">' + pctBrief(series, 'pb', st) + '</div></div>' +
      '<div><div class="pd-k2">较上周</div><div class="pd-v2">' + wkCell + '</div></div></div>';
    var more = '<details class="pd-note pd-thermo-more"><summary>市净率 / 股息率温度（次要字段）</summary>' +
      ['pb', 'dy'].map(function (m) { return thermoRow(series, m, st); }).join('') + '</details>';
    return '<section class="pd-card pd-thermo">' + head + big + scale + row2 +
      '<div class="pd-concl"><b>历史位置</b>：' + esc(concl) + '</div>' + more +
      '<p class="pd-foot">温度 = 所选区间真实样本分位（股息率取 100−分位）；&lt;20 偏冷、&gt;80 偏热，仅反映自身历史位置，不构成买卖建议。</p></section>';
  }

  /**
   * 回撤摘要（纯函数，供 UI 与测试）：
   * range：PanoMath.drawdown(sliceSeries(series, range, anchor))，峰值只取所选区间内；
   * full：PanoMath.drawdown(sliceSeries(series, 'all', anchor))，峰值取数据集起点至锚点。
   */
  function drawdownSummary(series, range, anchor) {
    var math = M();
    if (!math || !series) return { range: null, full: null, pairs: [], rangeStart: null, dataStart: null };
    var sl = math.sliceSeries(series, range, anchor);
    var fl = math.sliceSeries(series, 'all', anchor);
    var rdd = math.drawdown(sl), fdd = math.drawdown(fl);
    var pairs = [];
    if (rdd) {
      for (var i = 0; i < rdd.dates.length; i++) if (isNum(rdd.values[i])) pairs.push([rdd.dates[i], rdd.values[i]]);
    }
    return {
      range: rdd, full: fdd, pairs: pairs,
      rangeStart: pairs.length ? pairs[0][0] : null,
      dataStart: fdd ? firstValidDate(fl) : null
    };
  }
  function firstValidDate(s) {
    for (var i = 0; i < s.d.length; i++) if (isNum(s.price[i]) && s.price[i] > 0) return s.d[i];
    return null;
  }

  function drawdownHtml(series, st) {
    var head = '<div class="pd-card-head"><h3>回撤曲线</h3><span class="pd-muted">收盘点位从' + esc(rangeLabel(st.range)) + '区间最高点回落的幅度，缺值不补</span></div>';
    var d = drawdownSummary(series, st.range, st.anchor);
    if (!d.full) return '<section class="pd-card pd-dd">' + head + empty('没有收盘点位数据，无法计算回撤。') + '</section>';
    if (!d.range || !d.pairs.length) return '<section class="pd-card pd-dd">' + head + empty('所选区间内没有收盘点位。') + '</section>';
    var r = d.range, f = d.full, lab = rangeLabel(st.range);
    var stats = [
      statItem(lab + '当前回撤', '<span class="pd-down">' + esc(fmtPct(r.current)) + '</span>',
        '相对区间高点 ' + esc(fmtNum(r.peak, 2)) + '（' + esc(r.peakDate) + '）'),
      statItem(lab + '最大回撤', '<span class="pd-down">' + esc(fmtPct(r.maxDrawdown)) + '</span>',
        '峰 ' + esc(r.peakDateBeforeMaxDrawdown) + ' → 谷 ' + esc(r.maxDrawdownDate)),
      statItem('全部历史最大回撤', '<span class="pd-down">' + esc(fmtPct(f.maxDrawdown)) + '</span>',
        '峰 ' + esc(f.peakDateBeforeMaxDrawdown) + ' → 谷 ' + esc(f.maxDrawdownDate) + '；全部口径当前回撤 ' + esc(fmtPct(f.current)) +
        '（相对 ' + esc(fmtNum(f.peak, 2)) + '，' + esc(f.peakDate) + '）')
    ].join('');
    return '<section class="pd-card pd-dd">' + head + '<div class="pd-stats pd-stats-3">' + stats + '</div>' +
      '<div class="pd-chart pd-chart-dd" data-pd-chart="dd" role="img" aria-label="' + esc(lab) + '收盘点位回撤曲线"></div>' +
      '<details class="pd-note"><summary>0% 为区间最高点；往下越深，回落越大 · 口径说明</summary><p>区间口径的峰值只取所选区间内的收盘（区间首个收盘 ' + esc(d.rangeStart) + '），区间前高点不计入；全部口径从数据起点 ' + esc(d.dataStart) +
      ' 起算。指数点位不含分红再投资。曲线只连接有效观测，连线不代表中间缺失日存在数据。</p></details></section>';
  }

  // 迷你线：只用所选区间内真实非空观测；少于 MIN_HIST 个不画
  function sparkSvg(series, field, st) {
    var pairs = validPairs(M().sliceSeries(series, st.range, st.anchor), field);
    if (pairs.length < MIN_HIST || declaredFreq(series, field) === 'single') return '';
    var step = Math.max(1, Math.floor(pairs.length / 160)), pts = [];
    for (var i = 0; i < pairs.length; i += step) pts.push(pairs[i][1]);
    if (pts[pts.length - 1] !== pairs[pairs.length - 1][1]) pts.push(pairs[pairs.length - 1][1]);
    var min = Math.min.apply(null, pts), max = Math.max.apply(null, pts), span = max - min || 1;
    var W = 200, H = 34, dx = W / Math.max(1, pts.length - 1);
    var path = pts.map(function (v, k) { return (k ? 'L' : 'M') + (k * dx).toFixed(1) + ' ' + (H - 2 - (v - min) / span * (H - 4)).toFixed(1); }).join('');
    return '<svg class="pd-spark" viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="none" aria-hidden="true" focusable="false">' +
      '<path d="' + path + '" fill="none" stroke="' + COLORS.primary + '" stroke-width="1.4" vector-effect="non-scaling-stroke"/></svg>';
  }
  function miniCardsHtml(series, st) {
    function card(label, field, extra) {
      var c = fieldCoverage(series, field, st.anchor);
      return '<div class="pd-mini"><div class="pd-stat-label">' + esc(label) + '</div>' +
        (c.count ? '<div class="pd-stat-value">' + esc(fmtVal(c.lastValue, field)) + '</div><div class="pd-stat-sub">' + esc(c.last) + (c.count < MIN_HIST ? ' · 仅单期' : '') + ' · ' + shortSourceHtml(series, field) + (extra || '') + '</div>' + sparkSvg(series, field, st)
          : '<div class="pd-stat-value pd-muted">—</div><div class="pd-stat-sub">' + esc(emptyReason(series, field) || '数据源未提供') + '</div>') + '</div>';
    }
    var amtSrc = sourceOf(series, 'amt');
    var fx = amtSrc && amtSrc.fxSource && typeof amtSrc.fxSource === 'object'
      ? '<div class="pd-fx">原币换算：' + (safeUrl(amtSrc.fxSource.url || amtSrc.fxSource.page)
        ? '<a href="' + esc(safeUrl(amtSrc.fxSource.url || amtSrc.fxSource.page)) + '" target="_blank" rel="noopener noreferrer">' + esc(amtSrc.fxSource.label || '汇率来源') + '</a>'
        : esc(amtSrc.fxSource.label || '汇率来源')) + '，只用同日汇率，缺日不前填</div>' : '';
    var compWhy = emptyReason(series, 'componentNum');
    var mc = fieldCoverage(series, 'mcap', st.anchor);
    var mcLine = mc.count ? '<div class="pd-stat-sub">' + esc(mcapLabel(series)) + ' ' + esc(fmtVal(mc.lastValue, 'mcap')) + '（' + esc(mc.last) + '）</div>' : '';
    var comp = isNum(series.componentNum)
      ? '<div class="pd-stat-value">' + esc(series.componentNum) + ' 只</div><div class="pd-stat-sub">' + esc(series.componentDate || '日期未注明') + '</div>'
      : '<div class="pd-stat-value pd-muted">—</div><div class="pd-stat-sub">' + esc(compWhy || '数据源未提供') + '</div>';
    return '<section class="pd-minis">' + card('股息率', 'dy') + card('ROE', 'roe') + card('成交额', 'amt', fx) +
      '<div class="pd-mini"><div class="pd-stat-label">样本股数</div>' + comp + mcLine + '</div></section>';
  }

  function earningsHtml(series, st) {
    var sl = M().sliceSeries(series, st.range, st.anchor);
    var pe = validPairs(sl, 'pe'), eps = validPairs(sl, 'eps'), roe = validPairs(sl, 'roe');
    var head = '<div class="pd-card-head"><h3>估值与盈利</h3><span class="pd-muted">同一时间轴对照市盈率与来源披露的每股盈利，分辨谁在推动行情</span></div>';
    var peOk = pe.length >= MIN_HIST && histOk(series, 'pe', pe.length);
    var epsOk = eps.length >= MIN_HIST;
    var sub = [];
    ['eps', 'roe'].forEach(function (f) {
      var p = f === 'eps' ? eps : roe;
      if (p.length) sub.push(statItem(labelFor(f) + ' 最新', esc(fmtVal(p[p.length - 1][1], f) + (f === 'eps' && sourceOf(series, 'eps') && sourceOf(series, 'eps').unit ? ' ' + sourceOf(series, 'eps').unit : '')),esc(p[p.length - 1][0]) + ' · ' + p.length + ' 个观测 · ' + shortSourceHtml(series, f)));
      else sub.push(statItem(labelFor(f), '<span class="pd-muted">—</span>', esc(emptyReason(series, f) || '数据源未提供')));
    });
    var stats = '<div class="pd-stats pd-stats-2">' + sub.join('') + '</div>';
    if (!peOk && !epsOk) {
      var why = emptyReason(series, 'eps') || emptyReason(series, 'roe');
      return '<section class="pd-card pd-earn">' + head + stats + empty('所选区间市盈率不足以成线，数据源也未提供 EPS 序列。本页不从点位或 PE 反推盈利。' + (why ? ' ' + why : '')) + '</section>';
    }
    var note = epsOk ? epsSourceNote(series, eps, peOk) : '<p class="pd-foot">数据源未提供 EPS 序列，图中只画市盈率；本页不从点位或 PE 反推盈利。</p>';
    return '<section class="pd-card pd-earn">' + head + stats +
      '<div class="pd-chart pd-chart-mini" data-pd-chart="earn" data-pd-pe="' + (peOk ? 1 : 0) + '" data-pd-eps="' + (epsOk ? 1 : 0) + '" role="img" aria-label="市盈率与每股盈利对照"></div>' +
      '<div class="pd-plot-legend">' + (peOk ? '<span><i style="background:' + COLORS.primary + '"></i>市盈率</span>' : '') + (epsOk ? '<span><i style="background:' + COLORS.gold + '"></i>每股盈利</span>' : '') + '</div>' + note + '</section>';
  }

  // EPS 单位：取来源声明（如原站 u.eps=yuan → 元），未声明时显示“按来源”
  function epsUnit(series) {
    var src = sourceOf(series, 'eps');
    return src && src.unit ? String(src.unit) : FIELD_INFO.eps[1];
  }
  // 估值与盈利图的来源说明：EPS 与 PE 分别注明来源、单位、频率；不声称两者存在 点位/PE 恒等关系
  function epsSourceNote(series, eps, peOk) {
    var es = sourceOf(series, 'eps') || {}, ps = sourceOf(series, 'pe') || {};
    var f = declaredFreq(series, 'eps');
    var freq = f ? (FREQ_CN[f] || f) : '频率未注明';
    var samp = es.sampling ? '（' + es.sampling + '，非完整日频）' : '';
    var calc = es.calcVerified === false ? '，计算口径未核实' : '';
    var txt = '每股盈利：' + (es.label || '未注明来源') + '，单位 ' + epsUnit(series) + '/每股，' + freq + samp +
      '，本区间 ' + eps.length + ' 个观测（' + eps[0][0] + '~' + eps[eps.length - 1][0] + '）' + calc + '。';
    if (peOk) {
      txt += '市盈率：' + (ps.label || '未注明来源') + '（' + (ps.method || '口径未注明') + '）。两条线来源不同、口径未统一，只在同一时间轴并列；' +
        '同日 PE 与 EPS 不构成“点位 = 市盈率 × 每股盈利”的关系，不能互相换算。';
    }
    return '<p class="pd-foot pd-eps-note">' + esc(txt) + '</p>';
  }

  function turnoverHtml(series, st) {
    var head = '<div class="pd-card-head"><h3>成交热度</h3><span class="pd-muted">成交额（人民币亿元）与收盘点位，看情绪是否跟上</span></div>';
    var s = M().stats(series, 'amt', st.range, st.anchor);
    if (!s.count) {
      var anyAmt = fieldCoverage(series, 'amt', st.anchor).count;
      var why = anyAmt ? '' : emptyReason(series, 'amt');
      return '<section class="pd-card pd-turn">' + head + empty((anyAmt ? '所选区间没有成交额观测，可切换更长区间。' : '数据源未提供成交额。') + (why ? ' ' + why : '')) + '</section>';
    }
    var sl = M().sliceSeries(series, st.range, st.anchor);
    var amts = validPairs(sl, 'amt');
    if (!histOk(series, 'amt', s.count)) {
      var few = [
        statItem('最新成交额', esc(fmtVal(s.latest, 'amt')), esc(s.latestDate)),
        statItem('成交额历史分位', '<span class="pd-insufficient">' + esc(histShortText(series, 'amt', s.count)) + '</span>', s.count + ' 个样本 · ' + esc(freqLabel(series, 'amt', amts)))
      ].join('');
      return '<section class="pd-card pd-turn pd-turn-sparse">' + head + '<div class="pd-stats pd-stats-2">' + few + '</div>' +
        empty(histLongText(series, 'amt', s.count)) + '</section>';
    }
    var recent = amts.slice(-20), avg20 = null;
    if (recent.length) avg20 = recent.reduce(function (a, p) { return a + p[1]; }, 0) / recent.length;
    var stats = [
      statItem('最新成交额', esc(fmtVal(s.latest, 'amt')), esc(s.latestDate)),
      statItem('成交额历史分位', esc(fmtPct(s.percentile)), s.count + ' 个样本 · ' + esc(freqLabel(series, 'amt', amts))),
      statItem('近 ' + recent.length + ' 个观测均值', esc(fmtVal(avg20, 'amt')), '区间均值 ' + esc(fmtVal(s.mean, 'amt')))
    ].join('');
    return '<section class="pd-card pd-turn">' + head + '<div class="pd-stats pd-stats-3">' + stats + '</div>' +
      '<div class="pd-chart pd-chart-mini" data-pd-chart="turn" role="img" aria-label="成交额柱状图与收盘点位"></div>' +
      '<div class="pd-plot-legend"><span><i style="background:' + COLORS.bar + ';height:9px"></i>成交额</span><span><i style="background:#9fb4d0"></i>收盘点位</span>' +
      (fieldCoverage(series, 'turn', st.anchor).count ? '<span>换手率见“来源与覆盖”</span>' : '') + '</div></section>';
  }

  function warnListHtml(series) {
    var warn = Array.isArray(series.warnings) ? series.warnings.filter(Boolean) : [];
    if (!warn.length) return '';
    return '<details class="pd-note pd-warn-more" id="pd-warn-list"><summary>该指数数据提示（' + warn.length + ' 条）</summary><ul class="pd-warn" role="note">' +
      warn.map(function (w) { return '<li>' + esc(w) + '</li>'; }).join('') + '</ul></details>';
  }
  function coverageHtml(series, st) {
    function statusCell(av, count) {
      if (!av) return count ? '<span class="pd-muted">' + (count < MIN_HIST ? '仅单期' : '—') + '</span>' : '<span class="pd-muted">未取得</span>';
      var ok = count > 0;
      var txt = ok ? (count < MIN_HIST ? '可用 · 仅单期' : '可用') : statusCn(av.status === 'ok' ? 'unavailable' : av.status);
      var r = ok ? '' : shortReason(av.reason);
      return '<span class="pd-status pd-status-' + (ok ? 'ok' : 'no') + '">' + esc(txt) + '</span>' +
        (r ? '<div class="pd-reason">' + esc(r) + '</div>' : '') + reasonDetailsHtml(av);
    }
    var rows = FIELDS.map(function (f) {
      var c = fieldCoverage(series, f, st.anchor);
      return '<tr' + (c.count ? '' : ' class="pd-row-empty"') + '><th scope="row">' + esc(labelFor(f, series)) + '<span class="pd-muted"> ' + esc(f) + '</span></th>' +
        '<td>' + esc((sourceOf(series, f) && sourceOf(series, f).unit) || FIELD_INFO[f][1]) + '</td>' +
        '<td>' + sourceHtml(series, f) + '</td>' +
        '<td class="pd-num">' + (c.count ? c.count : '<span class="pd-muted">无</span>') + '</td>' +
        '<td>' + esc(c.first || '—') + '</td><td>' + esc(c.last || '—') + '</td>' +
        '<td class="pd-num">' + esc(c.count ? fmtVal(c.lastValue, f) : '—') + '</td>' +
        '<td>' + esc(c.freq || '') + '</td><td class="pd-status-cell">' + statusCell(availOf(series, f), c.count) + '</td></tr>';
    }).join('');
    var cav = availOf(series, 'componentNum');
    if (cav || isNum(series.componentNum)) {
      var has = isNum(series.componentNum);
      rows += '<tr' + (has ? '' : ' class="pd-row-empty"') + '><th scope="row">成分股数<span class="pd-muted"> componentNum</span></th><td>只</td>' +
        '<td>' + sourceHtml(series, 'componentNum') + '</td><td class="pd-num">' + (has ? 1 : '<span class="pd-muted">无</span>') + '</td>' +
        '<td>' + esc(has ? (series.componentDate || '—') : '—') + '</td><td>' + esc(has ? (series.componentDate || '—') : '—') + '</td>' +
        '<td class="pd-num">' + esc(has ? series.componentNum : '—') + '</td><td>披露值</td>' +
        '<td class="pd-status-cell">' + statusCell(cav, has ? MIN_HIST : 0) + '</td></tr>';
    }
    var nHas = FIELDS.filter(function (f) { return fieldCoverage(series, f, st.anchor).count > 0; }).length;
    var nSingle = FIELDS.filter(function (f) { var c = fieldCoverage(series, f, st.anchor).count; return c > 0 && !histOk(series, f, c); }).length;
    return '<section class="pd-card pd-cov"><div class="pd-card-head"><h3>来源与覆盖</h3><span class="pd-muted">每个字段的日期独立，旧数据不视为当日</span></div>' +
      '<p class="pd-cov-sum">' + FIELDS.length + ' 个字段中 <b>' + nHas + '</b> 个有真实观测' + (nSingle ? '（其中 ' + nSingle + ' 个仅单期/快照，不作长期分位）' : '') + '，<b>' + (FIELDS.length - nHas) + '</b> 个未取得；来源、口径、频率与缺失原因见下表。</p>' +
      '<details class="pd-note pd-cov-more"><summary>展开字段级来源与覆盖表</summary>' +
      '<div class="pd-table-wrap" tabindex="0" role="region" aria-label="字段覆盖表"><table class="pd-table"><thead><tr><th scope="col">字段</th><th scope="col">单位</th><th scope="col">来源 · 口径</th>' +
      '<th scope="col">观测数</th><th scope="col">首个日期</th><th scope="col">最新日期</th><th scope="col">最新值</th><th scope="col">频率</th><th scope="col">状态 · 原因</th></tr></thead><tbody>' +
      rows + '</tbody></table></div></details>' +
      warnListHtml(series) +
      '<details class="pd-note"><summary>统计口径说明</summary><p>频率优先采用来源声明，无声明时才按观测间隔估计；观测数与日期是数据实际覆盖，所选区间长度不代表已覆盖该区间。少于 ' + MIN_HIST + ' 个观测（单期）不显示分位、20/80 带与冷热评级。分位与均值只用实际非空观测计算；跨来源 PE/PB 不拼接、不前填。指标（PE/PB/股息率/市值/成交额）的区间变化不等于指数涨跌。图表只连接相邻的有效观测：本页无法区分休市与数据缺失，连线不表示中间缺失日期存在数据，请以本表的观测数、日期与频率为准。</p></details></section>';
  }

  // ---------- 图表挂载 ----------
  function mountAll(series, st) {
    var rootEl = st.root;
    var q = function (k) { return rootEl.querySelector('[data-pd-chart="' + k + '"]'); };
    var sl = M().sliceSeries(series, st.range, st.anchor);
    var el = q('main');
    if (el) {
      var s = M().stats(series, st.metric, st.range, st.anchor);
      mountChart(el, mainChartOption(st.metric, validPairs(sl, st.metric), s));
    }
    el = q('dd');
    if (el) {
      var d = drawdownSummary(series, st.range, st.anchor);
      var o = baseOption();
      o.yAxis = valueAxis('%', function (v) { return fmtNum(v, 0) + '%'; });
      o.yAxis.scale = false; o.yAxis.max = 0; o.grid.right = 18;
      o.tooltip.formatter = function (ps) {
        var p = Array.isArray(ps) ? ps[0] : ps;
        return p ? esc(p.value[0]) + '<br>' + p.marker + '回撤：' + esc(fmtPct(p.value[1])) : '';
      };
      o.series = [{ name: '回撤', type: 'line', data: d.pairs, showSymbol: false, sampling: 'lttb',
        lineStyle: { width: 1.2, color: COLORS.dd }, itemStyle: { color: COLORS.dd }, areaStyle: { color: COLORS.ddFill } }];
      mountChart(el, o);
    }
    el = q('earn');
    if (el) {
      var hasPe = el.getAttribute('data-pd-pe') === '1', hasEps = el.getAttribute('data-pd-eps') === '1';
      var eo = baseOption();
      eo.yAxis = [];
      eo.series = [];
      eo.tooltip.formatter = tooltipFmt('pe');
      if (hasPe) {
        eo.yAxis.push(valueAxis('倍', function (v) { return fmtNum(v, 1); }));
        eo.series.push({ id: 'pe', name: '市盈率', type: 'line', yAxisIndex: 0, data: validPairs(sl, 'pe'), showSymbol: false, sampling: 'lttb', lineStyle: { width: 1.4, color: COLORS.primary }, itemStyle: { color: COLORS.primary } });
      }
      if (hasEps) {
        var ax = valueAxis(epsUnit(series), function (v) { return fmtNum(v, 2); }, hasPe ? 'right' : 'left');
        if (hasPe) ax.splitLine = { show: false };
        eo.yAxis.push(ax);
        eo.series.push({ id: 'eps', name: labelFor('eps'), type: 'line', yAxisIndex: eo.yAxis.length - 1, data: validPairs(sl, 'eps'), showSymbol: true, symbolSize: 3, lineStyle: { width: 1.4, color: COLORS.gold }, itemStyle: { color: COLORS.gold } });
      }
      if (eo.yAxis.length < 2) eo.grid.right = 18;
      mountChart(el, eo);
    }
    el = q('turn');
    if (el) {
      var to = baseOption();
      var pricePairs = validPairs(sl, 'price');
      to.yAxis = [valueAxis('亿元', function (v) { return fmtNum(v, 0); })];
      to.tooltip.formatter = tooltipFmt('amt');
      to.series = [{ id: 'amt', name: '成交额', type: 'bar', data: validPairs(sl, 'amt'), large: true, barMaxWidth: 6, itemStyle: { color: COLORS.bar } }];
      if (pricePairs.length) {
        to.yAxis.push(valueAxis('点', function (v) { return fmtNum(v, 0); }, 'right'));
        to.yAxis[1].splitLine = { show: false };
        to.series.push({ id: 'price', name: '收盘点位', type: 'line', yAxisIndex: 1, data: pricePairs, showSymbol: false, sampling: 'lttb', lineStyle: { width: 1.2, color: '#9fb4d0' }, itemStyle: { color: '#9fb4d0' } });
      }
      mountChart(el, to);
    }
  }

  // ---------- 生命周期 ----------
  function disposeCharts() {
    if (!state) return;
    state.charts.forEach(function (c) { try { c.dispose(); } catch (e) { /* 已销毁 */ } });
    state.charts = [];
  }

  // 相关 ETF：etf-view.js（PanoEtf）未加载时整块不出现，不影响其他区块
  function etfHtml(series) {
    var E = root.PanoEtf;
    if (!E || typeof E.sectionHtml !== 'function') return '';
    try { return E.sectionHtml(series); } catch (e) { if (root.console) root.console.error(e); return ''; }
  }

  function draw(focusSel) {
    var st = state, series = st.series;
    disposeCharts();
    if (!M()) {
      st.root.innerHTML = empty('统计模块 analytics.js 未加载，无法展示详情。');
      return;
    }
    if (!series || !Array.isArray(series.d)) {
      st.root.innerHTML = empty('未找到该指数数据。');
      return;
    }
    st.root.innerHTML = headerHtml(series, st.anchor) + toolbarHtml(series, st) + mainCardHtml(series, st) +
      '<h3 class="pd-sec-t">这只指数的其他侧面 <span>与大曲线不重复：位置、风险、盈利、情绪</span></h3>' +
      '<div class="pd-grid pd-grid-12">' + thermoHtml(series, st) + drawdownHtml(series, st) + '</div>' +
      miniCardsHtml(series, st) +
      '<div class="pd-grid pd-grid-even">' + earningsHtml(series, st) + turnoverHtml(series, st) + '</div>' +
      etfHtml(series) + coverageHtml(series, st);
    mountAll(series, st);
    if (focusSel) {
      var f = st.root.querySelector(focusSel);
      if (f) f.focus();
    }
  }

  function onClick(ev) {
    if (!state) return;
    var t = ev.target;
    if (root.PanoEtf && root.PanoEtf.handleClick && root.PanoEtf.handleClick(ev, state.root)) return;
    var wb = t && t.closest ? t.closest('[data-pd-warn]') : null;
    if (wb && state.root.contains(wb)) {
      var wl = state.root.querySelector('#pd-warn-list');
      if (wl) { wl.open = true; if (wl.scrollIntoView) wl.scrollIntoView({ block: 'center' }); var sm = wl.querySelector('summary'); if (sm) sm.focus(); }
      return;
    }
    var btn = t && t.closest ? t.closest('[data-pd-metric],[data-pd-range]') : null;
    if (!btn || !state.root.contains(btn)) return;
    var m = btn.getAttribute('data-pd-metric'), r = btn.getAttribute('data-pd-range');
    var sel;
    if (m) { if (m === state.metric) return; state.metric = m; sel = '[data-pd-metric="' + m + '"]'; }
    if (r) { if (r === state.range) return; state.range = r; sel = '[data-pd-range="' + r + '"]'; }
    draw(sel);
    if (typeof state.onChange === 'function') {
      try { state.onChange({ range: state.range, metric: state.metric }); } catch (e) { if (root.console) root.console.error(e); }
    }
  }

  function onResize() {
    if (!state) return;
    if (state.resizeTimer) clearTimeout(state.resizeTimer);
    state.resizeTimer = setTimeout(function () {
      if (!state) return;
      state.charts.forEach(function (c) { try { c.resize(); } catch (e) { /* ignore */ } });
    }, 120);
  }

  function validRange(r) {
    r = String(r == null ? '' : r);
    for (var i = 0; i < RANGES.length; i++) if (RANGES[i][0] === r) return r;
    return '10';
  }
  function validMetric(m) {
    for (var i = 0; i < METRICS.length; i++) if (METRICS[i].key === m) return m;
    return 'pe';
  }

  function render(container, series, options) {
    if (!container) return;
    dispose();
    var opts = options || {};
    var rootEl = document.createElement('div');
    rootEl.className = 'pano-detail';
    container.innerHTML = '';
    container.appendChild(rootEl);
    state = {
      container: container, root: rootEl, series: series,
      range: validRange(opts.range), metric: validMetric(opts.metric),
      anchor: (opts.anchor && M() && M().parseDate(opts.anchor)) ? opts.anchor : null,
      onChange: opts.onChange, onOpenNotes: opts.onOpenNotes, charts: [], resizeTimer: null
    };
    rootEl.addEventListener('click', onClick);
    root.addEventListener('resize', onResize);
    draw();
  }

  function dispose() {
    if (!state) return;
    disposeCharts();
    if (state.resizeTimer) clearTimeout(state.resizeTimer);
    state.root.removeEventListener('click', onClick);
    root.removeEventListener('resize', onResize);
    if (state.root.parentNode) state.root.parentNode.removeChild(state.root);
    state = null;
  }

  root.PanoDetail = { render: render, dispose: dispose, drawdownSummary: drawdownSummary };
})(typeof window !== 'undefined' ? window : this);
