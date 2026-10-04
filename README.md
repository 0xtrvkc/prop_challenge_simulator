https://0xtrvkc.github.io/prop_challenge_simulator/

# Prop Challenge Pass-Probability Simulator

A single-file, client-side FTMO planning toolkit. It estimates challenge pass probability, audits a live forward-testing journey from a Myfxbook CSV, and calculates prop-safe position size. It includes current FTMO 1-Step and 2-Step presets plus fully custom simulation rules. No build step, dependencies, API, account connection, or server is required.

Open it in any modern browser and it runs entirely in-page.

## Weekly FTMO journey audit

The `journey_audit.sh` tab is designed for a new forward test. Its primary question is not “Will this definitely pass?” but **“Has this account failed an FTMO objective yet?”**

1. Export the complete trade-history CSV from Myfxbook, including the starting `Deposit` row.
2. Choose FTMO 1-Step, 2-Step Challenge, or 2-Step Verification.
3. Upload the cumulative CSV. Processing happens locally in the browser.
4. Save the result as a weekly checkpoint. On the next upload, the app reports the changes in trade count, balance, and closed drawdown.

The screen follows one direction: **upload → survival status → pace decision → objective buffers → weekly checkpoint → export**. The coach visually compares **Your setting → Suggested plan** for risk per trade, maximum lot, and a two-loss session stop. It reads the existing XAU/USD calculator setup automatically, without duplicating its controls inside Journey Audit. A sticky summary keeps status, pace, risk range, and maximum lot visible while the audit is reviewed.

The audit reconstructs closed balance, daily closed P/L, maximum closed-balance drawdown, active trading days, profit-target progress, the 1-Step end-of-day trailing loss floor, and the 1-Step Best Day ratio. Its headline states one of:

- **Still active — no failure found**: no rule breach exists in the imported closed-trade history.
- **Target reached — no closed-history breach**: closed trades meet the preset objectives, subject to the verification limitation below.
- **Failed — breach found in closed history**: the imported data itself contains a definite daily-loss or maximum-loss breach.

The static objective ledger shows net profit earned, required profit and remaining target, the largest observed within-day closed loss in money and percent of allowance, current maximum-loss remaining buffer, allowance use and floor, plus the worst historical buffer with its CSV date/time and the balance/floor at that point, and either the Best Day profit numerator and positive-day denominator or minimum trading days. A compact summary separates net profits from winners, net losses from losers, total net P/L and included reported commissions/swaps. Thin flat bars are rendered immediately without animation, gradients, glow or sheen. Historical breach status remains visible after recovery. All money values follow percentage-only privacy mode.

### Pace and sizing coach

After a CSV is loaded, the audit combines the journey with an embedded copy of the XAU/USD sizing setup: risk per trade, stop-loss distance, spread, commission, pip value, and lot step. These controls stay synchronized with the full calculator.

The coach returns **Slow down**, **Maintain**, **Cautious +0.1%**, or **Stop**. It considers sample size, full and recent-10 profit factor, current losing streak, daily-loss usage, maximum-loss usage, and the selected FTMO preset. Its output includes a risk range, maximum rounded-down XAU/USD lot size, session stop, evidence, and measurable conditions required before accelerating. Distance from the profit target never triggers an acceleration recommendation by itself.

### One-page audit report

After importing a CSV, use **print / save one-page A4 PDF** to create a compact MT5-style report containing the journey status, closed-balance curve, performance statistics, FTMO objective usage, and the XAU/USD pace and sizing plan. Print CSS fixes the output to one A4 portrait page; the browser print dialog can print it or save it as PDF.

Use **generate share image** to render the same audit as an A4-proportioned PNG directly in the browser. A preview opens with **save PNG** and, on supported mobile/desktop browsers, the native **share image** sheet. No report data is uploaded to a server.

The audit's privacy toggle switches both the live view and report to percentage-only mode. Monetary balances, dollar P/L, floors, cushions, absolute lot sizes, and broker-specific sizing values are removed while performance and risk percentages remain visible.

### Quant trade analysis

