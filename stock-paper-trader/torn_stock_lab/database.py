from __future__ import annotations

import json
import sqlite3
from contextlib import contextmanager
from pathlib import Path
from typing import Iterator

SCHEMA = """
PRAGMA journal_mode=WAL;
PRAGMA foreign_keys=ON;

CREATE TABLE IF NOT EXISTS observations (
    ticker TEXT NOT NULL,
    timestamp INTEGER NOT NULL,
    price REAL NOT NULL,
    total_shares INTEGER,
    investors INTEGER,
    source TEXT NOT NULL,
    received_at INTEGER NOT NULL,
    PRIMARY KEY (ticker, timestamp, source)
);

CREATE TABLE IF NOT EXISTS candles (
    ticker TEXT NOT NULL,
    interval TEXT NOT NULL,
    timestamp INTEGER NOT NULL,
    open REAL NOT NULL,
    high REAL NOT NULL,
    low REAL NOT NULL,
    close REAL NOT NULL,
    total_shares INTEGER,
    source TEXT NOT NULL,
    PRIMARY KEY (ticker, interval, timestamp, source)
);

CREATE TABLE IF NOT EXISTS portfolios (
    name TEXT PRIMARY KEY,
    cash REAL NOT NULL,
    starting_cash REAL NOT NULL,
    created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS positions (
    portfolio TEXT NOT NULL,
    ticker TEXT NOT NULL,
    shares INTEGER NOT NULL,
    average_price REAL NOT NULL,
    PRIMARY KEY (portfolio, ticker),
    FOREIGN KEY (portfolio) REFERENCES portfolios(name)
);

CREATE TABLE IF NOT EXISTS signals (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    created_at INTEGER NOT NULL,
    strategy TEXT NOT NULL,
    strategy_version TEXT NOT NULL,
    ticker TEXT NOT NULL,
    action TEXT NOT NULL CHECK(action IN ('BUY','SELL','HOLD','NO_TRADE')),
    confidence REAL NOT NULL,
    reference_price REAL NOT NULL,
    features_json TEXT NOT NULL,
    reason TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS trades (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    signal_id INTEGER,
    portfolio TEXT NOT NULL,
    executed_at INTEGER NOT NULL,
    ticker TEXT NOT NULL,
    side TEXT NOT NULL CHECK(side IN ('BUY','SELL')),
    shares INTEGER NOT NULL,
    price REAL NOT NULL,
    gross_value REAL NOT NULL,
    fee REAL NOT NULL,
    cash_after REAL NOT NULL,
    FOREIGN KEY (signal_id) REFERENCES signals(id),
    FOREIGN KEY (portfolio) REFERENCES portfolios(name)
);
"""


def ensure_parent(path: str) -> None:
    Path(path).parent.mkdir(parents=True, exist_ok=True)


@contextmanager
def connect(path: str) -> Iterator[sqlite3.Connection]:
    ensure_parent(path)
    db = sqlite3.connect(path)
    db.row_factory = sqlite3.Row
    db.execute("PRAGMA foreign_keys=ON")
    try:
        yield db
        db.commit()
    finally:
        db.close()


def initialize(path: str) -> None:
    with connect(path) as db:
        db.executescript(SCHEMA)


def insert_signal(
    db: sqlite3.Connection,
    *,
    created_at: int,
    strategy: str,
    strategy_version: str,
    ticker: str,
    action: str,
    confidence: float,
    reference_price: float,
    features: dict[str, float],
    reason: str,
) -> int:
    cursor = db.execute(
        """
        INSERT INTO signals
        (created_at, strategy, strategy_version, ticker, action, confidence,
         reference_price, features_json, reason)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            created_at,
            strategy,
            strategy_version,
            ticker,
            action,
            confidence,
            reference_price,
            json.dumps(features, sort_keys=True, separators=(",", ":")),
            reason,
        ),
    )
    return int(cursor.lastrowid)

