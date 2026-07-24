# Torn Stock Paper Trader

An evidence-first research lab for Torn's stock market. It collects public
market data, stores immutable observations, generates deterministic signals,
and simulates trades with fake Torn dollars.

It never buys or sells real Torn stocks.

## What v0.1 does

- Imports Tornsy OHLC history.
- Discovers and backfills every Torn stock automatically.
- Collects the public Tornsy stock watchlist once per run.
- Stores observations and candles in SQLite.
- Calculates momentum, mean-reversion, volatility, and moving-average features.
- Runs three paper strategies: momentum, mean reversion, and composite.
- Applies Torn's 0.1% selling fee.
- Records every signal and simulated trade before its outcome is known.
- Produces portfolio and benchmark reports.

## Quick start

Requires Python 3.11 or newer and no third-party Python packages.

```bash
cd stock-paper-trader
python -m torn_stock_lab init
python -m torn_stock_lab import-json data/seed/FHG-d1.json --ticker FHG --interval d1
python -m torn_stock_lab backtest --ticker FHG --strategy composite
python -m torn_stock_lab report
```

To populate and compare the entire market:

```bash
python -m torn_stock_lab backfill-all --interval d1 --limit 2000
python -m torn_stock_lab backtest-all --strategy momentum
python -m torn_stock_lab backtest-all --strategy mean-reversion
python -m torn_stock_lab backtest-all --strategy composite
```

`backfill-all` obtains the ticker list from Tornsy instead of relying on a
hard-coded list, so newly added stocks can be included automatically. TCSE is
excluded by default because it is the market index rather than a tradable
stock; pass `--include-index` to collect it for benchmark analysis.

For a live paper cycle:

```bash
python -m torn_stock_lab collect
python -m torn_stock_lab evaluate
python -m torn_stock_lab report
```

Run `collect` once per minute using a scheduler. The program stores its database
at `data/stock_history.sqlite3` by default.

## Configuration

Copy `config.example.json` to `config.json` and adjust the virtual capital,
position limits, signal thresholds, or database path. `config.json` is ignored
by Git so local settings and secrets are not committed.

Environment variables override the configuration file:

```text
TORN_STOCK_DB
TORN_STOCK_STARTING_CASH
TORN_STOCK_MAX_POSITION_PCT
TORN_STOCK_SELL_FEE
```

## Data sources

Tornsy documents its public, keyless API at https://tornsy.com/api. It normally
collects Torn stock data once per minute. This project sends a descriptive user
agent and makes only focused requests.

The included `data/seed/FHG-d1.json` is the 1,000-candle FHG daily history
captured on 2026-07-24. Growing SQLite databases are intentionally ignored by
Git: Git is used for code and curated snapshots, not as a live database.

## Research rules

1. Never edit historical signals or fills.
2. A backtest trade fills on the candle after its signal. Live paper trades fill
   at the first observation after the signal.
3. Selling costs 0.1% by default.
4. Strategies are versioned before they are evaluated on new data.
5. Results are compared with buy-and-hold, not only with cash.
6. No strategy is promoted based only on in-sample performance.
7. AI analysis, when added, must be evaluated against deterministic controls.

## Testing

```bash
python -m unittest discover -s tests -v
```

## Planned v0.2

- Official Torn API collector as the primary live source.
- Multi-stock historical backfill.
- Walk-forward evaluation and fixed forward horizons.
- Dashboard and charts.
- Optional OpenAI reviewer with strict structured output.
- Paper notifications.
