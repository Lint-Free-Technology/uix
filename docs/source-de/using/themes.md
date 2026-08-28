---
title: Themes
---
# Themes

UIX kann mit Home-Assistant-Themes zusammenarbeiten und zusätzliche Theme-Variablen auswerten. Dadurch lassen sich globale oder lokale Designregeln zentral pflegen.

Typische Einsatzfälle:

- Kartenstile je Theme
- Dialog- und More-info-Styling
- wiederverwendbare CSS-Blöcke
- Template-basierte Theme-Werte

## Beispielidee

```yaml
my_theme:
  uix-card-yaml: |
    ha-card {
      border-radius: 12px;
      box-shadow: none;
    }
```

## Hinweise

- Themes eignen sich für globale Regeln.
- Karten-UIX eignet sich für lokale Sonderfälle.
- Lokale Regeln sollten globale Theme-Regeln nur bewusst überschreiben.
