---
title: Foundries
description: Foundries are server-stored UIX Forge templates that let you define reusable forge and element configs once and apply them to many cards.
---
# Foundries

A **foundry** is a named UIX Forge template stored in Home Assistant. It acts as a reusable base configuration: define a `forge`, `element`, or `uix` config once, give it a name, and reference it in any number of cards with a single `foundry:` key. Local card config is merged on top, so you can still override any value per card.

## Managing foundries

Foundries are managed through the **UI eXtension** integration options in Home Assistant.

1. Go to **Settings → Devices & Services → UI eXtension → Configure**.
2. Choose one of the three menu options:
   - **Add a foundry** — enter a name and a YAML config object.
   - **Edit a foundry** — select an existing foundry from the dropdown, then update its config.
   - **Delete a foundry** — select an existing foundry from the dropdown and confirm.

The foundry name must be unique. It is used as the `foundry:` key in your card config.

## Using a foundry

Reference a foundry by name using the `foundry:` key:

```yaml
type: custom:uix-forge
foundry: my_tile
```

The foundry's `forge`, `element`, and `uix` configs are applied as if they were written directly on the card.

You can add or override any key locally — local values take precedence over the foundry:

```yaml
type: custom:uix-forge
foundry: my_tile
element:
  entity: light.kitchen
```

## Foundry config structure

A foundry is a YAML object that can contain any combination of `forge`, `element`, and `uix` keys:

```yaml
forge:
  mold: card
element:
  type: tile
  entity: light.living_room
uix:
  style: |
    ha-card {
      --tile-color: teal;
    }
```

The same keys are valid here as on a normal `uix-forge` card. See the [UIX Forge index](./index.md) for details on `forge` and `element` options.

## Merge behaviour

When a foundry is resolved, keys are merged in this order — later entries win:

1. **Foundry** — the stored foundry config.
2. **Local card** — keys defined directly on the card.

For **object values** (e.g. `forge`, `element`, `uix`), merging is recursive: nested keys are merged individually rather than the whole object being replaced. For **array and scalar values**, the local value replaces the foundry value entirely.

### Example

Foundry `weather_tile`:

```yaml
forge:
  mold: card
  macros:
    state_color: "my_macros.jinja"
element:
  type: weather-forecast
  show_current: true
  show_forecast: false
```

Card config:

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
    state_color: "my_macros.jinja"
element:
  type: weather-forecast
  entity: weather.home        # from card
  show_current: true          # from foundry
  show_forecast: true         # overridden by card
```

## Nested foundries

A foundry can itself reference another foundry using the `foundry` key. This lets you build a hierarchy of shared configs.

Foundry `base_tile`:

```yaml
forge:
  mold: card
element:
  type: tile
uix:
  style: |
    ha-card {
      border-radius: 20px;
    }
```

Foundry `light_tile` (extends `base_tile`):

```yaml
foundry: base_tile
element:
  color_on: yellow
  color_off: gray
```

Card:

```yaml
type: custom:uix-forge
foundry: light_tile
element:
  entity: light.living_room
```

The resolved config merges all three layers: `base_tile` → `light_tile` → card.

!!! warning "Circular references"
    If a chain of foundry references loops back to a foundry already in the chain, UIX detects the cycle and throws an error. Always ensure your foundry hierarchy is acyclic.

## UIX styling from a foundry

A foundry can include a `uix` key that applies [UIX styling](../using/index.md) to the forged element. Foundry styles are merged with any `uix` key on the local card, with the local card taking precedence:

```yaml
# Foundry: "styled_tile"
forge:
  mold: card
element:
  type: tile
  entity: light.living_room
uix:
  style: |
    ha-card {
      --tile-color: teal;
    }
```

```yaml
# Card — adds its own uix style on top
type: custom:uix-forge
foundry: styled_tile
uix:
  style: |
    ha-card {
      border-radius: 20px;
    }
```

## `disabled` key

Set `disabled: true` on a `uix-forge` card to suppress the element entirely. This key can be set locally or come from a foundry.

```yaml
type: custom:uix-forge
foundry: my_tile
disabled: true
```
