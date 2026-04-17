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

The foundry's `forge` and `element` configs are applied as if they were written directly on the UIX Forge config.

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

The same keys are valid here as on a normal `uix-forge` element. See the [UIX Forge](./index.md) for details on `forge` and `element` options.

!!! tip "Secrets"
    Secrets like `"!secret tile_lock_pin"` will be resolved from `secrets.yaml` in the main Home Assistant config directory. For more information see <https://www.home-assistant.io/docs/configuration/secrets/>

## Merge behaviour

When a foundry is resolved, keys are merged in this order — later entries win:

1. **Foundry** — the stored foundry config.
2. **Local forge** — keys defined directly on the forge config.

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

Forge:

```yaml
type: custom:uix-forge
foundry: light_tile
element:
  entity: light.living_room
```

The resolved config merges all three layers: `base_tile` → `light_tile` → forge config.

!!! warning "Circular references"
    If a chain of foundry references loops back to a foundry already in the chain, UIX detects the cycle and throws an error. Always ensure your foundry hierarchy is acyclic.

## Billets in foundries

Billets are a good fit for foundries because they act as named slots that individual forge instances can fill or override without touching the foundry templates.

There are two complementary patterns:

### Pattern 1 — define defaults in the foundry, override per instance

Define the billet with a sensible default in the foundry. Each instance can leave it as-is or override it with a local value. Templates in the foundry use the billet directly without needing any fallback logic.

Foundry `accent_tile`:

```yaml
forge:
  mold: card
  billets:
    accent: teal
element:
  type: tile
  entity: "{{ config.entity }}"
  uix:
    style: |
      ha-card {
        --tile-color: {{ accent }} !important;
      }
```

Instance — accepts the foundry default:

```yaml
type: custom:uix-forge
foundry: accent_tile
entity: light.bed_light
```

Instance — overrides the accent colour:

```yaml
type: custom:uix-forge
foundry: accent_tile
entity: light.kitchen
forge:
  billets:
    accent: orange
```

### Pattern 2 — define empty billet slots in the foundry

When the foundry should not impose any value and the billet is expected to be supplied by the instance, define the billet as `~` (null). The foundry templates must then handle the `none` case gracefully, either by providing a fallback using `or` or `default()`, or by guarding with `{% if %}`.

Foundry `flexible_tile`:

```yaml
forge:
  mold: card
  billets:
    accent: ~          # empty slot — instance is expected to override this
    label: ~           # optional label, templates handle none gracefully
element:
  type: tile
  entity: "{{ config.entity }}"
  name: "{{ label or state_attr(config.entity, 'friendly_name') }}"
  uix:
    style: |
      ha-card {
        {%- if accent %}
        --tile-color: {{ accent }} !important;
        {%- endif %}
      }
```

Instance — supplies the accent, leaves label empty:

```yaml
type: custom:uix-forge
foundry: flexible_tile
entity: light.bed_light
forge:
  billets:
    accent: teal
```

Instance — supplies both billets:

```yaml
type: custom:uix-forge
foundry: flexible_tile
entity: light.kitchen
forge:
  billets:
    accent: orange
    label: Kitchen ceiling
```

!!! note "Comments are stripped"
    Home Assistant stores foundry config as JSON, so YAML comments are not preserved. Use descriptive billet names (e.g. `accent_color`, `card_label`) to make the purpose of each slot self-evident to anyone editing instances.

## UIX styling from a foundry

A foundry can include a `uix` key under `forge` that applies [UIX styling](../using/index.md) to the forged element wrapper. Foundry styles are merged with any `uix` key in the local `forge` config, with the local forge config taking precedence.

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
# Forge — adds its own uix style on top
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
