import { EPS_MODEL, HIRES_MODELS, MIN_COVERAGE, RAIN_THRESHOLD, TEMP_TOLERANCE } from '../lib/config';
import { fmt1 } from '../lib/format';
import { clock } from '../lib/time';
import { Legend } from './Radar';

export function About({ updatedAt, loading, onReload }: { updatedAt: Date | null; loading: boolean; onReload: () => void }) {
  return (
    <footer className="about">
      <details className="fold">
        <summary>Quellen &amp; Methode</summary>
        <div className="prose">
          <h3>Treffsicherheit (Punkte)</h3>
          <p>
            Grundlage sind {HIRES_MODELS.length} Wettermodelle mit höchstens 7 km Gitterabstand. Ein Modell zählt für
            einen Tag, wenn es mindestens {Math.round(MIN_COVERAGE * 100)} % der Stunden liefert. Temperatur: Anteil der
            Modelle, die stündlich höchstens ±{fmt1(TEMP_TOLERANCE)} °C vom Median abweichen. Regen: Anteil der Modelle
            mit mindestens einer Stunde ≥ {fmt1(RAIN_THRESHOLD)} mm; „einig“ heißt, wie klar die Mehrheit für Regen
            oder trocken ist. Die Punkte zeigen den schwächeren der beiden Werte: ●●● ab 80 %, ●●○ ab 50 %, sonst ●○○.
            Eine kleine Zahl daneben bedeutet, dass weniger als 4 Modelle den Tag abdecken.
          </p>
          <p>
            {EPS_MODEL.name} ({EPS_MODEL.members} Läufe) wird gleich berechnet und separat angezeigt. Das Ergebnis ist
            eine Modell-Übereinstimmung, keine kalibrierte Wahrscheinlichkeit.
          </p>
          <h3>Regenradar</h3>
          <p>
            DWD-Radarkomposit (1 km, alle 5 Minuten): die letzte Stunde gemessen, danach die DWD-Vorhersage für 60
            Minuten. Zwischen den Bildern wird weich überblendet.
          </p>
          <Legend />
          <h3>Daten</h3>
          <p>
            <a href="https://open-meteo.com/">Open-Meteo</a> (CC BY 4.0) mit Modellen von ECMWF, DWD, MeteoSchweiz,
            Météo-France, KNMI und DMI · <a href="https://brightsky.dev/">Bright Sky</a> mit Daten des{' '}
            <a href="https://www.dwd.de/">Deutschen Wetterdienstes</a> · Karte: ©{' '}
            <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>-Mitwirkende (ODbL), vereinfacht.
          </p>
          <p>Alle Angaben ohne Gewähr. Keine amtlichen Warnungen.</p>
        </div>
      </details>
      <p className="stand">
        {updatedAt ? `Stand ${clock(updatedAt)} Uhr` : 'Wird geladen …'}
        <button type="button" className="link" onClick={onReload} disabled={loading}>
          {loading ? 'lädt …' : 'aktualisieren'}
        </button>
      </p>
    </footer>
  );
}