A fourth tab, **quant_analysis.sh**, appears only after a valid Myfxbook CSV is imported. It analyzes realized expectancy, payoff structure, break-even win rate, profit factor, an SQN-like consistency score, recovery factor, return percentiles, skew, tail balance, winner concentration, streaks, holding time, direction, symbol, session, weekday, recent-versus-full performance, position-size variation, post-loss sizing, visible stop usage, and supported Myfxbook execution fields.

The tab also infers a likely execution style from holding time, direction mix, sizing variation, and visible stop behavior. Nine evidence-scored strategy fingerprints cover high-frequency scalping, momentum/breakout, trend-following/runners, mean-reversion/counter-trend, recovery sizing, pyramiding, discretionary exits, fixed-size execution, and asymmetric runner payoff. These are pattern matches rather than claims about trader intent. The interface includes a confidence indicator and explicitly lists what closed-trade data cannot establish, such as floating-equity risk, pending orders, or timezone alignment.

The visual diagnostics include a return histogram with a fitted normal curve and mean/standard-deviation bands, rolling five-trade expectancy against cumulative P/L, an underwater drawdown chart, lot-size/outcome and holding-time/outcome scatter plots, and an explicit MAE-versus-MFE chart when Myfxbook provides complete Max/Min USD fields. The excursion view adds a 1:1 reference line, outcome-sized winner/loser bubbles, median MAE, median MFE, MFE-to-MAE ratio, realized MFE capture, and median peak-profit giveback. MAE is approximated from the absolute `Min(USD)` field and MFE from `Max(USD)`; these broker-report fields may not reproduce a tick-level path.

The Quant Analysis tab also computes an empirical binary-outcome Kelly cross-check from realized win rate and average winner-to-loser payoff. It shows full, half, and quarter Kelly; a sample-stressed Kelly using the 95% Wilson lower bound for win rate; and a prop-aware figure capped by the stricter of quarter Kelly and the current pace-coach limit. Full Kelly is clearly labeled as a theoretical growth optimum rather than a funded-account recommendation, and results are withheld when the history lacks both wins and losses.

The **WHAT IF · Kelly historical replay** runs the imported win/loss sequence at full, half, quarter, and one-eighth Kelly. Its default FTMO-oriented sizing takes a fixed risk fraction of the initial deposit on each trade; a selector also offers current-balance compounding. The default full-history view retains every trade's zigzag. The selected audit preset supplies daily and maximum loss floors, profit target, minimum days, and (for 1-Step) the Best Day condition. A dot marks each path's first modeled FTMO outcome, but trades after the dot in the full-history view are hypothetical and do not represent a continuing challenge. The replay-scope selector offers a stopped view that ends every modeled line at its first closed-trade loss breach or eligible target. The stopped view defaults to a chart zoom ending at the last displayed Kelly outcome, with an All imported trades option for the original timeline. The actual CSV path is cropped visually when zoomed; its legend and comparison bars still report the complete recorded history. Equity axes fit the displayed values, and drawdown ticks show two decimal places. The charts compare indexed equity and drawdown paths; the equity legend shows final index, and the drawdown legend shows maximum drawdown. Because a Myfxbook export does not reliably reveal initial stop-risk for every position, the replay uses the empirical binary model: each loss is −1R and each win is the observed average payoff multiple. Kelly fractions themselves are uncapped stress tests, not suggested FTMO trade sizes.

Below the paths, **Final balance by Kelly ratio** and **Balance change by Kelly ratio** compare the complete actual CSV outcome with Kelly paths on the same starting deposit. The modeled bars reflect the selected replay scope: full historical what-if or stop at FTMO outcome. They show final dollar balance and percentage return, including losses extending left of zero. Values refresh on a new CSV, audit preset, sizing choice, or replay scope. Percentage-only privacy mode hides the dollar panel. Replay dates are assumed already aligned with FTMO CE(S)T days. Closed-trade CSV data cannot verify floating-equity loss breaches, precise intraday equity, or official challenge compliance; overlapping trades and omitted costs can alter results. This is a sizing stress test, not an exact reconstruction or forecast.

### Advanced Quant Lab

The Quant Analysis tab now also includes a wider strategy-health and prop-survival laboratory. Every module regenerates from the newest imported CSV:

