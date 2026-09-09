#!/usr/bin/env bash
# Budget variance tracker tests.
# Fixtures: zero-budget, null, empty. Totals math. Static HTML first-paint checks.
set -u

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

PASS=0
FAIL=0

pass() {
  echo "PASS: $1"
  PASS=$((PASS + 1))
}

fail() {
  echo "FAIL: $1"
  FAIL=$((FAIL + 1))
}

expect_eq() {
  local got="$1"
  local want="$2"
  local msg="$3"
  if [ "$got" = "$want" ]; then
    pass "$msg"
  else
    fail "$msg (got ${got}, want ${want})"
  fi
}

# --- Node module fixtures + totals ------------------------------------------
NODE_OUT="$(node <<'EOF'
'use strict';
const v = require('./js/variance.js');
const lines = [];
function pass(msg) { lines.push('PASS: ' + msg); }
function fail(msg) { lines.push('FAIL: ' + msg); }
function eq(got, want, msg) {
  const same = Object.is(got, want) || got === want;
  if (same) pass(msg);
  else fail(msg + ' (got ' + JSON.stringify(got) + ', want ' + JSON.stringify(want) + ')');
}

if (v && typeof v.varianceDollars === 'function') pass('module loads in Node (varianceDollars export)');
else fail('module failed to load');

eq(v.POLARITY, 'actual-minus-budget', 'polarity is actual − budget');

eq(v.varianceDollars(120, 100), 20, 'variance $ overspend (actual 120, budget 100) = 20');
eq(v.varianceDollars(80, 100), -20, 'variance $ underspend (actual 80, budget 100) = -20');
eq(v.variancePercent(120, 100), 20, 'variance % = (actual−budget)/budget×100 → 20');
eq(v.variancePercent(80, 100), -20, 'variance % underspend = -20');

eq(v.variancePercent(50, 0), null, 'zero-budget percent is null (not Infinity)');
eq(v.varianceDollars(50, 0), 50, 'zero-budget dollars still computed (50 − 0 = 50)');
eq(v.flag(50, 0), 'over', 'zero-budget with actual spend flags over');
eq(v.flag(0, 0), 'on', 'zero-budget and zero actual flags on');
eq(v.variancePercent(0, 0), null, '0/0 percent is null not NaN');

eq(v.varianceDollars(null, 100), null, 'null actual → dollars null');
eq(v.variancePercent(null, 100), null, 'null actual → percent null');
eq(v.flag(null, 100), null, 'null actual → flag null');
eq(v.varianceDollars(100, null), null, 'null budget → dollars null');
eq(v.variancePercent(100, null), null, 'null budget → percent null');

eq(v.toNumber(''), null, 'empty string is null');
eq(v.toNumber('   '), null, 'whitespace-only string is null');
eq(v.toNumber({}), null, 'empty object is null');
eq(v.toNumber([]), null, 'empty array is null');
eq(v.toNumber(undefined), null, 'undefined is null');
eq(v.toNumber(NaN), null, 'NaN input is null');
eq(v.toNumber(Infinity), null, 'Infinity input is null');
eq(v.varianceDollars('', 10), null, 'empty actual → dollars null');
eq(v.variancePercent('', 10), null, 'empty actual → percent null');

eq(v.flag(102, 100), 'on', 'flag on when |%| ≤ 2 (default threshold)');
eq(v.flag(103, 100), 'over', 'flag over when % > 2');
eq(v.flag(97, 100), 'under', 'flag under when % < -2');
eq(v.flag(102, 100, { onTrackPercent: 1 }), 'over', 'custom threshold 1% treats +2% as over');

const m = v.metrics({ budget: 100, actual: 90 });
eq(m.varianceDollars, -10, 'metrics.varianceDollars');
eq(m.variancePercent, -10, 'metrics.variancePercent');
eq(m.flag, 'under', 'metrics.flag');

const emptyMetrics = v.metrics({});
eq(emptyMetrics.budget, null, 'empty cell budget null');
eq(emptyMetrics.actual, null, 'empty cell actual null');
eq(emptyMetrics.varianceDollars, null, 'empty cell dollars null');
eq(emptyMetrics.variancePercent, null, 'empty cell percent null');
eq(emptyMetrics.flag, null, 'empty cell flag null');

