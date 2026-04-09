---
description: Use the map spark to preserve zoom level and map centre when a map card is used inside UIX Forge.
icon: material/map
---

# :material-map: Map spark


The `map` spark adds advanced map state management to a map card used inside a [UIX Forge](../index.md) forged element. It supports three modes:

- **Memory mode** (`memory: true`): Captures the current Leaflet zoom and centre before each update and restores them afterwards, so the user's view is always preserved. Without it, every forge template update causes the map to reset to its default zoom level and centre position.
- **Fit map mode** (`fit_map: true`): Fits the map view when map card does not auto fit on load when used in custom cards which may hide the map initially. e.g. `custom: auto-entities`.
- **Tour mode** (`tour: true | object`): Automatically flies the map between a list of points of interest. A pause/play button is injected into the map. When `tour: true` all defaults are used; pass an object to customise behaviour.


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
| --- | --- | --- | --- |
| `type` | string | — | Must be `map`. |
| `memory` | boolean | false | Save/restore zoom and centre before/after each update. |
| `fit_map` | boolean | false | Fit map view to all entities once map is visible (useful for cards hidden on load). |
| `tour` | boolean or object | false | Enable tour mode. `true` uses all defaults; pass an object to customise (see below). |

### Tour sub-keys

| Key | Type | Default | Description |
| --- | --- | --- | --- |
| `period` | string or number | `10s` | Time to spend at each point of interest. Accepts a human-readable duration (e.g. `"30s"`, `"2m"`) or a number in milliseconds. |
| `zoom` | number | *(unset)* | Default zoom level used when flying to a POI. Omit to keep the map's current zoom. |
| `icon_pause` | string | `mdi:pause` | Icon shown on the overlay button while the tour is playing. |
| `icon_play` | string | `mdi:play` | Icon shown on the overlay button while the tour is paused. |
| `icon_position` | object | `{bottom: 10px, right: 10px}` | CSS position of the pause/play button. Accepts `top`, `bottom`, `left`, and `right` keys (numbers are treated as pixels). |
| `poi` | list | *(unset)* | List of points of interest. When omitted, the entities declared on the ha-map card are used. |

Each `poi` list entry may contain:

| Key | Type | Description |
| --- | --- | --- |
| `entity` | string | Entity ID. Must be present in the ha-map's `entities` list. Lat/lng are read from hass state attributes. |
| `latitude` | number | Latitude (required when `entity` is not set). |
| `longitude` | number | Longitude (required when `entity` is not set). |
| `zoom` | number | Per-POI zoom override. |

### Tour CSS variables

The pause/play button can be styled using CSS variables placed on the `ha-card` or any ancestor:

| Variable | Default | Description |
| --- | --- | --- |
| `--uix-map-tour-color` | `var(--primary-color)` | Icon colour. |
| `--uix-map-tour-background` | `rgba(255,255,255,0.8)` | Button background. |
| `--uix-map-tour-width` | `auto` | Button width. |
| `--uix-map-tour-height` | `auto` | Button height. |
| `--uix-map-tour-border-radius` | `4px` | Button border radius. |
| `--uix-map-tour-z-index` | `1000` | Button z-index (Leaflet controls use 1000). |

## How it works

**Memory mode:**

Each time the forged element is about to refresh due to a forge template update, the spark:

1. Reads the current `zoom` and `center` from the Leaflet map instance inside `ha-map`.
2. Waits for the forged element and then `ha-map` to finish their own update cycle.
3. Calls `leafletMap.setView(center, zoom, { reset: true })` to silently restore the saved position without triggering an animation.

If Leaflet has not yet initialised when the refresh fires (e.g. on initial render) the save step is skipped and no restore is attempted, so the map displays its default view on first load.

**Fit map mode:**

After the forged element and `ha-map` finish updating and once `ha-map` client width is non-zero and leaflet is ready, the spark will call `fitMap()` on `ha-map`.

**Tour mode:**

After the map is ready (and after `fit_map` completes if both are configured), the spark:

1. Resolves the POI list (from `poi` config, or by reading `latitude`/`longitude` from hass state attributes of the ha-map entities).
2. Injects a `ha-icon-button` overlay into the Leaflet container.
3. Starts a repeating timer that calls `leafletMap.flyTo()` to animate the map to the next POI every `period` seconds.
4. When the user clicks the pause/play button, the timer is stopped or restarted.

When `memory: true` and `tour` are both active, hass-update memory restores are suppressed while the tour is playing so that the tour animation is not interrupted.

!!! note
    The spark targets the `hui-map-card` element inside the forged element and then the `ha-map` element within its shadow root. It relies on the `leafletMap` property exposed by `ha-map`. If the forged element is not a map card (or is wrapped in another element that does not expose `hui-map-card`), none of the modes have any effect.

## Examples

### Using fit map mode with auto-entities

When using a map card with `custom:auto-entities` the way auto-entities hides the map card will mean it does not fit on load. Fit map mode can be used in this case to make sure the map fits on first load.

No include filters have been used for brevity of the example.

```yaml
type: custom:auto-entities
entities:
  - zone.home
filter:
  include: []
  exclude: []
card:
  type: custom:uix-forge
  forge:
    mold: card
    sparks:
      - type: map
        fit_map: true
  element:
    type: map
    fit_zones: true
    uix:
      style: |
        :host {
          display: block;
          height: 400px;
        }
```

### Tour mode with default settings

Automatically cycle through all map entities using defaults (10 s per stop, pause/play button in bottom-right corner):

```yaml
type: custom:uix-forge
forge:
  mold: card
  sparks:
    - type: map
      tour: true
element:
  type: map
  entities:
    - device_tracker.phone
    - device_tracker.tablet
```

### Tour mode with custom POI list

Fly between fixed coordinates and specific entities with individual zoom levels:

```yaml
type: custom:uix-forge
forge:
  mold: card
  sparks:
    - type: map
      tour:
        period: 15s
        zoom: 13
        icon_pause: mdi:pause-circle
        icon_play: mdi:play-circle
        icon_position:
          bottom: 16px
          left: 16px
        poi:
          - entity: device_tracker.phone
          - latitude: 48.8566
            longitude: 2.3522
            zoom: 11
          - entity: device_tracker.tablet
            zoom: 15
element:
  type: map
  entities:
    - device_tracker.phone
    - device_tracker.tablet
```

### Styling the tour button

```yaml
type: custom:uix-forge
forge:
  mold: card
  sparks:
    - type: map
      tour: true
element:
  type: map
  entities:
    - device_tracker.phone
  uix:
    style: |
      ha-card {
        --uix-map-tour-color: white;
        --uix-map-tour-background: rgba(0,0,0,0.5);
        --uix-map-tour-border-radius: 50%;
      }
```

