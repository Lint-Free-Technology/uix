---
title: Karten entwickeln
---
# Karten entwickeln

Eigene Karten sollten stabile DOM-Strukturen und nachvollziehbare Attribute verwenden. Dadurch kann UIX Elemente zuverlässiger finden und stylen.

Empfehlungen:

- keine unnötig wechselnden Klassennamen
- klare Shadow-DOM-Struktur
- sinnvolle Teile und Slots
- stabile Updates bei Zustandsänderungen

## UIX-freundliche Karten

Eine Karte ist gut mit UIX nutzbar, wenn sie erkennbare DOM-Strukturen besitzt. Elementnamen, Slots, Parts und sinnvolle Attribute sind hilfreicher als zufällig generierte Klassen.

## Empfehlungen

- Nutze sprechende interne Elemente.
- Vermeide unnötiges komplettes Neuaufbauen des DOM.
- Aktualisiere gezielt nur die Bereiche, die sich ändern.
- Dokumentiere wichtige Styling-Ziele.
- Prüfe die Karte mit UIX-Styles in Light und Dark Mode.
