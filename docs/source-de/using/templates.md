---
title: Templates
---
# Templates

UIX kann Templates auswerten, um Styles und Konfigurationen dynamisch zu machen. Das ist nützlich für Zustände, Benutzer, Hash-Werte oder wiederverwendbare Makros.

Beispiel:

```yaml
uix:
  style: |
    ha-card {
      background: "{{ 'red' if is_state('light.bed_light', 'on') else 'gray' }}";
    }
```

## Makros und Wiederverwendung

Templates helfen, wiederkehrende Logik nicht mehrfach im Dashboard-YAML zu duplizieren. Typische Beispiele sind Farbentscheidungen, Sichtbarkeit, Texte oder CSS-Werte.

```yaml
uix:
  style: |
    ha-card {
      opacity: {{ 1 if is_state('binary_sensor.home', 'on') else 0.45 }};
    }
```

## Hinweise

- Template-Ausgaben müssen gültiges CSS oder gültige YAML-Werte ergeben.
- Strings brauchen je nach Kontext Anführungszeichen.
- Bei Fehlern zuerst eine einfache feste Ausgabe testen und danach die Bedingung ergänzen.
