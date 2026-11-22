---
title: Sparks
description: Sparks are self-contained behaviours that augment an element forged with UIX Forge.
---
# Sparks

Add Sparks to the `forge.sparks` list to extend what Forge does. Each Spark has a `type` and its own options. Entities and Configuration Sparks also work with [Forge strategies](../forge.md#strategies).

Available sparks:

- :material-format-list-bulleted: [Entities](entities.md) — fill a list in your config or collect entity IDs for a patch or template.
- :material-file-tree: [Configuration](config.md) — add, change, or remove parts of a config, including the output of a Home Assistant strategy.
- :material-home-analytics: [Home Summary](home-summary.md) — choose which entities count toward a native Home Overview summary.
- :speech_balloon: [Tooltip](./tooltip.md) — attach a styled tooltip to any element within the forged element.
- :material-button-cursor: [Button](button.md) — insert an interactive `ha-button` element as a sibling after any element within the forged element.
- :material-badge-account-horizontal-outline: [Badge](badge.md) — insert a Web Awesome-styled `uix-badge` as a sibling before or after any element within the forged element.
- :label: [Attribute](attribute.md) — add, replace or remove an attribute of any element within the forged element.
- :zap: [Event](event.md) — receive DOM events from `fire-dom-event` actions and expose their data as template variables.
- :star: [Tile Icon](tile-icon.md) — insert a `ha-tile-icon` element as a sibling before or after any element within the forged element.
- :shield: [State Badge](state-badge.md) — insert a `state-badge` element as a sibling before or after any element within the forged element.
- :material-grid: [Grid](grid.md) — apply CSS Grid layout to any container element within the forged element.
- :mag: [Search](search.md) — find elements within a container by CSS selector and optional text filter, then apply class, attribute, or text mutations to all matches.
- :material-map: [Map](map.md) — preserve the zoom level and centre of a map card across Home Assistant state updates.
- :material-lock: [Lock](lock.md) — overlay a lock icon on any element to block interaction until the user passes a PIN, passphrase, or confirmation challenge.
- :material-information-outline: [More-info](more-info.md) — embed Home Assistant more-info content for an entity inside a forged element.
- :material-form-select: [Form](form.md) — add a Home Assistant form and optional submit and clear actions to a forged element.
- :material-star-four-points-outline: [Overlay Icon](overlay-icon.md) — overlay a `ha-icon`/`ha-state-icon` on any element inside the forged element.
- :material-image-outline: [Background](background.md) — inject a background layer (colour, image, video, or live camera) behind any element within the forged element.
- :material-palette: [Theme](theme.md) — apply a Frontend theme to the forged element or one of its descendants.
