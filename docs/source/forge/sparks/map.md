---
description: Use the map spark to preserve zoom level and map centre when a map card is used inside UIX Forge.
icon: material/map
---

# :material-map: Map spark

The `map` spark adds advanced map state management to a map card used inside a [UIX Forge](../index.md) forged element. It supports five modes:

- **Memory mode** (`memory: true`): Captures the current Leaflet zoom and centre before each update and restores them afterwards, so the user's view is always preserved. Without it, every forge template update causes the map to reset to its default zoom level and centre position.
- **Fit map mode** (`fit_map: true`): Fits the map view when map card does not auto fit on load when used in custom cards which may hide the map initially. e.g. `custom: auto-entities`.
- **Tour mode** (`tour: true | object`): Automatically moves the map between a list of points of interest. A pause/play button is injected into the map. When `tour: true` all defaults are used; pass an object to customise behaviour.
- **Hours to show slider mode** (`hours_to_show: true | object`): Injects an interactive `ha-slider` overlay into the map allowing users to adjust the hours of history loaded and rendered in real-time.
- **Entity filter overlay mode** (`entity_filter: true | object`): Injects an interactive checkable dropdown checklist overlay into the map allowing users to toggle visible entities on the map in real-time.

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
| `hours_to_show` | boolean or object | false | Enable hours to show slider overlay. `true` uses all defaults; pass an object to customise (see below). |
| `entity_filter` | boolean or object | false | Enable entity filter checklist dropdown overlay. `true` uses all defaults; pass an object to customise (see below). |

### Tour sub-keys

| Key | Type | Default | Description |
| --- | --- | --- | --- |
| `period` | string or number | `10s` | Time to spend at each point of interest. Accepts a human-readable duration (e.g. `"30s"`, `"2m"`) or a number in milliseconds. |
| `zoom` | number | `14` | Default zoom level used when moving to a POI. |
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

### Hours to Show sub-keys

| Key | Type | Default | Description |
| --- | --- | --- | --- |
| `min` | number | `0` | Minimum hours to show on the slider. |
| `max` | number | `24` | Maximum hours to show on the slider. |
| `step` | number | `1` | Increment step size of the slider. |
| `position` | object | `{bottom: 10px, right: 10px}` | CSS position of the slider capsule. Accepts `top`, `bottom`, `left`, and `right` keys (numbers are treated as pixels). |
| `tooltip_distance` | number | `20` | Distance in pixels of slider tooltip away from thumb. |

### Entity Filter sub-keys

| Key | Type | Default | Description |
| --- | --- | --- | --- |
| `position` | object | `{bottom: 10px, right: 10px}` | CSS position of the filter button capsule. Accepts `top`, `bottom`, `left`, and `right` keys (numbers are treated as pixels). |
| `size` | string | `s` | Button size (e.g. `s`, `m`, `l`). |
| `variant` | string | `neutral` | Button variant brand/style (e.g. `brand`, `neutral`, `danger`, `warning`, `success`). |
| `appearance` | string | `filled` | Button presentation appearance (e.g. `accent`, `filled`, `plain`). |
| `icon` | string | `mdi:filter-variant` | Trigger button start-icon representation. |
| `label` | string | `Filter` | Trigger button label string. Set to empty string to disable. |
| `group` | boolean or object | false | Group entities according to their domain. Set to `true` to use defaults, or an object to set labels for each entity domain grouping. |

#### Entity filter group sub-keys

| Key | Type | Default | Description |
| --- | --- | --- | --- |
| `persons` | string | `Persons` | Label for the `person` domain entity grouping. |
| `trackers` | string | `Trackers` | Label for the `device_tracker` domain entity grouping. |
| `zones` | string | `Zones` | Label for the `zone` domain entity grouping. |

### Tour CSS variables

The pause/play button can be styled using CSS variables placed on the `ha-card` or any ancestor:

