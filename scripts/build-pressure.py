#!/usr/bin/env python3
"""
Builds public/pressure.json: mean sea-level pressure (ECMWF via Open-Meteo) on a
2.5° grid over Europe at 12:00 Munich time for the next 15 days.

Runs in the deploy workflow (every 6 hours), so browsers load one small file instead
of hundreds of grid points. If the download fails the app simply hides the map.
"""
import json
import sys
import time
import urllib.parse
import urllib.request
from pathlib import Path

LATS = [35 + 2.5 * i for i in range(16)]  # 35 … 72.5
LONS = [-25 + 2.5 * i for i in range(29)]  # -25 … 45
BATCH = 50
URL = "https://api.open-meteo.com/v1/forecast"
MODELS = ["ecmwf_ifs025", "ecmwf_ifs"]
# Total time budget so a slow API never blocks publishing for long.
BUDGET_S = 240
PUBLISHED = "https://robert-tech-byte.github.io/wetter2000/pressure.json"
START = time.monotonic()


def remaining():
    return BUDGET_S - (time.monotonic() - START)


def fetch(points, model):
    q = {
        "latitude": ",".join(f"{la:g}" for la, _ in points),
        "longitude": ",".join(f"{lo:g}" for _, lo in points),
        "hourly": "pressure_msl",
        "models": model,
        "forecast_days": "16",
        "timezone": "Europe/Berlin",
        "cell_selection": "nearest",
    }
    url = f"{URL}?{urllib.parse.urlencode(q)}"
    last = None
    for attempt in range(3):
        if remaining() < 5:
            raise RuntimeError("time budget exhausted")
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "wetter2000-pressure-build"})
            with urllib.request.urlopen(req, timeout=min(45, remaining())) as r:
                data = json.load(r)
            return data if isinstance(data, list) else [data]
        except Exception as e:  # noqa: BLE001
            last = e
            print(f"  attempt {attempt + 1}: {e}", file=sys.stderr)
            time.sleep(min(3 * (attempt + 1), max(0, remaining())))
    raise RuntimeError(last)


def keep_published(path):
    """Fallback: reuse the currently published file (stale map is better than none)."""
    try:
        with urllib.request.urlopen(PUBLISHED, timeout=20) as r:
            data = json.load(r)
        if not data.get("days"):
            raise ValueError("empty")
        path.write_text(json.dumps(data, separators=(",", ":")))
        print(f"Kept published pressure.json from {data.get('generated')}")
        return True
    except Exception as e:  # noqa: BLE001
        print(f"No published pressure.json to keep: {e}", file=sys.stderr)
        return False


def noon_values(loc):
    """{date: pressure at 12:00} for one location."""
    h = loc["hourly"]
    return {t[:10]: p for t, p in zip(h["time"], h["pressure_msl"]) if t.endswith("T12:00") and p is not None}


def assemble(per_point, lats, lons):
    """per_point: list (row-major lat×lon) of {date: value} → days with 2-D grids."""
    dates = sorted(set().union(*[set(p) for p in per_point]))[:15]
    days = []
    for d in dates:
        grid = []
        for i in range(len(lats)):
            row = []
            for j in range(len(lons)):
                v = per_point[i * len(lons) + j].get(d)
                row.append(None if v is None else round(v, 1))
            grid.append(row)
        days.append({"date": d, "p": grid})
    return days


def main():
    path = Path(__file__).resolve().parent.parent / "public" / "pressure.json"
    path.parent.mkdir(parents=True, exist_ok=True)
    points = [(la, lo) for la in LATS for lo in LONS]
    for model in MODELS:
        try:
            per_point = []
            for k in range(0, len(points), BATCH):
                per_point += [noon_values(loc) for loc in fetch(points[k : k + BATCH], model)]
                time.sleep(1)
            break
        except Exception as e:  # noqa: BLE001
            print(f"model {model} failed: {e}", file=sys.stderr)
    else:
        if keep_published(path):
            return
        raise SystemExit("pressure data not available")
    out = {
        "source": "ECMWF via Open-Meteo (CC BY 4.0)",
        "model": model,
        "generated": time.strftime("%Y-%m-%dT%H:%MZ", time.gmtime()),
        "lats": LATS,
        "lons": LONS,
        "days": assemble(per_point, LATS, LONS),
    }
    path.write_text(json.dumps(out, separators=(",", ":")))
    print(f"Wrote {path} ({path.stat().st_size // 1024} KB, {len(out['days'])} days, model {model})")


if __name__ == "__main__":
    main()