const monthIds = ['m1', 'm2', 'm3'];
const cat = {
  id: 'widgets',
  name: 'Widgets',
  cells: {
    m1: { budget: 100, actual: 110 },
    m2: { budget: 100, actual: 90 },
    m3: { budget: 50, actual: null }
  }
};
const catTot = v.categoryTotals(cat, monthIds);
eq(catTot.budget, 200, 'category totals omit unpaired null month (budget 100+100, skip 50)');
eq(catTot.actual, 200, 'category totals omit unpaired null month (actual 110+90)');
eq(catTot.varianceDollars, 0, 'category totals variance $ = 0');
eq(catTot.variancePercent, 0, 'category totals variance % = 0');

const cats = [
  { id: 'a', name: 'A', cells: { jan: { budget: 10, actual: 12 }, feb: { budget: 10, actual: 8 } } },
  { id: 'b', name: 'B', cells: { jan: { budget: 20, actual: 20 }, feb: { budget: 20, actual: 22 } } }
];
const jan = v.monthTotals(cats, 'jan');
eq(jan.budget, 30, 'monthly totals budget 10+20 = 30');
eq(jan.actual, 32, 'monthly totals actual 12+20 = 32');
eq(jan.varianceDollars, 2, 'monthly totals variance $ = 2');

const grand = v.grandTotals(cats, ['jan', 'feb']);
eq(grand.budget, 60, 'grand totals budget 10+10+20+20 = 60');
eq(grand.actual, 62, 'grand totals actual 12+8+20+22 = 62');
eq(grand.varianceDollars, 2, 'grand totals variance $ = 2');

const z = v.pairedSums([]);
eq(z.budget, null, 'empty cell list totals are null not 0');
eq(z.actual, null, 'empty cell list actual is null');

const dataset = require('./data/variance.json');
const report = v.computeReport(dataset);
if (report.months.length >= 12) pass('production dataset has ≥12 months (' + report.months.length + ')');
else fail('production dataset month count ' + report.months.length);
if (report.categories.length >= 5) pass('production dataset has ≥5 categories (' + report.categories.length + ')');
else fail('production dataset category count ' + report.categories.length);

const blob = JSON.stringify(report);
if (blob.includes('NaN') || blob.includes('Infinity')) fail('computed report contains NaN or Infinity');
else pass('computed report has no NaN or Infinity');

process.stdout.write(lines.join('\n') + '\n');
process.exit(lines.some((l) => l.startsWith('FAIL:')) ? 1 : 0);
EOF
)"
NODE_EXIT=$?

while IFS= read -r line; do
  [ -z "$line" ] && continue
  echo "$line"
  case "$line" in
    PASS:*) PASS=$((PASS + 1)) ;;
    FAIL:*) FAIL=$((FAIL + 1)) ;;
  esac
done <<< "$NODE_OUT"

if [ "$NODE_EXIT" -ne 0 ] && [ "$FAIL" -eq 0 ]; then
  fail "Node test process exited $NODE_EXIT"
fi

# --- Static HTML first-paint (no JS) ----------------------------------------
HTML="$ROOT/index.html"

if [ -f "$HTML" ]; then
  pass "index.html exists"
else
  fail "index.html missing"
fi

if [ -f "$ROOT/.nojekyll" ]; then
  pass ".nojekyll present for GitHub Pages"
else
  fail ".nojekyll missing"
fi

# Simulate curl -sL of the baked file (grep the file; do not store HTML in a
# bash string — `$85,000` would expand as positional parameters).
MONTH_COUNT="$(grep -o 'data-month=' "$HTML" | wc -l | tr -d ' ')"
CAT_COUNT="$(grep -o 'data-category=' "$HTML" | wc -l | tr -d ' ')"

if [ "$MONTH_COUNT" -ge 12 ]; then
  pass "static HTML has ≥12 month columns ($MONTH_COUNT)"
else
  fail "static HTML month columns ($MONTH_COUNT) < 12"
