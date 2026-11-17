#!/usr/bin/env python3
"""
Builds src/data/basemap.json: simplified OpenStreetMap geodata for the radar base map.

Contents: Munich city boundary, Isar, Starnberger See, Ammersee, motorways and a few
place labels within ±62 km of the city centre. Data © OpenStreetMap contributors (ODbL).

Run manually (needs internet):  python3 scripts/build-basemap.py
or via the "Update basemap" GitHub workflow.
"""
import json
import math
import sys
import time
import urllib.parse
import urllib.request
from pathlib import Path

CENTER = (48.137, 11.575)
HALF_KM = 62
KM_LAT = 111.32
KM_LON = 111.32 * math.cos(math.radians(CENTER[0]))
S = CENTER[0] - HALF_KM / KM_LAT
N = CENTER[0] + HALF_KM / KM_LAT
W = CENTER[1] - HALF_KM / KM_LON
E = CENTER[1] + HALF_KM / KM_LON
BBOX = f"{S:.4f},{W:.4f},{N:.4f},{E:.4f}"

ENDPOINTS = [
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
    "https://overpass.private.coffee/api/interpreter",
]

PLACES = {
    "Freising": "Freising",
    "Dachau": "Dachau",
    "Erding": "Erding",
    "Starnberg": "Starnberg",
    "Ebersberg": "Ebersberg",
    "Fürstenfeldbruck": "Fürstenfeldbruck",
    "Wolfratshausen": "Wolfratshausen",
    "Holzkirchen": "Holzkirchen",
}

QUERY_BASE = f"""
[out:json][timeout:180];
(
  rel["boundary"="administrative"]["admin_level"="6"]["name"="München"];
  rel["waterway"="river"]["name"="Isar"];
  rel["natural"="water"]["name"~"^(Starnberger See|Ammersee)$"];
  way["natural"="water"]["name"~"^(Starnberger See|Ammersee)$"];
  node["place"~"^(town|city)$"]["name"~"^({'|'.join(PLACES)})$"]({BBOX});
  way["aeroway"="aerodrome"]["iata"="MUC"];
);
out geom;
"""

QUERY_MOTORWAYS = f"""
[out:json][timeout:180];
way["highway"="motorway"]({BBOX});
out geom;
"""


def overpass(query: str) -> dict:
    data = urllib.parse.urlencode({"data": query}).encode()
    last = None
    for url in ENDPOINTS:
        for attempt in range(3):
            try:
                req = urllib.request.Request(url, data=data, headers={"User-Agent": "wetter2000-basemap-build"})
                with urllib.request.urlopen(req, timeout=240) as r:
                    return json.load(r)
            except Exception as e:  # noqa: BLE001
                last = e
                print(f"  {url} attempt {attempt + 1}: {e}", file=sys.stderr)
                time.sleep(5 * (attempt + 1))
    raise SystemExit(f"Overpass not reachable: {last}")


def km(p):
    return ((p[1] - CENTER[1]) * KM_LON, (p[0] - CENTER[0]) * KM_LAT)


def simplify(points, tol_km):
    """Douglas-Peucker on [lat, lon] points with tolerance in km."""
    if len(points) < 3:
        return points
    pk = [km(p) for p in points]
    keep = [False] * len(points)
    keep[0] = keep[-1] = True
    stack = [(0, len(points) - 1)]
    while stack:
        a, b = stack.pop()
        ax, ay = pk[a]
        bx, by = pk[b]
        dx, dy = bx - ax, by - ay
        norm = math.hypot(dx, dy) or 1e-9
        best, idx = -1.0, -1
        for i in range(a + 1, b):
            px, py = pk[i]
            d = abs(dy * px - dx * py + bx * ay - by * ax) / norm if norm > 1e-9 else math.hypot(px - ax, py - ay)
            if d > best:
                best, idx = d, i
        if best > tol_km:
            keep[idx] = True
            stack += [(a, idx), (idx, b)]
    return [p for p, k in zip(points, keep) if k]


def geom(el):
    return [(g["lat"], g["lon"]) for g in el.get("geometry", []) if g]


