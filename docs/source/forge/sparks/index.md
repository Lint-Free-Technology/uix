---
title: Sparks
description: Sparks are self-contained behaviours that augment an element forged with UIX Forge.
---
# Sparks

Sparks are optional behaviours added to a [UIX Forge](../index.md) forged element via the `forge.sparks` list. Each spark has a `type` key and its own configuration options.

Available sparks:

- :speech_balloon: [Tooltip](./tooltip.md) — attach a styled tooltip to any element within the forged element.
- :label: [Attribute](attribute.md) — add, replace or remove an attribute of any element within the forged element.
- :zap: [Event](event.md) — receive DOM events from `fire-dom-event` actions and expose their data as template variables.
- :frame_photo: [Icon](icon.md) — insert a `ha-state-icon` element as a sibling before or after any element within the forged element.
