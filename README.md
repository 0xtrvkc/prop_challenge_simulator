https://0xtrvkc.github.io/prop_challenge_simulator/

# Prop Challenge Pass-Probability Simulator

A single-file, client-side Monte Carlo simulator that estimates your odds of passing a prop-firm trading challenge (FTMO-style or any custom ruleset), given a win rate, reward:risk ratio, and position size. Built as a self-contained terminal-themed web app — no build step, no dependencies, no server.

**File:** `prop_challenge_simulator.html`

Open it in any modern browser and it runs entirely in-page.

## What it does

You give it two kinds of inputs:

1. **Challenge rules** — profit target, max total loss, and max daily loss (all as % of starting balance). Defaults are 10% / 6% / 3%, matching a typical FTMO-style challenge, but every value is editable so you can model any firm's ruleset or your own personal risk limits.
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
- Max loss and daily loss are **static** thresholds measured from initial balance / start-of-day equity — the standard (non-trailing) drawdown model used by most challenges. It does **not** model trailing drawdowns.
- Position size (risk per trade) is held constant throughout — no compounding of lot size with equity, no martingale.
- A run ends the moment it hits the profit target (pass), breaches the max loss floor (fail), breaches the daily loss limit (fail), or reaches the day horizon without doing either (timeout).
- Trades are treated as uncorrelated — no streak clustering, no correlation between setups.

This is a probabilistic estimate from simulated randomness, not a guarantee of live trading outcomes. Real markets add slippage, spread, execution risk, and behavioral error that this model doesn't capture.

## Controls

| Control | Description |
|---|---|
| `PROFIT_TARGET` | Target gain (%) needed to pass. Default 10%. |
| `MAX_LOSS` | Total drawdown (%) from starting balance that fails the challenge. Default 6%. |
| `DAILY_LOSS` | Max single-day drawdown (%) that fails the challenge. Default 3%. |
| `WIN_RATE` | Your trade win rate. Presets at 55% / 65% / 75% ("1σ/2σ/3σ edge"), or drag freely from 40–85%. |
| `REWARD : RISK` | 1:1, 1:2, or a custom ratio (0.3–5). |
| `RISK_PER_TRADE` | % of balance risked per trade, 0.1–1.0%. |
| `TRADES_PER_DAY` | Number of trades taken each simulated day, 1–10. |
| `HORIZON` | Number of trading days simulated before an unfinished run counts as a timeout, 10–200. |
| `SIM_RUNS` | Number of Monte Carlo iterations: 2,000 / 5,000 / 10,000. |

Any change to a slider or control triggers a debounced re-run (300ms) automatically — there's also a manual `./run_simulation.sh` button. `↺ reset defaults` restores the FTMO-style defaults.

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
