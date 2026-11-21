/*
 * 指数全景 · 应用壳（PanoApp）
 * 负责：hash 路由（#/panorama、#/index/<encoded-code>）、侧栏分类/搜索/收藏、
 * CSV 导入校验（仅本次会话）、当前指数 CSV 导出、空模板下载、窄屏导航与对话框焦点。
 * 纯函数（CSV 解析/校验/合并/导出、路由解析）在无 DOM 环境下也可被 node 加载测试。
 */
(function (root) {
  'use strict';

  /** 无原型字典：外部值（代码/日期/表头）作键时不会命中 constructor/toString/__proto__ 等继承属性 */
  function dict(o) {
    var d = Object.create(null);
    if (o) Object.keys(o).forEach(function (k) { d[k] = o[k]; });
    return d;
  }
  var FIELDS = ['price', 'chg', 'pe', 'pb', 'dy', 'mcap', 'amt', 'turn', 'eps', 'roe', 'bps', 'volume', 'np'];
  var CSV_COLUMNS = ['code', 'name', 'category', 'date'].concat(FIELDS);
  var CATEGORIES = ['全局坐标', '核心宽基', '宽基谱系', '行业与主题', '行业指数', '跨境对照'];
  var IMPORT_CATEGORY = '导入（本次会话）';
  var RANGES = ['1', '3', '5', '10', 'all'];
  var METRICS = ['price', 'pe', 'pb', 'dy', 'mcap', 'amt'];
  var MISSING_TOKENS = dict({ '-': 1, '--': 1, 'null': 1, 'nan': 1, 'n/a': 1, 'na': 1 });
  var REPLACE_FIELDS = ['pe', 'pb']; // 跨源估值口径：导入时整列替换，不与原来源拼接
  var NONNEG = { price: 1, mcap: 1, amt: 1, turn: 1, volume: 1, dy: 1 };
  var UNITS = { price: '点', chg: '%', pe: '倍', pb: '倍', dy: '%', mcap: '亿元', amt: '亿元', turn: '%', eps: '来源原定义', roe: '%', bps: '来源原定义', volume: '股' };
  var FAV_KEY = 'pano.favorites.v1';
  var MAX_ERRORS = 30;
  var MAX_FILE_BYTES = 30 * 1024 * 1024;

  // ====================== 纯函数：CSV ======================
  /** RFC4180 风格解析：支持引号、"" 转义、引号内换行、CRLF、UTF-8 BOM。返回 {rows:[[cells]], error} */
  function parseCSVText(text) {
    if (typeof text !== 'string') return { rows: [], error: '文件内容不是文本' };
    if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1);
    var rows = [], row = [], cell = '', i = 0, n = text.length, inQ = false, lineNo = 1, quoteStartLine = 0;
    while (i < n) {
      var ch = text[i];
      if (inQ) {
        if (ch === '"') {
          if (text[i + 1] === '"') { cell += '"'; i += 2; continue; }
          inQ = false; i++;
          // 引号闭合后只能是分隔符或行尾
          var nx = text[i];
          if (i < n && nx !== ',' && nx !== '\n' && nx !== '\r') {
            return { rows: rows, error: '第 ' + lineNo + ' 行：引号闭合后出现多余字符' };
          }
          continue;
        }
        if (ch === '\n') lineNo++;
        cell += ch; i++; continue;
      }
      if (ch === '"') {
        if (cell.replace(/\s+/g, '') !== '') return { rows: rows, error: '第 ' + lineNo + ' 行：字段中间出现未转义的引号' };
        cell = ''; inQ = true; quoteStartLine = lineNo; i++; continue;
      }
      if (ch === ',') { row.push(cell); cell = ''; i++; continue; }
      if (ch === '\r' || ch === '\n') {
        row.push(cell); cell = '';
        rows.push({ cells: row, line: lineNo });
        row = [];
        if (ch === '\r' && text[i + 1] === '\n') i++;
        i++; lineNo++; continue;
      }
      cell += ch; i++;
    }
    if (inQ) return { rows: rows, error: '第 ' + quoteStartLine + ' 行起的引号没有闭合' };
    if (cell !== '' || row.length) { row.push(cell); rows.push({ cells: row, line: lineNo }); }
    // 去掉完全空白的行
    rows = rows.filter(function (r) { return r.cells.some(function (c) { return String(c).trim() !== ''; }); });
    return { rows: rows, error: null };
  }

  function normalizeDate(raw) {
    var s = String(raw).trim(), m;
    if ((m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(s)) || (m = /^(\d{4})\/(\d{1,2})\/(\d{1,2})$/.exec(s)) || (m = /^(\d{4})(\d{2})(\d{2})$/.exec(s))) {
      var y = +m[1], mo = +m[2], d = +m[3];
      if (y < 1900 || y > 2100 || mo < 1 || mo > 12 || d < 1) return null;
      var dt = new Date(Date.UTC(y, mo - 1, d));
      if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== d) return null;
      return y + '-' + (mo < 10 ? '0' : '') + mo + '-' + (d < 10 ? '0' : '') + d;
    }
    return null;
  }
  var NUM_RE = /^[+-]?(\d+(\.\d*)?|\.\d+)([eE][+-]?\d+)?$/;
  /** 返回 {ok:true,value:number|null} 或 {ok:false,msg}。空串/缺失标记 → null，绝不当 0。 */
  function parseNumber(raw) {
    var s = raw == null ? '' : String(raw).trim();
    if (s === '' || MISSING_TOKENS[s.toLowerCase()]) return { ok: true, value: null };
    if (/%$/.test(s)) return { ok: false, msg: '“' + s + '”含 %，请填百分数数值（1 表示 1%）' };
    if (!NUM_RE.test(s)) return { ok: false, msg: '“' + s + '”不是有效数字' };
    var v = Number(s);
    if (!isFinite(v)) return { ok: false, msg: '“' + s + '”不是有限数' };
    return { ok: true, value: v };
  }

  /**
   * 校验导入文本。全部通过才返回 groups；任何行错误 → ok:false，调用方不得修改任何数据。
   * existing: 现有 series 数组（用于名称/分类一致性提示）。
   */
  function validateImport(text, existing) {
    var res = { ok: false, errors: [], warnings: [], groups: dict(), order: [], rowCount: 0 };
    var parsed = parseCSVText(text);
    if (parsed.error) { res.errors.push(parsed.error); return res; }
    if (!parsed.rows.length) { res.errors.push('文件为空，至少需要表头和一行数据'); return res; }
    var header = parsed.rows[0].cells.map(function (h) { return String(h).trim().toLowerCase(); });
    var idx = dict(), dup = [];
    header.forEach(function (h, i) { if (h === '') return; if (h in idx) dup.push(h); else idx[h] = i; });
    if (dup.length) { res.errors.push('表头列重复：' + dup.join(', ')); return res; }
    var missingReq = ['code', 'name', 'date'].filter(function (h) { return !(h in idx); });
    if (missingReq.length) { res.errors.push('表头缺少必填列：' + missingReq.join(', ') + '（表头应为 ' + CSV_COLUMNS.join(',') + '）'); return res; }
    var unknown = header.filter(function (h) { return h && CSV_COLUMNS.indexOf(h) < 0; });
    if (unknown.length) res.warnings.push('忽略未知列：' + unknown.join(', '));
    if (!FIELDS.some(function (f) { return f in idx; })) { res.errors.push('表头中没有任何数值列（' + FIELDS.join(',') + '）'); return res; }
    var exMap = dict();
    var allowedCats = CATEGORIES.slice();
    (existing || []).forEach(function (s) {
      if (s && s.code) exMap[s.code] = s;
      if (s && s.category && s.category !== IMPORT_CATEGORY && allowedCats.indexOf(s.category) < 0) allowedCats.push(s.category);
    });
    var errCount = 0;
    function err(line, msg) { errCount++; if (res.errors.length < MAX_ERRORS) res.errors.push('第 ' + line + ' 行：' + msg); }

    for (var r = 1; r < parsed.rows.length; r++) {
      var row = parsed.rows[r], cells = row.cells, line = row.line;
      if (cells.length > header.length && cells.slice(header.length).some(function (c) { return String(c).trim() !== ''; })) {
        err(line, '列数 ' + cells.length + ' 多于表头 ' + header.length + ' 列'); continue;
      }
      var get = function (k) { return k in idx && idx[k] < cells.length ? String(cells[idx[k]]).trim() : ''; };
      var code = get('code'), name = get('name'), rawDate = get('date'), cat = get('category');
      var bad = false;
      if (!code) { err(line, 'code 为空'); bad = true; }
      else if (!/^[A-Za-z0-9][A-Za-z0-9._\-]{0,31}$/.test(code)) { err(line, 'code “' + code + '”格式无效（仅字母数字 . _ -，≤32 字符）'); bad = true; }
      if (!name) { err(line, 'name 为空'); bad = true; }
      var date = rawDate ? normalizeDate(rawDate) : null;
      if (!rawDate) { err(line, 'date 为空'); bad = true; }
      else if (!date) { err(line, 'date “' + rawDate + '”不是有效日期（YYYY-MM-DD）'); bad = true; }
      if (cat && allowedCats.indexOf(cat) < 0) { err(line, 'category “' + cat + '”不在 ' + allowedCats.join('/') + ' 中，可留空'); bad = true; }
      var vals = dict(), anyNum = false;
      FIELDS.forEach(function (f) {
        if (!(f in idx)) { vals[f] = null; return; }
        var p = parseNumber(get(f));
        if (!p.ok) { err(line, f + ' ' + p.msg); bad = true; return; }
        if (p.value !== null && NONNEG[f] && (f === 'price' ? p.value <= 0 : p.value < 0)) {
          err(line, f + ' = ' + p.value + (f === 'price' ? ' 必须大于 0' : ' 不能为负')); bad = true; return;
        }
        vals[f] = p.value;
        if (p.value !== null) anyNum = true;
      });
      if (!bad && !anyNum) { err(line, '没有任何有效数字（空单元格不会被当作 0）'); bad = true; }
      if (bad) continue;
      var g = res.groups[code];
      if (!g) {
        g = res.groups[code] = { code: code, name: name, category: cat || '', byDate: dict(), rows: 0 };
        res.order.push(code);
      } else {
        if (g.name !== name) res.warnings.push('第 ' + line + ' 行：' + code + ' 名称“' + name + '”与前文“' + g.name + '”不同，按前文');
        if (cat && !g.category) g.category = cat;
        else if (cat && g.category !== cat) { err(line, code + ' 分类“' + cat + '”与前文“' + g.category + '”冲突'); continue; }
      }
      var slot = g.byDate[date];
      if (!slot) { g.byDate[date] = vals; }
      else {
        var conflict = FIELDS.filter(function (f) { return vals[f] !== null && slot[f] !== null && vals[f] !== slot[f]; });
        if (conflict.length) { err(line, code + ' 在 ' + date + ' 重复且 ' + conflict.join(',') + ' 取值冲突'); continue; }
        FIELDS.forEach(function (f) { if (vals[f] !== null) slot[f] = vals[f]; });
      }
      g.rows++; res.rowCount++;
    }
    if (errCount > res.errors.length) res.errors.push('……另有 ' + (errCount - res.errors.length) + ' 处错误未列出');
    if (!errCount && !res.rowCount) res.errors.push('没有数据行');
    res.order.forEach(function (c) {
      var ex = exMap[c], g = res.groups[c];
      if (ex && g.name !== ex.name) res.warnings.push(c + ' 已存在，名称沿用原数据“' + ex.name + '”（CSV 为“' + g.name + '”）');
      if (ex && g.category && g.category !== ex.category) res.warnings.push(c + ' 分类沿用原数据“' + ex.category + '”（CSV 为“' + g.category + '”）');
    });
    res.ok = errCount === 0 && res.rowCount > 0;
    return res;
  }

  function cloneSources(src) {
    var out = dict();
    if (src && typeof src === 'object') Object.keys(src).forEach(function (k) {
      out[k] = src[k] && typeof src[k] === 'object' ? JSON.parse(JSON.stringify(src[k])) : src[k];
    });
    return out;
  }

  /**
   * 合并一个导入组到已有 series（可为 null），返回新对象，不修改原对象。
   * - price/chg/dy/mcap/amt/turn/eps/roe/bps/volume：按日期合并，导入非空值覆盖同日值，空单元格保留原值。
   * - pe/pb（REPLACE_FIELDS）：跨源估值口径不拼接。CSV 为该代码提供了任一非空值时整字段替换：
   *   只保留本次 CSV 实际提供的日期观测，原来源该列其余日期全部清空，sources 换成导入来源。
   */
  function mergeSeries(base, group, fileName) {
    var map = dict(), stat = { added: 0, overridden: 0, filled: 0, fields: dict(), replaced: [], cleared: 0 };
    var label = '用户导入CSV（本次会话）' + (fileName ? '：' + fileName : '');
    var baseDates = dict();
    if (base && Array.isArray(base.d)) {
      base.d.forEach(function (dt, i) {
        var o = dict();
        FIELDS.forEach(function (f) { var a = base[f]; o[f] = Array.isArray(a) && i < a.length && typeof a[i] === 'number' && isFinite(a[i]) ? a[i] : null; });
        map[dt] = o; baseDates[dt] = true;
      });
    }
    var importDates = Object.keys(group.byDate);
    // 整字段替换的估值字段：只要本次 CSV 对该代码提供了任一非空值
    REPLACE_FIELDS.forEach(function (f) {
      if (!importDates.some(function (dt) { return group.byDate[dt][f] !== null; })) return;
      stat.replaced.push(f);
      Object.keys(map).forEach(function (dt) {
        if (map[dt][f] !== null && group.byDate[dt] && group.byDate[dt][f] !== null) return; // 同日将被导入值覆盖
        if (map[dt][f] !== null) { stat.cleared++; map[dt][f] = null; }
      });
    });
    importDates.forEach(function (dt) {
      var v = group.byDate[dt], o = map[dt];
      if (!o) { o = map[dt] = dict(); FIELDS.forEach(function (f) { o[f] = null; }); stat.added++; }
      FIELDS.forEach(function (f) {
        if (v[f] === null) return;
        if (o[f] === null) stat.filled++; else if (o[f] !== v[f]) stat.overridden++;
        o[f] = v[f];
        stat.fields[f] = (stat.fields[f] || 0) + 1;
      });
    });
    // 原数据中只有被替换估值字段的日期，清空后整行为空：去掉，避免留下空行
    var dates = Object.keys(map).filter(function (dt) {
      return FIELDS.some(function (f) { return map[dt][f] !== null; });
    }).sort();
    var out = {
      code: base ? base.code : group.code,
      name: base ? base.name : group.name,
      category: base ? base.category : (group.category || IMPORT_CATEGORY),
      description: base ? base.description : '用户导入（本次会话）',
      componentNum: base ? base.componentNum : null,
      componentDate: base ? base.componentDate : null,
      sources: cloneSources(base && base.sources),
      warnings: (base && Array.isArray(base.warnings) ? base.warnings.slice() : []),
      d: dates
    };
    FIELDS.forEach(function (f) { out[f] = dates.map(function (dt) { return map[dt][f]; }); });
    var touched = Object.keys(stat.fields);
    var importSource = function (f, method) { return { label: label, url: '', unit: UNITS[f], method: method }; };
    touched.forEach(function (f) {
      var old = out.sources[f];
      if (REPLACE_FIELDS.indexOf(f) >= 0) {
        out.sources[f] = importSource(f, '用户提供，未经核验；整列替换，仅含本次 CSV 的 ' + stat.fields[f] + ' 个观测');
        if (old && old.label) out.warnings.push(f + ' 已整列替换为' + label + '（' + stat.fields[f] + ' 个观测），原来源“' + old.label + '”的该列数据本次会话不再使用，不与导入值拼接');
      } else if (!old) {
        out.sources[f] = importSource(f, '用户提供，未经核验');
      } else {
        out.warnings.push(f + ' 有 ' + stat.fields[f] + ' 个日期来自' + label + '，口径可能与原来源“' + (old.label || '') + '”不同');
      }
    });
    out.sources.userImport = { label: label, url: '', unit: '', method: '字段：' + touched.join(',') + (stat.replaced.length ? '（' + stat.replaced.join('/') + ' 整列替换）' : '') + '；仅保存在页面内存' };
    out.imported = { file: fileName || '', fields: touched, replaced: stat.replaced.slice(), rows: group.rows };
    return { series: out, stat: stat };
  }

  /** 把校验通过的结果应用到 series 列表，返回新列表与摘要；原列表与原对象不变。 */
  function applyImport(list, validated, fileName) {
    var byCode = dict(), out = list.slice(), summary = { merged: [], created: [], added: 0, overridden: 0, filled: 0, cleared: 0, replaced: [] };
    out.forEach(function (s, i) { byCode[s.code] = i; });
    validated.order.forEach(function (code) {
      var g = validated.groups[code];
      var i = byCode[code];
      var m = mergeSeries(i == null ? null : out[i], g, fileName);
      if (i == null) { byCode[code] = out.length; out.push(m.series); summary.created.push(code); }
      else { out[i] = m.series; summary.merged.push(code); }
      summary.added += m.stat.added; summary.overridden += m.stat.overridden; summary.filled += m.stat.filled;
      summary.cleared += m.stat.cleared;
      m.stat.replaced.forEach(function (f) { summary.replaced.push(code + ' ' + f); });
    });
    return { list: out, summary: summary };
  }

  function csvCell(v) {
    var s = v == null ? '' : String(v);
    return /[",\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  }
  function seriesToCSV(s) {
    var lines = [CSV_COLUMNS.join(',')];
    var d = Array.isArray(s.d) ? s.d : [];
    for (var i = 0; i < d.length; i++) {
      var row = [s.code, s.name, s.category || '', d[i]];
      FIELDS.forEach(function (f) {
        var a = s[f], v = Array.isArray(a) ? a[i] : null;
        row.push(typeof v === 'number' && isFinite(v) ? String(v) : '');
      });
      lines.push(row.map(csvCell).join(','));
    }
    return '﻿' + lines.join('\r\n') + '\r\n';
  }
  function templateCSV() { return '﻿' + CSV_COLUMNS.join(',') + '\r\n'; }

  // ====================== 纯函数：路由 ======================
  function parseRoute(hash) {
    var h = String(hash || '').replace(/^#/, '');
    var q = '', qi = h.indexOf('?');
    if (qi >= 0) { q = h.slice(qi + 1); h = h.slice(0, qi); }
    var params = dict();
    q.split('&').forEach(function (kv) {
      if (!kv) return;
      var p = kv.split('=');
      try { params[decodeURIComponent(p[0])] = decodeURIComponent(p.slice(1).join('=')); } catch (e) { /* 忽略坏参数 */ }
    });
    var range = RANGES.indexOf(params.range) >= 0 ? params.range : null;
    var metric = METRICS.indexOf(params.metric) >= 0 ? params.metric : null;
    var m = /^\/index\/(.+)$/.exec(h);
    if (m) {
      var code;
      try { code = decodeURIComponent(m[1]); } catch (e) { return { name: 'notfound', raw: m[1] }; }
      return { name: 'index', code: code, range: range, metric: metric };
    }
    if (h === '' || h === '/' || h === '/panorama') return { name: 'panorama', canonical: h === '/panorama' };
    return { name: 'notfound', raw: h };
  }
  function indexHash(code, range, metric) {
    var q = [];
    if (range) q.push('range=' + encodeURIComponent(range));
    if (metric) q.push('metric=' + encodeURIComponent(metric));
    return '#/index/' + encodeURIComponent(code) + (q.length ? '?' + q.join('&') : '');
  }

  // ====================== 纯函数：统计锚点 ======================
  /**
   * 所有序列中“任一字段为非空有限数”的最新合法 ISO 日期。
   * 用作统计锚点，避免 bundle.asOf 早于跨境数据或本次会话导入数据时把新日期截掉。
   */
  function maxObservationDate(list) {
    var best = null;
    (Array.isArray(list) ? list : []).forEach(function (s) {
      if (!s || !Array.isArray(s.d)) return;
      for (var i = s.d.length - 1; i >= 0; i--) {
        var dt = s.d[i];
        if (typeof dt !== 'string' || (best && dt <= best) || normalizeDate(dt) !== dt) continue;
        for (var k = 0; k < FIELDS.length; k++) {
          var a = s[FIELDS[k]];
          if (Array.isArray(a) && typeof a[i] === 'number' && isFinite(a[i])) { best = dt; break; }
        }
      }
    });
    return best;
  }
  /** 统计锚点 = max(数据包 asOf, 当前全部数据的最新实际观测日)；都无效时为 null。 */
  function statsAnchor(baseAsOf, list) {
    var b = typeof baseAsOf === 'string' && normalizeDate(baseAsOf) === baseAsOf ? baseAsOf : null;
    var m = maxObservationDate(list);
    if (!b) return m;
    if (!m) return b;
    return m > b ? m : b;
  }
  /**
   * 导入流程（纯函数）：校验 → 合并 → 重算锚点。失败时不返回 list/anchor，调用方保持原状态。
   */
  function importText(list, text, fileName, baseAsOf) {
    var v = validateImport(text, list);
    if (!v.ok) return { ok: false, validation: v };
    var applied = applyImport(list, v, fileName);
    return { ok: true, validation: v, list: applied.list, summary: applied.summary, anchor: statsAnchor(baseAsOf, applied.list) };
  }

  var api = {
    maxObservationDate: maxObservationDate, statsAnchor: statsAnchor, importText: importText,
    parseCSVText: parseCSVText, validateImport: validateImport, mergeSeries: mergeSeries, applyImport: applyImport,
    seriesToCSV: seriesToCSV, templateCSV: templateCSV, parseRoute: parseRoute, indexHash: indexHash,
    normalizeDate: normalizeDate, parseNumber: parseNumber, CSV_COLUMNS: CSV_COLUMNS
  };
  root.PanoApp = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof document === 'undefined') return;

  // ====================== DOM 应用 ======================
  var $ = function (id) { return document.getElementById(id); };
  var U = (root.PanoHome && root.PanoHome.util) || null;
  function esc(s) { return U ? U.esc(s) : String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return '&#' + c.charCodeAt(0) + ';'; }); }
  function fmtPct(v) { return U ? U.fmtPct(v) : (typeof v === 'number' && isFinite(v) ? v.toFixed(2) + '%' : '—'); }
  function cls(v) { return U ? U.cls(v) : ''; }

  var dataset = root.PANO_DATA;
  var dataOk = !!(dataset && typeof dataset === 'object' && Array.isArray(dataset.indices));
  var state = {
    indices: dataOk ? dataset.indices.filter(function (s) { return s && typeof s.code === 'string' && Array.isArray(s.d); }) : [],
    baseAsOf: dataOk ? dataset.asOf || null : null, // 原数据包截至日（仅展示，不随导入改变）
    anchor: null, baseAnchor: null,                   // 统计锚点：初始化与成功导入后重算
    range: '10', metric: 'pe', homeRange: '10',
    favorites: [], favPersist: true, route: null, view: null, current: null,
    query: '', collapsed: dict(), importedCodes: dict(), navOpen: false, etfFocus: null, scrollEtf: false
  };

  state.anchor = state.baseAnchor = statsAnchor(state.baseAsOf, state.indices);
  /** 锚点说明：区分原数据包、跨市场数据更晚、含本次导入数据三种情况，不把导入日期说成官方更新 */
  function anchorNote() {
    if (!state.anchor) return '';
    if (state.anchor === state.baseAsOf) return '统计截至 ' + state.anchor;
    if (state.anchor === state.baseAnchor) return '统计截至 ' + state.anchor + '（部分跨市场数据晚于数据包 ' + (state.baseAsOf || '未知') + '）';
    return '本次会话统计截至 ' + state.anchor + '（含导入数据；原数据包截至 ' + (state.baseAsOf || '未知') + '）';
  }
  function loadFavorites() {
    try {
      var raw = root.localStorage && root.localStorage.getItem(FAV_KEY);
      var arr = raw ? JSON.parse(raw) : [];
      state.favorites = Array.isArray(arr) ? arr.filter(function (c) { return typeof c === 'string'; }) : [];
    } catch (e) { state.favorites = []; state.favPersist = false; }
  }
  function saveFavorites() {
    try { root.localStorage.setItem(FAV_KEY, JSON.stringify(state.favorites)); state.favPersist = true; }
    catch (e) { state.favPersist = false; }
  }
  function isFav(code) { return state.favorites.indexOf(code) >= 0; }
  function toggleFavorite(code) {
    var i = state.favorites.indexOf(code);
    if (i >= 0) state.favorites.splice(i, 1); else state.favorites.push(code);
    saveFavorites();
    renderSidebar();
    syncDetailFav();
    renderBanner();
    return state.favorites.slice();
  }
  function findSeries(code) {
    for (var i = 0; i < state.indices.length; i++) if (state.indices[i].code === code) return state.indices[i];
    return null;
  }

  // ---------- 下载 ----------
  function download(name, text) {
    var blob = new Blob([text], { type: 'text/csv;charset=utf-8' });
    if (root.navigator && root.navigator.msSaveBlob) { root.navigator.msSaveBlob(blob, name); return; }
    var url = URL.createObjectURL(blob), a = document.createElement('a');
    a.href = url; a.download = name; a.style.display = 'none';
    document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(url); a.remove(); }, 1500);
  }
  function safeName(s) { return String(s).replace(/[^A-Za-z0-9._\-一-龥]+/g, '_'); }

  // ---------- 顶栏/横幅 ----------
  function renderMeta() {
    var el = $('dataMeta'); if (!el) return;
    var parts = [];
    if (dataOk) {
      parts.push('<span class="pill">数据包截至 ' + esc(state.baseAsOf || '未知') + '</span>');
      if (dataset.generatedAt) {
        var g = new Date(dataset.generatedAt);
        parts.push('<span>生成 ' + esc(isNaN(g) ? dataset.generatedAt : g.toLocaleString('zh-CN', { hour12: false })) + '</span>');
      }
      parts.push('<span>· ' + state.indices.length + ' 只指数</span>');
    } else {
      parts.push('<span class="pill pill-warn">数据包未加载</span>');
    }
    var nImp = Object.keys(state.importedCodes).length;
    if (nImp) parts.push('<span class="pill pill-warn">本次会话导入 ' + nImp + ' 只</span>');
    if (state.anchor && state.anchor !== state.baseAsOf) parts.push('<span class="pill' + (state.anchor !== state.baseAnchor ? ' pill-warn' : '') + '">' + esc(anchorNote()) + '</span>');
    el.innerHTML = parts.join(' ');
  }
  var bannerDismissed = dict();
  function renderBanner() {
    var el = $('banner'); if (!el) return;
    var out = [];
    if (!dataOk) {
      out.push('<div class="banner error" role="alert"><div><strong>未找到可用数据包。</strong>请确认 data-bundle.js 与 index.html 在同一目录并已由数据脚本生成（window.PANO_DATA）。也可用“导入 CSV”加载本次会话数据。</div></div>');
    }
    var missing = [];
    if (!root.PanoMath) missing.push('analytics.js（统计：分位/叠加/相关性将显示空态）');
    if (!root.PanoDetail) missing.push('detail.js（指数详情将显示基础信息）');
    if (!root.echarts) missing.push('assets/echarts.min.js（图表）');
    if (missing.length) out.push('<div class="banner info" role="status"><div>以下模块未加载：' + missing.map(esc).join('；') + '</div></div>');
    if (!state.favPersist && !bannerDismissed.fav) {
      out.push('<div class="banner" role="status"><div>浏览器禁止本地存储，收藏仅在本次打开期间有效。</div><button type="button" class="btn btn-ghost" data-dismiss="fav">知道了</button></div>');
    }
    el.innerHTML = out.join('');
    renderNotes();
  }
  // 数据包级说明：不再做大横幅，统一收在页尾折叠区；顶栏只留一个紧凑入口
  function datasetWarnings() { return dataOk && Array.isArray(dataset.warnings) ? dataset.warnings.filter(Boolean) : []; }
  function renderNotes() {
    var el = $('pageNotes'); if (!el) return;
    var ws = datasetWarnings();
    el.innerHTML = ws.length ? '<details class="page-notes" id="pageNotesBox"><summary>数据包说明（' + ws.length + ' 条）· 各字段日期独立、覆盖范围与缺失原因</summary><ul>' +
      ws.map(function (w) { return '<li>' + esc(typeof w === 'string' ? w : JSON.stringify(w)) + '</li>'; }).join('') + '</ul></details>' : '';
  }
  function openNotes() {
    var d = $('pageNotesBox'); if (!d) return;
    d.open = true; d.scrollIntoView({ block: 'center' });
    var sm = d.querySelector('summary'); if (sm) sm.focus({ preventScroll: true });
  }

  // ---------- 侧栏 ----------
  function matches(s, q) {
    if (!q) return true;
    return (s.name || '').toLowerCase().indexOf(q) >= 0 || (s.code || '').toLowerCase().indexOf(q) >= 0 ||
      (s.category || '').toLowerCase().indexOf(q) >= 0 ||
      (root.PanoEtf && q.length >= 2 ? root.PanoEtf.searchText(s.code).indexOf(q) >= 0 : false);
  }
  // 分类说明：只描述“点进去能回答什么问题”，不含任何数值
  var CAT_MEAN = dict({
    '__fav': '常看的指数放在一起，只保存在本浏览器。',
    '全局坐标': '四条大盘主线：先看全市场往哪走。',
    '核心宽基': '大中小盘代表，看市场主体的位置与估值。',
    '宽基谱系': '更宽或更细的规模切片，补齐大小盘全貌。',
    '行业与主题': '红利、消费、科技、医药、周期等主题，看风格偏好。',
    '行业指数': '中证全指一级行业及细分行业，看板块轮动。',
    '跨境对照': '港股、美股，看外部水位与同日涨跌。'
  });
  function itemHTML(s, currentCode) {
    var q = U ? U.latestQuote(s) : { chg: null, date: null };
    var on = isFav(s.code);
    return '<li class="side-item' + (on ? ' is-fav' : '') + '"><a class="side-link" href="' + esc(indexHash(s.code)) + '"' + (s.code === currentCode ? ' aria-current="page"' : '') +
      ' title="' + esc(s.name + ' ' + s.code + (q.date ? ' · ' + q.date + ' 收盘' : '')) + '"><span class="nm">' + esc(s.name || s.code) + '</span>' +
      '<span class="chg ' + cls(q.chg) + '">' + fmtPct(q.chg) + '</span></a>' +
      '<button type="button" class="star-btn" data-fav="' + esc(s.code) + '" aria-pressed="' + on + '" aria-label="' + (on ? '取消收藏 ' : '收藏 ') + esc(s.name) + '">' + (on ? '★' : '☆') + '</button></li>';
  }
  // 全局坐标：每只的角色与看点（描述性文字，不含数值）
  var COORD_ROLE = dict({
    '000001.SH': ['统筹全局', '全市场方向，先看它'],
    '399001.SZ': ['深市权重', '看深市蓝筹与制造'],
    '399006.SZ': ['成长风向', '看成长与创新企业'],
    '000688.SH': ['硬科技', '看科创板核心资产']
  });
  function coordCardHTML(s, currentCode) {
    var q = U ? U.latestQuote(s) : { price: null, chg: null, date: null };
    var role = COORD_ROLE[s.code] || ['', ''];
    var on = isFav(s.code);
    return '<li class="side-coord' + (on ? ' is-fav' : '') + '"><a class="side-link side-coord-link" href="' + esc(indexHash(s.code)) + '"' + (s.code === currentCode ? ' aria-current="page"' : '') +
      ' title="' + esc(s.name + ' ' + s.code + (q.date ? ' · ' + q.date + ' 收盘' : '')) + '">' +
      '<span class="cc-hd"><span class="nm">' + esc(s.name || s.code) + '</span>' + (role[0] ? '<span class="cc-role">' + esc(role[0]) + '</span>' : '') + '</span>' +
      (role[1] ? '<span class="cc-mean">' + esc(role[1]) + '</span>' : '') +
      '<span class="cc-q"><b>' + (U ? U.fmtNum(q.price, 2) : '—') + '</b><span class="chg ' + cls(q.chg) + '">' + fmtPct(q.chg) + '</span></span></a>' +
      '<button type="button" class="star-btn" data-fav="' + esc(s.code) + '" aria-pressed="' + on + '" aria-label="' + (on ? '取消收藏 ' : '收藏 ') + esc(s.name) + '">' + (on ? '★' : '☆') + '</button></li>';
  }
  function groupHTML(key, title, items, currentCode, forceOpen, emptyText) {
    var collapsed = !forceOpen && !!state.collapsed[key];
    var id = 'grp-' + encodeURIComponent(key).replace(/%/g, '_');
    var mean = CAT_MEAN[key] || '';
    var kind = key === '全局坐标' ? ' side-group-global' : key === '__fav' ? ' side-group-fav' : '';
    return '<div class="side-group' + kind + '"><button type="button" class="side-group-btn" data-group="' + esc(key) + '" aria-expanded="' + !collapsed + '" aria-controls="' + id + '">' +
      '<b>' + esc(title) + '</b><span class="count">' + items.length + ' 只</span><span class="caret" aria-hidden="true">' + (collapsed ? '展开' : '收起') + '</span></button>' +
      (mean ? '<p class="side-mean">' + esc(mean) + '</p>' : '') +
      '<ul id="' + id + '" class="side-chips' + (key === '全局坐标' ? ' side-coords' : '') + '"' + (collapsed ? ' hidden' : '') + '>' + (items.length ? items.map(function (s) { return key === '全局坐标' ? coordCardHTML(s, currentCode) : itemHTML(s, currentCode); }).join('') :
      '<li class="side-empty">' + esc(emptyText || '无') + '</li>') + '</ul></div>';
  }
  function renderSidebar() {
    var nav = $('sideNav'); if (!nav) return;
    var q = state.query.trim().toLowerCase();
    var cur = state.route && state.route.name === 'index' ? state.route.code : null;
    var list = state.indices.filter(function (s) { return matches(s, q); });
    var html = '';
    var favs = state.favorites.map(findSeries).filter(function (s) { return s && matches(s, q); });
    if (favs.length) html += groupHTML('__fav', '★ 我的收藏', favs, cur, !!q, '点击指数旁的 ☆ 收藏，常看的放在一起。');
    var cats = CATEGORIES.slice();
    list.forEach(function (s) { var c = s.category || '未分类'; if (cats.indexOf(c) < 0) cats.push(c); });
    cats.forEach(function (c) {
      var items = list.filter(function (s) { return (s.category || '未分类') === c; });
      if (!items.length) return;
      html += groupHTML(c, c, items, cur, !!q);
    });
    if (q && !list.length) html += '<p class="side-empty" role="status">没有匹配“' + esc(state.query) + '”的指数。</p>';
    if (!state.indices.length) html += '<p class="side-empty">暂无指数数据。</p>';
    nav.innerHTML = html;
    var tot = $('sideTot');
    if (tot) tot.textContent = q ? list.length + ' / ' + state.indices.length + ' 只' : state.indices.length + ' 只';
    var home = document.querySelector('.side-home');
    if (home) { if (state.route && state.route.name === 'panorama') home.setAttribute('aria-current', 'page'); else home.removeAttribute('aria-current'); }
  }

  // ---------- 视图 ----------
  function disposeView() {
    try { if (root.PanoHome && root.PanoHome.dispose) root.PanoHome.dispose(); } catch (e) { console.error(e); }
    try { if (root.PanoDetail && root.PanoDetail.dispose) root.PanoDetail.dispose(); } catch (e) { console.error(e); }
    var v = $('view'); if (v) v.innerHTML = '';
    state.view = null; state.current = null;
  }
  function setExport(series) {
    var b = $('exportBtn'); if (!b) return;
    b.disabled = !series;
    b.title = series ? '导出 ' + series.name + ' 全部历史为 CSV' : '进入某只指数详情后可导出';
  }
  function renderHome() {
    var v = $('view');
    state.view = 'home';
    setExport(null);
    document.title = '指数全景 · BusinessWeb';
    if (!root.PanoHome) { v.innerHTML = '<div class="empty"><strong>首页模块未加载</strong>home.js 不可用。</div>'; return; }
    root.PanoHome.render(v, state.indices, {
      range: state.homeRange, anchor: state.anchor || undefined, anchorNote: anchorNote(), favorites: state.favorites.slice(),
      onSelect: function (code) { navigate(indexHash(code)); },
      onSelectEtf: function (code) { state.etfFocus = code; navigate(indexHash(code)); },
      onToggleFavorite: toggleFavorite,
      onRangeChange: function (r) { state.homeRange = r; },
      notesCount: datasetWarnings().length,
      onOpenNotes: openNotes
    });
  }
  function detailBarHTML(s) {
    var on = isFav(s.code);
    return '<div class="detail-bar"><a class="back-btn" href="#/panorama">‹ 返回全局页</a>' +
      '<nav class="crumbs" aria-label="位置"><a href="#/panorama">指数全景</a> / <span>' + esc(s.category || '未分类') + '</span> / <b>' + esc(s.name) + '</b></nav>' +
      '<span class="spacer"></span>' +
      (s.imported ? '<span class="tag gold" title="本次会话导入，刷新后丢失">含导入数据</span>' : '') +
      '<button type="button" class="btn btn-sm" id="detailFav" aria-pressed="' + on + '">' + (on ? '★ 已收藏' : '☆ 收藏') + '</button>' +
      '<button type="button" class="btn btn-sm" id="detailExport">导出此指数 CSV</button></div>';
  }
  function syncDetailFav() {
    var b = $('detailFav'); if (!b || !state.current) return;
    var on = isFav(state.current.code);
    b.setAttribute('aria-pressed', String(on)); b.textContent = on ? '★ 已收藏' : '☆ 收藏';
  }
  function fallbackDetailHTML(s) {
    var q = U ? U.latestQuote(s) : { price: null, date: null, chg: null };
    var src = s.sources || {};
    return '<section class="section fallback-detail"><div class="section-head"><h2>' + esc(s.name) + ' <span class="muted small">' + esc(s.code) + '</span></h2></div>' +
      '<div class="empty" style="margin-bottom:12px"><strong>详情模块未加载</strong>detail.js（PanoDetail）不可用，以下仅为基础信息。</div>' +
      '<dl><dt>分类</dt><dd>' + esc(s.category || '—') + '</dd><dt>说明</dt><dd>' + esc(s.description || '—') + '</dd>' +
      '<dt>最新收盘</dt><dd>' + (U ? U.fmtNum(q.price, 2) : '—') + ' 点 ' + esc(q.date || '') + '</dd><dt>涨跌</dt><dd class="' + cls(q.chg) + '">' + fmtPct(q.chg) + '</dd>' +
      '<dt>历史区间</dt><dd>' + esc(s.d.length ? s.d[0] + ' 至 ' + s.d[s.d.length - 1] + '，' + s.d.length + ' 行' : '无数据') + '</dd>' +
      '<dt>来源</dt><dd>' + Object.keys(src).map(function (k) { return esc(k + '：' + (src[k] && src[k].label || '')); }).join('；') + '</dd></dl></section>';
  }
  // 首页“直接ETF”入口：进入详情后定位到 ETF 区块（只生效一次）
  function takeEtfFocus(code) {
    var hit = state.etfFocus === code;
    state.etfFocus = null;
    return hit;
  }
  function renderDetail(route) {
    var v = $('view');
    var s = findSeries(route.code);
    if (!s) {
      state.view = 'notfound'; setExport(null);
      document.title = '未找到指数 · 指数全景';
      v.innerHTML = '<section class="section"><div class="page-title"><h1 id="viewTitle" tabindex="-1">未找到指数</h1></div>' +
        '<div class="empty"><strong>数据中没有代码 “' + esc(route.code) + '”</strong>可能是链接有误，或该指数仅在之前的会话中导入过（导入数据刷新后不保留）。</div>' +
        '<p style="margin-top:12px"><a class="btn btn-primary" href="#/panorama">返回全局页</a></p></section>';
      return;
    }
    if (route.range) state.range = route.range;
    if (route.metric) state.metric = route.metric;
    state.view = 'detail'; state.current = s;
    setExport(s);
    document.title = s.name + ' ' + s.code + ' · 指数全景';
    state.scrollEtf = takeEtfFocus(s.code);
    v.innerHTML = detailBarHTML(s) + '<div id="detailHost"></div>';
    var host = $('detailHost');
    if (!root.PanoDetail || typeof root.PanoDetail.render !== 'function') { host.innerHTML = fallbackDetailHTML(s); return; }
    try {
      root.PanoDetail.render(host, s, {
        range: state.range, metric: state.metric, anchor: state.anchor || undefined,
        onOpenNotes: openNotes,
        onChange: function (o) {
          if (!o) return;
          if (RANGES.indexOf(o.range) >= 0) state.range = o.range;
          if (METRICS.indexOf(o.metric) >= 0) state.metric = o.metric;
          var h = indexHash(s.code, state.range, state.metric);
          state.route = parseRoute(h);
          try { history.replaceState(history.state, '', h); } catch (e) { /* file:// 等环境不支持时保留现状 */ }
        }
      });
    } catch (e) {
      console.error(e);
      host.innerHTML = '<div class="banner error" role="alert">详情渲染出错：' + esc(e && e.message) + '</div>' + fallbackDetailHTML(s);
    }
  }
  function renderNotFound(route) {
    state.view = 'notfound'; setExport(null);
    $('view').innerHTML = '<section class="section"><div class="page-title"><h1 id="viewTitle" tabindex="-1">页面不存在</h1></div>' +
      '<div class="empty"><strong>无法识别的地址 “#' + esc(route.raw || '') + '”</strong></div>' +
      '<p style="margin-top:12px"><a class="btn btn-primary" href="#/panorama">返回全局页</a></p></section>';
  }

  function sameRoute(a, b) {
    return a && b && a.name === b.name && a.code === b.code && (a.range || null) === (b.range || null) && (a.metric || null) === (b.metric || null);
  }
  function route(opts) {
    var r = parseRoute(location.hash);
    if (r.name === 'panorama' && !r.canonical) {
      try { history.replaceState(history.state, '', '#/panorama'); } catch (e) { /* ignore */ }
    }
    if (!(opts && opts.force) && sameRoute(r, state.route) && state.view) return;
    var prev = state.route;
    state.route = r;
    disposeView();
    if (r.name === 'index') renderDetail(r);
    else if (r.name === 'panorama') renderHome();
    else renderNotFound(r);
    renderSidebar();
    if (prev && !(opts && opts.keepScroll)) {
      root.scrollTo(0, 0);
      var t = document.querySelector('#view h1, #view h2');
      var main = $('main');
      if (t && t.hasAttribute('tabindex')) t.focus({ preventScroll: true });
      else if (main) main.focus({ preventScroll: true });
    }
    if (state.scrollEtf) {
      state.scrollEtf = false;
      var sec = $('pd-etf');
      if (sec) { sec.scrollIntoView({ block: 'start' }); sec.focus({ preventScroll: true }); }
    }
  }
  function navigate(hash) {
    closeNav(false);
    if (location.hash === hash) route({ force: true });
    else location.hash = hash;
  }

  // ---------- 导航开合 ----------
  function openNav() {
    state.navOpen = true;
    document.body.classList.add('nav-open');
    $('navToggle').setAttribute('aria-expanded', 'true');
    $('navToggle').setAttribute('aria-label', '关闭指数导航');
    $('scrim').hidden = false;
    var si = $('searchInput'); if (si) si.focus();
  }
  function closeNav(returnFocus) {
    if (!state.navOpen) return;
    state.navOpen = false;
    document.body.classList.remove('nav-open');
    $('navToggle').setAttribute('aria-expanded', 'false');
    $('navToggle').setAttribute('aria-label', '打开指数导航');
    $('scrim').hidden = true;
    if (returnFocus) $('navToggle').focus();
  }
  function isNarrow() { return root.matchMedia ? root.matchMedia('(max-width: 900px)').matches : false; }

  // ---------- 导入对话框 ----------
  var dialogOpener = null;
  function openImport() {
    var d = $('importDialog');
    dialogOpener = document.activeElement;
    if (typeof d.showModal === 'function') { try { d.showModal(); } catch (e) { d.setAttribute('open', ''); d.classList.add('fallback-open'); } }
    else { d.setAttribute('open', ''); d.classList.add('fallback-open'); }
    var first = d.querySelector('#importFile');
    // 文件 input 视觉隐藏，焦点放到可见的“选择文件”区域
    if (first) first.focus();
  }
  function closeImport() {
    var d = $('importDialog');
    if (typeof d.close === 'function' && d.open) d.close();
    else { d.removeAttribute('open'); d.classList.remove('fallback-open'); onDialogClosed(); }
  }
  function onDialogClosed() {
    var t = dialogOpener && document.contains(dialogOpener) ? dialogOpener : $('importBtn');
    if (t && t.focus) t.focus();
    dialogOpener = null;
  }
  function showImportResult(html) { $('importResult').innerHTML = html; }
  function handleFile(file) {
    if (!file) return;
    if (file.size > MAX_FILE_BYTES) { showImportResult('<p class="bad">导入失败：文件超过 30MB。</p><p>原有数据未改变。</p>'); return; }
    var reader = new FileReader();
    reader.onerror = function () { showImportResult('<p class="bad">导入失败：无法读取文件。</p><p>原有数据未改变。</p>'); };
    reader.onload = function () {
      var text = String(reader.result || '');
      var r;
      try { r = importText(state.indices, text, file.name, state.baseAsOf); } catch (e) {
        r = { ok: false, validation: { ok: false, errors: ['导入异常：' + (e && e.message)], warnings: [] } };
      }
      var v = r.validation;
      var warnHTML = v.warnings && v.warnings.length ? '<p>提示：</p><ul>' + v.warnings.slice(0, 20).map(function (w) { return '<li>' + esc(w) + '</li>'; }).join('') + '</ul>' : '';
      if (!v.ok) {
        showImportResult('<p class="bad">导入失败：' + esc(file.name) + ' 未导入任何数据，原有数据未改变。</p><ul>' +
          v.errors.map(function (e) { return '<li>' + esc(e) + '</li>'; }).join('') + '</ul>' + warnHTML);
        return;
      }
      // 只有成功时才同时提交数据与锚点；失败分支在上方已 return，锚点不变
      var prevAnchor = state.anchor;
      state.indices = r.list;
      state.anchor = r.anchor;
      r.summary.created.concat(r.summary.merged).forEach(function (c) { state.importedCodes[c] = true; });
      var sm = r.summary;
      showImportResult('<p class="ok">已导入 ' + esc(file.name) + '：' + v.rowCount + ' 行，' + v.order.length + ' 只指数（新增 ' + sm.created.length + '，合并 ' + sm.merged.length + '）。</p>' +
        '<p>新增日期 ' + sm.added + ' 个，补充空值 ' + sm.filled + ' 处，覆盖已有不同值 ' + sm.overridden + ' 处。数据仅在本次会话有效，刷新页面即恢复原始数据。</p>' +
        (state.anchor !== prevAnchor ? '<p><strong>统计锚点已更新：</strong>' + esc(prevAnchor || '无') + ' → ' + esc(state.anchor) + '。分位、叠加与详情区间按此日期计算；这是本次会话导入数据的日期，不代表原数据包已更新。</p>' : '') +
        (sm.replaced.length ? '<p><strong>PE/PB 整列替换：</strong>' + esc(sm.replaced.join('、')) + '。这些列只保留本次 CSV 提供的观测，原来源该列被清除 ' + sm.cleared + ' 个值（未与导入值拼接）。</p>' : '') + warnHTML);
      renderMeta();
      route({ force: true, keepScroll: true });
    };
    reader.readAsText(file, 'utf-8');
  }

  // ---------- 初始化 ----------
  function init() {
    loadFavorites();
    renderMeta();
    renderBanner();

    $('navToggle').addEventListener('click', function () { if (state.navOpen) closeNav(true); else openNav(); });
    $('scrim').addEventListener('click', function () { closeNav(true); });

    var search = $('searchInput');
    search.addEventListener('input', function () { state.query = search.value; renderSidebar(); });
    search.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') {
        var first = $('sideNav').querySelector('.side-group:not(:first-child) .side-link, .side-link');
        var q = state.query.trim().toLowerCase();
        var hit = state.indices.filter(function (s) { return matches(s, q); })[0];
        if (hit) { e.preventDefault(); navigate(indexHash(hit.code)); }
        else if (first) first.focus();
      } else if (e.key === 'Escape' && search.value) {
        e.stopPropagation(); search.value = ''; state.query = ''; renderSidebar();
      }
    });

    $('sideNav').addEventListener('click', function (e) {
      var fav = e.target.closest('[data-fav]');
      if (fav) {
        var code = fav.getAttribute('data-fav');
        toggleFavorite(code);
        if (state.view === 'home') route({ force: true, keepScroll: true });
        var again = $('sideNav').querySelector('[data-fav="' + (root.CSS && CSS.escape ? CSS.escape(code) : code) + '"]');
        if (again) again.focus();
        return;
      }
      var g = e.target.closest('[data-group]');
      if (g) {
        var key = g.getAttribute('data-group');
        var open = g.getAttribute('aria-expanded') === 'true';
        state.collapsed[key] = open;
        g.setAttribute('aria-expanded', String(!open));
        var caret = g.querySelector('.caret'); if (caret) caret.textContent = open ? '展开' : '收起';
        var ul = $(g.getAttribute('aria-controls')); if (ul) ul.hidden = open;
        return;
      }
      var link = e.target.closest('a.side-link');
      if (link) {
        e.preventDefault();
        navigate(link.getAttribute('href'));
      }
    });
    $('sidebar').addEventListener('click', function (e) {
      var home = e.target.closest('.side-home');
      if (home) { e.preventDefault(); navigate('#/panorama'); }
    });

    $('banner').addEventListener('click', function (e) {
      var b = e.target.closest('[data-dismiss]');
      if (b) { bannerDismissed[b.getAttribute('data-dismiss')] = true; renderBanner(); }
    });

    $('view').addEventListener('click', function (e) {
      if (e.target.closest('#detailFav') && state.current) { toggleFavorite(state.current.code); return; }
      if (e.target.closest('#detailExport')) exportCurrent();
    });

    $('importBtn').addEventListener('click', openImport);
    $('exportBtn').addEventListener('click', exportCurrent);
    $('templateBtn').addEventListener('click', function () { download('指数全景_导入模板.csv', templateCSV()); });
    var fileInput = $('importFile');
    fileInput.addEventListener('change', function () {
      var f = fileInput.files && fileInput.files[0];
      handleFile(f);
      fileInput.value = '';
    });
    var dlg = $('importDialog');
    dlg.addEventListener('close', onDialogClosed);
    dlg.addEventListener('click', function (e) { if (e.target === dlg) closeImport(); });
    $('importClose').addEventListener('click', function (e) {
      if (typeof dlg.close !== 'function') { e.preventDefault(); closeImport(); }
    });
    // 键盘：文件选择 label 可聚焦（input 视觉隐藏但可聚焦）
    dlg.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && !(typeof dlg.showModal === 'function' && dlg.open && !dlg.classList.contains('fallback-open'))) {
        e.preventDefault(); closeImport();
      }
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && state.navOpen && !$('importDialog').open) { closeNav(true); return; }
      var tag = (e.target && e.target.tagName) || '';
      if (e.key === '/' && !e.ctrlKey && !e.metaKey && !e.altKey && !/INPUT|TEXTAREA|SELECT/.test(tag) && !(e.target && e.target.isContentEditable)) {
        e.preventDefault();
        if (isNarrow() && !state.navOpen) openNav(); else search.focus();
      }
    });
    if (root.matchMedia) {
      var mq = root.matchMedia('(max-width: 900px)');
      var onMq = function () { if (!mq.matches) closeNav(false); };
      if (mq.addEventListener) mq.addEventListener('change', onMq); else if (mq.addListener) mq.addListener(onMq);
    }

    root.addEventListener('hashchange', function () { route(); });
    route();
  }
  function exportCurrent() {
    var s = state.current;
    if (!s) return;
    download(safeName(s.code) + '_' + safeName(s.name) + '_' + (s.d.length ? s.d[s.d.length - 1] : 'empty') + '.csv', seriesToCSV(s));
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})(typeof window !== 'undefined' ? window : this);
