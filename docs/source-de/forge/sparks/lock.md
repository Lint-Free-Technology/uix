---
title: Lock Spark
---
# Lock Spark

Der Lock Spark legt eine Sperre über ein Element. Benutzer müssen dann eine PIN, Passphrase oder Bestätigung ausführen, bevor die darunterliegende Interaktion möglich ist.

## Beispielidee

```yaml
forge:
  sparks:
    - type: lock
      mode: confirm
      text: Aktion bestätigen
```

## Hinweise

- Geeignet für kritische Schalter oder Szenen.
- Eine Sperre ersetzt keine echte Backend-Sicherheit.
- Für gemeinsam genutzte Dashboards klare Texte verwenden.
