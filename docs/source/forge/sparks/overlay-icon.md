---
description: Use the overlay-icon spark to overlay a ha-icon or ha-state-icon on any target element within a UIX Forge element.
icon: material/star-four-points-outline
---

# :material-star-four-points-outline: Overlay Icon spark

The `overlay-icon` spark overlays an icon on any element inside a [UIX Forge](../index.md) forged element.

- If `entity` is set, the spark renders a `ha-state-icon`.
- Otherwise it renders a `ha-icon`.

The icon can come from:

- a fixed MDI icon (`icon`)
- an SVG path (`icon_path`)
- an image URL (`image_url`)
- an entity state icon (`entity`)

## Basic usage

```yaml
type: custom:uix-forge
forge:
  mold: card
  sparks:
    - type: overlay-icon
      for: hui-tile-card $ ha-tile-icon
      icon: mdi:sparkles
element:
  type: tile
  entity: light.bed_light
```

## Configuration reference

### Top-level keys

| Key | Type | Default | Description |
|---|---|---|---|
| `type` | string | — | Must be `overlay-icon`. |
| `for` | string | `element` | UIX selector for the element to overlay. Default targets the root of the forged element. |
| `icon` | string | — | MDI/custom to show. Use one of `icon`, `icon_path` or `image_url`. |
| `icon_path` | string | — | SVG path of icon to show. Use one of `icon`, `icon_path` or `image_url`. |
| `image_url` | string | — | Static image applied as overlay. Supports `media-source://` URIs. Use one of `icon`, `icon_path` or `image_url`. |
| `entity` | string | — | If provided a state icon is rendered (`ha-state-icon`). |
| `value` | string | — | If `entity` is provided you can override the state value used to generate the icon. |
| `state_color` | boolean | `true` | If `entity` is provided whether state color is used for the icon. |
| `icon_color` | string | `var(--white-color)` when target is `ha-tile-icon`, `var(--primary-color)` otherwise | CSS color for the icon. Overrides state color if set. |
| `icon_position` | object | when forge mold is row: `{top: 6, left: 30}`; when target is `ha-tile-icon`: `{top: 2, left: 30}` | Pixel offsets for the icon inside the overlay. Accepts any combination of `top`, `bottom` and `left`, `right`. Numbers are treated as pixels; strings accept any CSS value. |
| `icon_size` | number or string | `12px` when target is `ha-tile-icon`, `24px` otherwise | Size of the icon. Numbers are treated as pixels; strings are passed through as-is. |
| `icon_background` | CSS background | `var(--primary-color)` when target is `ha-tile-icon`, otherwise not set | Background of the icon. |

## Customizing the overlay appearance

The overlay icon respects CSS custom properties. Set these on the forged element's `uix.style` (or in a theme):

| CSS variable | Default | Description |
|---|---|---|
| `--uix-overlay-icon-z-index` | `10` | Stack order of the overlay. |
| `--uix-overlay-icon-display` | `block` | CSS display of the overlay. |
| `--uix-overlay-icon-opacity` | `0.5` | Opacity of the overlay (icon and background combined). |
| `--uix-overlay-icon-border-radius` | `inherit` | Border radius of the overlay (inherits the target's). |
| `--uix-overlay-icon-row-border-radius` | `--uix-overlay-icon-border-radius` | Border radius of the overlay when the forge mold is `row`. |
| `--uix-overlay-icon-border` | `unset` | Border style CSS. |
| `--uix-overlay-icon-size` | `24px`; `12px` when target is `ha-tile-icon` | Size of the icon. Overrides `icon_size` from spark config. |
| `--uix-overlay-icon-color` | `var(--primary-color)`; `var(--white-color)` when target is `ha-tile-icon` | Icon color. |
| `--uix-overlay-icon-background` | `none`; `var(--primary-color)` when target is `ha-tile-icon` | Background of the icon element. |
| `--uix-overlay-icon-icon-border-radius` | `none`; `50%` when target is `ha-tile-icon` | Border radius of the icon element. |
| `--uix-overlay-icon-padding` | `0`; `2px` when target is `ha-tile-icon` | Padding around the icon. |
| `--uix-overlay-icon-position` | `none` | CSS `translate` value applied to the icon (e.g. `30px 6px`). |

!!! warning
    As rows in entities card are displayed inline (`display: inline`) deeper element targeting cannot take place as overlays do not work with elements displayed inline. This means overlay-icon spark can only apply to an entire entity row.

## Examples

### Tile icon overlay badge

```yaml
type: custom:uix-forge
forge:
  mold: card
  sparks:
    - type: overlay-icon
      for: hui-tile-card $ ha-tile-icon
      icon: mdi:check-decagram
      icon_background: green
element:
  type: tile
  entity: light.bed_light
```

### Entity-driven overlay icon with value override

```yaml
type: custom:uix-forge
forge:
  mold: card
  sparks:
    - type: overlay-icon
      for: hui-tile-card $ ha-tile-icon
      entity: light.bed_light
      value: "on"
      state_color: true
element:
  type: tile
  entity: light.bed_light
```
