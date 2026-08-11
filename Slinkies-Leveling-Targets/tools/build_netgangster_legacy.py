import base64
import gzip
from pathlib import Path

BASE = Path(__file__).resolve().parents[1]
PAYLOAD = Path(__file__).with_name("netgangster_legacy.csv.gz.b64")
OUTPUT = BASE / "Netgangster-Legacy-Leveling-Targets.csv"


def main():
    encoded = PAYLOAD.read_text(encoding="utf-8").strip()
    csv_bytes = gzip.decompress(base64.b64decode(encoded))
    OUTPUT.write_bytes(csv_bytes)
    print(f"Wrote {OUTPUT}")


if __name__ == "__main__":
    main()
