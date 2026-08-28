---
title: Anwendung
---
# Anwendungskonzept

UIX wird als Home-Assistant-Integration installiert und stellt Frontend-Ressourcen bereit. Dadurch muss keine manuelle Ressource in Lovelace gepflegt werden.

Die Integration lädt UIX im Frontend, beobachtet relevante Home-Assistant-Elemente und wendet Styling, Templates oder Forge-Konfigurationen an.

## Ablauf im Frontend

1. Home Assistant lädt die UIX-Integration.
2. UIX stellt seine JavaScript-Ressource bereit.
3. Das Frontend lädt UIX zusammen mit der Oberfläche.
4. UIX sucht passende Konfigurationen in Karten, Themes oder Forge-Elementen.
5. Änderungen werden angewendet und bei Zustandsänderungen aktualisiert.

## Cache und Updates

Nach einem UIX-Update kann der Browser noch alte Ressourcen verwenden. UIX zeigt dann nach Möglichkeit eine Reload-Meldung. Wenn Änderungen trotzdem nicht sichtbar werden, hilft ein harter Reload oder das Leeren des App-Caches.
