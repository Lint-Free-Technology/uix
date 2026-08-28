---
title: Background Spark
---
# Background Spark

Der Background Spark fügt einem Element eine Hintergrundebene hinzu. Unterstützt werden unter anderem Farben, Bilder, Videos und Kameraquellen.

## Beispiel

```yaml
forge:
  sparks:
    - type: background
      image: /local/backgrounds/living-room.jpg
      fit: cover
```

## Hinweise

- Hintergrundmedien sollten schnell laden.
- Text und Icons müssen lesbar bleiben.
- Live-Kameras können je nach Gerät Performance kosten.
