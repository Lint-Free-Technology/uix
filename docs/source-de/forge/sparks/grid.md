---
title: Grid Spark
---
# Grid Spark

Der Grid Spark wendet CSS Grid auf einen Container innerhalb eines Forge-Elements an. Damit lassen sich interne Layouts sauber strukturieren.

## Beispiel

```yaml
forge:
  sparks:
    - type: grid
      target: ha-card
      columns: 2
      gap: 8px
```

## Hinweise

- Grid eignet sich für klar strukturierte Kacheln.
- Definiere Spalten und Abstände bewusst.
- Prüfe kleine Displays, damit Inhalte nicht zu eng werden.