fi

if [ "$CAT_COUNT" -ge 5 ]; then
  pass "static HTML has ≥5 named categories ($CAT_COUNT)"
else
  fail "static HTML category rows ($CAT_COUNT) < 5"
fi

if grep -q 'Payroll' "$HTML"; then
  pass "static HTML contains category name Payroll"
else
  fail "static HTML missing category name Payroll"
fi

if grep -q 'Marketing' "$HTML"; then
  pass "static HTML contains category name Marketing"
else
  fail "static HTML missing category name Marketing"
fi

if grep -q 'Jan 2025' "$HTML"; then
  pass "static HTML contains month label Jan 2025"
else
  fail "static HTML missing month label Jan 2025"
fi

if grep -q 'Dec 2025' "$HTML"; then
  pass "static HTML contains month label Dec 2025"
else
  fail "static HTML missing month label Dec 2025"
fi

if grep -qE 'class="var">[+-]?\$[0-9]' "$HTML"; then
  pass "static HTML contains numeric dollar variance/amounts"
else
  fail "static HTML missing numeric dollar amounts"
fi

if grep -qE 'class="pct">[+-]?[0-9]+\.[0-9]%' "$HTML"; then
  pass "static HTML contains numeric variance percents"
else
  fail "static HTML missing numeric variance percents"
fi

# Not a Loading-only shell: must have a real table with rows, not just a spinner.
LOADING_ONLY=0
if grep -qiE 'Loading(\.\.\.|…)' "$HTML"; then
  if ! grep -q 'variance-table' "$HTML"; then
    LOADING_ONLY=1
  fi
fi
if [ "$LOADING_ONLY" -eq 0 ] && grep -q 'class="variance-table"' "$HTML"; then
  pass "static HTML is not Loading-only (baked variance table present)"
else
  fail "static HTML looks like a Loading-only shell"
fi

if awk 'BEGIN{ignore=0} /<script/{ignore=1} {if(!ignore) print} /<\/script>/{ignore=0}' "$HTML" | grep -q 'Payroll' \
  && awk 'BEGIN{ignore=0} /<script/{ignore=1} {if(!ignore) print} /<\/script>/{ignore=0}' "$HTML" | grep -q 'Jan 2025'; then
  pass "category names and month labels appear outside <script> (first paint without JS)"
else
  fail "table labels only appear inside script tags"
fi

# curl -sL first-paint: stream to grep so bash does not expand `$85,000`.
if curl -sL "file://${HTML}" | grep -F 'Payroll' >/dev/null \
  && curl -sL "file://${HTML}" | grep -F 'Jan 2025' >/dev/null \
  && curl -sL "file://${HTML}" | grep -F 'class="var">' >/dev/null \
  && curl -sL "file://${HTML}" | grep -F 'class="pct">' >/dev/null; then
  pass "curl -sL first-paint shows categories, months, and variance $ / %"
else
  fail "curl -sL first-paint missing baked table"
fi

# JSON cell completeness: 12 months × 5+ categories, each with budget+actual keys
JSON_CHECK="$(node -e '
const d = require("./data/variance.json");
const months = d.months.map((m) => m.id);
let cells = 0, ok = 0;
for (const cat of d.categories) {
  for (const id of months) {
    cells++;
    const c = cat.cells[id];
    if (c && Object.prototype.hasOwnProperty.call(c, "budget") && Object.prototype.hasOwnProperty.call(c, "actual")) ok++;
  }
}
if (months.length >= 12 && d.categories.length >= 5 && ok === cells) {
  console.log("ok " + months.length + "x" + d.categories.length);
  process.exit(0);
}
console.log("bad " + ok + "/" + cells);
process.exit(1);
')"
if [ $? -eq 0 ]; then
  pass "JSON cells all have budget and actual keys (${JSON_CHECK#ok })"
else
  fail "JSON cells missing budget/actual ($JSON_CHECK)"
fi

echo "Summary: ${PASS} passed, ${FAIL} failed"
if [ "$FAIL" -ne 0 ]; then
  exit 1
fi
exit 0
