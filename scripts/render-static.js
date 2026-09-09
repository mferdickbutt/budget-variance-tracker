#!/usr/bin/env node
/**
 * Bake computeReport() into index.html so first paint (and curl -sL)
 * shows category names, month labels, and numeric variance $ / % with
 * no JavaScript and no Loading… shell.
 *
 * Usage: node scripts/render-static.js
 */
'use strict';

var fs = require('fs');
var path = require('path');

var root = path.join(__dirname, '..');
var Variance = require(path.join(root, 'js', 'variance.js'));

var dataset = JSON.parse(
  fs.readFileSync(path.join(root, 'data', 'variance.json'), 'utf8')
);
var report = Variance.computeReport(dataset);

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function cellHtml(m) {
  var flag = m.flag || 'null';
  var varD = Variance.formatDollars(m.varianceDollars, true);
  var varP = Variance.formatPercent(m.variancePercent);
  return (
    '<td class="flag-' + escapeHtml(flag) + '" data-flag="' + escapeHtml(flag) + '"' +
    ' data-variance-dollars="' + (m.varianceDollars === null ? '' : String(m.varianceDollars)) + '"' +
    ' data-variance-percent="' + (m.variancePercent === null ? '' : String(m.variancePercent)) + '">' +
    '<div class="cell-lines">' +
    '<span class="muted">B ' + escapeHtml(Variance.formatDollars(m.budget, false)) + '</span>' +
    '<span class="muted">A ' + escapeHtml(Variance.formatDollars(m.actual, false)) + '</span>' +
    '<span class="var">' + escapeHtml(varD) + '</span>' +
    '<span class="pct">' + escapeHtml(varP) + '</span>' +
    '</div></td>'
  );
}

var monthHeaders = report.months.map(function (m) {
  return '            <th scope="col" data-month="' + escapeHtml(m.id) + '">' + escapeHtml(m.label) + '</th>';
}).join('\n');

var bodyRows = report.categories.map(function (cat) {
  var tds = report.months.map(function (m) {
    return cellHtml(cat.cells[m.id]);
  }).join('');
  return (
    '<tr>' +
    '<th scope="row" data-category="' + escapeHtml(cat.id) + '">' + escapeHtml(cat.name) + '</th>' +
    tds +
    cellHtml(cat.totals) +
    '</tr>'
  );
}).join('\n');

var totalTds = report.months.map(function (m) {
  return cellHtml(report.monthTotals[m.id]);
}).join('');

var html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(dataset.title || 'Budget Variance Tracker')}</title>
  <link rel="stylesheet" href="css/style.css">
</head>
<body>
  <div class="wrap">
    <header>
      <h1>${escapeHtml(dataset.title || 'Budget Variance Tracker')}</h1>
      <p class="lede">Public operating budget vs actuals. First paint is this table — no JavaScript required.</p>
    </header>

    <p class="formula">Variance $ = actual − budget &nbsp;·&nbsp; Variance % = (actual − budget) / budget × 100 &nbsp;·&nbsp; On-track when |%| ≤ ${escapeHtml(String(report.thresholds.onTrackPercent))}%</p>

    <div class="legend">
      <span><i class="swatch over"></i>over (spent more than budget)</span>
      <span><i class="swatch under"></i>under (spent less than budget)</span>
      <span><i class="swatch on"></i>on (within ${escapeHtml(String(report.thresholds.onTrackPercent))}% or $0 on a $0 budget)</span>
      <span><i class="swatch missing"></i>missing (null / not yet closed → —)</span>
    </div>

    <p class="js-hint" hidden>Filters dim non-matching cells. They do not load or replace the table.</p>
    <div class="filters" role="group" aria-label="Highlight variance flags">
      <button type="button" data-filter="all" aria-pressed="true">All</button>
      <button type="button" data-filter="over" aria-pressed="false">Over</button>
      <button type="button" data-filter="under" aria-pressed="false">Under</button>
      <button type="button" data-filter="on" aria-pressed="false">On track</button>
      <button type="button" data-filter="null" aria-pressed="false">Missing</button>
    </div>

    <div class="table-scroll">
      <table class="variance-table">
        <caption>${escapeHtml(dataset.title || 'Budget variance')} (${report.months.length} months × ${report.categories.length} categories). Polarity: actual − budget. Zero-budget % is —.</caption>
        <thead>
          <tr>
            <th scope="col">Category</th>
            ${monthHeaders}
            <th scope="col">YTD Total</th>
          </tr>
        </thead>
        <tbody>
${bodyRows}
        </tbody>
        <tfoot>
          <tr>
            <th scope="row">Monthly total</th>
            ${totalTds}
            ${cellHtml(report.grandTotals)}
          </tr>
        </tfoot>
      </table>
    </div>

    <footer>
      <p>Data: <a href="data/variance.json">data/variance.json</a>. Recalculate markup with <code>node scripts/render-static.js</code>. Tests: <code>bash scripts/test.sh</code>.</p>
    </footer>
  </div>
  <script src="js/variance.js"></script>
  <script src="js/enhance.js"></script>
</body>
</html>
`;

fs.writeFileSync(path.join(root, 'index.html'), html);
process.stdout.write(
  'Wrote index.html (' +
    report.months.length + ' months, ' +
    report.categories.length + ' categories)\n'
);
