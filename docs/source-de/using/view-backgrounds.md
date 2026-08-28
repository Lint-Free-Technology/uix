---
title: Ansichtshintergründe
---
# Ansichtshintergründe

UIX unterstützt Hintergründe für ganze Views, etwa Farben, Bilder, Videos oder Kameras. Je nach Quelle können statische Dateien, Medienquellen oder Entitäten verwendet werden.

Wichtig:

- Auf Lesbarkeit der Karten achten.
- Mobile Darstellung prüfen.
- Medienquellen auf Ladezeit und Datenschutz prüfen.

## Beispielidee

```yaml
uix:
  style: |
    hui-view {
      background: center / cover no-repeat url("/local/backgrounds/home.jpg");
    }
```

## Empfehlungen

- Nutze ausreichend dunkle oder helle Overlays, wenn Karten sonst schwer lesbar sind.
- Verwende lokal gespeicherte Medien, wenn die Ansicht zuverlässig schnell laden soll.
- Bei Video- oder Kamera-Hintergründen vorher prüfen, ob mobile Geräte damit flüssig bleiben.
