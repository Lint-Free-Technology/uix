---
description: Use the tile-icon spark to insert a ha-tile-icon element as a sibling before or after a target element within a UIX Forge element.
icon: material/image-outline
---

# :frame_photo: Tile Icon spark

The `tile-icon` spark inserts a `ha-tile-icon` element as a DOM sibling immediately **before** or **after** a target element inside a forged element.

The icon source can be:

- a fixed MDI icon string (`icon`)
- an SVG path string (`icon_path`)
- an image URL (`image_url`)
- an entity whose state icon is displayed via `ha-state-icon` placed in the tile icon's `icon` slot (`entity`)

Optionally the tile icon can be made interactive with tap/hold/double-tap [actions](#actions).

## Basic usage

Add a `tile-icon` entry to `forge.sparks` with either `after` or `before` to specify the target element, and one of `icon`, `icon_path`, `image_url`, or `entity` to provide the icon source:

```yaml
type: custom:uix-forge
forge:
  mold: card
  sparks:
    - type: tile-icon
      after: ha-tile-icon
      icon: mdi:star
element:
  type: tile
  entity: light.living_room
```

The `after`/`before` value is a selector that locates the target element within the forged element. It supports the same [DOM navigation syntax](../../concepts/dom.md) as UIX styles, including `$` to cross shadow-root boundaries.

## Configuration

| Key | Type | Required | Default | Description |
| --- | ---- | -------- | ------- | ----------- |
| `type` | `string` | ✅ | — | Must be `tile-icon`. |
| `after` | `string` | one of `after`/`before` ✅ | — | UIX selector for the reference element. The icon is inserted as a sibling **after** the matched element. |
| `before` | `string` | one of `after`/`before` ✅ | — | UIX selector for the reference element. The icon is inserted as a sibling **before** the matched element. |
| `icon` | `string` | one of `icon`/`icon_path`/`image_url`/`entity` ✅ | — | MDI icon string (e.g. `mdi:star`) passed to `ha-tile-icon` as its `icon` property. |
| `icon_path` | `string` | one of `icon`/`icon_path`/`image_url`/`entity` ✅ | — | SVG path string passed to `ha-tile-icon` as its `iconPath` property (rendered via `ha-svg-icon`). |
| `image_url` | `string` | one of `icon`/`icon_path`/`image_url`/`entity` ✅ | — | URL of an image to display inside the tile icon. |
| `entity` | `string` | one of `icon`/`icon_path`/`image_url`/`entity` ✅ | — | Entity ID whose current state object is passed to a `ha-state-icon` placed in the tile icon's `icon` slot, displaying the entity's native state icon. |
| `color` | CSS color | | - | Color to apply to tile icon. Overrides entity state color |
| `tap_action` | action | | — | Action to perform on tap. |
| `hold_action` | action | | — | Action to perform on hold. |
| `double_tap_action` | action | — | — | Action to perform on double tap. |

!!! note
    Exactly one of `after` or `before` must be provided, and exactly one icon source (`icon`, `icon_path`, `image_url`, or `entity`) must be provided.

## Actions

When one or more action keys are set (`tap_action`, `hold_action`, `double_tap_action`), the tile icon is automatically made interactive and action events bubble up through the DOM for Home Assistant to handle:

```yaml
type: custom:uix-forge
forge:
  mold: card
  sparks:
    - type: tile-icon
      after: ha-tile-icon
      entity: light.living_room
      tap_action:
        action: toggle
      hold_action:
        action: more-info
element:
  type: tile
  entity: light.living_room
```

## Examples

### Insert an icon after an element using a fixed icon

```yaml
type: custom:uix-forge
forge:
  mold: card
  sparks:
    - type: tile-icon
      after: ha-tile-icon
      icon: mdi:chevron-right
element:
  type: tile
  entity: light.living_room
```

### Insert an entity state icon before an element

```yaml
type: custom:uix-forge
forge:
  mold: card
  sparks:
    - type: tile-icon
      before: ha-tile-info
      entity: light.living_room
element:
  type: tile
  entity: light.living_room
```

### Insert an icon using an SVG path

```yaml
type: custom:uix-forge
forge:
  mold: card
  sparks:
    - type: tile-icon
      after: ha-tile-icon
      icon_path: "M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z"
element:
  type: tile
  entity: light.living_room
```

### Insert an image icon

```yaml
type: custom:uix-forge
forge:
  mold: card
  sparks:
    - type: tile-icon
      after: ha-tile-icon
      image_url: /local/my-icon.png
element:
  type: tile
  entity: light.living_room
```

### Cross a shadow boundary to reach a deeply nested element

```yaml
type: custom:uix-forge
forge:
  mold: card
  sparks:
    - type: tile-icon
      after: "hui-tile-card $ ha-tile-icon"
      icon: mdi:star
element:
  type: tile
  entity: light.living_room
```

!!! note
    - The spark targets the **first** element matched by `after`/`before`.
    - The inserted `ha-tile-icon` element is placed in the same parent as the target element — it is a sibling, not a child.
    - If the target element is assigned to a named slot, the inserted tile icon is given the same slot automatically.
    - The tile icon element is tracked by a unique ID and **updated in place** on config or state changes — it is never duplicated.
    - The tile icon element is removed automatically when the forge element is disconnected from the DOM.
