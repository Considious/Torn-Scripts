from __future__ import annotations

import json
import os
from dataclasses import dataclass
from pathlib import Path


@dataclass(frozen=True)
class Config:
    database_path: str = "data/stock_history.sqlite3"
    starting_cash: float = 10_000_000_000
    sell_fee_rate: float = 0.001
    max_position_percent: float = 0.10
    minimum_trade_value: float = 1_000_000
    strategy_version: str = "paper-v0.1"
    tornsy_base_url: str = "https://tornsy.com/api"
    request_timeout_seconds: int = 20


def load_config(path: str = "config.json") -> Config:
    values: dict[str, object] = {}
    config_path = Path(path)
    if config_path.exists():
        values.update(json.loads(config_path.read_text(encoding="utf-8")))

    overrides = {
        "database_path": os.getenv("TORN_STOCK_DB"),
        "starting_cash": os.getenv("TORN_STOCK_STARTING_CASH"),
        "max_position_percent": os.getenv("TORN_STOCK_MAX_POSITION_PCT"),
        "sell_fee_rate": os.getenv("TORN_STOCK_SELL_FEE"),
    }
    for key, value in overrides.items():
        if value is not None:
            values[key] = value

    numeric = {
        "starting_cash": float,
        "sell_fee_rate": float,
        "max_position_percent": float,
        "minimum_trade_value": float,
        "request_timeout_seconds": int,
    }
    for key, converter in numeric.items():
        if key in values:
            values[key] = converter(values[key])
    return Config(**values)

