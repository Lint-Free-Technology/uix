---
title: Forge-Referenz
---
# Forge-Referenz

UIX Forge nutzt eine Konfiguration mit `forge`, `element` und optional `uix`.

Minimalbeispiel:

```yaml
type: custom:uix-forge
forge:
  mold: card
element:
  type: tile
  entity: sun.sun
```

## Aufbau

- `type: custom:uix-forge` aktiviert das Forge-Element.
- `forge.mold` legt fest, in welchem Kontext das Element erzeugt wird.
- `element` enthält die eigentliche Home-Assistant-Konfiguration.
- `uix` kann zusätzlich Styling auf das erzeugte Element anwenden.
- `forge.sparks` ergänzt optionale Verhalten.

## Häufige Molds

| Mold | Zweck |
| --- | --- |
| `card` | erzeugt eine Lovelace-Karte |
| `row` | erzeugt eine Zeile für Entities-Karten |
| `badge` | erzeugt ein Badge |
| `section` | erzeugt einen Abschnitt |
| `picture-element` | erzeugt ein Element für Picture-Elements |

## Template-Werte

Viele Forge-Werte können Templates enthalten. Dadurch lassen sich Sichtbarkeit, Entitäten, Icons, Texte und Layoutwerte abhängig vom Home-Assistant-Zustand steuern.

```yaml
forge:
  mold: card
  hidden: "{{ is_state('input_boolean.hide_card', 'on') }}"
element:
  type: tile
  entity: "{{ states('input_text.target_entity') }}"
```

## Fehler vermeiden

- Achte auf gültiges YAML.
- Verwende Fallback-Werte in Templates.
- Teste zunächst ohne Sparks und ergänze sie danach.
- Schalte `show_error` nur dann aus, wenn Fehler bewusst verborgen werden sollen.
