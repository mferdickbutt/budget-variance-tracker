/**
 * Budget variance calculator — works in the browser and in Node.
 *
 * Polarity: actual − budget
 *   Positive $ / %  → over  (spent more than budgeted)
 *   Negative $ / %  → under (spent less than budgeted)
 *   |%| ≤ onTrackPercent (default 2) → on
 *
 * Zero-budget, null, empty, NaN, and Infinity never produce NaN or Infinity
 * in outputs. Missing or non-finite inputs yield `null` for that metric.
 *
 * Totals include a cell only when BOTH budget and actual are present numbers.
 * A null actual (e.g. a month not yet closed) is omitted, not treated as $0.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.Variance = factory();
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  var POLARITY = 'actual-minus-budget';
  var DEFAULT_THRESHOLDS = { onTrackPercent: 2 };

  function isEmpty(value) {
    return value === null || value === undefined || value === '';
  }

  /**
   * Coerce a cell value to a finite number, or null.
   * Rejects '', whitespace-only strings, {}, [], NaN, ±Infinity.
   */
  function toNumber(value) {
    if (isEmpty(value)) return null;
    if (typeof value === 'boolean') return null;
    if (typeof value === 'object') return null;
    if (typeof value === 'string' && value.trim() === '') return null;
    var n = typeof value === 'number' ? value : Number(value);
    if (!Number.isFinite(n)) return null;
    return n;
  }

  /** Variance $ = actual − budget. Null if either side is missing. */
  function varianceDollars(actual, budget) {
    var a = toNumber(actual);
    var b = toNumber(budget);
    if (a === null || b === null) return null;
    return a - b;
  }

  /**
   * Variance % = (actual − budget) / budget × 100.
   * Null when either side is missing OR budget is 0 (undefined %).
   */
  function variancePercent(actual, budget) {
    var a = toNumber(actual);
    var b = toNumber(budget);
    if (a === null || b === null) return null;
    if (b === 0) return null;
    return ((a - b) / b) * 100;
  }

  /**
   * Flag: 'over' | 'under' | 'on' | null
   * When % is undefined (zero budget), fall back to the sign of variance $.
   * Both-zero (budget 0 and actual 0) is 'on'.
   */
  function flag(actual, budget, thresholds) {
    var dollars = varianceDollars(actual, budget);
    if (dollars === null) return null;
    var pct = variancePercent(actual, budget);
    var onPct = DEFAULT_THRESHOLDS.onTrackPercent;
    if (thresholds && thresholds.onTrackPercent != null) {
      var parsed = toNumber(thresholds.onTrackPercent);
      if (parsed !== null) onPct = Math.abs(parsed);
    }
    if (pct === null) {
      if (dollars === 0) return 'on';
      return dollars > 0 ? 'over' : 'under';
    }
    if (Math.abs(pct) <= onPct) return 'on';
    return dollars > 0 ? 'over' : 'under';
  }

  function metrics(cell, thresholds) {
    var raw = cell && typeof cell === 'object' ? cell : {};
    var budget = toNumber(raw.budget);
    var actual = toNumber(raw.actual);
    return {
      budget: budget,
      actual: actual,
      varianceDollars: varianceDollars(actual, budget),
      variancePercent: variancePercent(actual, budget),
      flag: flag(actual, budget, thresholds)
    };
  }

  /**
   * Sum paired cells. A cell contributes only when both budget and actual
   * are finite numbers. Returns { budget, actual } or both-null if none paired.
   */
  function pairedSums(cells) {
    var budget = 0;
    var actual = 0;
    var n = 0;
    if (!Array.isArray(cells)) {
      return { budget: null, actual: null };
    }
    for (var i = 0; i < cells.length; i++) {
      var cell = cells[i] || {};
      var b = toNumber(cell.budget);
      var a = toNumber(cell.actual);
      if (b === null || a === null) continue;
      budget += b;
      actual += a;
      n += 1;
    }
    if (n === 0) return { budget: null, actual: null };
    return { budget: budget, actual: actual };
  }

  function totalsFromCells(cells, thresholds) {
    var sums = pairedSums(cells);
    return metrics({ budget: sums.budget, actual: sums.actual }, thresholds);
  }

  function cellForMonth(category, monthId) {
    if (!category || !category.cells) return {};
    return category.cells[monthId] || {};
  }

  function categoryTotals(category, monthIds, thresholds) {
    var ids = monthIds || [];
    var cells = [];
    for (var i = 0; i < ids.length; i++) {
      cells.push(cellForMonth(category, ids[i]));
    }
    return totalsFromCells(cells, thresholds);
  }

  function monthTotals(categories, monthId, thresholds) {
    var list = categories || [];
    var cells = [];
    for (var i = 0; i < list.length; i++) {
      cells.push(cellForMonth(list[i], monthId));
    }
    return totalsFromCells(cells, thresholds);
  }

  function grandTotals(categories, monthIds, thresholds) {
    var cats = categories || [];
    var ids = monthIds || [];
    var cells = [];
    for (var c = 0; c < cats.length; c++) {
      for (var m = 0; m < ids.length; m++) {
        cells.push(cellForMonth(cats[c], ids[m]));
      }
    }
    return totalsFromCells(cells, thresholds);
  }

  function monthList(dataset) {
    var months = (dataset && dataset.months) || [];
    return months.map(function (m) {
      if (typeof m === 'string') return { id: m, label: m };
      return { id: m.id, label: m.label || m.id };
    });
  }

  function computeReport(dataset) {
    var data = dataset || {};
    var thresholds = data.thresholds || DEFAULT_THRESHOLDS;
    var months = monthList(data);
    var monthIds = months.map(function (m) { return m.id; });
    var categories = data.categories || [];

    var rows = categories.map(function (cat) {
      var cells = {};
      for (var i = 0; i < monthIds.length; i++) {
        var id = monthIds[i];
        cells[id] = metrics(cellForMonth(cat, id), thresholds);
      }
      return {
        id: cat.id,
        name: cat.name,
        cells: cells,
        totals: categoryTotals(cat, monthIds, thresholds)
      };
    });

    var byMonth = {};
    for (var j = 0; j < monthIds.length; j++) {
      byMonth[monthIds[j]] = monthTotals(categories, monthIds[j], thresholds);
    }

    return {
      polarity: POLARITY,
      thresholds: {
        onTrackPercent: thresholds.onTrackPercent != null
          ? thresholds.onTrackPercent
          : DEFAULT_THRESHOLDS.onTrackPercent
      },
      currency: data.currency || 'USD',
      months: months,
      categories: rows,
      monthTotals: byMonth,
      grandTotals: grandTotals(categories, monthIds, thresholds)
    };
  }

  function formatDollars(n, signed) {
    if (n === null || n === undefined) return '—';
    var abs = Math.abs(n);
    var formatted = abs.toLocaleString('en-US', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    });
    var core = '$' + formatted;
    if (signed) {
      if (n > 0) return '+' + core;
      if (n < 0) return '-' + core;
      return core;
    }
    return n < 0 ? '-' + core : core;
  }

  function formatPercent(n) {
    if (n === null || n === undefined) return '—';
    var rounded = Math.round(n * 10) / 10;
    var body = Math.abs(rounded).toFixed(1) + '%';
    if (rounded > 0) return '+' + body;
    if (rounded < 0) return '-' + body;
    return '0.0%';
  }

  return {
    POLARITY: POLARITY,
    DEFAULT_THRESHOLDS: DEFAULT_THRESHOLDS,
    toNumber: toNumber,
    varianceDollars: varianceDollars,
    variancePercent: variancePercent,
    flag: flag,
    metrics: metrics,
    pairedSums: pairedSums,
    categoryTotals: categoryTotals,
    monthTotals: monthTotals,
    grandTotals: grandTotals,
    computeReport: computeReport,
    formatDollars: formatDollars,
    formatPercent: formatPercent
  };
});