| Variable | Default | Description |
| --- | --- | --- |
| `--uix-map-tour-icon-color` | `var(--primary-color)` | Icon color. |
| `--uix-map-tour-icon-ring-color` | `var(--uix-map-tour-icon-color)` | Countdown ring color (defaults to icon color). |
| `--uix-map-tour-icon-background` | `rgba(255,255,255,0.8)` | Button background. |
| `--uix-map-tour-icon-box-shadow` | `0 1px 5px rgba(0,0,0,0.4)` | Box shadow of the icon container. |
| `--uix-map-tour-icon-width` | `auto` | Button width. |
| `--uix-map-tour-icon-height` | `auto` | Button height. |
| `--uix-map-tour-icon-border-radius` | `9999px` | Button border radius (pill by default). |
| `--uix-map-tour-icon-z-index` | `1000` | Button z-index (Leaflet controls use 1000). |

### Hours to Show CSS variables

The history duration slider can be styled using CSS variables placed on the `ha-card` or any ancestor:

| Variable | Default | Description |
| --- | --- | --- |
| `--uix-map-slider-background` | `rgba(255,255,255,0.8)` | Background color of slider container. |
| `--uix-map-slider-text-color` | `var(--primary-text-color, #212121)` | Color of the duration label next to the slider. |
| `--uix-map-slider-width` | `100px` | Explicit width of the slider component. |
| `--uix-map-slider-border-radius` | `9999px` | Slider container border radius (pill by default). |
| `--uix-map-slider-padding` | `4px 12px` | Padding of the capsule container. |
| `--uix-map-slider-box-shadow` | `0 1px 5px rgba(0,0,0,0.4)` | Box shadow of the container element. |
| `--uix-map-slider-z-index` | `1000` | Controls overlay depth of the slider capsule. |
| `--uix-map-slider-label-min-width` | `28px` | Minimum width of the duration label. |
| `--uix-map-slider-thumb-size` | *(unset)* | Height and width of the slider thumb. |
| `--uix-map-slider-thumb-height` | `16px` | Height of the slider thumb component structure (defaults to thumb-size if set). |
| `--uix-map-slider-thumb-width` | `16px` | Width of the slider thumb component structure (defaults to thumb-size if set). |
| `--uix-map-slider-track-size` | `4px` | Thickness of the slider track. |
| `--uix-map-slider-track-color` | `var(--disabled-color)` | Background base track color. |
| `--uix-map-slider-indicator-color` | `var(--primary-color)` | Color of the active indicator bar. |
| `--uix-map-slider-thumb-color` | `var(--uix-map-slider-indicator-color)` | Color of the circular slider thumb. |
| `--uix-map-slider-thumb-hover-opacity` | `0.08` | Hover opacity surrounding the thumb. |
| `--uix-map-slider-thumb-pressed-opacity` | `0.12` | Opacity of thumb halo while active/pressed. |
| `--uix-map-slider-thumb-box-shadow` | `inherit` | Custom shadow styling applied to the interactive thumb item. |
| `--uix-map-slider-tooltip-color` | `var(--primary-text-color)` | Text color inside the popup thumb tooltip. |
| `--uix-map-slider-tooltip-font-size` | `var(--ha-font-size-s)` | Font size of text inside the tooltip. |
| `--uix-map-slider-tooltip-font-weight` | `var(--ha-font-weight-normal)` | Font thickness of elements inside tooltip. |
| `--uix-map-slider-tooltip-background-color` | `var(--secondary-background-color)` | Background color of popup tooltip bubble. |
| `--uix-map-slider-tooltip-border-radius` | `var(--ha-border-radius-sm)` | Corner rounding of tooltip bubble. |
| `--uix-map-slider-tooltip-border-width` | `0px` | Border thickness of tooltip. |
| `--uix-map-slider-tooltip-border-color` | `currentColor` | Border color of tooltip bubble. |
| `--uix-map-slider-tooltip-border-style` | `none` | Border line style. |

### Entity Filter CSS variables

The entity filter dropdown can be styled using CSS variables placed on the `ha-card` or any ancestor:

