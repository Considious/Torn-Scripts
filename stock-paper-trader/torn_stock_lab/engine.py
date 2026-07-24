from __future__ import annotations

import sqlite3

from .broker import ensure_portfolio, execute
from .config import Config
from .database import insert_signal
from .indicators import calculate_features
from .strategies import STRATEGIES


def candle_rows(db: sqlite3.Connection, ticker: str, interval: str = "d1"):
    return db.execute(
        """
        SELECT timestamp, close FROM candles
        WHERE ticker=? AND interval=?
        ORDER BY timestamp
        """,
        (ticker.upper(), interval),
    ).fetchall()


def latest_decision(
    db: sqlite3.Connection,
    config: Config,
    ticker: str,
    strategy_name: str,
    interval: str = "d1",
):
    rows = candle_rows(db, ticker, interval)
    if len(rows) < 31:
        raise ValueError(f"{ticker} has only {len(rows)} candles; 31 are required")
    features = calculate_features([float(row["close"]) for row in rows])
    decision = STRATEGIES[strategy_name](features)
    timestamp = int(rows[-1]["timestamp"])
    signal_id = insert_signal(
        db,
        created_at=timestamp,
        strategy=strategy_name,
        strategy_version=config.strategy_version,
        ticker=ticker.upper(),
        action=decision.action,
        confidence=decision.confidence,
        reference_price=features["price"],
        features=features,
        reason=decision.reason,
    )
    return signal_id, timestamp, features, decision


def backtest(
    db: sqlite3.Connection,
    config: Config,
    ticker: str,
    strategy_name: str,
    interval: str = "d1",
) -> dict[str, float]:
    rows = candle_rows(db, ticker, interval)
    if len(rows) < 32:
        raise ValueError("At least 32 candles are required")

    portfolio = f"backtest-{strategy_name}-{ticker.lower()}"
    db.execute("DELETE FROM trades WHERE portfolio=?", (portfolio,))
    db.execute("DELETE FROM positions WHERE portfolio=?", (portfolio,))
    db.execute("DELETE FROM portfolios WHERE name=?", (portfolio,))
    ensure_portfolio(db, portfolio, config.starting_cash)

    closes = [float(row["close"]) for row in rows[:31]]
    for index in range(31, len(rows)):
        signal_row = rows[index - 1]
        execution_row = rows[index]
        features = calculate_features(closes)
        decision = STRATEGIES[strategy_name](features)
        signal_id = insert_signal(
            db,
            created_at=int(signal_row["timestamp"]),
            strategy=strategy_name,
            strategy_version=config.strategy_version,
            ticker=ticker.upper(),
            action=decision.action,
            confidence=decision.confidence,
            reference_price=features["price"],
            features=features,
            reason=decision.reason,
        )
        if decision.action in {"BUY", "SELL"}:
            execute(
                db,
                signal_id=signal_id,
                portfolio=portfolio,
                ticker=ticker.upper(),
                side=decision.action,
                price=float(execution_row["close"]),
                timestamp=int(execution_row["timestamp"]),
                allocation_percent=config.max_position_percent,
                sell_fee_rate=config.sell_fee_rate,
                minimum_trade_value=config.minimum_trade_value,
            )
        closes.append(float(execution_row["close"]))

    account = db.execute(
        "SELECT cash, starting_cash FROM portfolios WHERE name=?", (portfolio,)
    ).fetchone()
    position = db.execute(
        "SELECT shares FROM positions WHERE portfolio=? AND ticker=?",
        (portfolio, ticker.upper()),
    ).fetchone()
    final_price = float(rows[-1]["close"])
    shares = int(position["shares"]) if position else 0
    equity = float(account["cash"]) + shares * final_price
    first_test_price = float(rows[31]["close"])
    buy_hold = config.starting_cash * final_price / first_test_price
    trades = db.execute(
        "SELECT COUNT(*) AS count FROM trades WHERE portfolio=?", (portfolio,)
    ).fetchone()["count"]
    return {
        "starting_cash": config.starting_cash,
        "ending_equity": equity,
        "strategy_return": equity / config.starting_cash - 1,
        "buy_hold_equity": buy_hold,
        "buy_hold_return": buy_hold / config.starting_cash - 1,
        "trades": int(trades),
    }


def backtest_all(
    db: sqlite3.Connection,
    config: Config,
    strategy_name: str,
    interval: str = "d1",
) -> dict[str, object]:
    tickers = [
        row["ticker"]
        for row in db.execute(
            """
            SELECT ticker FROM candles
            WHERE interval=?
            GROUP BY ticker
            HAVING COUNT(*) >= 32
            ORDER BY ticker
            """,
            (interval,),
        )
    ]
    results: dict[str, dict[str, float] | dict[str, str]] = {}
    for ticker in tickers:
        try:
            results[ticker] = backtest(
                db, config, ticker, strategy_name, interval
            )
        except Exception as exc:
            results[ticker] = {"error": f"{type(exc).__name__}: {exc}"}

    valid = [
        result
        for result in results.values()
        if "strategy_return" in result
    ]
    beat_buy_hold = sum(
        result["strategy_return"] > result["buy_hold_return"] for result in valid
    )
    return {
        "strategy": strategy_name,
        "interval": interval,
        "tickers_tested": len(valid),
        "beat_buy_hold_count": beat_buy_hold,
        "beat_buy_hold_rate": beat_buy_hold / len(valid) if valid else 0.0,
        "average_strategy_return": (
            sum(result["strategy_return"] for result in valid) / len(valid)
            if valid
            else 0.0
        ),
        "average_buy_hold_return": (
            sum(result["buy_hold_return"] for result in valid) / len(valid)
            if valid
            else 0.0
        ),
        "results": results,
    }
