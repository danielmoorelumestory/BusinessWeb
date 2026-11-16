/*
 * 指数全景 · 相关 ETF 展示（PanoEtf）
 * 数据：window.PANO_ETFS（etf-catalog.js，由 ETF 目录维护者生成并逐条核验）。本模块不自带任何产品目录。
 *   {schemaVersion:1, verifiedAt, indices:{<指数代码>:{name, notes, products:[{code,name,exchange,
 *    relationship:'tracks'|'related_theme', benchmarkCode, benchmarkName, sourceUrl, sourceTitle, verifiedAt, relationNote?}]}}}
 * 展示规则：
 *   - 缺代码/名称/交易所/实际跟踪指数/官方 https 来源/核验日期 的条目一律不展示（不出列表，只计数说明）。
 *   - “直接跟踪本指数”只认 relationship=tracks 且 benchmarkCode 与本指数代码一致；
 *     （或指数条目 benchmarkAliases 里声明的官方代码别名）；标了 tracks 但实际跟踪别的指数的，按“相关主题”展示并注明实际跟踪指数，不计入直接 ETF 数。
 *   - 只列事实（代码、名称、交易所、跟踪指数、来源、核验日期），不排序推荐、不展示收益、不接买卖。
 */
(function (root) {
  'use strict';

  var EXCHANGES = { SH: '上交所', SSE: '上交所', SZ: '深交所', SZSE: '深交所', HK: '港交所', HKEX: '港交所' };
  var ISO = /^\d{4}-\d{2}-\d{2}/;

  function dict() { return Object.create(null); }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function str(v) { return typeof v === 'string' ? v.trim() : ''; }
  function httpsUrl(u) {
    u = str(u);
    return /^https:\/\/[^\s"'<>]+$/i.test(u) ? u : null;
  }
  function isoDay(v) { v = str(v); return ISO.test(v) ? v.slice(0, 10) : null; }
  /** 指数代码比较键：去掉交易所/机构后缀，大写。 */
  function codeKey(c) { return str(c).toUpperCase().split('.')[0]; }
  var CN_SUFFIX = { SH: true, SZ: true, CSI: true };
  /**
   * 两个指数代码是否指同一指数：主体相同，且后缀相容——任一方无后缀、后缀相同，或同为境内 SH/SZ/CSI
   * （000994.SH / 000994.CSI / 000994 相同；000001.SH 与 000001.HK 不同）。
   */
  function sameIndex(a, b) {
    var pa = str(a).toUpperCase().split('.'), pb = str(b).toUpperCase().split('.');
    if (!pa[0] || pa[0] !== pb[0]) return false;
    var sa = pa[1] || '', sb = pb[1] || '';
    return !sa || !sb || sa === sb || (CN_SUFFIX[sa] && CN_SUFFIX[sb]) || false;
  }
  function exchangeLabel(x) { x = str(x); return EXCHANGES[x.toUpperCase()] || x; }

  function catalog() {
    var c = root.PANO_ETFS;
    if (!c || typeof c !== 'object' || c.schemaVersion !== 1 || !c.indices || typeof c.indices !== 'object') return null;
    return c;
  }

  /** 条目是否具备展示所需的已核实字段。 */
  function verified(p) {
    return !!(p && typeof p === 'object' && /^[0-9A-Za-z]{4,10}$/.test(str(p.code)) && str(p.name) && str(p.exchange) &&
      (p.relationship === 'tracks' || p.relationship === 'related_theme') &&
      str(p.benchmarkCode) && str(p.benchmarkName) && httpsUrl(p.sourceUrl) && isoDay(p.verifiedAt));
  }

  /**
   * 某只指数的 ETF 分组：{direct:[], related:[], hidden:n, notes, entry:bool, catalogDate}
   * direct：tracks 且基准代码与本指数一致；related：相关主题（含基准不一致而被降级的 tracks）。
   */
  function groupsFor(indexCode) {
    var out = { direct: [], related: [], hidden: 0, notes: '', entry: false, catalogDate: null, available: false };
    var c = catalog();
    if (!c) return out;
    out.available = true;
    out.catalogDate = isoDay(c.verifiedAt);
    var e = c.indices[indexCode];
    if (!e || typeof e !== 'object') return out;
    out.entry = true;
    out.notes = str(e.notes);
    var seen = dict();
    // 本地代码与官方跟踪指数代码不同（如 DJI.US ↔ DJIA）时，目录在指数条目上声明 benchmarkAliases
    var own = [indexCode].concat(Array.isArray(e.benchmarkAliases) ? e.benchmarkAliases.filter(function (a) { return str(a); }) : []);
    function isOwn(bench) { return own.some(function (c) { return sameIndex(c, bench); }); }
    (Array.isArray(e.products) ? e.products : []).forEach(function (p) {
      if (!verified(p)) { out.hidden++; return; }
      var key = str(p.code) + '|' + str(p.exchange).toUpperCase();
      if (seen[key]) return;
      seen[key] = true;
      var item = {
        code: str(p.code), name: str(p.name), exchange: exchangeLabel(p.exchange),
        benchmarkCode: str(p.benchmarkCode), benchmarkName: str(p.benchmarkName),
        sourceUrl: httpsUrl(p.sourceUrl), sourceTitle: str(p.sourceTitle) || '官方产品页',
        verifiedAt: isoDay(p.verifiedAt), relationNote: str(p.relationNote), demoted: false
      };
      if (p.relationship === 'tracks' && isOwn(p.benchmarkCode)) out.direct.push(item);
      else { item.demoted = p.relationship === 'tracks'; out.related.push(item); }
    });
    return out;
  }

  /** 直接跟踪本指数的已核实 ETF 数（不含相关主题）。 */
  function directCount(indexCode) { return groupsFor(indexCode).direct.length; }

  /** 搜索用：本指数相关 ETF 的代码与名称（直接 + 相关），小写拼接。 */
  function searchText(indexCode) {
    var g = groupsFor(indexCode);
    return g.direct.concat(g.related).map(function (p) { return p.code + ' ' + p.name; }).join(' ').toLowerCase();
  }

  function rowHtml(p, direct) {
    var bench = '<b class="pe-bench">' + esc(p.benchmarkName) + '</b> <span class="pe-code">' + esc(p.benchmarkCode) + '</span>';
    var note = p.demoted ? '来源标为跟踪，但实际跟踪 ' + p.benchmarkName + '（' + p.benchmarkCode + '），不是本指数' : p.relationNote;
    return '<li class="pe-item">' +
      '<div class="pe-main"><span class="pe-name">' + esc(p.name) + '</span>' +
      '<span class="pe-tick"><b>' + esc(p.code) + '</b><span class="pe-ex">' + esc(p.exchange) + '</span>' +
      '<button type="button" class="pe-copy" data-pe-copy="' + esc(p.code) + '" aria-label="复制基金代码 ' + esc(p.code) + '">复制代码</button></span></div>' +
      '<div class="pe-meta"><span>' + (direct ? '跟踪指数：' : '实际跟踪：') + bench + '</span>' +
      (note ? '<span class="pe-note">' + esc(note) + '</span>' : '') + '</div>' +
      '<div class="pe-src"><a class="pe-link" href="' + esc(p.sourceUrl) + '" target="_blank" rel="noopener noreferrer external" referrerpolicy="no-referrer">' +
      esc(p.sourceTitle) + ' ↗</a><span class="pe-date">核验于 ' + esc(p.verifiedAt) + '</span></div></li>';
  }

  var VISIBLE = 4;
  /** 产品列表：按目录原顺序（不排序、不推荐），超过 VISIBLE 只的折叠在“展开其余”里。 */
  function listHtml(items, direct) {
    var rows = items.map(function (p) { return rowHtml(p, direct); });
    if (rows.length <= VISIBLE + 1) return '<ul class="pe-list">' + rows.join('') + '</ul>';
    return '<ul class="pe-list">' + rows.slice(0, VISIBLE).join('') + '</ul>' +
      '<details class="pe-more"><summary>展开其余 ' + (rows.length - VISIBLE) + ' 只（按目录顺序，非排名）</summary>' +
      '<ul class="pe-list">' + rows.slice(VISIBLE).join('') + '</ul></details>';
  }

  /** 详情页 ETF 区块 HTML（series 为指数序列；只用其 code/name）。 */
  function sectionHtml(series) {
    var code = series && series.code, name = (series && series.name) || code || '';
    var g = groupsFor(code);
    var head = '<div class="pd-card-head"><h3>相关 ETF</h3><span class="pd-muted">只列已核实的事实，不构成推荐，不按收益排序</span></div>';
    var body;
    if (!g.available) {
      body = '<p class="pe-empty">ETF 目录未加载，暂无可展示的已核实产品。</p>';
    } else {
      var directBlock = '<div class="pe-group"><h4>直接跟踪本指数 <span class="pe-count">' + g.direct.length + ' 只</span></h4>' +
        (g.direct.length ? listHtml(g.direct, true) :
          '<p class="pe-empty">暂无已核实的直接跟踪 ETF：没有找到跟踪「' + esc(name) + '」（' + esc(code) + '）的产品。' +
          (g.related.length ? '下面的产品跟踪的是其他指数，只是主题相关，走势与本指数不同。' : '') + '</p>') + '</div>';
      var relatedBlock = g.related.length ? '<div class="pe-group pe-group-rel"><h4>相关主题（跟踪其他指数）<span class="pe-count">' + g.related.length + ' 只</span></h4>' +
        listHtml(g.related, false) + '</div>' : '';
      body = directBlock + relatedBlock;
    }
    var foot = [];
    if (g.notes) foot.push(esc(g.notes));
    if (g.hidden) foot.push(g.hidden + ' 条记录缺少官方来源或核验日期，未展示。');
    if (g.catalogDate) foot.push('目录核验日期 ' + esc(g.catalogDate) + '；份额、费率、规模等以基金公司与交易所最新公告为准。');
    return '<section class="pd-card pd-etf" id="pd-etf" tabindex="-1" aria-labelledby="pd-etf-t">' +
      head.replace('<h3>', '<h3 id="pd-etf-t">') + body +
      (foot.length ? '<p class="pd-foot">' + foot.join('<br>') + '</p>' : '') +
      '<p class="pe-status" role="status" aria-live="polite"></p></section>';
  }

  function copyText(text, done) {
    var nav = root.navigator;
    if (nav && nav.clipboard && typeof nav.clipboard.writeText === 'function') {
      nav.clipboard.writeText(text).then(function () { done(true); }, function () { done(fallbackCopy(text)); });
      return;
    }
    done(fallbackCopy(text));
  }
  function fallbackCopy(text) {
    var doc = root.document;
    if (!doc || !doc.body || typeof doc.execCommand !== 'function') return false;
    var ta = doc.createElement('textarea');
    ta.value = text; ta.setAttribute('readonly', ''); ta.style.position = 'fixed'; ta.style.opacity = '0';
    doc.body.appendChild(ta); ta.select();
    var ok = false;
    try { ok = doc.execCommand('copy'); } catch (e) { ok = false; }
    doc.body.removeChild(ta);
    return ok;
  }

  /** 详情页点击委托：处理“复制代码”。返回 true 表示已处理。 */
  function handleClick(ev, scope) {
    var t = ev && ev.target && ev.target.closest ? ev.target.closest('[data-pe-copy]') : null;
    if (!t || (scope && !scope.contains(t))) return false;
    var code = t.getAttribute('data-pe-copy');
    var sec = t.closest('.pd-etf');
    var status = sec ? sec.querySelector('.pe-status') : null;
    copyText(code, function (ok) {
      if (status) status.textContent = ok ? '已复制 ' + code : '复制失败，请手动选择代码 ' + code;
    });
    return true;
  }

  var api = {
    groupsFor: groupsFor, directCount: directCount, searchText: searchText, sectionHtml: sectionHtml,
    handleClick: handleClick, verified: verified, codeKey: codeKey, sameIndex: sameIndex
  };
  root.PanoEtf = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : this);
