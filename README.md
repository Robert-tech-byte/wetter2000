# Wetter2000

Minimalistische Wettervorhersage für München – React + TypeScript + Vite, gehostet auf GitHub Pages.

## Aufbau

Eine Spalte, drei Ebenen: Auf einen Blick steht die Antwort, Antippen zeigt die Begründung, ganz unten liegen die Details.

- **Komme ich trocken an?** (ganz oben): Hin oder Heim, Richtung der Arbeit per Kompass, Fahrzeit 10/20/30 min (20 km/h, direkte Linie ab U-Bahn Schwanthalerhöhe). Prüft die Fahrt mit Radar + Nowcast entlang der Strecke und schlägt sonst die trockenste Abfahrt vor; nach dem Nowcast mit ICON-D2-15-Minuten-Werten. Einstellungen bleiben auf dem Gerät gespeichert.
- **Jetzt:** Temperatur der DWD-Station München-Stadt (Bright Sky), Wetterlage, Hoch/Tief. Aufklappbar: gefühlte Temperatur, Wind, Luftdruck, Sonne.
- **Nächste 12 Stunden:** seitlich wischbare Leiste mit Symbol, Temperatur und Regenwahrscheinlichkeit (Median der 7 Modelle, Bewölkung für das Symbol). Die erste Karte „Jetzt“ nutzt Messwert und Radar-Nowcast.
- **Regen in der nächsten Stunde:** ein Satz und ein Streifen mit 12 Fünf-Minuten-Werten.
- **Regenradar:** DWD-Radarkomposit in 1-km-Blöcken (5 min) der letzten Stunde plus DWD-Nowcast für 60 Minuten, mit Überblendung. Übersicht ±15 km, Antippen öffnet ±40 km.
- **Grundkarte:** eigene Vektorkarte ohne Kartenkacheln: Stadtgrenze, Stadtteile, Hauptstraßen, Autobahnen, Isar, Seen, Orte, Entfernungsringe.
- **Tage:** 15 Tage als Liste mit Regen-Spalte (Wahrscheinlichkeit und Menge der Modelle für 3 Tage, danach ECMWF-Menge). Antippen zeigt den stündlichen Verlauf von Temperatur und Regen; für heute bis übermorgen darunter, wie sicher Temperatur und Regen sind (7 Modelle ≤ 7 km). „Details“ für Power-User: Böen, Sonne, Modellspannen, Einzelmodelle, ICON-D2-EPS.

Parameter (Toleranz, Schwellen, Modellliste) stehen in [`src/lib/config.ts`](src/lib/config.ts).

## Kartendaten

`src/data/basemap.json` wird von [`scripts/build-basemap.py`](scripts/build-basemap.py) aus OpenStreetMap (Overpass-API) erzeugt und vereinfacht.
Neu erzeugen: GitHub → Actions → **Update basemap** → *Run workflow*. Der Workflow legt die Datei auf dem Branch `basemap-data` ab; von dort wird sie nach `main` übernommen (oder lokal `python3 scripts/build-basemap.py`).
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
