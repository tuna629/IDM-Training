# IDM Forschungsmethoden – Prüfungstrainer

Statische Website für GitHub Pages. Kein API-Key und kein Server notwendig.

## Auf GitHub veröffentlichen

1. Auf GitHub ein neues Repository anlegen, z. B. `forschungsmethoden-trainer`.
2. Die Dateien aus diesem Ordner in das Repository hochladen und committen.
3. Im Repository **Settings → Pages** öffnen.
4. Unter **Build and deployment** `Deploy from a branch` wählen.
5. Branch `main`, Ordner `/ (root)` auswählen und speichern.
6. Nach kurzer Zeit zeigt GitHub oben die veröffentlichte Adresse an.

Typisch sieht sie so aus:
`https://DEIN-GITHUB-NAME.github.io/forschungsmethoden-trainer/`

## iPhone/iPad

Website in Safari öffnen → Teilen → **Zum Home-Bildschirm**.
Die Seite enthält außerdem einen Service Worker und kann nach dem ersten Laden weitgehend offline funktionieren.

## Was der Trainer kann

- 20 Fragen pro Test
- Checkboxen / Mehrfachauswahl
- IDM-artige Teilpunkte
- unmittelbare Auswertung
- Nur Fehler anzeigen
- Test erneut versuchen, ohne den alten Versuch zu überschreiben
- alte Tests im Verlauf
- neue Tests ohne stilles Wiederverwenden bereits erzeugter Fragen
- Bereiche: gesamtes Skript, qualitativ, quantitativ, Statistik & Testverfahren
- lokaler Lernfortschritt via `localStorage`

## Wichtig zur Neuheit der Fragen

Die Seite erzeugt Fragen kombinatorisch aus einem großen, skriptbasierten Begriffs- und Szenarienpool.
Die konkrete Frage-ID wird unabhängig von der Reihenfolge der Antwortmöglichkeiten gespeichert. Ein bloßes Umsortieren der Optionen zählt daher **nicht** als neue Frage.

Der Verlauf gilt pro Browser/Gerät. Wer Browserdaten löscht oder ein anderes Gerät verwendet, startet einen neuen lokalen Verlauf.

## Inhalte erweitern

Die Wissensbasis liegt in `bank.js`; die Generierungslogik in `app.js`.
