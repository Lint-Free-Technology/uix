---
title: Search Spark
---
# Search Spark

Der Search Spark sucht Elemente über CSS-Selektoren und optionalen Textinhalt. Gefundene Elemente können anschließend verändert werden.

## Beispielidee

```yaml
forge:
  sparks:
    - type: search
      target: ha-card
      selector: ha-icon
```

## Hinweise

- Suche so eng wie möglich, damit nicht zu viele Elemente geändert werden.
- Textsuche ist praktisch, aber empfindlicher bei Übersetzungen.
- Bei dynamischen Karten kann ein späterer Render neue Suche nötig machen.