- Monte Carlo prop survival with a 10th–90th percentile equity fan
- Risk-per-trade sweep from 0.1% to 3.0%, pass probability and breach probability
- Empirical current-risk, full-, half-, quarter- and one-eighth-Kelly survival scenarios
- Rolling expectancy and win-rate stability with improving/weakening status
- Sequence-shuffle drawdown testing and original-path percentile
- Winner-removal stress tests for the best one, three and five trades
- Bootstrap intervals for expectancy, win rate and probability of positive expectancy
- Time-to-target, time-to-breach and unfinished-path estimates
- Conditional win rates, runs-test warning and observed streak structure
- Position-size behavior after losses, holding-time asymmetry and recovery-sizing flags
- Symbol and direction concentration with group drawdown
- MAE/MFE, MFE capture, profit giveback and positive-to-losing-close diagnostics
- Closed-P/L daily-limit pressure, best-day share and consistency dilution estimate
- A prioritized action board derived from the imported evidence

Simulation output is deterministic for the same uploaded history. It uses a seeded bootstrap so reloading or resizing the page does not produce a cosmetically different conclusion. Prop-rule simulation remains an approximation: closed-trade exports do not contain reliable tick-by-tick floating equity, and day boundaries depend on the timezone written in the CSV.

Distribution statistics include standard deviation, ±1σ coverage, worst-trade z-score, skewness, excess kurtosis, percentiles, and a Jarque–Bera shape-deviation diagnostic. Small-sample warnings remain visible because a fitted normal curve does not prove trade returns are normally distributed.

All on-screen typography is enlarged by 30% for improved readability. Print-report typography remains independently sized so the audit still fits on one A4 page.

A Myfxbook trade CSV does not contain continuous combined floating equity. It therefore cannot prove official compliance with FTMO's equity-based drawdown checks, and the app labels this limitation separately instead of incorrectly treating it as a failure. Daily grouping assumes the export timestamps already match FTMO's CE(S)T day.

## What it does

You give it two kinds of inputs:

1. **Challenge rules** — select FTMO 1-Step, 2-Step Challenge, or 2-Step Verification, then customize the profit target, daily loss, total loss, loss-floor behavior, minimum trading days, and Best Day consistency rule if needed.
2. **Your strategy** — expected win rate, reward:risk ratio, risk per trade, trades per day, and the time horizon (in trading days) before an unfinished run is marked a timeout.

It then runs thousands of simulated trading sequences (Bernoulli win/loss draws at your stated win rate) against those rules and reports:

- **Pass probability** — % of runs that hit the profit target before breaching either drawdown rule
- **Fail · max loss** — % that blow the max total loss floor
- **Fail · daily loss** — % that blow the daily loss limit on some single day
- **Timeout** — % that neither pass nor fail within the horizon
- **Expectancy per trade** (in R and in %)
- **Average days to pass** (successful runs only)
- **Full-Kelly optimal risk** (reference only, not a recommendation)
- A sample of up to 40 simulated equity curves, color-coded by outcome, plotted on a canvas chart
- A plain-language "verdict" summarizing the result and commenting on whether your position sizing looks aggressive, conservative, or balanced

## How the simulation works

- Each trade is an independent Bernoulli draw: win with probability `p` (win rate), gaining `risk% × R:R`, or lose, dropping `risk%`.
- FTMO 1-Step uses an **end-of-day trailing** maximum-loss floor based on the highest recorded end-of-day balance. FTMO 2-Step uses a static floor from initial balance.
- Daily loss is measured from each day's starting balance and checked after every simulated trade.
- The 1-Step preset models the Best Day rule: the best positive day cannot exceed 50% of all positive-day profit. The two 2-Step presets require at least four trading days.
- Position size (risk per trade) is held constant throughout — no compounding of lot size with equity, no martingale.
- A run ends the moment it hits the profit target (pass), breaches the max loss floor (fail), breaches the daily loss limit (fail), or reaches the day horizon without doing either (timeout).
- Trades are treated as uncorrelated — no streak clustering, no correlation between setups.

This is a probabilistic estimate from simulated randomness, not a guarantee of live trading outcomes. Real markets add slippage, spread, execution risk, and behavioral error that this model doesn't capture.

## Controls

