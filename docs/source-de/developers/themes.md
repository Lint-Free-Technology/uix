---
title: Themes entwickeln
---
# Themes entwickeln

Themes können UIX-Variablen bereitstellen und dadurch wiederverwendbare Styling-Regeln ermöglichen.

## Empfehlungen

- Theme-Variablen klar benennen.
- Globale Regeln sparsam halten.
- Lokale Kartenregeln nicht unnötig durch Themes erschweren.
- Dark-Mode-Werte immer mitprüfen.

## Beispiel

```yaml
my_theme:
  uix-card-yaml: |
    ha-card {
      box-shadow: none;
    }
```
