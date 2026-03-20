---
description: Use the icon spark to insert a ha-state-icon element as a sibling before or after a target element within a UIX Forge element.
icon: material/image-outline
---

# :frame_photo: Icon spark

The `icon` spark inserts a [`ha-state-icon`](https://github.com/home-assistant/frontend) element as a DOM sibling immediately **before** or **after** a target element inside a [UIX Forge](../index.md) forged element. The icon can be defined as a fixed MDI icon string or driven by an entity's current state.

## Basic usage

Add an `icon` entry to `forge.sparks` with either `after` or `before` to specify the target element, and either `icon` or `entity` to provide the icon source:

```yaml
type: custom:uix-forge
forge:
  mold: card
  sparks:
    - type: icon
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
| `type` | `string` | ✅ | — | Must be `icon`. |
| `after` | `string` | one of `after`/`before` ✅ | — | UIX selector for the reference element. The icon is inserted as a sibling **after** the matched element. |
| `before` | `string` | one of `after`/`before` ✅ | — | UIX selector for the reference element. The icon is inserted as a sibling **before** the matched element. |
| `icon` | `string` | one of `icon`/`entity` ✅ | — | MDI icon string (e.g. `mdi:star`) set directly on the `ha-state-icon` element's `icon` property. |
| `entity` | `string` | one of `icon`/`entity` ✅ | — | Entity ID whose current state object is passed to `ha-state-icon` as `stateObj`, allowing it to display the entity's native state icon. |

!!! note
    Exactly one of `after` or `before` must be provided, and exactly one of `icon` or `entity` must be provided.

## Examples

### Insert an icon after an element using a fixed icon

```yaml
type: custom:uix-forge
forge:
  mold: card
  sparks:
    - type: icon
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
    - type: icon
      before: ha-tile-info
      entity: light.living_room
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
    - type: icon
      after: "hui-tile-card $ ha-tile-icon"
      icon: mdi:star
element:
  type: tile
  entity: light.living_room
```

!!! note
    - The spark targets the **first** element matched by `after`/`before`.
    - The inserted `ha-state-icon` element is placed in the same parent as the target element — it is a sibling, not a child.
    - The icon element is removed automatically when the forge element is disconnected from the DOM.