| Variable | Default | Description |
| --- | --- | --- |
| `--uix-map-entity-filter-background` | `rgba(255,255,255,0.8)` | Background color of entity filter container. |
| `--uix-map-entity-filter-padding` | `4px` | Padding of the filter capsule container. |
| `--uix-map-entity-filter-border-radius` | `9999px` | Entity filter container border radius (pill by default). |
| `--uix-map-entity-filter-box-shadow` | `0 1px 5px rgba(0,0,0,0.4)` | Box shadow of the container element. |
| `--uix-map-entity-filter-z-index` | `1000` | Controls overlay depth of the filter capsule. |
| `--uix-map-entity-filter-dropdown-min-width` | `180px` | Minimum width of the opened dropdown menu list. |
| `--uix-map-entity-filter-item-icon-color` | `var(--ha-color-fill-neutral-loud-resting)` | Color of the check icon of entity filter list items. |
| `--uix-map-entity-filter-item-icon-checked-color` | `var(--uix-map-entity-filter-item-icon-color, var(--primary-color))` | Color of the check icon of entity filter items when checked. |

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
2. Injects a `ha-icon-button` overlay into the Leaflet container with a circular SVG countdown ring around it.
3. Moves the map to the first POI immediately, then starts a repeating timer that calls `leafletMap.setView()` to advance to the next POI every `period` seconds.
4. The countdown ring animates from full to empty over each `period`, giving a visual indication of time remaining at the current POI.
5. When the user clicks the pause/play button, the timer is stopped or restarted and the countdown ring is hidden or restarted.

When `memory: true` and `tour` are both active, hass-update memory restores are suppressed while the tour is playing so that the tour animation is not interrupted.

**Hours to show slider mode:**

When active, the spark:

1. Renders a horizontal `ha-slider` control in a capsule-shaped overlay container.
2. If `tour` is also active and at the default position, the slider is automatically shifted leftwards to prevent visual overlapping.
3. Automatically sets, clamps, and updates `hui-map-card` `_config.hours_to_show` based on slider drags and releases to fetch history records in real-time.
4. Smoothly preserves the user's selected value across template-driven forge re-renders.

**Entity filter overlay mode:**

When active, the spark:

1. Renders a dropdown overlay using `ha-dropdown` with a trigger `ha-button`.
2. Resolves and displays each map entity as a checkbox using Friendly Name.
3. Directly filters visible entities. As a map card will error with no entities, deselecting any last selected entity is disabled.
4. If the `show_all: true` is set in forged map card config, a `Show All` option will also show in the dropdown. While entities are filtered, any new map entities will not show until `Show All` is selected.
5. If `tour`or `hours_to_show` is also active and at the default position, the slider is automatically shifted leftwards to prevent visual overlapping.
6. If `tour` is also active, changing filtered entities will cause the map tour to restart.

!!! note
    The spark targets the `hui-map-card` element inside the forged element as well as the `ha-map` element within its shadow root. It relies on the `leafletMap` property exposed by `ha-map`. If the forged element is not a map card (or is wrapped in another element that does not expose `hui-map-card`), none of the modes have any effect.

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

Override the default pill shape with rounded corners and a dark background:

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
        --uix-map-tour-icon-color: white;
        --uix-map-tour-icon-background: rgba(0,0,0,0.5);
        --uix-map-tour-icon-border-radius: 4px;
      }
```

### Hours to show history slider

Enable a customizable history duration slider to load between 0 (shows all points) and 48 hours of tracker data on the map:

```yaml
type: custom:uix-forge
forge:
  mold: card
  sparks:
    - type: map
      hours_to_show:
        min: 0
        max: 48
        step: 2
        position:
          bottom: 15px
          left: 15px
element:
  type: map
  entities:
    - device_tracker.phone
```

### Entity selection filter dropdown

Enable an interactive dropdown to toggle entity tracks visibility in real-time:

```yaml
type: custom:uix-forge
forge:
  mold: card
  sparks:
    - type: map
      entity_filter: true
element:
  type: map
  entities:
    - device_tracker.phone
    - device_tracker.tablet
    - device_tracker.watch
```

Customise the trigger button text, size, color and icon styling:

```yaml
type: custom:uix-forge
forge:
  mold: card
  sparks:
    - type: map
      entity_filter:
        label: "Trackers"
        icon: "mdi:account-multiple"
        size: "m"
        variant: "brand"
        appearance: "filled"
element:
  type: map
  entities:
    - device_tracker.phone
    - device_tracker.tablet
```

Display entity filter grouped by domain with custom labels

```yaml
type: custom:uix-forge
forge:
  mold: card
  sparks:
    - type: map
      entity_filter:
        group:
          persons: Household
          trackers: Phones
          zones: Places
element:
  type: map
  show_all: true
```
