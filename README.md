# Budget Variance Tracker

Public FY2025 operating budget vs actuals by category and month. **First paint is the variance table** — `index.html` is generated with the numbers already in the markup. JavaScript only dims cells when you use the flag filters.

## Formulas

Polarity is **actual − budget** (overspend is positive).

| Metric | Formula | Notes |
| --- | --- | --- |
| Variance $ | `actual − budget` | Positive = over; negative = under. |
| Variance % | `(actual − budget) / budget × 100` | **Null** when budget is `0`, or when either side is null/empty. Never `NaN` or `Infinity`. |
| Flag | `over` / `under` / `on` | `on` when `\|variance %\| ≤ 2` (see `thresholds.onTrackPercent` in the data file). If % is undefined (zero budget), the flag uses the sign of variance $; `$0` on a `$0` budget is `on`. |
| Totals | Sum of **paired** cells, then the same formulas | A cell is paired only when **both** budget and actual are finite numbers. Null actuals (period not closed) are omitted, not treated as `$0`. |

`js/variance.js` is a pure browser + Node module (`Variance` global, or `require('./js/variance.js')`).

## Data schema

`data/variance.json` (`budget-variance/v1`):

- `months[]` — `{ id, label }`, twelve calendar months in 2025.
- `categories[]` — `{ id, name, cells }`. `cells` is keyed by month id.
- Each cell: `{ "budget": number, "actual": number | null }`.
- `thresholds.onTrackPercent` — currently `2`.
- Production data includes a **zero-budget** Travel pair (Jan/Feb) and a **null actual** (Professional Services, Dec).

## How to re-render

After editing `data/variance.json` or `js/variance.js`:

```bash
node scripts/render-static.js
```

That rewrites `index.html` (category names, month labels, variance $ and %). Do not hand-edit the table. `.nojekyll` is present so GitHub Pages will serve the site as static files.

```bash
bash scripts/test.sh
```

Tests cover zero-budget / null / empty fixtures, totals math, and static-HTML first-paint checks (`curl`-equivalent read of `index.html`, not a Loading-only shell).

## Suggested next improvements

- Drill-down from a flagged cell to vendor-level actuals.
- Fiscal-year and department selectors without replacing the baked table (swap pre-rendered fragments).
- CSV / ODS export of the computed report.
- Optional dollar-amount on-track band in addition to the percent threshold.
- Sparkline column for each category’s variance % over the year.
