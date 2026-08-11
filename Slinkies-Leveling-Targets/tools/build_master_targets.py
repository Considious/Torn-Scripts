#!/usr/bin/env python3

import csv
import io
from pathlib import Path

BASE = Path(__file__).resolve().parents[1]
FILES = [
    BASE / "Baldrs.csv",
    BASE / "Slinky-Leveling-Targets.csv",
    BASE / "Torn-Forum-Leveling-Targets.csv",
    BASE / "Netgangster-Legacy-Leveling-Targets.csv",
]
OUTPUT = BASE / "Master-Leveling-Targets.csv"

UNKNOWN = {"", "unknown", "—", "-", "none", "null"}


def known(value):
    return str(value or "").strip().lower() not in UNKNOWN


def source_label(row, filename):
    source = (row.get("source_list") or filename).strip()
    section = (row.get("source_section") or "").strip()
    if section:
        return f"{source} - {section}"
    return source


def stat_number(value):
    """Normalize 1.2k / 2.96m style estimates for comparison only."""
    text = str(value or "").strip().lower().replace(",", "")
    if not known(text):
        return None
    multiplier = 1
    if text.endswith("k"):
        multiplier = 1_000
        text = text[:-1]
    elif text.endswith("m"):
        multiplier = 1_000_000
        text = text[:-1]
    try:
        return float(text) * multiplier
    except ValueError:
        return None


def choose_total(existing, candidate):
    """Keep a known estimate; when sources disagree, keep the higher estimate."""
    if not known(existing):
        return candidate if known(candidate) else "Unknown"
    if not known(candidate):
        return existing

    old_num = stat_number(existing)
    new_num = stat_number(candidate)
    if old_num is None or new_num is None:
        return existing
    return candidate if new_num > old_num else existing


def choose_level(existing, candidate):
    """Level can only increase, so keep the highest reported level."""
    try:
        old = int(existing)
    except (TypeError, ValueError):
        old = -1
    try:
        new = int(candidate)
    except (TypeError, ValueError):
        new = -1
    best = max(old, new)
    return str(best) if best >= 0 else "Unknown"


def merge():
    targets = {}

    for path in FILES:
        with path.open("r", encoding="utf-8-sig", newline="") as handle:
            for row in csv.DictReader(handle):
                player_id = str(row.get("id") or "").strip()
                if not player_id:
                    continue

                source = source_label(row, path.stem)
                target = targets.setdefault(player_id, {
                    "id": player_id,
                    "name": "Unknown",
                    "level": "Unknown",
                    "total": "Unknown",
                    "profile_url": f"https://www.torn.com/profiles.php?XID={player_id}",
                    "sources": [],
                })

                if known(row.get("name")):
                    target["name"] = row["name"].strip()
                target["level"] = choose_level(target["level"], row.get("level"))
                target["total"] = choose_total(target["total"], row.get("total"))

                if known(row.get("profile_url")):
                    target["profile_url"] = row["profile_url"].strip()
                if source and source not in target["sources"]:
                    target["sources"].append(source)

    rows = list(targets.values())
    rows.sort(key=lambda r: (-int(r["level"]) if str(r["level"]).isdigit() else 1, stat_number(r["total"]) or float("inf"), r["name"].lower()))

    with OUTPUT.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=["id", "name", "level", "total", "profile_url", "sources"])
        writer.writeheader()
        for row in rows:
            row = dict(row)
            row["sources"] = " | ".join(row["sources"])
            writer.writerow(row)

    print(f"Merged {sum(1 for _ in rows)} unique targets into {OUTPUT.name}")


if __name__ == "__main__":
    merge()
