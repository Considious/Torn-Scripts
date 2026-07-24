from __future__ import annotations

import math
from statistics import fmean, pstdev


def percent_change(current: float, previous: float) -> float:
    return current / previous - 1.0 if previous else 0.0


def calculate_features(closes: list[float]) -> dict[str, float]:
    if len(closes) < 31:
        raise ValueError("At least 31 closing prices are required")

    returns = [percent_change(b, a) for a, b in zip(closes[-31:-1], closes[-30:])]
    latest = closes[-1]
    sma7 = fmean(closes[-7:])
    sma30 = fmean(closes[-30:])
    volatility30 = pstdev(returns) if len(returns) > 1 else 0.0

    gains = [max(value, 0.0) for value in returns[-14:]]
    losses = [max(-value, 0.0) for value in returns[-14:]]
    average_gain = fmean(gains)
    average_loss = fmean(losses)
    if average_loss == 0:
        rsi14 = 100.0 if average_gain else 50.0
    else:
        rs = average_gain / average_loss
        rsi14 = 100.0 - (100.0 / (1.0 + rs))

    zscore30 = 0.0
    price_std = pstdev(closes[-30:])
    if price_std:
        zscore30 = (latest - sma30) / price_std

    return {
        "price": latest,
        "return_1": percent_change(latest, closes[-2]),
        "return_7": percent_change(latest, closes[-8]),
        "return_30": percent_change(latest, closes[-31]),
        "sma_7": sma7,
        "sma_30": sma30,
        "sma_ratio": percent_change(sma7, sma30),
        "volatility_30": volatility30,
        "rsi_14": rsi14,
        "zscore_30": zscore30,
        "log_price": math.log(latest),
    }

