---
title: Bilder
---
# Entitätsbilder stylen

UIX kann Bilder von Entitäten und Picture-Elementen anpassen. Das ist nützlich für Avatare, Kamerabilder, Medienbilder oder eigene Visualisierungen.

Typische Anpassungen:

- Größe und Zuschnitt
- Rundung
- Rahmen
- Schatten
- zustandsabhängige Darstellung

## Beispiel

```yaml
type: picture-entity
entity: person.alex
uix:
  style: |
    img {
      border-radius: 50%;
      border: 2px solid var(--primary-color);
    }
```

## Hinweise

- Prüfe, ob das Bild als `img`, `ha-entity-picture` oder innerhalb einer Karte gerendert wird.
- Achte bei Kamerabildern auf Aktualisierung und Ladezeit.
- Nutze `object-fit`, wenn Bilder nicht verzerrt werden sollen.
