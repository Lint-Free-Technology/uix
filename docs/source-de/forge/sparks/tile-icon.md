---
title: Tile Icon Spark
---
# Tile Icon Spark

Der Tile Icon Spark fügt ein `ha-tile-icon` in ein Forge-Element ein. Damit lassen sich Icons nachträglich ergänzen oder neben vorhandenen Elementen positionieren.

## Beispiel

```yaml
forge:
  sparks:
    - type: tile-icon
      icon: mdi:lightbulb
      entity: light.kitchen
```

## Hinweise

- Tile Icons passen besonders gut zu Tile-Karten.
- Zustandsfarben hängen von Entität und Theme ab.
- Für eigene Farben kann zusätzlich UIX Styling verwendet werden.