| Control | Description |
|---|---|
| `PROFIT_TARGET` | Target gain (%) needed to pass. Default 10%. |
| `PRESET` | FTMO 1-Step (default), FTMO 2-Step Challenge, FTMO 2-Step Verification, or Custom. |
| `MAX_LOSS` | Total loss allowance. Default 10%. |
| `DAILY_LOSS` | Max single-day drawdown. Default 3% for FTMO 1-Step. |
| `MAX_LOSS_MODE` | Static floor or end-of-day trailing floor. |
| `MIN_TRADING_DAYS` | Minimum active days required before passing. |
| `BEST_DAY` | Requires the best positive day to be no more than 50% of total positive-day profit. |
| `WIN_RATE` | Your estimated trade win rate. Convenience values at 55% / 65% / 75%, or drag freely from 40–85%. These are not statistical confidence levels. |
| `REWARD : RISK` | 1:1, 1:2, or a custom ratio (0.3–5). |
| `RISK_PER_TRADE` | % of balance risked per trade, 0.1–1.0%. |
| `TRADES_PER_DAY` | Number of trades taken each simulated day, 1–10. |
| `HORIZON` | Number of trading days simulated before an unfinished run counts as a timeout, 10–200. |
| `SIM_RUNS` | Number of Monte Carlo iterations: 2,000 / 5,000 / 10,000. |

Any change triggers a debounced re-run (300ms) automatically. `↺ reset defaults` restores the FTMO 1-Step preset.

## FTMO preset definitions

| Preset | Profit target | Daily loss | Maximum loss | Additional objective |
|---|---:|---:|---:|---|
| FTMO 1-Step | 10% | 3% | 10%, end-of-day trailing | Best Day ≤ 50% of positive-day profit |
| FTMO 2-Step · Challenge | 10% | 5% | 10%, static | Minimum 4 trading days |
| FTMO 2-Step · Verification | 5% | 5% | 10%, static | Minimum 4 trading days |

