/**
 * Progressive enhancement only. The variance table is already in the HTML.
 * Filters dim cells that do not match; they never replace or fetch the table.
 */
(function () {
  'use strict';
  var table = document.querySelector('.variance-table');
  var bar = document.querySelector('.filters');
  if (!table || !bar) return;

  var hint = document.querySelector('.js-hint');
  if (hint) hint.hidden = false;

  bar.addEventListener('click', function (event) {
    var btn = event.target.closest('button[data-filter]');
    if (!btn) return;
    var filter = btn.getAttribute('data-filter');
    bar.querySelectorAll('button[data-filter]').forEach(function (b) {
      b.setAttribute('aria-pressed', b === btn ? 'true' : 'false');
    });
    table.querySelectorAll('td[data-flag]').forEach(function (td) {
      var flag = td.getAttribute('data-flag');
      var dim = filter !== 'all' && flag !== filter;
      td.classList.toggle('dimmed', dim);
    });
  });
})();
