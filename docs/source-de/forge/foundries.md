---
title: Foundries
---
# Foundries

Foundries sind serverseitig gespeicherte Forge-Vorlagen. Sie helfen, komplexe Forge-Konfigurationen nur einmal zu definieren und an vielen Stellen wiederzuverwenden.

Typischer Ablauf:

1. Foundry definieren.
2. Foundry per Schlüssel referenzieren.
3. Lokale Werte nur bei Bedarf überschreiben.

## Warum Foundries nützlich sind

Ohne Foundries wiederholt sich komplexes YAML schnell in vielen Dashboards. Mit einer Foundry liegt die Grundstruktur zentral vor, während Karten nur noch Parameter oder Überschreibungen enthalten.

## Beispielidee

```yaml
type: custom:uix-forge
forge:
  foundry: room_tile
element:
  entity: light.kitchen
```

## Hinweise

- Foundries sollten klare Namen haben.
- Lokale Overrides sollten klein bleiben.
- Änderungen an einer Foundry wirken auf alle Verwendungen.
- Vor größeren Änderungen empfiehlt sich ein Backup der Foundry-Konfiguration.
