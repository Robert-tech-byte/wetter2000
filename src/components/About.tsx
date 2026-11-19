import { EPS_MODEL, HIRES_MODELS, MIN_COVERAGE, RAIN_THRESHOLD, TEMP_TOLERANCE } from '../lib/config';
import { fmt1 } from '../lib/format';
import { clock } from '../lib/time';
import { Legend } from './Radar';
import { Logo } from './Logo';

export function About({ updatedAt, loading, onReload }: { updatedAt: Date | null; loading: boolean; onReload: () => void }) {
  return (
    <footer className="about">
      <p className="claim">
        <Logo size={22} />
        <span>
          Wetter<b>2000</b> · Föhnomenal genau.
        </span>
      </p>
      <details className="fold">
        <summary>Quellen &amp; Methode</summary>
        <div className="prose">
          <h3>Treffsicherheit (Punkte)</h3>
          <p>
            Grundlage sind {HIRES_MODELS.length} Wettermodelle mit höchstens 7 km Gitterabstand. Ein Modell zählt für
            einen Tag, wenn es mindestens {Math.round(MIN_COVERAGE * 100)} % der Stunden liefert. Temperatur: Anteil der
            Modelle, die stündlich höchstens ±{fmt1(TEMP_TOLERANCE)} °C vom Median abweichen. Regen: Anteil der Modelle
            mit mindestens einer Stunde ≥ {fmt1(RAIN_THRESHOLD)} mm; „einig“ heißt, wie klar die Mehrheit für Regen
            oder trocken ist. In der Tageszeile zeigen die Punkte den schwächeren der beiden Werte: ●●● ab 80 %, ●●○ ab 50 %,
            sonst ●○○. Eine kleine Zahl daneben bedeutet, dass weniger als 4 Modelle den Tag abdecken. Das Diagramm
            zeigt den Median aller Modelle, die Fläche ihre Spanne.
          </p>
          <p>
            Ab dem vierten Tag reicht von diesen Modellen nur noch ICON-EU (DWD, etwa 120 Stunden). Solange es den Tag zu
            mindestens {Math.round(MIN_COVERAGE * 100)} % abdeckt, wird es mit dem ECMWF-Hauptlauf verglichen: Temperatur =
            Anteil der Stunden, in denen beide höchstens ±{fmt1(TEMP_TOLERANCE)} °C auseinanderliegen; Regen = beide mit
            Regen oder beide trocken (●●●), sonst uneinig (●○○). Mit nur 2 Modellen ist das weniger belastbar als für die
            ersten 3 Tage. Die Fläche im Diagramm zeigt dann den Abstand zwischen ECMWF und ICON-EU.
          </p>
          <p>
            {EPS_MODEL.name} ({EPS_MODEL.members} Läufe) wird gleich berechnet und separat angezeigt. Das Ergebnis ist
            eine Modell-Übereinstimmung, keine kalibrierte Wahrscheinlichkeit.
          </p>
          <h3>Komme ich trocken an?</h3>
          <p>
            Arbeitsort: U-Bahn Schwanthalerhöhe oder Westfriedhof. Das Zuhause liegt in der gewählten Richtung,
            die Entfernung ergibt sich aus Fahrzeit und 20 km/h (gerade Linie). Für jede Minute der Fahrt wird der
            Regen an der Stelle gelesen, an der man dann ungefähr ist. Bis zum Ende des Nowcasts (ca. +60 min) mit
            dem DWD-Radar in 5-Minuten-Schritten, danach mit ICON-D2 in 15-Minuten-Schritten (Streckenmitte, ungenauer). „Trocken“ heißt unter 0,05 mm auf der ganzen Fahrt. Wind: ICON-D2 in 15-Minuten-Schritten an der Streckenmitte, zerlegt in Gegen-, Rücken- und Seitenwind zur Fahrtrichtung; die Zeitangabe ist eine grobe Faustregel. Es wird nichts gespeichert.
          </p>
          <h3>GroWeLa (Großwetterlage)</h3>
          <p>
            Vereinfachte Einordnung aus dem ECMWF-Luftdruck um 12 Uhr. Die Richtung folgt aus dem Druckgefälle über
            Süddeutschland. Zyklonal oder antizyklonal: zuerst nach dem Luftdruck über München (bis 1005 hPa zyklonal,
            ab 1020 hPa antizyklonal), dann nach einem nahen Tief (bis ca. 1000 km) oder Hoch (bis ca. 800 km), erst
            danach nach der Krümmung des Druckfelds. Angelehnt an die objektive Wetterlagenklassifikation des DWD, die
            aber zusätzlich Höhendaten nutzt; die Einordnung hier ist eine Näherung.
          </p>
          <h3>14-Tage-Trend</h3>
          <p>
            ECMWF-Ensemble (Kontrolllauf und 50 Varianten, 0,25°) über Open-Meteo, alle 6 Stunden neu geladen. Je Tag
            werden Höchst- und Tiefstwert jedes Laufs bestimmt. Offener Punkt und Zahl: Median, zur Orientierung verbunden. Dunkler Querstrich: der einzelne ECMWF-Hauptlauf, aus dem die Werte in den Tageszeilen stammen; liegt er weit neben den Strichen, ist er ein Ausreißer. Kräftiger Strich: mittlere 50 %
            der Läufe (wahrscheinlich), feiner Strich: mittlere 80 % (möglich). Regen: Füllung = Median der Tagessumme,
            Rahmen = 90. Perzentil, Zahl darunter = Anteil der Läufe mit mindestens 0,1 mm.
          </p>
          <h3>Föhn</h3>
          <p>
            „Föhn“ erscheint an einem Tag, wenn laut ECMWF-Modell tagsüber mindestens 2 Stunden lang gleichzeitig gilt:
            Luftdruck in Bozen mindestens 4 hPa höher als in München, Wind in etwa 3000 m Höhe aus Süd bis Südwest und
            Luftfeuchte in München unter 55 %. Das ist eine Faustregel, keine Messung.
          </p>
          <h3>Regenradar</h3>
          <p>
            DWD-Radarkomposit in 1-km-Blöcken, alle 5 Minuten: die letzte Stunde gemessen, danach die DWD-Vorhersage
            für 60 Minuten. Zwischen den Bildern wird überblendet.
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
