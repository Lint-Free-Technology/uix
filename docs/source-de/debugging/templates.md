---
title: Templates debuggen
---
# Templates debuggen

Templates können mit UIX-Debug-Ausgaben untersucht werden. Typische Probleme sind falsche Entitätsnamen, unerwartete `none`-Werte oder ungültige YAML-Strings.

## Vorgehen

1. Ersetze die Template-Ausgabe testweise durch einen festen Wert.
2. Prüfe, ob die CSS-Regel dann wirkt.
3. Füge die Template-Bedingung wieder ein.
4. Kontrolliere Anführungszeichen und Datentypen.

## Beispiel

```yaml
uix:
  style: |
    ha-card {
      opacity: {{ 1 if is_state('light.bed_light', 'on') else 0.4 }};
    }
```

Wenn ein Template nichts ausgibt, entsteht oft ungültiges CSS. Dann sollte ein Fallback-Wert ergänzt werden.
