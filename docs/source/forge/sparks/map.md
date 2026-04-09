---
description: Use the map spark to preserve zoom level and map centre when a map card is used inside UIX Forge.
icon: material/map
---

# :material-map: Map spark


The `map` spark adds advanced map state management to a map card used inside a [UIX Forge](../index.md) forged element. It supports two modes:

- **Memory mode** (`memory: true`): Captures the current Leaflet zoom and centre before each update and restores them afterwards, so the user's view is always preserved. Without it, every forge template update causes the map to reset to its default zoom level and centre position.
- **Fit map mode** (`fit_map: true`): Fits the map view when map card does not auto fit on load when used in custom cards which may hide the map initially. e.g. `custom: auto-entities`.


## Basic usage

```yaml
type: custom:uix-forge
forge:
  mold: card
  sparks:
    - type: map
      memory: true
element:
  type: map
  entities:
    - device_tracker.phone
```

## Configuration

| Key | Type | Default | Description |
|-----|------|----- ---|-------------|
| `type`   | string | — | Must be `map`. |
| `memory` | boolean | false | Save/restore zoom and centre before/after each update. |
| `fit_map`| boolean | false | Fit map view to all entities once map is visible (useful for cards hidden on load). |

## How it works

**Memory mode:**

Each time the forged element is about to refresh due to a forge template update, the spark:

1. Reads the current `zoom` and `center` from the Leaflet map instance inside `ha-map`.
2. Waits for the forged element and then `ha-map` to finish their own update cycle.
3. Calls `leafletMap.setView(center, zoom, { reset: true })` to silently restore the saved position without triggering an animation.

If Leaflet has not yet initialised when the refresh fires (e.g. on initial render) the save step is skipped and no restore is attempted, so the map displays its default view on first load.

**Fit map mode:**

After the forged element and `ha-map` finish updating and once client width is non-zero, the spark will call `fitMap()` on `ha-map`.

!!! note
  The spark targets the `hui-map-card` element inside the forged element and then the `ha-map` element within its shadow root. It relies on the `leafletMap` property exposed by `ha-map`. If the forged element is not a map card (or is wrapped in another element that does not expose `hui-map-card`), neither mode has any effect.
