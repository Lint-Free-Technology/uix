---
title: Abschnittshintergründe
---
# Abschnittshintergründe

Mit UIX lassen sich Hintergründe für Dashboard-Abschnitte gestalten. Das ist besonders hilfreich bei Section-Views in Home Assistant.

Nutze Abschnittshintergründe sparsam, damit Dashboards lesbar bleiben und Karten nicht mit dem Hintergrund konkurrieren.

## Beispielidee

```yaml
uix:
  style: |
    hui-section {
      background: rgba(0, 0, 0, 0.04);
      border-radius: 12px;
      padding: 8px;
    }
```

## Hinweise

- Prüfe Abschnittsansichten auf Desktop und Mobilgerät.
- Hintergründe sollten Kontrast nicht verschlechtern.
- In produktiven Dashboards sind ruhige Farben meist besser lesbar als starke Effekte.
