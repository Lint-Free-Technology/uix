---
title: Entitäten
---
# Entitäten, Badges und Elemente stylen

UIX kann nicht nur ganze Karten, sondern auch Zeilen, Badges, Picture-Elements und Marker ansprechen. Entscheidend ist der richtige Selektor für das jeweilige Home-Assistant-Element.

Typischer Ablauf:

1. Ziel im DOM finden.
2. UIX-Selektor formulieren.
3. CSS-Regeln unter `uix.style` ergänzen.
4. In Home Assistant prüfen, ob das Element verzögert gerendert wird.

## Beispiel

```yaml
type: entities
entities:
  - entity: sensor.temperature
    name: Temperatur
uix:
  style: |
    hui-sensor-entity-row {
      color: var(--primary-color);
    }
```

## Gute Praxis

- Beginne mit einem breiten Selektor und grenze danach ein.
- Vermeide fragile Selektoren, die von zufälligen internen Klassennamen abhängen.
- Dokumentiere besondere DOM-Pfade direkt im Dashboard-YAML.
- Teste nach Home-Assistant-Updates, weil interne Komponentenstrukturen wechseln können.
