---
title: Icons
---
# Icons stylen

UIX kann Icon-Farbe, Größe und Darstellung abhängig von Entität, Zustand oder Theme anpassen.

Beispiel:

```yaml
uix:
  style: |
    ha-state-icon {
      color: red;
    }
```

Für zustandsabhängige Farben können Templates verwendet werden.

## Zustandsabhängiges Beispiel

```yaml
type: tile
entity: light.bed_light
uix:
  style: |
    ha-state-icon {
      color: {{ 'gold' if is_state('light.bed_light', 'on') else 'gray' }};
    }
```

## Hinweise

- Nutze `ha-state-icon` für viele moderne Karten.
- Bei älteren oder speziellen Karten kann das Ziel abweichen.
- Icon-Farben können durch Home-Assistant-Themes oder Kartenlogik überschrieben werden.
- UIX kann gezielt pro Entität arbeiten, wenn mehrere Icons in einer Karte vorhanden sind.
