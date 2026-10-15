# Raumstupser fürs iPhone

Webseite: https://linusmm-ship-it.github.io/raumstupser/

Freie Zeitfenster für Griebnitzsee und Golm. Mobile Oberfläche mit Logo, S-Filter, Mindestdauer, Datum und gespeicherter Campus-Auswahl. Der S-Filter ist für Griebnitzsee standardmäßig an und für Golm aus; die Auswahl wird pro Campus gespeichert. In Safari über **Teilen → Zum Home-Bildschirm** hinzufügen.

Die Seite lädt beim Öffnen, bei Rückkehr aus dem Hintergrund und per Knopfdruck den neuesten veröffentlichten Datenstand. Die Zeitfenster werden dabei mit der aktuellen Berliner Uhrzeit neu berechnet. GitHub Actions ruft etwa alle fünf Minuten öffentliche Uni-Daten für heute und die nächsten sechs Tage ab; GitHub kann die Läufe verzögern. Ein älterer Datenstand wird ausdrücklich gekennzeichnet. Eine sekundengenaue Live-Abfrage beim Öffnen ist ohne zusätzlichen Server nicht möglich, weil die Uni-API Browser-Abfragen von GitHub Pages nicht erlaubt.

Quelle: dieselbe öffentliche RoomsAPI wie Mobile.UP. Veröffentlicht werden nur Raumbezeichnung, Beginn/Ende und Abrufzeit, keine Dozierendennamen, Veranstaltungstitel oder persönlichen Daten. Unbelegt laut Raumplan bedeutet keine Buchung; Zugang ist vor Ort zu prüfen.

GitHub Pages veröffentlicht die Seite über GitHub Actions; die Quelle liegt auf `main`. Datenaktualisierung unter **Actions → Raumdaten aktualisieren → Run workflow** manuell starten. GitHub deaktiviert geplante Workflows in öffentlichen Repositories nach längerer Inaktivität (aktuell 60 Tage); bei Bedarf unter Actions wieder aktivieren.

Ohne zusätzliche Dienste, Login, Tracking, Datenbank oder npm-Abhängigkeiten. Campus und S-Filter werden nur lokal im Browser gespeichert. Kein Service Worker, damit alte Daten nicht unbemerkt offline weiterverwendet werden.

Wenn die Mobile.UP-API ausfällt oder einen leeren Raumkatalog liefert, liest der GitHub-Workflow datierte öffentliche PULS-Wochenpläne für die verifizierten Raumkennungen ein. Nicht lesbare Pläne werden ausgelassen und gezählt. Die Ersatzquelle wird angezeigt. Fehlende Tages-/Wochenendspalten werden nicht als frei interpretiert. Wenn beide Quellen ausfallen, wird ein vorhandener letzter gültiger Tagesstand mit Warnung erhalten oder eine Störung angezeigt.
