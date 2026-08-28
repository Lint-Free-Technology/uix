---
title: Karten
---
# Karten stylen

Mit UIX kannst du CSS direkt an Home-Assistant-Karten anwenden. Der häufigste Einstiegspunkt ist `ha-card`.

```yaml
type: tile
entity: light.bed_light
uix:
  style: |
    ha-card {
      background: red;
      border-radius: 12px;
    }
```

## Typische Ziele

Karten bestehen meist aus einem äußeren `ha-card` und je nach Kartentyp aus weiteren inneren Elementen. Für einfache Anpassungen reicht oft `ha-card`. Für feinere Anpassungen kannst du innere Elemente über CSS-Selektoren ansprechen.

```yaml
type: entities
entities:
  - light.bed_light
uix:
  style: |
    ha-card {
      border: 1px solid var(--divider-color);
      box-shadow: none;
    }
    .card-header {
      font-size: 18px;
    }
```

## Hinweise

- Schreibe UIX-Code im YAML der Karte unter `uix:`.
- Nutze `style: |`, wenn du mehrere CSS-Regeln einfügst.
- Prüfe bei komplexen Karten im Browser-DOM, ob das gewünschte Element innerhalb eines Shadow DOM liegt.
- Wenn eine Karte nicht sofort reagiert, Home Assistant hart neu laden oder den Cache leeren.
