/* 指数全景 · 图表左右端点吸附
 *
 * 问题：ECharts 的坐标轴提示只在绘图区（grid）内触发。首末观测正好落在绘图区左右边线上，
 * 鼠标必须停在那一个像素才能看到；再往外一点进入轴边距，十字线和提示就消失，首末数据实际看不到。
 *
 * 做法：鼠标位于绘图区上下范围内、但在左右轴边距里时，把横坐标钳到绘图区边线，
 * 用 showTip 交给 ECharts 自己的坐标轴提示。ECharts 按该位置在“当前可见区间”（dataZoom 过滤后的数据）
 * 里找最近的真实观测，axisPointer.snap 让十字竖线落在该观测上，提示显示的是它自己的日期和值。
 * 不改数据、不补日期；绘图区内、滑块、上下边距的行为完全不变。
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.PanoChartEdge = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  function gridRect(chart) {
    try {
      var g = chart.getModel().getComponent('grid', 0);
      return g && g.coordinateSystem ? g.coordinateSystem.getRect() : null;
    } catch (e) { return null; }
  }

  // 鼠标 (x, y) 在左右轴边距内时返回钳到绘图区边线的点；在绘图区内或上下边距（含滑块）时返回 null。
  function edgePoint(rect, x, y) {
    if (!rect || !(rect.width > 0) || !(rect.height > 0)) return null;
    if (y < rect.y || y > rect.y + rect.height) return null;
    if (x < rect.x) return { x: rect.x, y: y, side: 'left' };
    if (x > rect.x + rect.width) return { x: rect.x + rect.width, y: y, side: 'right' };
    return null;
  }

  function attach(chart) {
    if (!chart || typeof chart.getZr !== 'function') return;
    var zr = chart.getZr();
    zr.on('mousemove', function (e) {
      var p = edgePoint(gridRect(chart), e.offsetX, e.offsetY);
      if (p) chart.dispatchAction({ type: 'showTip', x: p.x, y: p.y });
    });
    zr.on('globalout', function () { chart.dispatchAction({ type: 'hideTip' }); });
  }

  return { attach: attach, edgePoint: edgePoint, gridRect: gridRect };
});
