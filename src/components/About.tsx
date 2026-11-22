import { AIFS_MODEL, EPS_MODEL, EU_EPS_MODEL, HIRES_MODELS, MIN_COVERAGE, RAIN_THRESHOLD, TEMP_TOLERANCE } from '../lib/config';
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
          Wetter<b>2000</b> · Föhnomenal genial.
        </span>
      </p>
      <details className="fold">
        <summary>Quellen &amp; Methode</summary>
        <div className="prose">
          <h3>Tendenz</h3>
          <p>
            Der Pfeil neben der Temperatur vergleicht den aktuellen Messwert der DWD-Station München-Stadt mit dem Wert
            derselben Station von vor einer Stunde (Bright Sky; meldet die Station halbstündlich, wird zwischen den beiden stündlichen Messungen davor und danach gemittelt): ↑ ab +0,5 °C, ↓ ab −0,5 °C, sonst →. Antippen zeigt die
            genaue Änderung. Fehlt der Vergleichswert, erscheint kein Pfeil.
          </p>
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
            Ab dem vierten Tag nutzt die Treffsicherheit {EU_EPS_MODEL.name} ({EU_EPS_MODEL.provider}, {EU_EPS_MODEL.members}{' '}
            Läufe, etwa {fmt1(EU_EPS_MODEL.resolutionKm)} km), solange es reicht (etwa 5 Tage), nach denselben Regeln wie oben,
            nur über Läufe statt Modelle; die Regen-Spalte zeigt dann den Anteil der Läufe mit Regen. Danach wird der
            ECMWF-Hauptlauf (IFS) mit {AIFS_MODEL.name} verglichen, dem KI-Modell von ECMWF (etwa {AIFS_MODEL.resolutionKm} km):
            Temperatur = Anteil der Stunden, in denen beide höchstens ±{fmt1(TEMP_TOLERANCE)} °C auseinanderliegen; Regen =
            beide mit Regen oder beide trocken (●●●), sonst uneinig (●○○). Beide stammen von ECMWF und starten vom selben
            Zustand der Atmosphäre; das ist weniger belastbar als ein Vergleich vieler Modelle. Die Werte in den Zeilen
            bleiben die des ECMWF-Hauptlaufs.
          </p>
          <p>
            {EPS_MODEL.name} ({EPS_MODEL.members} Läufe) wird gleich berechnet und separat angezeigt. Das Ergebnis ist
            eine Modell-Übereinstimmung, keine kalibrierte Wahrscheinlichkeit.
          </p>
          <h3>Komme ich trocken an?</h3>
          <p>
            Arbeitsort: U-Bahn Schwanthalerhöhe, Westfriedhof oder Universität. Das Zuhause liegt in der gewählten Richtung,
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
          <h3>15 Tage</h3>
          <p>
            ECMWF-Ensemble (Kontrolllauf und 50 Varianten, 0,25°) über Open-Meteo, alle 6 Stunden neu geladen, heute
            eingeschlossen. Je Tag werden Höchst- und Tiefstwert sowie die Regensumme jedes Laufs bestimmt; gezeigt wird
            jeweils der mittlere Wert aller Läufe (Median) als wahrscheinlichster Wert. Rot: Höchstwert, blau: Tiefstwert.
            Säule und Zahl darüber: Regenmenge in mm (Median; rechnet höchstens die Hälfte der Läufe mit Regen, ist sie
            meist 0 und entfällt). Zahl darunter: Anteil der Läufe mit mindestens 0,1 mm Regen am Tag. Gestaltet nach den
            Band über dem Regen: Bewölkung in 3-Stunden-Abschnitten (mittlerer Wert der Läufe), gelb = sonnig, hell- bis dunkelgrau = zunehmend bewölkt; nachts gedämpft, dunkelblau = klar. Tag und Nacht nach Sonnenauf- und -untergang. Prinzipien von Dieter Rams: nur die nötigen Angaben, die Nulllinie als einzige Hilfslinie. Antippen eines Tages öffnet ihn in der Tagesliste.
          </p>
          <h3>Föhn</h3>
          <p>
            „Föhn“ erscheint an einem Tag, wenn laut ECMWF-Modell tagsüber mindestens 2 Stunden lang gleichzeitig gilt:
            Luftdruck in Bozen mindestens 4 hPa höher als in München, Wind in etwa 3000 m Höhe aus Süd bis Südwest und
            Luftfeuchte in München unter 55 %. Das ist eine Faustregel, keine Messung.
          </p>
          <h3>Regenradar</h3>
          <p>
            DWD-Radarkomposit mit 1 km Auflösung, zwischen den Messpunkten weich interpoliert (keine feineren Details als 1 km), alle 5 Minuten. Werte unter 0,3 mm/h (die beiden kleinsten Stufen der DWD-Daten) sind auf der Karte ausgeblendet; dabei kommt meist kein spürbarer Regen an. Zeitleiste: die letzte Stunde gemessen, danach die DWD-Vorhersage
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
