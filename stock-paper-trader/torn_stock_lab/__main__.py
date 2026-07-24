from __future__ import annotations

import argparse
import json
import sys

from .broker import ensure_portfolio
from .config import load_config
from .database import connect, initialize
from .engine import backtest, latest_decision
from .strategies import STRATEGIES
from .tornsy import fetch_watchlist, import_ohlc_file, store_watchlist


def parser() -> argparse.ArgumentParser:
    root = argparse.ArgumentParser(description="Torn stock paper-trading lab")
    root.add_argument("--config", default="config.json")
    commands = root.add_subparsers(dest="command", required=True)
    commands.add_parser("init")

    import_json = commands.add_parser("import-json")
    import_json.add_argument("path")
    import_json.add_argument("--ticker", required=True)
    import_json.add_argument("--interval", default="d1")

    commands.add_parser("collect")

    evaluate = commands.add_parser("evaluate")
    evaluate.add_argument("--ticker", default="FHG")
    evaluate.add_argument("--strategy", choices=STRATEGIES, default="composite")
    evaluate.add_argument("--interval", default="d1")

    test = commands.add_parser("backtest")
    test.add_argument("--ticker", required=True)
    test.add_argument("--strategy", choices=STRATEGIES, default="composite")
    test.add_argument("--interval", default="d1")

    commands.add_parser("report")
    return root


def main() -> int:
    args = parser().parse_args()
    config = load_config(args.config)
    initialize(config.database_path)

    if args.command == "init":
        with connect(config.database_path) as db:
            ensure_portfolio(db, "paper-composite", config.starting_cash)
        print(f"Initialized {config.database_path}")
        return 0

    if args.command == "import-json":
        with connect(config.database_path) as db:
            count = import_ohlc_file(db, args.path, args.ticker, args.interval)
        print(f"Imported {count} {args.ticker.upper()} {args.interval} candles")
        return 0

    if args.command == "collect":
        payload = fetch_watchlist(
            config.tornsy_base_url, config.request_timeout_seconds
        )
        with connect(config.database_path) as db:
            count = store_watchlist(db, payload)
        print(f"Stored {count} current observations")
        return 0

    if args.command == "evaluate":
        with connect(config.database_path) as db:
            signal_id, timestamp, features, decision = latest_decision(
                db, config, args.ticker, args.strategy, args.interval
            )
        print(
            json.dumps(
                {
                    "signal_id": signal_id,
                    "timestamp": timestamp,
                    "ticker": args.ticker.upper(),
                    "action": decision.action,
                    "confidence": decision.confidence,
                    "reason": decision.reason,
                    "features": features,
                },
                indent=2,
            )
        )
        return 0

    if args.command == "backtest":
        with connect(config.database_path) as db:
            result = backtest(
                db, config, args.ticker, args.strategy, args.interval
            )
        print(json.dumps(result, indent=2))
        return 0

    if args.command == "report":
        with connect(config.database_path) as db:
            portfolios = [
                dict(row)
                for row in db.execute(
                    "SELECT name, cash, starting_cash, created_at FROM portfolios"
                )
            ]
            trades = db.execute("SELECT COUNT(*) AS count FROM trades").fetchone()[
                "count"
            ]
            candles = db.execute(
                "SELECT COUNT(*) AS count FROM candles"
            ).fetchone()["count"]
        print(json.dumps({"portfolios": portfolios, "trades": trades, "candles": candles}, indent=2))
        return 0

    return 1


if __name__ == "__main__":
    sys.exit(main())

