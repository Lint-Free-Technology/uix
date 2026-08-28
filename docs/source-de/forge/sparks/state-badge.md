---
title: State Badge Spark
---
# State Badge Spark

Der State Badge Spark fügt ein Home-Assistant-Status-Badge ein. Das ist hilfreich, wenn ein erzeugtes Element eine kompakte Zustandsanzeige bekommen soll.

## Beispiel

```yaml
forge:
  sparks:
    - type: state-badge
      entity: sensor.temperature
```

## Hinweise

- State Badges sind kompakt und eignen sich für Statusübersichten.
- Die Darstellung folgt grundsätzlich Home-Assistant-Logik.
- Mit Styling kann das Badge farblich an die Karte angepasst werden.
