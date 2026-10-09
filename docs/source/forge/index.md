---
title: UIX Forge
description: Learn about UIX Forge, a powerful custom element that combines templates, sparks, and UIX styling.
---
UIX Forge forges Home Assistant elements with templates in its element configuration and additional augmentation through [UIX Forge Sparks](./sparks/). Its [layered configuration](./forge.md#layered-configuration) mode also lets a wrapped element retain its own template fields while Forge templates a separate overlay.

Forge supports the card, badge, row, picture-element, section, footer, and card-feature molds. Cross-context molds allow embedding one element type in a different parent context, such as a card used as a row inside an entities card — see [Cross-context molds](./forge.md#cross-context-molds). Layered configuration is available for every mold.

See [Forge](./forge.md) for complete forge config reference.

## Foundries

A **foundry** is a reusable UIX Forge configuration that lets you define `forge`, `element`, `element_base`, and `uix` fragments once and share them across many cards. A resolved `element_base` selects layered configuration; `element_disabled_paths` remains local to the consuming Forge.

See [Foundries](./foundries.md) for a full guide including merge behaviour, nested foundries, and management via the integration options.

## Sparks

Sparks are optional behaviours that you add to the `forge.sparks` list. Each spark has a `type` key and its own options.

Available sparks:

- :speech_balloon: [Tooltip](./sparks/tooltip.md) — attach a styled tooltip to any element inside the forged element.
- :material-button-cursor: [Button](./sparks/button.md) - attach a styled button (`ha-button`) with actions as a sibling before or after any element within the forged element.
- :material-badge-account-horizontal-outline: [Badge](./sparks/badge.md) - insert a Web Awesome-styled `uix-badge` as a sibling before or after any element within the forged element.
- :label: [Attribute](./sparks/attribute.md) — add, replace or remove an attribute of any element within the forged element.
- :zap: [Event](./sparks/event.md) — receive DOM events from `fire-dom-event` actions and expose their data as template variables.
- :star: [Tile Icon](./sparks/tile-icon.md) — insert a `ha-tile-icon` element as a sibling before or after any element within the forged element.
- :shield: [State badge](./sparks/state-badge.md) - insert a `state-badge` element as a sibling before or after any element within the forged element.
- :material-grid: [Grid](./sparks/grid.md) - apply **CSS Grid** layout to any container element inside a forged element
- :mag: [Search](./sparks/search.md) - queries a container within a forged element with a CSS selector and optional inner text to find, then apply mutations to the found element(s).
- :material-map: [Map](./sparks/map.md) — preserve the map view and add tours, history sliders, and entity filters with configurable control positions.
- :material-lock: [Lock](./sparks/lock.md) — overlay a lock icon on any element to block interaction until the user passes a PIN, passphrase, or confirmation challenge.
- :material-form-select: [Form](./sparks/form.md) — add a Home Assistant form and optional submit and clear actions to a forged element.
- :material-star-four-points-outline: [Overlay Icon](./sparks/overlay-icon.md) — overlay a `ha-icon`/`ha-state-icon` on any element inside the forged element.
- :material-image-outline: [Background](./sparks/background.md) — inject a background layer (colour, image, video, or live camera) behind any element within the forged element.
- :material-palette: [Theme](./sparks/theme.md) — apply a Frontend theme to the forged element or one of its descendants.
