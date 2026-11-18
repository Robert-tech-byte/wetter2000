#!/usr/bin/env python3
"""
Builds public/trend.json: 15-day trend for Munich from the ECMWF ensemble
(control + 50 members, via Open-Meteo). Per local day: percentiles of the daily
maximum and minimum temperature, the median and 90th percentile of the daily
precipitation sum and the share of members with precipitation.

Runs in the deploy workflow every 6 hours. On failure it keeps the currently
published file so the chart never disappears because of a slow API.
"""
import json
import sys
import time
import urllib.parse
import urllib.request
from pathlib import Path

LAT, LON = 48.137, 11.575
URL = "https://ensemble-api.open-meteo.com/v1/ensemble"
MODEL = "ecmwf_ifs025"
PUBLISHED = "https://robert-tech-byte.github.io/wetter2000/trend.json"
RAIN_DAY_MM = 0.1  # a member counts as "rain" from this daily sum
BUDGET_S = 180
START = time.monotonic()


def fetch():
    q = {
        "latitude": LAT,
        "longitude": LON,
        "models": MODEL,
        "hourly": "temperature_2m,precipitation",
        "forecast_days": 16,
        "timezone": "Europe/Berlin",
    }
    url = f"{URL}?{urllib.parse.urlencode(q)}"
    last = None
    for attempt in range(3):
        left = BUDGET_S - (time.monotonic() - START)
        if left < 5:
            break
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "wetter2000-trend-build"})
            with urllib.request.urlopen(req, timeout=min(60, left)) as r:
                return json.load(r)
        except Exception as e:  # noqa: BLE001
            last = e
            print(f"  attempt {attempt + 1}: {e}", file=sys.stderr)
            time.sleep(3 * (attempt + 1))
    raise RuntimeError(last)


def fetch_det():
    """Deterministic ECMWF daily max/min, the same values the day rows in the app show."""
    q = {
        "latitude": LAT,
        "longitude": LON,
        "models": "ecmwf_ifs",
        "daily": "temperature_2m_max,temperature_2m_min",
        "forecast_days": 16,
        "timezone": "Europe/Berlin",
    }
    url = f"https://api.open-meteo.com/v1/forecast?{urllib.parse.urlencode(q)}"
    req = urllib.request.Request(url, headers={"User-Agent": "wetter2000-trend-build"})
    with urllib.request.urlopen(req, timeout=60) as r:
        d = json.load(r)["daily"]
    return {t: (mx, mn) for t, mx, mn in zip(d["time"], d["temperature_2m_max"], d["temperature_2m_min"])}


def percentile(values, q):
    """Linear-interpolated percentile (q in 0..100)."""
    s = sorted(values)
    if not s:
        return None
    k = (len(s) - 1) * q / 100
    f = int(k)
    c = min(f + 1, len(s) - 1)
    return s[f] + (s[c] - s[f]) * (k - f)


def members(hourly, var):
    """[(name, values)] for control + all members of one variable."""
    out = []
    for key, vals in hourly.items():
        if key == var or key.startswith(var + "_member"):
            out.append((key, vals))
    return out


def summarize(hourly):
    times = hourly["time"]
    dates = sorted({t[:10] for t in times})
    temps = members(hourly, "temperature_2m")
    rains = {k.replace("precipitation", "temperature_2m"): v for k, v in members(hourly, "precipitation")}
    days = []
    for d in dates:
        idx = [i for i, t in enumerate(times) if t.startswith(d)]
        maxs, mins, sums = [], [], []
        for name, vals in temps:
            tv = [vals[i] for i in idx if vals[i] is not None]
            # Ensemble data is 3-/6-hourly later on; require enough values for a sensible day.
            if len(tv) < 4:
                continue
            maxs.append(max(tv))
            mins.append(min(tv))
            rv = rains.get(name)
            if rv is not None:
                sums.append(sum(rv[i] for i in idx if rv[i] is not None))
        if len(maxs) < 10:
            continue
        ctrl = dict(temps).get("temperature_2m") or temps[0][1]
        hours = sum(1 for i in idx if ctrl[i] is not None)
        pct = lambda arr: {f"p{q}": round(percentile(arr, q), 1) for q in (10, 25, 50, 75, 90)}
        days.append(
            {
                "date": d,
                "max": pct(maxs),
                "min": pct(mins),
                "rain": {
                    "p50": round(percentile(sums, 50), 1),
                    "p90": round(percentile(sums, 90), 1),
                    "prob": round(sum(1 for x in sums if x >= RAIN_DAY_MM) / len(sums), 2),
                },
                "members": len(maxs),
                "hours": hours,
            }
        )
    return days


def keep_published(path):
    try:
        with urllib.request.urlopen(PUBLISHED, timeout=20) as r:
            data = json.load(r)
        if not data.get("days"):
            raise ValueError("empty")
        path.write_text(json.dumps(data, separators=(",", ":")))
        print(f"Kept published trend.json from {data.get('generated')}")
        return True
    except Exception as e:  # noqa: BLE001
        print(f"No published trend.json to keep: {e}", file=sys.stderr)
        return False


def main():
    path = Path(__file__).resolve().parent.parent / "public" / "trend.json"
    path.parent.mkdir(parents=True, exist_ok=True)
    try:
        raw = fetch()
        days = summarize(raw["hourly"])
        if len(days) < 10:
            raise RuntimeError(f"only {len(days)} days")
    except Exception as e:  # noqa: BLE001
        print(f"trend failed: {e}", file=sys.stderr)
        if keep_published(path):
            return
        raise SystemExit("trend data not available")
    # Diagnostics: compare with the deterministic run shown in the day rows.
    try:
        det = fetch_det()
        print("date        hrs  det max/min   ens p50 max/min")
        for d in days:
            mx, mn = det.get(d["date"], (None, None))
            d["det"] = {"max": mx, "min": mn}
            print(f"{d['date']}  {d['hours']:>3}  {mx!s:>5}/{mn!s:<5}  {d['max']['p50']:>5}/{d['min']['p50']}")
    except Exception as e:  # noqa: BLE001
        print(f"deterministic comparison failed: {e}", file=sys.stderr)
    out = {
        "source": "ECMWF-Ensemble via Open-Meteo (CC BY 4.0)",
        "model": MODEL,
        "generated": time.strftime("%Y-%m-%dT%H:%MZ", time.gmtime()),
        "days": days,
    }
    path.write_text(json.dumps(out, separators=(",", ":")))
    print(f"Wrote {path} ({path.stat().st_size // 1024} KB, {len(days)} days, {days[0]['members']} members)")


if __name__ == "__main__":
    main()
