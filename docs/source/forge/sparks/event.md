---
description: Use the event spark to receive browser events and expose their data as template variables in a UIX Forge element.
---

# Event spark

The `event` spark receives events fired with `fire-dom-event` and exposes the received data as template variables inside the [UIX Forge](../index.md) element. Use it to build cards that react to user interactions or automation-triggered events elsewhere in the dashboard.

## Configuration

| Key | Type | Required | Default | Description |
|-----|------|----------|---------|-------------|
| `type` | `string` | ✅ | — | Must be `event`. |
| `forge_id` | `string` | | — | ID for this forge element. Data from `fire-dom-event` events whose `forge_id` matches is spread directly into `uixForge.event`. |
| `other_forge_ids` | list of strings | | — | IDs of other forge elements to listen to. Data for each ID is available as `uixForge.event.<id>`. |

At least one of `forge_id` or `other_forge_ids` should be set for the spark to receive anything.

## Template variables

When the event spark is active, an `event` key is added to the `uixForge` template variable:

| Variable | Description |
|----------|-------------|
| `uixForge.event.<key>` | Data keys from events matching `forge_id`, spread directly into `uixForge.event`. |
| `uixForge.event.<other_id>.<key>` | Data from events matching an ID listed in `other_forge_ids`, nested under that ID. |

Data accumulates across events — each new event is deep-merged into the existing state.

## Firing an event

Any Home Assistant element that supports `tap_action` can fire an event using `action: fire-dom-event`. Add a `uix_forge` key alongside `action` containing a list of forge event objects:

```yaml
tap_action:
  action: fire-dom-event
  uix_forge:
    - forge_id: my_card
      data:
        selected: living_room
```

## Usage

### Basic example — a button that updates a card

A button card fires an event; a forge card receives it and updates its template:

```yaml
# Button that fires an event
type: button
name: Living Room
tap_action:
  action: fire-dom-event
  uix_forge:
    - forge_id: my_tile
      data:
        entity: light.living_room
```

```yaml
# Forge card that reacts to the event
type: custom:uix-forge
forge:
  mold: card
  sparks:
    - type: event
      forge_id: my_tile
element:
  type: tile
  entity: "{{ uixForge.event.entity | default('light.bed_light') }}"
```

### Listening to another forge element's events

Use `other_forge_ids` to receive events intended for a different forge element. The data is then available under `uixForge.event.<forge_id>`:

```yaml
type: custom:uix-forge
forge:
  mold: card
  sparks:
    - type: event
      other_forge_ids:
        - card_a
        - card_b
element:
  type: markdown
  content: |
    card_a selected: {{ uixForge.event.card_a.selected | default('none') }}
    card_b selected: {{ uixForge.event.card_b.selected | default('none') }}
```

### Combining own ID and other IDs

You can set both `forge_id` and `other_forge_ids` simultaneously:

```yaml
type: custom:uix-forge
forge:
  mold: card
  sparks:
    - type: event
      forge_id: main_card
      other_forge_ids:
        - sidebar_card
element:
  type: markdown
  content: |
    My data: {{ uixForge.event.my_key | default('none') }}
    Sidebar data: {{ uixForge.event.sidebar_card.my_key | default('none') }}
```

## Notes

- The spark is active as soon as the forge element is connected to the DOM and stops listening when it is removed.
- All string values in the `element` config are processed as Jinja2 templates, so `uixForge.event` is available throughout the element config and in UIX styles.
- If no matching event has been received yet, `uixForge.event` will be empty (or absent) — use `| default(...)` in your templates to handle this gracefully.
- Data from successive events is **deep-merged**, not replaced. Sending a second event with `{ forge_id: "my_card", data: { count: 2 } }` after a first one with `{ score: 10 }` results in `uixForge.event` containing both `count` and `score`.
