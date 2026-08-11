# Builds the Baldr source CSV used by Slinky's leveling target project.
import csv
import json
import urllib.request
from pathlib import Path

SOURCE_URL = "https://raw.githubusercontent.com/OranWeb/tc-baldrs-levelling-list/master/data.json"
OUTPUT_PATH = Path(__file__).resolve().parents[1] / "Baldrs.csv"

INCLUDED_LISTS = [
    "Baldr's List 1",
    "Baldr's List 2",
    "Baldr's List 3",
    "Baldr's Extra List 1",
    "Baldr's Extra List 2",
    "Baldr's Extra List 3",
]

FIELDNAMES = [
    "source_list",
    "name",
    "id",
    "level",
    "total",
    "strength",
    "defense",
    "speed",
    "dexterity",
]


def load_source():
    with urllib.request.urlopen(SOURCE_URL, timeout=30) as response:
        return json.load(response)


def build_rows(data):
    rows = []

    for list_name in INCLUDED_LISTS:
        targets = data.get(list_name)
        if targets is None:
            raise KeyError(f"Missing expected Baldr list: {list_name}")

        for target in targets:
            rows.append({
                "source_list": list_name,
                "name": target.get("name", "Unknown"),
                "id": target.get("id", "Unknown"),
                "level": target.get("lvl", "Unknown"),
                "total": target.get("total", "Unknown"),
                "strength": target.get("str", "Unknown"),
                "defense": target.get("def", "Unknown"),
                "speed": target.get("spd", "Unknown"),
                "dexterity": target.get("dex", "Unknown"),
            })

    return rows


def write_csv(rows):
    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)

    with OUTPUT_PATH.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=FIELDNAMES)
        writer.writeheader()
        writer.writerows(rows)


def main():
    data = load_source()
    rows = build_rows(data)
    write_csv(rows)
    print(f"Wrote {len(rows)} Baldr target rows to {OUTPUT_PATH}")


if __name__ == "__main__":
    main()
