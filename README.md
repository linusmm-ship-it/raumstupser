# Raumstupser fürs iPhone

Webseite: https://linusmm-ship-it.github.io/raumstupser/

Freie Zeitfenster für Griebnitzsee und Golm. Mobile Oberfläche mit Logo, S-Filter, Mindestdauer, Datum und gespeicherter Campus-Auswahl. Der S-Filter ist für Griebnitzsee standardmäßig an und für Golm aus; die Auswahl wird pro Campus gespeichert. In Safari über **Teilen → Zum Home-Bildschirm** hinzufügen.

Die Seite fragt beim Öffnen, bei Rückkehr aus dem Hintergrund, bei wiederhergestellter Internetverbindung und während der Nutzung etwa einmal pro Minute den öffentlichen Live-Datendienst https://raumstupser-daten.spicy-finch-1813.chatgpt.site ab. Dieser ruft die offizielle Uni-API direkt ab und umgeht deren Browser-CORS-Beschränkung. Die Berliner Uhrzeit bestimmt die angezeigten Zeitfenster.

Falls der Live-Abruf ausfällt, wählt die Seite den neuesten gültigen Stand aus GitHub Pages, dem GitHub-Repository und einem lokal gespeicherten Tagesstand. Ersatzstände behalten ihre ursprüngliche Abrufzeit und sind sichtbar gekennzeichnet. Ein falsches Datum, ein falscher Campus oder ein leerer Katalog wird nicht als gültige Verfügbarkeit akzeptiert. Ohne passende Daten zeigt die App eine Störung. GitHub Actions erzeugt zusätzlich Ersatzstände für sieben Tage; der geplante Fünf-Minuten-Takt ist keine Garantie, die tatsächlichen Abstände können mehrere Stunden betragen.

Quelle: dieselbe öffentliche RoomsAPI wie Mobile.UP. Veröffentlicht werden Raumbezeichnung, Beginn/Ende, öffentliche Veranstaltungstitel, PULS-Links und Abrufzeit. Separate Dozierendennamen, Zugangsdaten oder private Daten werden nicht übernommen. Unbelegt laut Raumplan bedeutet keine Buchung; Zugang ist vor Ort zu prüfen.

GitHub Pages veröffentlicht die Seite über GitHub Actions; die Quelle liegt auf `main`. Datenaktualisierung unter **Actions → Raumdaten aktualisieren → Run workflow** manuell starten. GitHub deaktiviert geplante Workflows in öffentlichen Repositories nach längerer Inaktivität (aktuell 60 Tage); bei Bedarf unter Actions wieder aktivieren.

Der Live-Dienst benötigt weder Uni-Login noch Datenbank. Campus, S-Filter und letzte gültige Tagesstände werden lokal im Browser gespeichert. Kein Service Worker.

Wenn die Mobile.UP-API ausfällt oder einen leeren Raumkatalog liefert, liest der GitHub-Workflow datierte öffentliche PULS-Wochenpläne für die verifizierten Raumkennungen ein. Nicht lesbare Pläne werden ausgelassen und gezählt. Die Ersatzquelle wird angezeigt. Fehlende Tages-/Wochenendspalten werden nicht als frei interpretiert. Wenn beide Quellen ausfallen, wird ein vorhandener letzter gültiger Tagesstand mit Warnung erhalten oder eine Störung angezeigt.

Die Suche **Was läuft im Raum?** durchsucht beide Campusse unabhängig von den Filtern der Freiraumsuche. Sie zeigt laufende Veranstaltungen mit Uhrzeiten sowie bis zu zwei folgende Termine am heutigen Tag. Überlappende Termine bleiben sichtbar. Nicht prüfbare Räume werden als unbekannt gekennzeichnet. Die Daten werden nur laut veröffentlichtem Plan ausgewertet, nicht vor Ort erkannt.

Mit **Wunschzeit** lassen sich Von/Bis-Uhrzeiten zum ausgewählten Datum angeben. Ergebnisse sind nur Räume, die den gesamten Zeitraum durchgehend unbelegt sind; die Mindestdauer gilt in diesem Modus nicht. Die Raumsuche nach laufenden Veranstaltungen bleibt auf heute bezogen.
