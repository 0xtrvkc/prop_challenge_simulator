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

The screen follows one direction: **upload → survival status → pace decision → objective buffers → optional sizing assumptions → weekly checkpoint → export**. The coach visually compares **Your setting → Suggested plan** for risk per trade, maximum lot, and a two-loss session stop. The optional assumptions panel is only for correcting the real technical stop or broker costs used in that calculation; it does not manually override the coach's verdict. Essential advice stays in Journey Audit, while the full lot calculator is a secondary advanced destination. A sticky summary keeps status, pace, risk range, and maximum lot visible while the audit is reviewed.

The audit reconstructs closed balance, daily closed P/L, maximum closed-balance drawdown, active trading days, profit-target progress, the 1-Step end-of-day trailing loss floor, and the 1-Step Best Day ratio. Its headline states one of:

- **Still active — no failure found**: no rule breach exists in the imported closed-trade history.
- **Target reached — no closed-history breach**: closed trades meet the preset objectives, subject to the verification limitation below.
- **Failed — breach found in closed history**: the imported data itself contains a definite daily-loss or maximum-loss breach.

Animated objective meters make the remaining room visible at a glance: profit-target progress, the largest share of the daily-loss budget consumed so far, current maximum-loss budget consumed, and either Best Day concentration or minimum-trading-day progress. Green, amber, and red zones show increasing breach danger; motion is disabled automatically when the browser requests reduced motion.

### Pace and sizing coach

After a CSV is loaded, the audit combines the journey with an embedded copy of the XAU/USD sizing setup: risk per trade, stop-loss distance, spread, commission, pip value, and lot step. These controls stay synchronized with the full calculator.

The coach returns **Slow down**, **Maintain**, **Cautious +0.1%**, or **Stop**. It considers sample size, full and recent-10 profit factor, current losing streak, daily-loss usage, maximum-loss usage, and the selected FTMO preset. Its output includes a risk range, maximum rounded-down XAU/USD lot size, session stop, evidence, and measurable conditions required before accelerating. Distance from the profit target never triggers an acceleration recommendation by itself.

### One-page audit report

After importing a CSV, use **print / save one-page A4 PDF** to create a compact MT5-style report containing the journey status, closed-balance curve, performance statistics, FTMO objective usage, and the XAU/USD pace and sizing plan. Print CSS fixes the output to one A4 portrait page; the browser print dialog can print it or save it as PDF.

The audit's privacy toggle switches both the live view and report to percentage-only mode. Monetary balances, dollar P/L, floors, cushions, absolute lot sizes, and broker-specific sizing values are removed while performance and risk percentages remain visible.

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
- Light/dark theme toggle, defaulting to the OS `prefers-color-scheme`.
- Fully responsive; controls stack below the chart on narrow viewports.

## Usage

Just open the HTML file in a browser:

```bash
open prop_challenge_simulator.html   # macOS
# or double-click it / drag into a browser tab
```

No install, no server, no internet connection required (aside from the font CDN, which degrades gracefully to a system monospace font if unavailable).
