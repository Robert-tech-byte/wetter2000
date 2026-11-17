# Wetter2000

Minimalistische Wettervorhersage für München – React + TypeScript + Vite, gehostet auf GitHub Pages.

## Aufbau

Eine Spalte, drei Ebenen: Auf einen Blick steht die Antwort, Antippen zeigt die Begründung, ganz unten liegen die Details.

- **Jetzt:** Temperatur der DWD-Station München-Stadt (Bright Sky), Wetterlage, Hoch/Tief. Aufklappbar: gefühlte Temperatur, Wind, Luftdruck, Sonne.
- **Regen in der nächsten Stunde:** ein Satz und ein Streifen mit 12 Fünf-Minuten-Werten.
- **Regenradar:** DWD-Radarkomposit (1 km, 5 min) der letzten Stunde plus DWD-Nowcast für 60 Minuten. Das Feld wird leicht geglättet, bilinear interpoliert, stufenlos eingefärbt und zwischen den Bildern überblendet. Antippen öffnet eine größere Ansicht (±60 km).
- **Grundkarte:** eigene Vektorkarte ohne Kartenkacheln: Stadtgrenze, Isar, Starnberger See, Ammersee, Autobahnen, 9 Orte, Entfernungsringe.
- **Nächste Tage:** Spanne und Treffsicherheit ●●● aus 7 Modellen ≤ 7 km plus ICON-D2-EPS. Aufklappbar: Prozentwerte, Modellraster, stündlicher Verlauf, Einzelwerte.
- **Bis Tag 15:** ECMWF IFS als kompakte Liste.

Parameter (Toleranz, Schwellen, Modellliste) stehen in [`src/lib/config.ts`](src/lib/config.ts).

## Kartendaten

`src/data/basemap.json` wird von [`scripts/build-basemap.py`](scripts/build-basemap.py) aus OpenStreetMap (Overpass-API) erzeugt und vereinfacht.
Neu erzeugen: GitHub → Actions → **Update basemap** → *Run workflow* (oder lokal `python3 scripts/build-basemap.py`).
Daten © OpenStreetMap-Mitwirkende, ODbL.

## Datenquellen

- [Open-Meteo](https://open-meteo.com/) – Forecast- und Ensemble-API (CC BY 4.0)
- [Bright Sky](https://brightsky.dev/) – DWD-Messwerte und Radar
- [OpenStreetMap](https://www.openstreetmap.org/copyright) – Grundkarte (ODbL)

## Entwicklung

```bash
npm install
npm run dev      # lokal starten
npm test         # Tests
npm run build    # Produktions-Build nach dist/
```

Jeder Push auf `main` baut die App per GitHub Actions und veröffentlicht sie auf GitHub Pages.
