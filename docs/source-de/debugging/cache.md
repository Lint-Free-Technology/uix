---
title: Cache
---
# Cache-Probleme

Nach Updates kann der Browser oder die Companion App alte Ressourcen behalten. In diesem Fall:

- Home Assistant neu laden.
- Browser hart neu laden.
- Companion-App-Cache leeren.
- Prüfen, ob UIX eine Reload-Meldung zeigt.

## Typische Anzeichen

- Alte Styles bleiben sichtbar.
- Neue YAML-Regeln wirken erst nach mehreren Reloads.
- Desktop-Browser und Companion App zeigen unterschiedliche Ergebnisse.
- Nach einem UIX-Update erscheint kurz eine Reload-Meldung.

## Empfehlung

Erst Home Assistant neu laden, dann den Browser hart neu laden. In der Companion App kann zusätzlich das Leeren des Frontend-Caches nötig sein.
