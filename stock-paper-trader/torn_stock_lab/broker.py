from __future__ import annotations

import sqlite3
import time


def ensure_portfolio(db: sqlite3.Connection, name: str, starting_cash: float) -> None:
    db.execute(
        """
        INSERT OR IGNORE INTO portfolios(name, cash, starting_cash, created_at)
        VALUES (?, ?, ?, ?)
        """,
        (name, starting_cash, starting_cash, int(time.time())),
    )


def execute(
    db: sqlite3.Connection,
    *,
    signal_id: int | None,
    portfolio: str,
    ticker: str,
    side: str,
    price: float,
    timestamp: int,
    allocation_percent: float,
    sell_fee_rate: float,
    minimum_trade_value: float,
) -> bool:
    account = db.execute(
        "SELECT cash FROM portfolios WHERE name=?", (portfolio,)
    ).fetchone()
    if account is None:
        raise ValueError(f"Unknown portfolio: {portfolio}")

    position = db.execute(
        "SELECT shares, average_price FROM positions WHERE portfolio=? AND ticker=?",
        (portfolio, ticker),
    ).fetchone()
    owned = int(position["shares"]) if position else 0

    if side == "BUY":
        budget = float(account["cash"]) * allocation_percent
        shares = int(budget // price)
        gross = shares * price
        if shares <= 0 or gross < minimum_trade_value:
            return False
        new_cash = float(account["cash"]) - gross
        old_cost = owned * float(position["average_price"]) if position else 0.0
        new_owned = owned + shares
        average_price = (old_cost + gross) / new_owned
        fee = 0.0
    elif side == "SELL":
        shares = owned
        if shares <= 0:
            return False
        gross = shares * price
        fee = gross * sell_fee_rate
        new_cash = float(account["cash"]) + gross - fee
        new_owned = 0
        average_price = 0.0
    else:
        raise ValueError(f"Unsupported side: {side}")

    db.execute("UPDATE portfolios SET cash=? WHERE name=?", (new_cash, portfolio))
    db.execute(
        """
        INSERT INTO positions(portfolio, ticker, shares, average_price)
        VALUES (?, ?, ?, ?)
        ON CONFLICT(portfolio, ticker)
        DO UPDATE SET shares=excluded.shares, average_price=excluded.average_price
        """,
        (portfolio, ticker, new_owned, average_price),
    )
    db.execute(
        """
        INSERT INTO trades
        (signal_id, portfolio, executed_at, ticker, side, shares, price,
         gross_value, fee, cash_after)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            signal_id,
            portfolio,
            timestamp,
            ticker,
            side,
            shares,
            price,
            gross,
            fee,
            new_cash,
        ),
    )
    return True

