---
title: Tooltip Spark
---
# Tooltip Spark

Der Tooltip Spark hängt einen erklärenden Hinweis an ein Element innerhalb eines Forge-Elements. Er eignet sich für kurze Hilfetexte, Zustandsinformationen oder kontextbezogene Hinweise.

## Beispiel

```yaml
forge:
  sparks:
    - type: tooltip
      text: "Weitere Informationen"
      target: ha-card
```

## Hinweise

- Tooltips sollten kurz sein.
- Der Zielselektor muss ein Element im Forge-Element finden.
- Für längere Inhalte ist ein Button mit More-info oft besser geeignet.
