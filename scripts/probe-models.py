#!/usr/bin/env python3
"""Log-only probe: which Open-Meteo model names return data, how far and how dense (hours per day)."""
import json
import urllib.parse
import urllib.request
from collections import Counter

BASE = {"latitude": 48.137, "longitude": 11.575, "timezone": "Europe/Berlin", "hourly": "temperature_2m,precipitation"}
PROBES = [
    ("forecast", "ecmwf_aifs025_single", 16),
    ("ensemble", "icon_eu", 6),
    ("ensemble", "dwd_icon_eu_eps", 6),
    ("ensemble", "icon_d2", 3),
]
HOST = {"forecast": "https://api.open-meteo.com/v1/forecast", "ensemble": "https://ensemble-api.open-meteo.com/v1/ensemble"}

for api, model, days in PROBES:
    q = dict(BASE, models=model, forecast_days=days)
    url = f"{HOST[api]}?{urllib.parse.urlencode(q)}"
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "wetter2000-probe"})
        with urllib.request.urlopen(req, timeout=60) as r:
            h = json.load(r)["hourly"]
    except Exception as e:  # noqa: BLE001
        print(f"{api} {model}: FAILED {e}")
        continue
    t = h["time"]
    temp = h.get("temperature_2m")
    members = sum(1 for k in h if k.startswith("temperature_2m"))
    per_day = Counter(t[i][:10] for i in range(len(t)) if temp and temp[i] is not None)
    print(f"{api} {model}: members={members} hours/day={dict(sorted(per_day.items()))}")
