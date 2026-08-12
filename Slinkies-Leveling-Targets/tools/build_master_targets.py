#!/usr/bin/env python3

import csv
from pathlib import Path

BASE = Path(__file__).resolve().parents[1]
FILES = [
    BASE / "Baldrs.csv",
    BASE / "Slinky-Leveling-Targets.csv",
    BASE / "Torn-Forum-Leveling-Targets.csv",
    BASE / "Netgangster-Legacy-Leveling-Targets.csv",
    BASE / "Script-Reported-Targets.csv",
]
OUTPUT = BASE / "Master-Leveling-Targets.csv"

UNKNOWN = {"", "unknown", "—", "-", "none", "null"}
MIN_LEVEL = 10
MAX_STATS = 2500
TORN_FORUM_HIGH_STAT_MARKERS = (
    "Targets 1000-10000 estimated stats",
    "Targets 10k-100k estimated stats",
)


def known(value):
    return str(value or "").strip().lower() not in UNKNOWN


def source_label(row, filename):
    source = (row.get("source_list") or filename).strip()
    section = (row.get("source_section") or "").strip()
    if section:
        return f"{source} - {section}"
    return source


def stat_number(value):
    """Normalize values such as 1.2k / 2.96m / 1,000 to a number."""
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
    elif text.endswith("b"):
        multiplier = 1_000_000_000
        text = text[:-1]

    try:
        return float(text) * multiplier
    except ValueError:
        return None


def format_stat(value):
    """Write known stat estimates as plain integers without commas or suffixes."""
    numeric = stat_number(value)
    if numeric is None:
        return "Unknown"
    return str(int(round(numeric)))


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


def forum_source_over_1k(sources):
    return any(
        source.startswith("Torn Forum Leveling Targets - ") and
        any(marker in source for marker in TORN_FORUM_HIGH_STAT_MARKERS)
        for source in sources
    )


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

    removed_low_level = 0
    removed_forum = 0
    removed_high_stats = 0
    rows = []

    for target in targets.values():
        try:
            level = int(target["level"])
        except (TypeError, ValueError):
            level = None

        if level is not None and level < MIN_LEVEL:
            removed_low_level += 1
            continue

        if forum_source_over_1k(target["sources"]):
            removed_forum += 1
            continue

        total_numeric = stat_number(target["total"])
        if total_numeric is not None and total_numeric > MAX_STATS:
            removed_high_stats += 1
            continue

        target["total"] = format_stat(target["total"])
        rows.append(target)

    rows.sort(key=lambda r: (
        -int(r["level"]) if str(r["level"]).isdigit() else 1,
        stat_number(r["total"]) or float("inf"),
        r["name"].lower(),
    ))

    with OUTPUT.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(
            handle,
            fieldnames=["id", "name", "level", "total", "profile_url", "sources"],
        )
        writer.writeheader()
        for row in rows:
            row = dict(row)
            row["sources"] = " | ".join(row["sources"])
            writer.writerow(row)

    print(f"Original unique targets: {len(targets)}")
    print(f"Removed level <{MIN_LEVEL}: {removed_low_level}")
    print(f"Removed Torn Forum >1k groups: {removed_forum}")
    print(f"Removed total stats >{MAX_STATS}: {removed_high_stats}")
    print(f"Remaining targets: {len(rows)}")


if __name__ == "__main__":
    merge()
