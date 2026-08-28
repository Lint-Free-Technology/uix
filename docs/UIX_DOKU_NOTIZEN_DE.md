# UIX Dokumentation - Notizen

Quelle: https://uix.lf.technology/contributing/

## Allgemein

Beitraege zu UI eXtension sind willkommen: Integration-Code, Frontend-Code
oder Aktualisierungen an der Dokumentation.

## Integration

Der Hauptzweck der Integration ist es, Updates der Frontend-Ressource zu
verwalten. Als Home-Assistant-Integration kann UIX aber auch Dienste anbieten,
die mit der Frontend-Ressource kommunizieren.

Wenn neue Ideen fuer UIX-Dienste entstehen, soll ein Pull Request erstellt
werden. Wenn die Idee noch unsicher ist, zuerst eine GitHub Discussion starten.

### Integration entwickeln

Fuer erfahrene Integration-Entwickler ist der empfohlene Weg, den Ordner
`custom_components/uix` in einen Home-Assistant-Core-Dev-Container einzubinden.

Beim Testen beachten:

- Versionsnummer in `package.json` mit Entwicklungs-Tag anpassen, zum Beispiel `5.0.1-mydev.1`.
- `npm run build` ausfuehren; dadurch wird die Version in `manifest.json` aktualisiert und `uix.js` gebaut.
- Home Assistant im Dev-Container neu starten.

Wichtig: Wenn Integration und Frontend-Ressource nicht sauber gemeinsam gebaut
und aktualisiert werden, kann UIX in einen uneindeutigen Zustand geraten.
Moegliche Folgen sind nicht sichtbare Aenderungen, wiederholte Reload-Warnungen
oder notwendiges Leeren von Frontend-Caches.

## Frontend

Die Frontend-JavaScript-Ressource ist der zentrale Teil von UIX. Neue UIX-
Funktionen oder Home-Assistant-Elemente, die von UIX gepatcht werden sollen,
koennen per Pull Request vorgeschlagen werden. Bei Unsicherheit zuerst eine
GitHub Discussion starten.

### Frontend entwickeln

Wenn ein Home-Assistant-Dev-Container vorhanden ist, denselben Ablauf wie bei
der Integration verwenden. Ohne Dev-Container beim Testen:

- Versionsnummer in `package.json` mit Entwicklungs-Tag anpassen, zum Beispiel `5.0.1-mydev.1`.
- `npm run build` ausfuehren; dadurch wird `manifest.json` aktualisiert und `uix.js` kompiliert.
- `uix.js` und `manifest.json` nach `custom_components/uix` kopieren.
- Home Assistant neu starten.

Auch hier gilt: Wenn Frontend-Ressource und Integration nicht zusammenpassen,
koennen Aenderungen wirkungslos bleiben, Reload-Warnungen erscheinen oder
Frontend-Caches muessen geleert werden.

## Dokumentation bearbeiten

Die UIX-Dokumentation ist ein Bereich, in dem alle UIX-Nutzer beitragen koennen.
Wenn Python in der Umgebung installiert ist, koennen die Markdown-Quelldateien
bearbeitet und die Ergebnisse lokal in Echtzeit angesehen werden.

## Dokumentation lokal starten

Die UIX-Dokumentation wird aus Markdown-Quelldateien mit Zensical gebaut.

Empfohlener Ablauf:

```bash
python3 -m venv .venv
source .venv/bin/activate
pip3 install zensical
cd docs
zensical serve
```

Danach ist die Dokumentationsseite lokal erreichbar unter:

```text
http://localhost:8000
```

Ein anderer Host oder Port kann mit `--dev-addr` angegeben werden.
Beispiel:

```bash
zensical serve localhost:9000
```

## Pull Requests

- `uix.js` nicht in Pull Requests committen.
- Die Ressourcendatei wird beim Release gebaut.
- UIX ist eine Integration; deshalb kann `uix.js` nicht als Release Asset genutzt werden, sondern muss im Ordner `custom_components/uix` liegen.
- Bei neuen visuellen Komponenten Tests beilegen.
- Weitere Hinweise stehen in `tests/README.md`.
- Commit-Namen nach Conventional Commits verwenden, soweit moeglich.
- Pull Requests werden zwar gesquasht und der Titel kann angepasst werden, die Konvention bleibt trotzdem hilfreich.
- Bei Breaking Changes im Commit-Footer oder Pull Request `BREAKING CHANGE: ...` angeben.
- Geschlossene oder reparierte Issues im Commit-Footer oder Pull Request referenzieren, zum Beispiel `fixes #1234`.
