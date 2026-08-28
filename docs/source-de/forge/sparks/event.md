---
title: Event Spark
---
# Event Spark

Der Event Spark nimmt DOM-Events aus `fire-dom-event`-Aktionen auf und stellt Eventdaten als Template-Variablen bereit.

## Beispielidee

```yaml
forge:
  sparks:
    - type: event
      event_type: my-uix-event
```

## Hinweise

- Events eignen sich für Interaktion zwischen Karten.
- Namen sollten eindeutig sein.
- Prüfe in der Browserkonsole, ob Events wirklich ausgelöst werden.