Rules can change. Verify the preset against [FTMO's official Trading Objectives](https://ftmo.com/en/trading-objectives/) before purchasing or trading an evaluation. This project is independent and is not affiliated with FTMO.

The lot-sizing tab includes the same presets and shows the complete objective summary beside its sizing controls. Selecting a preset automatically applies its daily-loss percentage, maximum-loss percentage, and static/end-of-day-trailing behavior.

### Live FTMO account-state sizing

The lot sizer accepts:

- Initial simulated capital
- Current balance and equity
- Balance recorded at the start of the CE(S)T trading day
- Highest recorded end-of-day balance
- Positive Days' Profit and Best Day profit
- Maximum share of the tighter remaining drawdown buffer that one stopped trade may consume

It calculates the current daily-loss floor, maximum-loss floor, exact remaining buffer to each, Best Day consistency progress, and a prop-safe lot cap. The final lot recommendation is the lower of the trader's requested risk size and this safety cap. Current equity should include floating P/L, commissions, and swaps.

For FTMO 1-Step, the maximum-loss reference is the greater of initial capital or the entered highest end-of-day balance. For FTMO 2-Step, the maximum-loss floor remains static from initial capital. The safety cap defaults to 20% of whichever remaining buffer is tighter; this is a planning policy, not an FTMO rule.

## Tech notes

- Pure HTML/CSS/JS, single file, no external JS dependencies (only a Google Fonts import for JetBrains Mono).
- Chart is hand-drawn on a `<canvas>` element (no charting library).
- Light/dark theme toggle. Light mode and Journey Audit are the first-visit defaults; a manually selected theme is remembered locally. The light palette uses WCAG-readable text and button contrast, distinct surface layers, and a four-step Upload → Audit → Size → Analyze progress guide.
- Fully responsive; controls stack below the chart on narrow viewports.

## Usage

Just open the HTML file in a browser:

```bash
open prop_challenge_simulator.html   # macOS
# or double-click it / drag into a browser tab
```

No install, no server, no internet connection required (aside from the font CDN, which degrades gracefully to a system monospace font if unavailable).

### Monthly ledger and current-state forecast

Journey Audit includes a monthly closed-P/L calendar, opening automatically on the latest month in each imported history. Monday-first weeks, month totals, per-week net, active-day counts and daily trade drilldowns use net P/L including reported commissions and swaps. Month navigation and Latest CSV month return control are provided. Percentage-only mode applies to the calendar, daily ledger and forecast.

The pass/failure race starts at the latest audited balance and state, rather than restarting the challenge. It resamples complete observed days (latest 20 active days by default, or all history) into 2,000 deterministic paths over 30, 90 or 180 future active trading days. Within-day losses, the selected preset’s EOD trailing/static floor, minimum-day and Best Day conditions are modeled. It reports pass-first, fail-first and unfinished probabilities, conditional median and 10th–90th percentile timing, and cumulative outcome probability curves. Already failed or target-eligible histories are shown as resolved. Futures assume distinct new opening days; overnight/overlapping trades are an approximation. Calendar-time estimates use observed activity density. Fixed observed dollar P/L is resampled; this does not resize risk or verify intratrade equity.

### Objective ledger overview and drilldown

The ledger now opens with net P/L, winning-trade profits and losing-trade losses, followed by four compact objective cards. Each card has a native **View breakdown** disclosure for amounts, calculation references, historical buffers and explanations. **Full account details & rule audit** contains the account metrics, included costs, dated breach checks and checkpoint comparison. All disclosures start collapsed and open immediately with no animation.

The top toolbar includes **1-Step**, **2-Step** (Challenge) and **Verification** buttons. The selector replays the entire imported history and updates survival status, sizing, objective cards, Kelly replay, forecast and export report. 1-Step uses a 3% daily limit, a 10% EOD trailing maximum loss and Best Day consistency; 2-Step uses a 5% daily limit, a 10% fixed maximum-loss floor and four minimum trading days. Challenge and Verification targets are 10% and 5% respectively. Switching the preset evaluates the same history against that phase; it does not automatically split trades into sequential Challenge and Verification accounts.

### Full-width Journey Audit workspace

A compact top toolbar holds CSV loading/replacement, file metadata and a single evaluation-rule selector. CSV requirements are expandable. A small loaded-status line replaces the four-step banner. Survival status and the sizing coach sit side by side on desktop; sizing actions and evidence are available under **Sizing details & rationale**. The full-width P/L summary and four objective cards follow, with account details, checkpoint actions and exports below. Objective cards use four columns on wide screens, two on tablets/phones and one on very narrow screens; the decision panels and footer stack on mobile. The audit and sizing transitions are static.


## Multi-firm comparison — September 2026

`prop-rules.js` is the shared source for the simulation, imported-history audit, Kelly replay, advanced quantitative simulations, day-bootstrap forecast and lot calculator. It contains FTMO 1-Step, FTMO 2-Step Challenge, FTMO Verification and **WeMasterTrade NoPC–EU Instant**. Other WMT packages and regions are deliberately not represented by the NoPC–EU preset.

The WMT preset uses a 6% payout target, 2% daily allowance, fixed 4% total-loss floor, no profit consistency and a 1% initial-capital limit per trade idea. Sources and their 2026-09-30 verification date appear under the comparison. Daily allowance is fixed against initial capital, while the daily reference is the greater of day-start balance and equity. Live sizing accepts both values and subtracts existing same-idea risk before sizing another position.

**Unresolved official wording:** WMT's package comparison describes balance-based total loss while its general FAQ describes equity-based total loss. Both imply a fixed initial-capital floor; the live calculator monitors equity conservatively. WMT's reset timezone remains unverified. CSV close-date days are assumed to align with the firm's reset. Closed records cannot certify overnight floating equity, planned risk, overlapping idea risk, or payout approval. The preset uses the FAQ's reached-or-surpassed language at loss-limit boundaries.

Load one complete Myfxbook CSV with its initial Deposit row. The comparison preserves the same reported dollar P/L, costs and trade order for every plan. It shows the first modeled target or breach, current target progress and buffers, and worst historical buffers. Later full-history breaches remain visible after an earlier target. FTMO Challenge and Verification are independent comparisons of the same history; they are not an automatically completed two-stage evaluation. The WMT outcome is **payout target reached**, not challenge passed or payout approved.

Known realized trade-idea losses are grouped by symbol, direction and exact closing timestamp. Losses exceeding the WMT idea cap are recorded as violations. Grouping is a limited reconstruction: incomplete symbols, timestamps, profitable closes and missing floating exposure prevent full risk-consistency verification. Live sizing needs the user's combined committed exposure, not merely the next position's risk.

The shared monthly calendar includes expandable daily comparisons across all plans. Percentage-only privacy mode also covers comparison tables and day details. The collapsible risk sweep uses 600 identical seeded binary-outcome paths per plan and risk setting over 90 modeled active days. Risk compounds from current balance; rule allowances and the WMT idea cap stay based on initial capital. Above-cap planned entries fail before their modeled win/loss result. The fixed-dollar day-bootstrap forecast can detect known realized idea-loss violations but cannot infer planned risk.

Run the rule regression checks with:

```sh
node tests/prop-rules.test.cjs
```

Keep `prop-rules.js`, `firm-comparison.js`, `quant-lab.js` and `journey-analytics.js` alongside `index.html` when deploying.

## PyBroker-inspired robustness checks

Import a complete CSV, open **quant_analysis.sh**, and expand **Robustness checks** in Advanced Quant Lab. These checks update with every import and evaluation-rule change. They run in the browser; Python and PyBroker are not required.

- **Trading-day block bootstrap:** 600 seeded resamples of consecutive three-active-day blocks, retaining within-day trade order. Shows 95% percentile intervals for net expectancy and profit factor, the 95th percentile of maximum closed-balance drawdown, and the share of resamples with positive expectancy. Requires six active closing days. Resamples keep the original day count; trade counts can vary when days contain different numbers of positions. No-loss samples retain infinite profit factor; all-zero samples have undefined PF. This preserves some local dependence but assumes observed day blocks remain representative.
- **Chronological edge validation:** uses the first half of active closing days as an initial baseline and checks three separate later periods against expanding earlier history. Requires twelve active closing days. Test days never enter their own earlier baseline. This is a descriptive chronological check; it does not fit a model, optimize parameters, or turn previously inspected history into untouched out-of-sample evidence.
- **Execution-cost stress:** enter an extra flat cost per trade as a percentage of initial capital (default 0.01%). Compare recorded net results with that surcharge and twice that surcharge. Each scenario uses the shared selected prop rules and shows the first modeled outcome separately from later historical breaches. Reported commissions/swaps are already included; the surcharge represents additional execution friction. The break-even extra cost equals positive observed mean net P/L per trade. No lot-aware fill or slippage model is inferred from the CSV.

All monetary diagnostics in this section use percentages of initial capital. Drawdown percentages use the running closed-balance peak. History is grouped by the CSV's local closing dates; the existing reset-timezone and floating-equity limitations still apply. Fixed observed net amounts are used, without position resizing.

Inspired by PyBroker's [bootstrap evaluation](https://www.pybroker.com/en/latest/notebooks/3.%20Evaluating%20with%20Bootstrap%20Metrics.html), [walkforward model validation](https://www.pybroker.com/en/latest/notebooks/6.%20Training%20a%20Model.html), and [slippage modeling](https://www.pybroker.com/en/latest/notebooks/14.%20Modeling%20Slippage.html). This app uses percentile day-block bootstrapping, not PyBroker's per-bar BCa intervals, and it does not execute the PyBroker engine. A positive-resample share is not a posterior probability that an edge exists.

Deploy **`robustness.js`** alongside the existing HTML and JavaScript files. Run all numerical and rule regressions with:

```sh
node --test tests/*.test.cjs
```


## Optional Jev upgrade

**Plan-adherence journal review.** In Quant Analysis after importing a statement, enter a written plan including permitted exceptions, then up to 20 trade notes, one per line. Jev compares each note with the plan and labels plan followed, documented exception, unplanned departure, or insufficient evidence. Use the result filter to focus on one label. The request includes only a small aggregate context (trade count, profit factor, preset and closed-history limitation), not the original CSV. It does not infer trader intent from P/L, change FTMO status, adjust lot size, or replace the numerical coach.

See [JEV.md](JEV.md) for browser-first setup, privacy, input limits, tests and live-evaluation limitations. Existing functionality works without Jev configuration.
