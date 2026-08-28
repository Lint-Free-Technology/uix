---
title: Schnellstart
description: Einstieg in UI eXtension für Home Assistant.
---
# Schnellstart

!!! note inline end "Für Card-mod-Nutzer"
    Wenn du von Card-mod kommst, lies zusätzlich die [FAQ](./faq.md). UIX unterstützt viele Card-mod-Konfigurationen, nutzt aber eigene Schlüssel und bringt zusätzliche Funktionen mit.

## Installation

### HACS

[![Home Assistant öffnen und Repository in HACS anzeigen.](https://my.home-assistant.io/badges/hacs_repository.svg)](https://my.home-assistant.io/redirect/hacs_repository/?owner=Lint-Free-Technology&repository=uix&category=integration)

Installiere UI eXtension über [HACS](https://hacs.xyz/). Nach der Installation muss Home Assistant neu gestartet werden, damit die Integration geladen werden kann.

!!! hint "Download-Schritt in HACS"
    In HACS reicht das Öffnen des Repositorys nicht aus. Achte darauf, die Integration wirklich herunterzuladen. Je nach Ansicht findest du den Download-Button direkt oder im `...`-Menü.

### Manuell

Kopiere den Ordner `custom_components/uix` aus dem Repository in den `custom_components`-Ordner deiner Home-Assistant-Konfiguration. Starte Home Assistant anschließend neu.

## UI eXtension als Dienst hinzufügen

[![Home Assistant öffnen und Integration anzeigen.](https://my.home-assistant.io/badges/integration.svg)](https://my.home-assistant.io/redirect/integration/?domain=uix)

Nach dem Download muss UI eXtension in Home Assistant unter `Einstellungen` -> `Geräte & Dienste` als Integration hinzugefügt werden. Danach die Seite neu laden, damit die Frontend-Ressource aktiv wird.

!!! question "UIX wird nicht gefunden?"
    Prüfe, ob Home Assistant nach der Installation neu gestartet wurde. Bei HACS erscheint meist eine Reparaturmeldung, über die der Neustart ausgelöst werden kann.

## Erstes UIX Styling

1. Öffne eine Karte im Home-Assistant-GUI-Editor.
2. Klicke unten im Bearbeitungsdialog auf `Code-Editor anzeigen`.
3. Ergänze im YAML die UIX-Konfiguration.

```yaml
type: tile
entity: light.bed_light
uix:
  style: |
    ha-card {
      background: red;
    }
```

Während der Eingabe sollte sich der Kartenhintergrund rot färben. Außerdem erscheint ein kleines Pinsel-Symbol in der Nähe von `Visuellen Editor anzeigen`. Das zeigt an, dass diese Karte UIX-Code enthält, der im visuellen Editor nicht vollständig dargestellt wird.

![Quick Start](./assets/page-assets/quick-start/quick-start-basic.png)

## Erstes UIX Forge

UIX Forge erzeugt ein Home-Assistant-Element aus einer Vorlage. Im Beispiel wird eine Tile-Karte erzeugt, die ausgeblendet wird, wenn `input_boolean.test_boolean` auf `on` steht.

```yaml
type: custom:uix-forge
forge:
  mold: card
  show_error: false
  hidden: "{{ is_state('input_boolean.test_boolean', 'on') }}"
  grid_options:
    columns: "{{ 6 }}"
    rows: 1
element:
  type: tile
  icon: "{{ 'mdi:test-tube' }}"
  entity: "{{ 'sun.sun' }}"
  uix:
    style: |
      ha-card {
        background: red;
      }
```

![First UIX Forge](./assets/page-assets/quick-start/basic-first-forge.gif)

## Nächste Schritte

- [UIX Styling](./using/index.md)
- [UIX Forge](./forge/index.md)
- [FAQ](./faq.md)
