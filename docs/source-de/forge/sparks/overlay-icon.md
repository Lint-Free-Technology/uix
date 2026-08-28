---
title: Overlay Icon Spark
---
# Overlay Icon Spark

Der Overlay Icon Spark legt ein Icon über ein Element. Das eignet sich für Statushinweise, Warnungen oder zusätzliche visuelle Markierungen.

## Beispiel

```yaml
forge:
  sparks:
    - type: overlay-icon
      icon: mdi:alert
      position: top-right
```

## Hinweise

- Overlay-Icons sollten den Inhalt nicht verdecken.
- Nutze klare Positionen und ausreichend Kontrast.
- Für dynamische Icons kann ein Template genutzt werden.
