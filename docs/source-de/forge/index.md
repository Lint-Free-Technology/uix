---
title: UIX Forge
description: Überblick über UIX Forge, Molds, Foundries und Sparks.
---
# UIX Forge

UIX Forge erzeugt Home-Assistant-Elemente dynamisch. Du definierst eine `forge`-Konfiguration, ein Ziel-`element` und optional zusätzliche `sparks`, die Verhalten oder Darstellung erweitern.

Unterstützte Elementtypen sind unter anderem Karten, Badges, Zeilen, Abschnitte und Picture-Elements. Cross-Context-Molds erlauben, ein Element in einem anderen Kontext zu verwenden, zum Beispiel eine Karte als Zeile in einer Entities-Karte.

Für die vollständige Konfigurationsreferenz siehe [Forge-Referenz](./forge.md).

## Foundries

Eine **Foundry** ist eine servergespeicherte UIX-Forge-Vorlage. Damit kannst du `forge`, `element` und `uix` einmal definieren und an vielen Stellen wiederverwenden. Lokal überschreibst du nur die Werte, die sich unterscheiden.

Mehr dazu: [Foundries](./foundries.md)

## Sparks

Sparks sind optionale Bausteine in `forge.sparks`. Jeder Spark hat einen `type` und eigene Optionen.

Verfügbare Sparks:

- :speech_balloon: [Tooltip](./sparks/tooltip.md) - Tooltip an ein Element hängen.
- :material-button-cursor: [Button](./sparks/button.md) - Button mit Aktionen einfügen.
- :label: [Attribute](./sparks/attribute.md) - Attribute hinzufügen, ersetzen oder entfernen.
- :zap: [Event](./sparks/event.md) - DOM-Events aufnehmen und als Template-Variablen nutzen.
- :star: [Tile Icon](./sparks/tile-icon.md) - `ha-tile-icon` ergänzen.
- :shield: [State Badge](./sparks/state-badge.md) - Status-Badge einfügen.
- :material-grid: [Grid](./sparks/grid.md) - CSS Grid auf Container anwenden.
- :mag: [Search](./sparks/search.md) - Elemente per CSS-Selektor suchen und verändern.
- :material-map: [Map](./sparks/map.md) - Kartenansicht stabil halten.
- :material-lock: [Lock](./sparks/lock.md) - Interaktion per Sperre schützen.
- :material-star-four-points-outline: [Overlay Icon](./sparks/overlay-icon.md) - Icon über ein Element legen.
- :material-image-outline: [Background](./sparks/background.md) - Hintergrundfarbe, Bild, Video oder Kamera einfügen.
- :material-palette: [Theme](./sparks/theme.md) - Theme auf ein Element anwenden.