def stitch(ways):
    """Joins open ways into closed rings by matching endpoints."""
    ways = [w[:] for w in ways if len(w) > 1]
    rings = []
    while ways:
        ring = ways.pop(0)
        changed = True
        while ring[0] != ring[-1] and changed:
            changed = False
            for i, w in enumerate(ways):
                if w[0] == ring[-1]:
                    ring += w[1:]
                elif w[-1] == ring[-1]:
                    ring += w[-2::-1]
                elif w[-1] == ring[0]:
                    ring = w[:-1] + ring
                elif w[0] == ring[0]:
                    ring = w[::-1][:-1] + ring
                else:
                    continue
                ways.pop(i)
                changed = True
                break
        rings.append(ring)
    return rings


def inside(p):
    return S <= p[0] <= N and W <= p[1] <= E


def clip_lines(line):
    """Splits a line into the parts inside the bbox."""
    parts, cur = [], []
    for p in line:
        if inside(p):
            cur.append(p)
        elif cur:
            parts.append(cur)
            cur = []
    if cur:
        parts.append(cur)
    return [c for c in parts if len(c) > 1]


def rnd(line):
    return [[round(p[0], 4), round(p[1], 4)] for p in line]


def outer_rings(rel):
    return stitch([geom(m) for m in rel.get("members", []) if m.get("type") == "way" and m.get("role") in ("outer", "")])


def main():
    print("Fetching base layers …", file=sys.stderr)
    base = overpass(QUERY_BASE)
    city, isar, lakes, places = [], [], [], []
    seen_lakes = set()
    for el in base["elements"]:
        tags = el.get("tags", {})
        name = tags.get("name")
        if el["type"] == "relation" and tags.get("boundary") == "administrative":
            city = [rnd(simplify(r, 0.03)) for r in outer_rings(el)]
        elif el["type"] == "relation" and tags.get("waterway") == "river":
            for m in el.get("members", []):
                if m.get("type") == "way" and m.get("role") in ("main_stream", ""):
                    for part in clip_lines(geom(m)):
                        isar.append(rnd(simplify(part, 0.04)))
        elif tags.get("natural") == "water" and name not in seen_lakes:
            rings = outer_rings(el) if el["type"] == "relation" else [geom(el)]
            if rings:
                seen_lakes.add(name)
                lakes += [rnd(simplify(r, 0.05)) for r in rings if len(r) > 3]
        elif el["type"] == "node" and name in PLACES and name not in {p["name"] for p in places}:
            places.append({"name": PLACES[name], "lat": round(el["lat"], 4), "lon": round(el["lon"], 4)})
        elif tags.get("aeroway") == "aerodrome":
            g = geom(el)
            if g:
                places.append(
                    {"name": "Flughafen", "lat": round(sum(p[0] for p in g) / len(g), 4), "lon": round(sum(p[1] for p in g) / len(g), 4)}
                )

    print("Fetching motorways …", file=sys.stderr)
    roads = overpass(QUERY_MOTORWAYS)
    by_ref = {}
    for el in roads["elements"]:
        ref = (el.get("tags", {}).get("ref") or "").split(";")[0].replace(" ", "") or "?"
        for part in clip_lines(geom(el)):
            line = simplify(part, 0.08)
            if len(line) > 1:
                by_ref.setdefault(ref, []).append(rnd(line))
    motorways = [{"ref": r, "lines": lines} for r, lines in sorted(by_ref.items())]

    missing = [n for n in PLACES if n not in {p["name"] for p in places}]
    if not city or not isar or len(lakes) < 2 or missing:
        raise SystemExit(f"Incomplete data: city={len(city)} isar={len(isar)} lakes={len(lakes)} missing={missing}")

    out = {
        "attribution": "© OpenStreetMap contributors, ODbL 1.0 – simplified",
        "generated": time.strftime("%Y-%m-%d"),
        "city": city,
        "isar": isar,
        "lakes": lakes,
        "motorways": motorways,
        "places": places,
    }
    path = Path(__file__).resolve().parent.parent / "src" / "data" / "basemap.json"
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(out, ensure_ascii=False, separators=(",", ":")))
    pts = sum(len(l) for l in city + isar + lakes) + sum(len(l) for m in motorways for l in m["lines"])
    print(f"Wrote {path} ({path.stat().st_size // 1024} KB, {pts} points, motorways: {[m['ref'] for m in motorways]})")


if __name__ == "__main__":
    main()
