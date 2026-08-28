---
title: DOM
---
# DOM-Konzept

Home Assistant rendert viele Elemente in Web Components und Shadow DOM. UIX bietet Hilfen, um trotzdem gezielt Elemente zu finden und zu stylen.

Wichtige Begriffe:

- **Host**: das Web-Component-Element.
- **Shadow Root**: interner DOM-Bereich eines Web Components.
- **Selector**: CSS-Ausdruck, mit dem UIX ein Ziel findet.
- **Express Search Selector**: verkürzte UIX-Syntax für häufige Suchpfade.

## Warum DOM-Pfade wichtig sind

Viele Home-Assistant-Karten sind aus mehreren Web Components aufgebaut. Ein sichtbares Element liegt deshalb oft nicht direkt im normalen HTML, sondern innerhalb einer oder mehrerer Shadow-Root-Ebenen. UIX hilft dabei, diese Ebenen gezielt zu erreichen.

## Arbeitsweise

1. Öffne die Entwicklerwerkzeuge des Browsers.
2. Suche das sichtbare Ziel, zum Beispiel Icon, Zeile oder Text.
3. Ermittle den Weg über Host-Elemente und Shadow Roots.
4. Übertrage diesen Weg in deine UIX-Konfiguration.

## Tipps

- Nutze stabile Elementnamen statt automatisch erzeugter Klassen.
- Prüfe Selektoren nach Home-Assistant-Updates.
- Halte DOM-Pfade so kurz wie möglich.
- Wenn UIX nichts findet, kann das Ziel noch nicht gerendert sein oder in einem anderen Shadow Root liegen.
