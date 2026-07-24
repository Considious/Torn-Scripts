from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class Decision:
    action: str
    confidence: float
    reason: str


def momentum(features: dict[str, float]) -> Decision:
    score = 0
    score += 1 if features["return_7"] > 0.01 else -1
    score += 1 if features["return_30"] > 0 else -1
    score += 1 if features["sma_ratio"] > 0 else -1
    if score >= 2 and features["rsi_14"] < 75:
        return Decision("BUY", min(0.90, 0.50 + 0.10 * score), "positive multi-period momentum")
    if score <= -2:
        return Decision("SELL", min(0.90, 0.50 + 0.10 * abs(score)), "negative multi-period momentum")
    return Decision("HOLD", 0.50, "momentum evidence is mixed")


def mean_reversion(features: dict[str, float]) -> Decision:
    z = features["zscore_30"]
    rsi = features["rsi_14"]
    if z <= -1.5 and rsi < 40:
        return Decision("BUY", min(0.90, 0.55 + abs(z) / 10), "oversold relative to 30-day range")
    if z >= 1.5 and rsi > 60:
        return Decision("SELL", min(0.90, 0.55 + abs(z) / 10), "overextended relative to 30-day range")
    return Decision("HOLD", 0.50, "no strong mean-reversion condition")


def composite(features: dict[str, float]) -> Decision:
    mom = momentum(features)
    revert = mean_reversion(features)
    if mom.action == revert.action and mom.action in {"BUY", "SELL"}:
        return Decision(
            mom.action,
            min(0.95, (mom.confidence + revert.confidence) / 2 + 0.05),
            f"agreement: {mom.reason}; {revert.reason}",
        )
    if mom.action in {"BUY", "SELL"} and revert.action == "HOLD":
        return Decision(mom.action, mom.confidence - 0.10, mom.reason)
    if revert.action in {"BUY", "SELL"} and mom.action == "HOLD":
        return Decision(revert.action, revert.confidence - 0.10, revert.reason)
    return Decision("HOLD", 0.45, "strategies disagree or lack sufficient evidence")


STRATEGIES = {
    "momentum": momentum,
    "mean-reversion": mean_reversion,
    "composite": composite,
}

