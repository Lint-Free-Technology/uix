---
title: Button Spark
---
# Button Spark

Der Button Spark fügt einen `ha-button` mit Home-Assistant-Aktionen ein. Er kann vor oder nach einem gefundenen Element platziert werden.

## Beispiel

```yaml
forge:
  sparks:
    - type: button
      text: Öffnen
      action:
        action: more-info
        entity: light.kitchen
```

## Hinweise

- Buttons sollten eine klare Aktion ausführen.
- Icons und Texte können je nach Ziel kombiniert werden.
- Prüfe, ob der Button in kompakten Karten genug Platz hat.
