# Wetter2000

Wettervorhersage für München – React + TypeScript + Vite, gehostet auf GitHub Pages.

## Funktionen

- **Jetzt:** aktuelle Messung der DWD-Station München-Stadt (über Bright Sky), Sonnenauf-/-untergang.
- **Regenradar:** DWD-Radarkomposit RV (1 km, 5 min) der letzten Stunde plus DWD-Nowcast für die nächsten 60 Minuten, mit Zeitleiste, Animation und Regenverlauf für München.
- **Modell-Übereinstimmung (heute bis übermorgen):** 7 hochauflösende Modelle (≤ 7 km: ICON-D2, ICON-EU, ICON-CH1, ICON-CH2, AROME HD, HARMONIE KNMI, HARMONIE DMI) plus das Ensemble ICON-D2-EPS (20 Läufe).
  - Temperatur: Anteil der Modelle innerhalb ±1,5 °C vom stündlichen Median, gemittelt über den Tag.
  - Regen: Anteil der Modelle mit mindestens einer Stunde ≥ 0,1 mm.
  - Ein Modell zählt für einen Tag nur, wenn es ≥ 75 % der Stunden abdeckt.
- **15-Tage-Vorhersage:** ECMWF IFS.

Parameter (Toleranz, Schwellen, Modellliste) stehen in [`src/lib/config.ts`](src/lib/config.ts).

## Datenquellen

- [Open-Meteo](https://open-meteo.com/) – Forecast- und Ensemble-API (CC BY 4.0)
- [Bright Sky](https://brightsky.dev/) – DWD-Messwerte und Radar
- Karte: © OpenStreetMap-Mitwirkende

## Entwicklung

```bash
npm install
npm run dev      # lokal starten
npm test         # Tests
npm run build    # Produktions-Build nach dist/
```

## Deployment

Jeder Push auf `main` baut die App per GitHub Actions und veröffentlicht sie auf GitHub Pages
(`Settings → Pages → Source: GitHub Actions`).
