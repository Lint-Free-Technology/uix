---
title: Attribute Spark
---
# Attribute Spark

Der Attribute Spark setzt, ersetzt oder entfernt Attribute an Elementen innerhalb eines Forge-Elements. Das ist nützlich für Barrierefreiheit, Selektoren oder gezielte UI-Zustände.

## Beispiel

```yaml
forge:
  sparks:
    - type: attribute
      target: ha-card
      attribute: data-room
      value: kitchen
```

## Hinweise

- Attribute können für CSS-Selektoren hilfreich sein.
- Entferne Attribute nur, wenn klar ist, dass Home Assistant sie nicht benötigt.
- Template-Werte können dynamische Attribute erzeugen.
