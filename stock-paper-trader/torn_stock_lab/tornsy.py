from __future__ import annotations

import json
import time
import urllib.parse
import urllib.request
from pathlib import Path


USER_AGENT = "Considious-Torn-Stock-Paper-Trader/0.1 (research; paper trades only)"


def fetch_json(url: str, timeout: int = 20) -> dict:
    request = urllib.request.Request(
        url,
        headers={"Accept": "application/json", "User-Agent": USER_AGENT},
    )
    with urllib.request.urlopen(request, timeout=timeout) as response:
        return json.load(response)


def fetch_watchlist(base_url: str, timeout: int = 20) -> dict:
    return fetch_json(f"{base_url.rstrip('/')}/stocks", timeout)


def fetch_history(
    base_url: str,
    ticker: str,
    *,
    interval: str = "d1",
    limit: int = 2000,
    from_timestamp: int | None = None,
    to_timestamp: int | None = None,
    timeout: int = 20,
) -> dict:
    params: dict[str, int | str] = {"interval": interval, "limit": limit}
    if from_timestamp is not None:
        params["from"] = from_timestamp
    if to_timestamp is not None:
        params["to"] = to_timestamp
    query = urllib.parse.urlencode(params)
    return fetch_json(
        f"{base_url.rstrip('/')}/{ticker.lower()}?{query}",
        timeout,
    )


def import_ohlc_payload(
    db,
    payload: dict,
    *,
    ticker: str,
    interval: str,
    source: str = "tornsy",
) -> int:
    rows = []
    for item in payload.get("data", []):
        if len(item) < 6:
            continue
        rows.append(
            (
                ticker.upper(),
                interval,
                int(item[0]),
                float(item[1]),
                float(item[2]),
                float(item[3]),
                float(item[4]),
                int(item[5]) if item[5] is not None else None,
                source,
            )
        )
    db.executemany(
        """
        INSERT OR IGNORE INTO candles
        (ticker, interval, timestamp, open, high, low, close, total_shares, source)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        rows,
    )
    return len(rows)


def import_ohlc_file(db, path: str, ticker: str, interval: str) -> int:
    payload = json.loads(Path(path).read_text(encoding="utf-8"))
    return import_ohlc_payload(
        db, payload, ticker=ticker, interval=interval, source="tornsy-file"
    )


def store_watchlist(db, payload: dict, source: str = "tornsy") -> int:
    timestamp = int(payload.get("timestamp") or time.time())
    received_at = int(time.time())
    rows = []
    for item in payload.get("data", []):
        ticker = item.get("stock")
        price = item.get("price")
        if not ticker or price is None:
            continue
        rows.append(
            (
                str(ticker).upper(),
                timestamp,
                float(price),
                item.get("total_shares"),
                item.get("investors"),
                source,
                received_at,
            )
        )
    db.executemany(
        """
        INSERT OR IGNORE INTO observations
        (ticker, timestamp, price, total_shares, investors, source, received_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        """,
        rows,
    )
    return len(rows)


def tickers_from_watchlist(payload: dict, include_index: bool = False) -> list[str]:
    tickers = []
    for item in payload.get("data", []):
        ticker = item.get("stock")
        if not ticker:
            continue
        if item.get("index") and not include_index:
            continue
        tickers.append(str(ticker).upper())
    return sorted(set(tickers))


def backfill_all(
    db,
    *,
    base_url: str,
    interval: str,
    limit: int,
    timeout: int,
    delay_seconds: float = 0.25,
    include_index: bool = False,
) -> dict[str, object]:
    watchlist = fetch_watchlist(base_url, timeout)
    tickers = tickers_from_watchlist(watchlist, include_index=include_index)
    imported: dict[str, int] = {}
    errors: dict[str, str] = {}
    for ticker in tickers:
        try:
            payload = fetch_history(
                base_url,
                ticker,
                interval=interval,
                limit=limit,
                timeout=timeout,
            )
            imported[ticker] = import_ohlc_payload(
                db,
                payload,
                ticker=ticker,
                interval=interval,
                source="tornsy",
            )
        except Exception as exc:  # continue so one ticker cannot ruin the backfill
            errors[ticker] = f"{type(exc).__name__}: {exc}"
        time.sleep(delay_seconds)
    return {
        "interval": interval,
        "requested_tickers": len(tickers),
        "imported": imported,
        "errors": errors,
    }
