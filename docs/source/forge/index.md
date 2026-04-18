---
title: UIX Forge
description: Learn about UIX Forge, a powerful custom element that combines templates, sparks, and UIX styling.
---
UIX Forge provides a way to forge Home Assistant elements allowing for templates for all of the element's configuration, as well as additional advanced augmentation of the element through [UIX Forge Sparks](./sparks/).

Home Assistant elements supported are card, badge, row, section and picture-element.

See [Forge](./forge.md) for complete forge config reference.

## Foundries

A **foundry** is a server-stored UIX Forge template that lets you define reusable `forge`, `element`, and `uix` configs once and share them across many cards. Reference a foundry with the `foundry:` key and override only what you need locally.

See [Foundries](./foundries.md) for a full guide including merge behaviour, nested foundries, and management via the integration options.

## Sparks

Sparks are optional behaviours that you add to the `forge.sparks` list. Each spark has a `type` key and its own options.

Available sparks:

- :speech_balloon: [Tooltip](./sparks/tooltip.md) — attach a styled tooltip to any element inside the forged element.
- :material-button-cursor: [Button](./sparks/button.md) - attach a styled button (`ha-button`) with actions as a sibling before or after any element within the forged element.
- :label: [Attribute](./sparks/attribute.md) — add, replace or remove an attribute of any element within the forged element.
- :zap: [Event](./sparks/event.md) — receive DOM events from `fire-dom-event` actions and expose their data as template variables.
- :star: [Tile Icon](tile-icon.md) — insert a `ha-tile-icon` element as a sibling before or after any element within the forged element.
- :shield: [State badge](./sparks/state-badge.md) - insert a `state-badge` element as a sibling before or after any element within the forged element.
- :material-grid: [Grid](./sparks/grid.md) - apply **CSS Grid** layout to any container element inside a forged element
- :mag: [Search](./sparks/search.md) - queries a container within a forged element with a CSS selector and optional inner text to find, then apply mutations to the found element(s).
- :material-map: [Map](./sparks/map.md) — preserve the zoom level and centre of a map card across Home Assistant state updates.
- :material-lock: [Lock](./sparks/lock.md) — overlay a lock icon on any element to block interaction until the user passes a PIN, passphrase, or confirmation challenge.
