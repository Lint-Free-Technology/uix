---
description: Use the grid spark to apply CSS Grid layout to any container element inside a UIX Forge element.
icon: material/grid
---

# :material-grid: Grid spark

The `grid` spark applies **CSS Grid** layout to any container element inside a [UIX Forge](../index.md) forged element.  It is designed for use with grid cards and section containers in Home Assistant dashboards, letting you define the full grid layout — columns, rows, gaps, auto-flow and alignment — with a concise YAML snippet instead of hand-writing `style` CSS.

## Basic usage

Apply a 3-column equal-width grid to the forged element itself:

```yaml
type: custom:uix-forge
forge:
  mold: card
  sparks:
    - type: grid
      columns: 3
element:
  type: grid
  cards:
    - type: tile
      entity: light.living_room
    - type: tile
      entity: light.bedroom
    - type: tile
      entity: light.kitchen
```

`columns: 3` expands to `grid-template-columns: repeat(3, 1fr)`.

---

## Configuration

| Key | Type | Default | Description |
| --- | ---- | ------- | ----------- |
| `type` | `string` | — | Must be `grid`. |
| `for` | `string` | `element` | UIX selector for the target element. Default `element` refers to the root of the forged element. Supports `$` for shadow-root crossings (see [DOM navigation](../../concepts/dom.md)). |
| `columns` | `number` \| `string` | — | Grid template columns. A **number** becomes `repeat(n, 1fr)`. A **string** is used verbatim (e.g. `"200px 1fr 200px"`). |
| `rows` | `number` \| `string` | — | Grid template rows. Same shorthand as `columns`. |
| `gap` | `number` \| `string` | — | Shorthand gap between rows and columns. A **number** is treated as pixels (e.g. `8` → `8px`). A **string** is used verbatim (e.g. `"8px 16px"`). |
| `column_gap` | `number` \| `string` | — | Column gap only. Same shorthand as `gap`. |
| `row_gap` | `number` \| `string` | — | Row gap only. Same shorthand as `gap`. |
| `auto_rows` | `string` | — | `grid-auto-rows` value (e.g. `"minmax(100px, auto)"`). |
| `auto_columns` | `string` | — | `grid-auto-columns` value. |
| `auto_flow` | `string` | — | `grid-auto-flow` value: `row`, `column`, `dense`, `row dense`, or `column dense`. |
| `justify_items` | `string` | — | `justify-items` value: `start`, `end`, `center`, `stretch`. |
| `align_items` | `string` | — | `align-items` value: `start`, `end`, `center`, `stretch`. |
| `justify_content` | `string` | — | `justify-content` value. |
| `align_content` | `string` | — | `align-content` value. |
| `place_items` | `string` | — | `place-items` shorthand (`<align-items> / <justify-items>`). |
| `place_content` | `string` | — | `place-content` shorthand (`<align-content> / <justify-content>`). |

!!! tip
    Use the [`uix_forge_path()`](../../concepts/dom.md#uix_forge_path0-forge-helper) console helper to find the exact DOM selector for your target container when `element` isn't sufficient.

---

## Examples

### Equal-width columns with a gap

```yaml
type: custom:uix-forge
forge:
  mold: card
  sparks:
    - type: grid
      columns: 4
      gap: 8
element:
  type: grid
  cards:
    - type: tile
      entity: light.living_room
    - type: tile
      entity: light.bedroom
    - type: tile
      entity: light.kitchen
    - type: tile
      entity: light.office
```

### Custom column widths

```yaml
type: custom:uix-forge
forge:
  mold: card
  sparks:
    - type: grid
      columns: "200px 1fr 200px"
      gap: "8px 16px"
element:
  type: grid
  cards:
    - type: tile
      entity: light.living_room
    - type: tile
      entity: light.bedroom
    - type: tile
      entity: light.kitchen
```

### Dense auto-flow for irregular card sizes

```yaml
type: custom:uix-forge
forge:
  mold: card
  sparks:
    - type: grid
      columns: 3
      auto_rows: "minmax(80px, auto)"
      auto_flow: row dense
element:
  type: grid
  cards:
    - type: tile
      entity: light.living_room
      grid_options:
        columns: 2
    - type: tile
      entity: light.bedroom
    - type: tile
      entity: light.kitchen
```

### Target a nested container

Use `for` with a UIX selector to target a container that is not the root element:

```yaml
type: custom:uix-forge
forge:
  mold: card
  sparks:
    - type: grid
      for: "hui-grid-card $ #root"
      columns: 3
      gap: 8
element:
  type: grid
  cards:
    - type: tile
      entity: light.living_room
    - type: tile
      entity: light.bedroom
    - type: tile
      entity: light.kitchen
```

### Center all grid items

```yaml
type: custom:uix-forge
forge:
  mold: card
  sparks:
    - type: grid
      columns: 3
      place_items: center
element:
  type: grid
  cards:
    - type: tile
      entity: light.living_room
    - type: tile
      entity: light.bedroom
    - type: tile
      entity: light.kitchen
```

---

## Notes

- The spark sets `display: grid` automatically — you do not need to set it yourself.
- All grid styles applied by this spark are **removed** when the forge element is disconnected or the configuration changes, so they do not leak into the surrounding layout.
- Only properties that are explicitly configured are written; unconfigured properties are left untouched.
