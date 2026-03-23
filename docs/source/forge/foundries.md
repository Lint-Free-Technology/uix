---
title: Foundries
description: Foundries are server-stored UIX Forge configurations that let you define reusable forge and element configurations once and apply them to many elements.
---
# Foundries

A **foundry** is a named UIX Forge configuration stored in Home Assistant. It acts as a reusable base configuration: define a `forge` and `element` config once, give it a name, and reference it in any number of elements with a single `foundry:` key. Local element config is merged on top, so you can still override any value per element.

## Managing foundries

Foundries are managed through the **UI eXtension** integration options in Home Assistant.

1. Go to **Settings → Devices & Services → UI eXtension → Configure (cog)**.
2. Choose one of the three menu options:
   - **Add a foundry** — enter a name and a YAML config object.
   - **Edit a foundry** — select an existing foundry from the dropdown, then update its config.
   - **Delete a foundry** — select an existing foundry from the dropdown and confirm.

The foundry name must be unique. It is used as the `foundry:` key in your element config.

## Using a foundry

Reference a foundry by name using the `foundry:` key:

```yaml
type: custom:uix-forge
foundry: my_tile
```

The foundry's `forge` and `element` configs are applied as if they were written directly on the element.

You can add or override any key locally — local values take precedence over the foundry:

```yaml
type: custom:uix-forge
foundry: my_tile
element:
  entity: light.kitchen
```

## Foundry config structure

A foundry is a YAML object that can contain any combination of `forge` and `element` keys:

```yaml
forge:
  mold: card
  uix:
    style:
      hui-tile-card $: |
        ha-card {
          --tile-color: red !important;
        }
element:
  type: tile
  entity: "{{ 'sun.sun' }}"
```

The same keys are valid here as on a normal `uix-forge` element. See the [UIX Forge index](./index.md) for details on `forge` and `element` options.

## Merge behaviour

When a foundry is resolved, keys are merged in this order — later entries win:

1. **Foundry** — the stored foundry config.
2. **Local element** — keys defined directly on the element.

For **object values** (e.g. `forge`, `element`), merging is recursive: nested keys are merged individually rather than the whole object being replaced. For **array and scalar values**, the local value replaces the foundry value entirely.

### Example

Foundry `weather_tile`:

```yaml
forge:
  mold: card
  macros:
    entity_color: "my_macros.jinja"
element:
  type: weather-forecast
  show_current: true
  show_forecast: false
```

Element config:

```yaml
type: custom:uix-forge
foundry: weather_tile
element:
  entity: weather.home
  show_forecast: true
```

Resolved config:

```yaml
forge:
  mold: card
  macros:
    entity_color: "my_macros.jinja"
element:
  type: weather-forecast
  entity: weather.home        # from element
  show_current: true          # from foundry
  show_forecast: true         # overridden by element
```

## Nested foundries

A foundry can itself reference another foundry using the `foundry` key. This lets you build a hierarchy of shared configs.

Foundry `base_tile`:

```yaml
forge:
  mold: card
  uix:
    style:
      hui-tile-card $: |
        ha-card {
          border-radius: 20px;
        }
element:
  type: tile
```

Foundry `light_tile` (extends `base_tile`):

```yaml
foundry: base_tile
element:
  vertical: false
  features_position: inline
  features:
    - type: light-brightness
```

Element:

```yaml
type: custom:uix-forge
foundry: light_tile
element:
  entity: light.living_room
```

The resolved config merges all three layers: `base_tile` → `light_tile` → element.

!!! warning "Circular references"
    If a chain of foundry references loops back to a foundry already in the chain, UIX detects the cycle and throws an error. Always ensure your foundry hierarchy is acyclic.

## UIX styling from a foundry

A foundry can include a `uix` key under `forge` that applies [UIX styling](../using/index.md) to the forge element wrapper. Foundry styles are merged with any `uix` key in the local `forge` config, with the local element taking precedence.

!!! tip "Combining styles"
    If you need to have root styling and shadow root styling, use YAML selectors placing your root styling in the root key `.:`. If you use text only for `style:` on element you will override all yaml styles in foundries.

```yaml
# Foundry: "styled_tile"
forge:
  mold: card
  uix:
    style:
      hui-tile-card $: |
        ha-card {
          --tile-color: red !important;
        }
element:
  type: tile
```

```yaml
# Element — adds its own uix style on top
type: custom:uix-forge
foundry: styled_tile
forge:
  uix:
    style:
      .: |
        :host {
          --ha-card-border-radius: 20px;
        }
element:
  entity: light.living_room
```
