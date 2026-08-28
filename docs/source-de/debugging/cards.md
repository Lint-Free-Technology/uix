---
title: Karten debuggen
---
# Karten debuggen

Wenn ein Kartenstil nicht wirkt:

1. Prüfe, ob die Karte UIX-Code enthält.
2. Leere den Browsercache oder lade Home Assistant hart neu.
3. Prüfe den DOM-Zielpfad.
4. Kontrolliere YAML-Einrückung und Template-Ausgaben.

## Prüfliste

- Ist `uix:` auf derselben Ebene wie `type:` und `entity:`?
- Wird die Karte wirklich neu gerendert?
- Greift eine stärkere CSS-Regel aus Theme oder Karte?
- Liegt das Zielelement in einem Shadow Root?
- Wird der Style durch einen späteren Home-Assistant-Render überschrieben?

## Kleine Testregel

Beginne mit einer sichtbaren Regel:

```yaml
uix:
  style: |
    ha-card {
      outline: 3px solid red;
    }
```

Wenn diese Regel wirkt, ist UIX aktiv und das Problem liegt wahrscheinlich im Zielselektor oder in der CSS-Spezifität.
