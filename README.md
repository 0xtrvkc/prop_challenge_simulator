https://0xtrvkc.github.io/prop_challenge_simulator/

# Prop Challenge Pass-Probability Simulator

A single-file, client-side Monte Carlo simulator that estimates your odds of passing a prop-firm trading challenge, given a win rate, reward:risk ratio, and position size. It includes current FTMO 1-Step and 2-Step presets plus fully custom rules. Built as a self-contained terminal-themed web app — no build step, dependencies, or server.

Open it in any modern browser and it runs entirely in-page.

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
| `WIN_RATE` | Your trade win rate. Presets at 55% / 65% / 75% ("1σ/2σ/3σ edge"), or drag freely from 40–85%. |
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

The lot-sizing tab includes the same presets and shows the complete objective summary beside its sizing controls. Selecting a preset automatically applies its daily-loss percentage, maximum-loss percentage, and static/end-of-day-trailing behavior. Profit target, minimum days, and Best Day requirements are shown for planning context; they do not alter the lot-size formula. Dollar loss budgets are sizing references based on the entered balance, not a calculation of the account's exact remaining distance to a live breach floor.

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
