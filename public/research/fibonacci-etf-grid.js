(() => {
  'use strict';
  const byId = id => document.getElementById(id);
  const number = id => Number(byId(id).value);
  const format = n => Number.isFinite(n) ? n.toFixed(3) : '超出计算范围';
  const ratios = [0, .236, .382, .5, .618, .786, 1];
  const extensions = [1, 1.272, 1.382, 1.618];
  const fibForm = byId('fib-form');
  function calculateFib() {
    const low = number('fib-low'), high = number('fib-high'), c = number('fib-c');
    const mode = byId('fib-mode').value, scale = byId('fib-scale').value;
    const three = mode.startsWith('three'), down = mode.endsWith('down');
    const message = byId('fib-message');
    byId('fib-c-label').hidden = !three;
    byId('fib-c').disabled = !three;
    if (!fibForm.checkValidity() || ![low, high].every(Number.isFinite) || low <= 0 || high <= low || (three && (!Number.isFinite(c) || c < low || c > high))) {
      message.textContent = '请输入有限的正价格，且 H > L；三点扩展的 C 应位于 L 与 H 之间。';
      message.className = 'calc-message error';
      byId('fib-results').hidden = true;
      return;
    }
    const log = scale === 'log';
    const a = log ? Math.log(low) : low, b = log ? Math.log(high) : high;
    const origin = three ? (log ? Math.log(c) : c) : (down ? b : a);
    const prices = three || mode.startsWith('two') ? extensions : ratios;
    const price = r => {
      const coordinate = mode === 'retracement-up' ? b - r * (b - a)
        : mode === 'retracement-down' ? a + r * (b - a)
        : origin + (down ? -1 : 1) * r * (b - a);
      return log ? Math.exp(coordinate) : coordinate;
    };
    const values = prices.map(price);
    if (!values.every(Number.isFinite) || (log && values.some(v => v <= 0))) {
      message.textContent = '结果超出可计算的正价格范围，请缩小输入跨度。';
      message.className = 'calc-message error';
      byId('fib-results').hidden = true;
      return;
    }
    byId('fib-results').hidden = false;
    byId('fib-table-body').replaceChildren(...prices.map((r, i) => {
      const row = document.createElement('tr');
      const ratioCell = document.createElement('td'), priceCell = document.createElement('td');
      ratioCell.textContent = prices === ratios ? `${(r * 100).toFixed(1)}%` : `${r.toFixed(3)} 倍`;
      priceCell.textContent = `${format(values[i])} 元${values[i] <= 0 ? '（不可交易）' : ''}`;
      row.append(ratioCell, priceCell);
      return row;
    }));
    message.className = 'calc-message';
    let explanation = '';
    if (mode === 'retracement-up') explanation = `61.8% 波段回撤价 ${format(price(.618))} 元，相对 H 下跌 ${(100 * (high - price(.618)) / high).toFixed(2)}%。`;
    else if (mode === 'retracement-down') explanation = `61.8% 波段反弹价 ${format(price(.618))} 元，相对 L 上涨 ${(100 * (price(.618) - low) / low).toFixed(2)}%。`;
    else explanation = `${three ? '三点' : '两点'}扩展，以${three ? ' C' : down ? ' H' : ' L'} 为计算起点。`;
    message.textContent = explanation + (values.some(v => v <= 0) ? ' 零或负价格仅说明线性外推失效，不可据此挂单。' : ' 价格坐标不代表反弹概率或交易信号。');
    const chartMin = Math.min(...values), chartMax = Math.max(...values);
    const coordinate = v => log ? Math.log(v) : v;
    const min = coordinate(chartMin), max = coordinate(chartMax);
    const y = v => 30 + (max - coordinate(v)) / (max - min || 1) * 240;
    const lines = values.map((v, i) => {
      const yy = y(v), special = prices[i] === .618 || prices[i] === 1.618;
      const label = prices === ratios ? `${(prices[i] * 100).toFixed(1)}%` : `${prices[i].toFixed(3)}×`;
      return `<line x1="72" y1="${yy}" x2="282" y2="${yy}" stroke="${special ? '#25715c' : '#cedacf'}" stroke-width="${special ? 2 : 1}"/><text x="3" y="${yy + 4}" fill="#62746a" font-size="12">${label}</text><text x="292" y="${yy + 4}" fill="#16352f" font-size="12">${format(v)}</text>`;
    }).join('');
    byId('fib-chart').innerHTML = `<svg viewBox="0 0 400 302" role="img" aria-label="${log ? '对数' : '线性'}价格坐标，各比例对应价见左侧表格"><rect x="72" y="30" width="210" height="240" fill="#edf3ec" rx="3"/>${lines}</svg>`;
    byId('fib-chart-note').textContent = `${log ? '对数' : '线性'}坐标示意 · 未模拟真实走势 · 表内价格保留三位小数，并非可执行订单。`;
  }
  fibForm.addEventListener('input', calculateFib);
  fibForm.addEventListener('change', calculateFib);
  fibForm.addEventListener('submit', event => event.preventDefault());
  const atrForm = byId('atr-form');
  function calculateAtr() {
    const p = number('atr-price'), atr = number('atr-value'), k = number('atr-multiple');
    const cost = number('atr-cost'), tick = number('atr-tick');
    const valid = atrForm.checkValidity() && [p, atr, k, cost, tick].every(Number.isFinite) && p > 0 && atr >= 0 && k > 0 && cost >= 0 && tick > 0;
    const basic = k * atr, minimum = Math.max(basic, p * cost / 100, tick);
    const candidate = Math.ceil(minimum / tick - 1e-10) * tick;
    if (!valid || ![basic, minimum, candidate].every(Number.isFinite)) {
      byId('atr-message').textContent = '请输入有效参数：价格、倍数和报价单位须为正；ATR 与成本门槛不可为负。';
      byId('atr-message').className = 'calc-message error';
      byId('atr-results').hidden = true;
      return;
    }
    byId('atr-results').hidden = false;
    byId('atr-basic').textContent = `${(100 * basic / p).toFixed(2)}%`;
    byId('atr-candidate').textContent = `${(100 * candidate / p).toFixed(2)}%`;
    byId('atr-gap').textContent = `${candidate.toFixed(Math.min(8, Math.max(3, Math.ceil(-Math.log10(tick)))))} 元`;
    byId('atr-message').className = 'calc-message';
    byId('atr-message').textContent = '候选价差取 ATR、往返成本门槛、报价单位的最大值，再向上对齐报价单位。成本门槛由你估算，未自动计算券商最低佣金；计算结果不代表最优网格。';
  }
  atrForm.addEventListener('input', calculateAtr);
  atrForm.addEventListener('submit', event => event.preventDefault());
  byId('print-report').addEventListener('click', () => window.print());
  const sidebar = byId('report-outline');
  const media = window.matchMedia('(max-width: 760px)');
  const updateOutline = () => { sidebar.open = !media.matches; };
  updateOutline(); media.addEventListener('change', updateOutline);
  const links = [...document.querySelectorAll('.sidebar nav a')];
  links.forEach(link => link.addEventListener('click', () => { if (media.matches) sidebar.open = false; }));
  let pending = false;
  function updateReading() {
    const height = document.documentElement.scrollHeight - window.innerHeight;
    byId('reading-progress').style.width = `${height > 0 ? Math.min(100, window.scrollY / height * 100) : 0}%`;
    let active = links[0];
    for (const link of links) {
      const section = document.querySelector(link.getAttribute('href'));
      if (section && section.getBoundingClientRect().top <= 135) active = link;
    }
    links.forEach(link => {
      link.classList.toggle('active', link === active);
      if (link === active) link.setAttribute('aria-current', 'location'); else link.removeAttribute('aria-current');
    });
    pending = false;
  }
  window.addEventListener('scroll', () => { if (!pending) { pending = true; window.requestAnimationFrame(updateReading); } }, {passive:true});
  window.addEventListener('resize', updateReading);
  calculateFib(); calculateAtr(); updateReading();
})();
