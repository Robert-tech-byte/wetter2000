# Wetter2000

Föhnomenal genial. Wetter für München. – React + TypeScript + Vite, gehostet auf GitHub Pages.

## Aufbau

Eine Spalte, drei Ebenen: Auf einen Blick steht die Antwort, Antippen zeigt die Begründung, ganz unten liegen die Details.

- **Komme ich trocken an?** (ganz oben): Arbeitsort (U Schwanthalerhöhe, U Westfriedhof oder U Universität), Hin oder Heim, Richtung des Zuhauses per Kompass, Fahrzeit 10/20/30/40 min (20 km/h, direkte Linie). Prüft die Fahrt mit Radar + Nowcast entlang der Strecke, zeigt Gegen-/Rücken-/Seitenwind mit Böen und grober Zeitwirkung und schlägt sonst die trockenste Abfahrt vor; nach dem Nowcast mit ICON-D2-15-Minuten-Werten. Es wird nichts gespeichert; jeder Aufruf beginnt mit der Auswahl.
- **Kopfzone (nach Dieter Rams):** schmale blaue Markenleiste mit Aktualisieren (↻); darunter auf hellem Grund Messwert mit Tendenzpfeil, Wetter, Hoch/Tief, „Komme ich trocken an?“ sowie GroWeLa und „Mehr zu jetzt“; deren Inhalte klappen darunter auf.
- **Jetzt:** Temperatur der DWD-Station München-Stadt (Bright Sky) mit Tendenzpfeil der letzten Stunde (↑/↓ ab ±0,5 °C, sonst →; Antippen zeigt die Änderung), Wetterlage, Hoch/Tief. Aufklappbar: gefühlte Temperatur, Wind, Luftdruck, Sonne.
- **Nächste 12 Stunden:** seitlich wischbare Leiste mit Symbol, Temperatur und Regenwahrscheinlichkeit (Median der 7 Modelle, Bewölkung für das Symbol). Die erste Karte „Jetzt“ nutzt Messwert und Radar-Nowcast. Antippen einer Stunde zeigt Details: Temperatur mit Modellspanne, gefühlte Temperatur, Regen, Wind/Böen mit Richtung, Bewölkung, Luftfeuchte und Treffsicherheit.
- **Regen in der nächsten Stunde:** ein Satz und ein Streifen mit 12 Fünf-Minuten-Werten.
- **Regenradar:** DWD-Radarkomposit (1 km, zwischen den Messpunkten weich interpoliert, unter 0,3 mm/h ausgeblendet, 5 min) der letzten Stunde plus DWD-Nowcast für 60 Minuten, mit Überblendung. Übersicht ±15 km, Antippen öffnet ±40 km; dort zoombar bis ±6 km (Zwei-Finger-Zoom, Ziehen, Doppeltipp, Mausrad, +/−).
- **Grundkarte:** eigene Vektorkarte ohne Kartenkacheln: Stadtgrenze, Stadtteile, Hauptstraßen, Autobahnen, Isar, Seen, Orte, Entfernungsringe.
- **GroWeLa:** Knopf über „Mehr zu jetzt“, erklärt die Großwetterlage und das Warum (Herkunft der Luft, auf- oder absinkende Luft, Drucktendenz, Wind, Föhn-Mechanismus; Anströmrichtung, zyklonal/antizyklonal, Lage von Hoch und Tief, Bedeutung für München, Trend 3 Tage) aus dem ECMWF-Luftdruck.
- **Föhn:** Kennzeichen an Tagen, an denen laut ECMWF Föhn wahrscheinlich ist (Druck Bozen − München ≥ 4 hPa, Höhenwind S–SW, Luftfeuchte < 55 %).
- **15 Tage:** unter dem Radar, ab heute, ECMWF-Ensemble (51 Läufe), nach Dieter Rams reduziert: Höchstwert (rot, gefüllt) und Tiefstwert (blau, offen) als Median mit Zahl am Punkt, Bewölkungsband in 3-Stunden-Abschnitten (gelb sonnig bis dunkelgrau bedeckt, nachts dunkelblau bis grau), Regenmenge als Säule mit mm-Angabe, darunter Regenwahrscheinlichkeit in %; ein Satz fasst den Trend zusammen. Antippen öffnet den Tag unten.
- **Tage:** 15 Tage als Liste mit Regen-Spalte (Wahrscheinlichkeit und Menge der Modelle für 3 Tage, danach ECMWF-Menge). Antippen zeigt den stündlichen Verlauf von Temperatur und Regen; für heute bis übermorgen darunter, wie sicher Temperatur und Regen sind (7 Modelle ≤ 7 km); danach, solange es reicht (etwa 5 Tage), ICON-EU-EPS (40 Läufe) mit Regenwahrscheinlichkeit; ab dann ECMWF-Hauptlauf (IFS) gegen ECMWF AIFS (KI-Modell, 2 Modelle). „Details“ für Power-User: Luftdruckkarte Europa um 12 Uhr (Isobaren, Hochs/Tiefs), Böen, Sonne, Modellspannen, Einzelmodelle, ICON-D2-EPS.

Parameter (Toleranz, Schwellen, Modellliste) stehen in [`src/lib/config.ts`](src/lib/config.ts).

## Marke

- **Logo:** Münchner Skyline (Frauenkirche, Olympiaturm) mit dezenter Zugspitze im Wettersteingebirge, auf Tiefblau. Quelle: `scripts/brand/logo.cjs` (`node scripts/brand/logo.cjs <ordner>` erzeugt `icon.svg`), App-Icons per `node scripts/brand/app-icons.cjs <ordner> public` (benötigt Playwright).
- **Farben:** Tiefblau `#0F2D4A` (Marke), Isar `#1C7C8C` (Akzent, Links), Föhn `#F2B33D` (Signal); Blau `#2364D2` bleibt Regen vorbehalten.
- **Schrift:** Inter Tight / Inter, IBM Plex Mono für Messwerte.
- **Claim:** „Föhnomenal genial.“

## Icons

Eigene flache, farbige SVG-Icons (`src/components/Icon.tsx`): gelbe Sonne, graue Wolken, blauer Regen.

## Luftdruckkarte

`public/pressure.json` wird im Veröffentlichungs-Workflow alle 6 Stunden von [`scripts/build-pressure.py`](scripts/build-pressure.py) erzeugt: ECMWF-Luftdruck auf Meereshöhe (Open-Meteo) im 2,5°-Raster über Europa, je Tag um 12 Uhr. Isobaren (5 hPa) und Hochs/Tiefs berechnet die App. Ländergrenzen: Natural Earth 1:50m (gemeinfrei), `src/data/europe.json`. Wetterfronten werden nicht dargestellt.

## Trenddaten

`public/trend.json` erzeugt [`scripts/build-trend.py`](scripts/build-trend.py) im Veröffentlichungs-Workflow alle 6 Stunden aus dem ECMWF-Ensemble (Open-Meteo Ensemble-API, `ecmwf_ifs025`). Schlägt der Abruf fehl, bleibt die zuletzt veröffentlichte Datei erhalten.

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
