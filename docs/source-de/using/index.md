---
title: UIX Styling
description: UI eXtension Styling in Home Assistant verwenden.
---
# UIX Styling verwenden

UIX Styling erlaubt CSS-Anpassungen an fast allen sichtbaren Elementen der Home-Assistant-Oberfläche. Du kannst Karten, Zeilen, Badges, Icons, Bilder, Abschnitte, Ansichten und Theme-Variablen gezielt anpassen.

## Themen

- :bar_chart: [Karten stylen](./cards.md)
- :bulb: [Entitäten, Badges, Elemente und Marker stylen](./entities.md)
- :red_circle: [Icons stylen](./icons.md)
- :adult: [Entitätsbilder stylen](./images.md)
- :white_square_button: [Abschnittshintergründe](./section-backgrounds.md)
- :film_frames: [Ansichtshintergründe mit Kamera, Video oder Bild](./view-backgrounds.md)
- :clipboard: [Templates](./templates.md)
- :art: [Themes](./themes.md)
- :hammer_and_pick: [Weitere Optionen](./other.md)

## Grundprinzip

UIX-Konfiguration wird meist direkt in YAML unter `uix:` geschrieben:

```yaml
uix:
  style: |
    ha-card {
      border-radius: 12px;
    }
```

Je nach Element kann UIX andere DOM-Ziele ansprechen, verschachtelte Shadow-Roots erreichen und Templates auswerten.
