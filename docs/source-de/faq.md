---
title: FAQ
description: Häufige Fragen zu UI eXtension.
hide:
  - toc
  - navigation
---
# FAQ

## Wie migriere ich am besten von Card-mod?

- Deinstalliere Card-mod.
- Entferne eine eventuell manuell eingetragene `extra_module_url`-Ressource für Card-mod.
- Starte Home Assistant neu.
- Folge danach dem [Schnellstart](./quick-start.md).

!!! tip "UI eXtension als Dienst hinzufügen"
    UI eXtension ist eine Integration und muss nach dem Download über HACS zusätzlich als Dienst/Integration in Home Assistant hinzugefügt werden.

## Ist UI eXtension ein direkter Ersatz für Card-mod?

Ja, UIX ist weitgehend als Ersatz für Card-mod-Konfigurationen bis Version 4.2.1 gedacht. Bestehende Card-mod-Schlüssel werden unterstützt. Für neue Konfigurationen empfiehlt sich aber `uix:`.

## Ist UIX nur Card-mod mit anderer Dokumentation?

Nein. UIX nutzt den eigenen Domain- und Konfigurationsschlüssel `uix`, unterstützt moderne Home-Assistant-Änderungen und ergänzt zusätzliche Funktionen wie Forge, Foundries, Sparks, DOM-Hilfen und Debug-Ausgaben.

## Muss nach Updates der Cache geleert werden?

UIX kann erkennen, wenn ein Neuladen nötig ist, und zeigt dafür eine Meldung mit einer `Reload Now`-Aktion. Bei hartnäckigen Problemen hilft zusätzlich ein harter Browser-Reload oder das Leeren des Companion-App-Caches.

## Ist die deutsche Doku eigenständig nutzbar?

Ja. Die deutsche Doku enthält eine eigene Navigation, deutsche Einstiegsseiten und deutsche Detailseiten. Sehr tiefe Spezialfälle können später weiter ausgebaut werden, aber die Seiten führen nicht nur auf die englische Doku zurück.
