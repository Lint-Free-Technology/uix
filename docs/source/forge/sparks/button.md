---
description: Use the button spark to insert an interactive ha-button element as a sibling before or after a target element within a UIX Forge element.
icon: material/button-cursor
---

# :material-button-cursor: Button spark

The `button` spark inserts a Home Assistant [`ha-button`](https://github.com/home-assistant/frontend/tree/dev/src/components/ha-button.ts) element as a DOM sibling immediately **after** a target element inside a forged element.

The button can display:

- a text label (`label`)
- a leading icon (`start_icon`)
- a trailing icon (`end_icon`)

Optionally the button can be made interactive with tap/hold/double-tap [actions](#actions).

## Basic usage

Add a `button` entry to `forge.sparks` with `for` to specify the target element. The button is inserted as a sibling of the matched element, in the same parent node.

The `for` value is a selector that locates the target element within the forged element. It supports the same [DOM navigation syntax](../../concepts/dom.md) as UIX styles, including `$` to cross shadow-root boundaries.

```yaml
type: custom:uix-forge
forge:
  mold: card
  sparks:
    - type: button
      for: hui-tile-card $ ha-tile-icon
      label: Toggle
      entity: light.living_room
      tap_action:
        action: toggle
element:
  type: tile
  entity: light.living_room
```

!!! tip
    You can use the [`uix_forge_path()`](../../concepts/dom.md#uix_forge_path0-forge-helper) DOM helper to take the guesswork out of finding the right path for `for`.

## Configuration

| Key | Type | Required | Default | Description |
| --- | ---- | -------- | ------- | ----------- |
| `type` | `string` | ✅ | — | Must be `button`. |
| `for` | `string` | ✅ | — | UIX selector for the reference element. The button is inserted as a sibling **after** the matched element. |
| `entity` | `string` | | — | Entity ID passed to action handlers (e.g. `toggle`). Required for entity-based actions. |
| `label` | `string` | | `""` | Text label displayed inside the button. |
| `start_icon` | `string` | | — | MDI icon string (e.g. `mdi:play`) displayed **before** the label. |
| `end_icon` | `string` | | — | MDI icon string (e.g. `mdi:chevron-right`) displayed **after** the label. |
| `variant` | `string` | | — | Button colour variant. One of `brand`, `neutral`, `danger`, `warning`, `success`. When omitted, the default HA button style (`primary`) is used. |
| `appearance` | `string` | | — | Button appearance. One of `accent`, `filled`, `plain`. |
| `size` | `string` | | — | Button size passed directly to `ha-button` (e.g. `small`, `medium`, `large`). |
| `tap_action` | action | | — | Action to perform on tap. |
| `hold_action` | action | | — | Action to perform on hold. |
| `double_tap_action` | action | | — | Action to perform on double tap. |

!!! note
    The spark targets the **first** element matched by `for`. The inserted `ha-button` element is placed in the same parent as the target element — it is a sibling, not a child.

## Actions

When one or more action keys are set (`tap_action`, `hold_action`, `double_tap_action`), the button fires the corresponding Home Assistant action. Provide `entity` when using entity-based actions such as `toggle` or `more-info`.

```yaml
type: custom:uix-forge
forge:
  mold: card
  sparks:
    - type: button
      for: hui-tile-card $ ha-tile-icon
      label: Toggle
      entity: light.living_room
      tap_action:
        action: toggle
      hold_action:
        action: more-info
element:
  type: tile
  entity: light.living_room
```

!!! note
    When used inside a tile card the button's click events are isolated from the tile card's own action handler — only the button's configured actions fire.

## Examples

??? example "Button with a label and toggle action"
    ```yaml
    type: custom:uix-forge
    forge:
      mold: card
      sparks:
        - type: button
          for: hui-tile-card $ ha-tile-icon
          label: Toggle
          entity: light.living_room
          tap_action:
            action: toggle
    element:
      type: tile
      entity: light.living_room
    ```

??? example "Button with a danger variant and plain appearance"
    ```yaml
    type: custom:uix-forge
    forge:
      mold: card
      sparks:
        - type: button
          for: hui-tile-card $ ha-tile-icon
          label: Turn off
          variant: danger
          appearance: plain
          entity: light.living_room
          tap_action:
            action: call-service
            service: light.turn_off
            target:
              entity_id: light.living_room
    element:
      type: tile
      entity: light.living_room
    ```

??? example "Button with start and end icons"
    ```yaml
    type: custom:uix-forge
    forge:
      mold: card
      sparks:
        - type: button
          for: hui-tile-card $ ha-tile-icon
          start_icon: mdi:play
          label: Scene
          end_icon: mdi:chevron-right
          tap_action:
            action: navigate
            navigation_path: /lovelace/scenes
    element:
      type: tile
      entity: light.living_room
    ```

??? example "Icon-only button"
    ```yaml
    type: custom:uix-forge
    forge:
      mold: card
      sparks:
        - type: button
          for: hui-tile-card $ ha-tile-icon
          start_icon: mdi:information-outline
          entity: light.living_room
          tap_action:
            action: more-info
    element:
      type: tile
      entity: light.living_room
    ```
