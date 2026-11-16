/*
 * 指数全景 · 统计模块 PanoMath
 * 普通 script（window.PanoMath）与 CommonJS（module.exports）双用，无依赖。
 * 所有函数只读输入，不修改原 series。
 */
(function (root, factory) {
  'use strict';
  var api = factory();
  if (typeof module === 'object' && module && module.exports) {
    module.exports = api;
  }
  if (root) {
    root.PanoMath = api;
  }
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this), function () {
  'use strict';

  var FIELDS = ['price', 'chg', 'pe', 'pb', 'dy', 'mcap', 'amt', 'turn', 'eps', 'roe', 'bps', 'volume'];
  var RANGES = { '1': 1, '3': 3, '5': 5, '10': 10, 'all': null };
  var DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

  function isNum(v) {
    return typeof v === 'number' && isFinite(v);
  }

  // 'YYYY-MM-DD' -> {y,m,d}；非法日期返回 null（含 2月30 等）
  function parseDate(s) {
    if (typeof s !== 'string') return null;
    var m = DATE_RE.exec(s);
    if (!m) return null;
    var y = +m[1], mo = +m[2], d = +m[3];
    if (mo < 1 || mo > 12 || d < 1 || d > daysInMonth(y, mo)) return null;
    return { y: y, m: mo, d: d };
  }

  function isLeap(y) {
    return (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
  }

  function daysInMonth(y, m) {
    return [31, isLeap(y) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][m - 1];
  }

  function pad2(n) {
    return (n < 10 ? '0' : '') + n;
  }

  function fmtDate(y, m, d) {
    var ys = String(y);
    while (ys.length < 4) ys = '0' + ys;
    return ys + '-' + pad2(m) + '-' + pad2(d);
  }

  // 日历年回退：2024-02-29 回退 1 年 = 2023-02-28（月末钳制）
  function minusYears(iso, years) {
    var p = parseDate(iso);
    if (!p) return null;
    var y = p.y - years;
    var d = Math.min(p.d, daysInMonth(y, p.m));
    return fmtDate(y, p.m, d);
  }

  // 自 1970-01-01 起的天数（UTC，无时区漂移）
  function dayNumber(iso) {
    var p = parseDate(iso);
    if (!p) return null;
    return Math.round(Date.UTC(p.y, p.m - 1, p.d) / 86400000);
  }

  // ISO 周序号：周一为一周起点。1970-01-05（周一）所在周 = 1。
  // 相邻 ISO 周的序号恰好相差 1，跨年（52/53 周）也成立。
  function isoWeekIndex(iso) {
    var n = dayNumber(iso);
    if (n === null) return null;
    return Math.floor((n + 3) / 7);
  }

  function lastDate(series) {
    var d = series && series.d;
    if (!d || !d.length) return null;
    var best = null;
    for (var i = 0; i < d.length; i++) {
      if (parseDate(d[i]) && (best === null || d[i] > best)) best = d[i];
    }
    return best;
  }

  /** 区间起始日（含）。range='all' 返回 null。非法 range 视为 'all'。 */
  function rangeStart(range, anchor) {
    var key = String(range == null ? 'all' : range);
    var years = Object.prototype.hasOwnProperty.call(RANGES, key) ? RANGES[key] : null;
    if (years === null || !anchor) return null;
    return minusYears(anchor, years);
  }

  /**
   * sliceSeries(series, range, anchor)
   * 区间为 [anchor 回退 N 个日历年, anchor]，两端含。
   * anchor 缺省为数据末日；anchor 之后的数据不纳入。返回新对象，12 个字段与 d 对齐。
   */
  function sliceSeries(series, range, anchor) {
    var out = {};
    var k;
    if (!series || typeof series !== 'object') {
      out.d = [];
      for (k = 0; k < FIELDS.length; k++) out[FIELDS[k]] = [];
      return out;
    }
    for (k in series) {
      if (Object.prototype.hasOwnProperty.call(series, k) && k !== 'd' && FIELDS.indexOf(k) < 0) {
        out[k] = series[k];
      }
    }
    var dates = Array.isArray(series.d) ? series.d : [];
    var end = (anchor && parseDate(anchor)) ? anchor : lastDate(series);
    var start = rangeStart(range, end);
    var idx = [];
    for (var i = 0; i < dates.length; i++) {
      var dt = dates[i];
      if (!parseDate(dt)) continue;
      if (end && dt > end) continue;
      if (start && dt < start) continue;
      idx.push(i);
    }
    out.d = idx.map(function (j) { return dates[j]; });
    for (k = 0; k < FIELDS.length; k++) {
      var f = FIELDS[k];
      var arr = Array.isArray(series[f]) ? series[f] : [];
      out[f] = idx.map(function (j) {
        var v = arr[j];
        return v === undefined ? null : v;
      });
    }
    out.rangeStart = start;
    out.rangeEnd = end;
    return out;
  }

  // 有效观测：有限数值；price 还要求 > 0
  function validValue(metric, v) {
    if (!isNum(v)) return false;
    if (metric === 'price' && v <= 0) return false;
    return true;
  }

  // 线性插值分位（与 numpy 默认 linear 一致），sorted 升序
  function quantileSorted(sorted, q) {
    var n = sorted.length;
    if (!n) return null;
    if (n === 1) return sorted[0];
    var pos = (n - 1) * q;
    var lo = Math.floor(pos), hi = Math.ceil(pos);
    return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
  }

  function emptyStats(metric) {
    return {
      metric: metric, latest: null, latestDate: null, count: 0, percentile: null,
      q20: null, q80: null, min: null, max: null, mean: null, minDate: null, maxDate: null,
      firstValue: null, firstDate: null, changePct: null,
      changeKind: metric === 'price' ? 'price' : 'metric'
    };
  }

  /**
   * stats(series, metric, range, anchor)
   * 仅统计区间内实际非空有限观测。percentile = (#样本 <= 最新值) / count * 100。
   * changePct：此指标首末相对变化（%）。仅 metric==='price' 时 changeKind='price'，可称区间涨跌。
   */
  function stats(series, metric, range, anchor) {
    var s = sliceSeries(series, range, anchor);
    var arr = s[metric];
    var res = emptyStats(metric);
    res.rangeStart = s.rangeStart || (s.d.length ? s.d[0] : null);
    res.rangeEnd = s.rangeEnd || null;
    if (!Array.isArray(arr)) return res;
    var vals = [], dates = [];
    for (var i = 0; i < s.d.length; i++) {
      if (validValue(metric, arr[i])) {
        vals.push(arr[i]);
        dates.push(s.d[i]);
      }
    }
    var n = vals.length;
    if (!n) return res;
    var latest = vals[n - 1];
    var le = 0, sum = 0, mn = vals[0], mx = vals[0], mnD = dates[0], mxD = dates[0];
    for (var j = 0; j < n; j++) {
      var v = vals[j];
      if (v <= latest) le++;
      sum += v;
      if (v < mn) { mn = v; mnD = dates[j]; }
      if (v > mx) { mx = v; mxD = dates[j]; }
    }
    var sorted = vals.slice().sort(function (a, b) { return a - b; });
    res.latest = latest;
    res.latestDate = dates[n - 1];
    res.count = n;
    res.percentile = le / n * 100;
    res.q20 = quantileSorted(sorted, 0.2);
    res.q80 = quantileSorted(sorted, 0.8);
    res.min = mn;
    res.max = mx;
    res.minDate = mnD;
    res.maxDate = mxD;
    res.mean = sum / n;
    res.firstValue = vals[0];
    res.firstDate = dates[0];
    res.changePct = (n >= 2 && vals[0] !== 0) ? (latest - vals[0]) / Math.abs(vals[0]) * 100 : null;
    return res;
  }

  /**
   * drawdown(series)
   * 以输入序列内的历史最高收盘（高水位）计算回撤 %。缺值位置保持 null，不补 0，也不更新峰值。
   * 无有效收盘时返回 null。
   */
  function drawdown(series) {
    if (!series || !Array.isArray(series.d)) return null;
    var d = series.d, p = Array.isArray(series.price) ? series.price : [];
    var peak = null, peakDate = null, values = [], maxDd = null, maxDdDate = null, maxDdPeakDate = null;
    for (var i = 0; i < d.length; i++) {
      var v = p[i];
      if (!validValue('price', v)) {
        values.push(null);
        continue;
      }
      if (peak === null || v > peak) { peak = v; peakDate = d[i]; }
      var dd = (v / peak - 1) * 100;
      if (dd === 0) dd = 0; // 去掉 -0
      values.push(dd);
      if (maxDd === null || dd < maxDd) { maxDd = dd; maxDdDate = d[i]; maxDdPeakDate = peakDate; }
    }
    if (peak === null) return null;
    return {
      dates: d.slice(), values: values, maxDrawdown: maxDd,
      maxDrawdownDate: maxDdDate, peakDateBeforeMaxDrawdown: maxDdPeakDate,
      current: lastValid(values), peak: peak, peakDate: peakDate
    };
  }

  function lastValid(arr) {
    for (var i = arr.length - 1; i >= 0; i--) if (isNum(arr[i])) return arr[i];
    return null;
  }

  /** Pearson；样本 < 3 或任一侧方差为 0 返回 null */
  function pearson(xs, ys) {
    var n = xs.length;
    if (n < 3 || ys.length !== n) return null;
    var mx = 0, my = 0, i;
    for (i = 0; i < n; i++) { mx += xs[i]; my += ys[i]; }
    mx /= n; my /= n;
    var sxy = 0, sxx = 0, syy = 0;
    for (i = 0; i < n; i++) {
      var dx = xs[i] - mx, dy = ys[i] - my;
      sxy += dx * dy; sxx += dx * dx; syy += dy * dy;
    }
    var scaleX = Math.max(Math.abs(mx), 1), scaleY = Math.max(Math.abs(my), 1);
    if (sxx <= 1e-24 * n * scaleX * scaleX || syy <= 1e-24 * n * scaleY * scaleY) return null;
    var r = sxy / Math.sqrt(sxx * syy);
    if (r > 1) r = 1;
    if (r < -1) r = -1;
    return r;
  }

  /**
   * 共同日期轴上每个 ISO 周取最后一个观测，只在相邻 ISO 周之间计算周收益率。
   * 缺周（周序号跳跃）处不产生收益率，不当 0。
   * 返回 {weeks:[周末观测日期], returns:[[每条线的周收益率...]], returnDates:[收益对应的周末日期]}
   */
  function weeklyReturns(dates, priceRows) {
    var lastIdxOfWeek = [], weekIdx = [];
    for (var i = 0; i < dates.length; i++) {
      var w = isoWeekIndex(dates[i]);
      if (weekIdx.length && weekIdx[weekIdx.length - 1] === w) {
        lastIdxOfWeek[lastIdxOfWeek.length - 1] = i;
      } else {
        weekIdx.push(w);
        lastIdxOfWeek.push(i);
      }
    }
    var returns = priceRows.map(function () { return []; });
    var returnDates = [];
    for (var k = 1; k < weekIdx.length; k++) {
      if (weekIdx[k] - weekIdx[k - 1] !== 1) continue;
      var a = lastIdxOfWeek[k - 1], b = lastIdxOfWeek[k];
      returnDates.push(dates[b]);
      for (var r = 0; r < priceRows.length; r++) {
        returns[r].push(priceRows[r][b] / priceRows[r][a] - 1);
      }
    }
    return { weeks: lastIdxOfWeek.map(function (j) { return dates[j]; }), returns: returns, returnDates: returnDates };
  }

  /**
   * compare(seriesList, range, anchor)
   * anchor 缺省取各序列末日的最大值（统一窗口）；在窗口内取所有序列都有正收盘价的共同日期，
   * 以共同首日 = 100 归一。相关性用该共同日期轴的 ISO 周末观测周收益率。
   */
  function compare(seriesList, range, anchor) {
    var list = Array.isArray(seriesList) ? seriesList.filter(function (s) { return s && typeof s === 'object'; }) : [];
    var codes = list.map(function (s) { return s.code; });
    var names = list.map(function (s) { return s.name; });
    var end = anchor && parseDate(anchor) ? anchor : null;
    if (!end) {
      list.forEach(function (s) {
        var ld = lastDate(s);
        if (ld && (!end || ld > end)) end = ld;
      });
    }
    var maps = list.map(function (s) {
      var sl = sliceSeries(s, range, end);
      var m = Object.create(null);
      for (var i = 0; i < sl.d.length; i++) {
        if (validValue('price', sl.price[i])) m[sl.d[i]] = sl.price[i];
      }
      return m;
    });
    var common = [];
    if (maps.length) {
      Object.keys(maps[0]).forEach(function (dt) {
        for (var j = 1; j < maps.length; j++) if (!(dt in maps[j])) return;
        common.push(dt);
      });
      common.sort();
    }
    var rows = maps.map(function (m) { return common.map(function (dt) { return m[dt]; }); });
    var lines = list.map(function (s, i) {
      var base = rows[i][0];
      return {
        code: s.code, name: s.name,
        values: rows[i].map(function (v) { return v / base * 100; })
      };
    });
    var n = list.length;
    var wr = weeklyReturns(common, rows);
    var matrix = [], counts = [];
    for (var a = 0; a < n; a++) {
      matrix.push([]);
      counts.push([]);
      for (var b = 0; b < n; b++) {
        var xs = [], ys = [];
        for (var t = 0; t < wr.returnDates.length; t++) {
          var x = wr.returns[a][t], y = wr.returns[b][t];
          if (isNum(x) && isNum(y)) { xs.push(x); ys.push(y); }
        }
        counts[a].push(xs.length);
        matrix[a].push(pearson(xs, ys));
      }
    }
    return {
      dates: common,
      lines: lines,
      startDate: common.length ? common[0] : null,
      endDate: common.length ? common[common.length - 1] : null,
      rangeStart: rangeStart(range, end),
      anchor: end,
      corr: {
        codes: codes, names: names, matrix: matrix, counts: counts,
        weeks: wr.weeks.length, returnDates: wr.returnDates,
        method: '共同交易日轴 · ISO 周最后一个观测 · 相邻周收益率 Pearson；缺周跳过不补 0'
      }
    };
  }

  return {
    FIELDS: FIELDS.slice(),
    METRICS: ['price', 'pe', 'pb', 'dy', 'mcap', 'amt'],
    sliceSeries: sliceSeries,
    stats: stats,
    drawdown: drawdown,
    compare: compare,
    // 辅助函数（供详情页与测试复用）
    pearson: pearson,
    weeklyReturns: weeklyReturns,
    isoWeekIndex: isoWeekIndex,
    minusYears: minusYears,
    rangeStart: rangeStart,
    parseDate: parseDate,
    lastDate: lastDate,
    quantileSorted: quantileSorted
  };
});
