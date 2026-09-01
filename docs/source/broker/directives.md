---
title: Directives
description: Apply declarative UIX Broker operations to a selected element.
---
# Directives

!!! note
    UIX Broker is available in 8.2.0-beta.2

Directives run one at a time after every interaction rule matches. Each directive performs one configured operation, using the interaction anchor by default or an explicitly selected directive anchor where supported.

- [Block](#block) — prevent the initiating browser event's default action and propagation.
- [Property](#property) — set or clear a JavaScript object property.
- [Event](#event) — dispatch a `CustomEvent`.
- [Call](#call) — invoke an element method.
- [Button](#button) — insert an interactive Home Assistant button.
- [Action](#action) — run a Home Assistant, frontend, or UIX action.
- [Wait](#wait) — delay the next directive.

## Block

`block` calls `preventDefault()` and `stopImmediatePropagation()` on the initiating browser event.

```yaml
- type: block
```

It is available only in `browser` and `shortcut` realms. The interaction anchor and host-element rule anchors must resolve synchronously; if a required `select_tree` anchor is not already present, UIX Broker skips the complete interaction. A `block` directive is applied before the remaining directives are processed, even when it appears later in the list.

## Directive anchors

`property`, `event`, `call`, and `button` directives use the interaction anchor by default. Each can override that default with its own `anchor` configuration. A bare string is relative to the interaction anchor, a string beginning with `&` is a compact absolute document-root `select_tree` path, and `{ select_tree: ... }` is the equivalent long absolute form.

```yaml
directives:
  - type: property
    anchor: "$ ha-dialog"
    set: withoutHeader
    value: true
  - type: event
    anchor: "&home-assistant $$ ha-automation-sidebar"
    name: broker-sidebar-event
  - type: call
    anchor:
      select_tree: "home-assistant $ ha-more-info-dialog"
    method: closeDialog
```

Use the `uix_broker_path($0)` console helper in the browser console to find a relative directive-anchor path.

See [Interaction Anchors](./interaction-anchors.md#anchors-in-rules-and-directives) for the selection formats.

See [Finding paths in the browser console](./interaction-anchors.md#finding-paths-in-the-browser-console) for more information on the console helpers available.

## Property

`property` directive changes the selected anchor's JavaScript object. `set` takes a dot-separated property path, creates any missing intermediate plain-object levels, and assigns the value at the final property. `clear` takes the same kind of path and deletes only the final property; it does not remove its parent objects.

```yaml
- type: property
  set: config.heading
  value: New title
- type: property
  clear: config.icon
```

Values can refer to captured data. `@captured` resolves to the complete captured-data object, while `@captured.path` resolves to the value at that dot-separated path. Array indexes can use either dot notation (`items.0`) or brackets (`items[0]`). The reference is substituted before the property is set and must be quoted in YAML as it starts with `@`.

```yaml
- type: property
  set: config.entity
  value: "@captured.entity_id"
```

## Event

`event` dispatches a `CustomEvent` on the selected anchor, which is either the override anchor or the default interaction anchor. `bubbles` and `composed` default to `false`, matching the DOM API.

```yaml
- type: event
  name: broker-demo-event
  bubbles: true
  composed: true
  data:
    entity: light.bed_light
```

Set `capture_data: true` to copy captured event data into a modified event. The outgoing event's `detail` starts with the initiating interaction's captured data, then shallowly overlays values from this directive's `data` object. The `capture_data` option is only available to the `event` directive.

```yaml
- type: event
  name: broker-forwarded-event
  capture_data: true
  data:
    source: uixBroker
```

Set `capture_data: deep` when nested plain objects should be merged instead. Directive `data` wins for conflicting values; arrays and non-plain objects are replaced as complete values. This leaves `capture_data: true` unchanged.

```yaml
- type: event
  name: broker-forwarded-event
  capture_data: deep
  data:
    params:
      source: uixBroker
```

## Call

`call` invokes a method on the selected anchor. `method` accepts a safe dot-separated method path and preserves the method object's `this` binding. `args`, when provided, must be an array and supports captured-data substitution.

```yaml
- type: call
  method: focus
- type: call
  method: setSelectionRange
  args: [0, 5]
```

## Button

`button` inserts a Home Assistant `ha-button` beside the directive anchor. It uses the same button configuration and action handling as the [Forge button spark](../forge/sparks/button.md). The button is inserted after the directive anchor by default.

Use `after` or `before` to select a different reference element. These paths are relative to the resolved directive anchor and support the usual UIX `select_tree` syntax. The button is still inserted as a sibling of the matched reference element.

```yaml
- type: button
  label: Toggle
  entity: light.living_room
  tap_action:
    action: toggle
```

```yaml
- type: button
  anchor: "$ ha-dialog"
  before: "div.header"
  label: Toggle
  entity: light.living_room
  tap_action:
    action: toggle
```

Use `style` for a flat mapping of CSS property names and values. The properties are set inline on the generated `ha-button`, which is useful for button dimensions and spacing that cannot be styled from dashboard configuration.

```yaml
- type: button
  anchor: "$ div.menu div.title"
  icon: mdi:hammer
  color: red
  size: s
  tap_action:
    action: navigate
    navigation_path: /config/tools
  style:
    "--ha-button-box-shadow": rgba(0, 0, 0, 0.1) 0px 4px 12px
    "--ha-icon-button-size": 32px
```

### Further UIX styling

Use `style` for simple inline properties. For further customisation, use UIX styling — normally through a theme. First create the button, select the generated `ha-button` in your browser's element inspector, then run `uix_path($0)` to generate the appropriate theme variable and selector path.

Use a theme when you need templates or styles inside a shadow root. See [DOM navigation](../concepts/dom.md) for selector paths and [UIX application](../concepts/application.md) for how UIX styling is applied.

For example, a button inserted into the sidebar can be styled through `uix-sidebar-yaml`:

```yaml
uix-sidebar-yaml: |
  .: |
    div[data-uix-broker-button] ha-button {
      --uix-button-margin: 6px;
    }
```

| Key | Type | Default | Description |
| --- | --- | --- | --- |
| `after` | `string` | directive anchor | Relative selector for the reference element. The button is inserted after it. |
| `before` | `string` | — | Relative selector for the reference element. The button is inserted before it. |
| `entity` | `string` | — | Entity ID used by entity-based actions. |
| `icon` | `string` | — | MDI icon placed in the button label slot. It takes precedence over `label`. |
| `color` | `string` | — | Icon colour for an icon-only button. |
| `label` | `string` | `""` | Button label. |
| `start_icon` / `end_icon` | `string` | — | MDI icon before or after the label. |
| `variant` | `string` | Home Assistant default | `brand`, `neutral`, `danger`, `warning`, or `success`. Icon-only buttons default to `neutral`. |
| `appearance` | `string` | Home Assistant default | `accent`, `filled`, `outlined`, or `plain`. Icon-only buttons default to `plain`. |
| `size` | `string` | — | `s` (small) or `m` (medium). |
| `style` | object | — | Flat map of CSS property names and string or numeric values, set inline on `ha-button`. |
| `tap_action` / `hold_action` / `double_tap_action` | action | — | Home Assistant action to run from the button. |

!!! note
    - Set at most one of `after` and `before`.
    - Button clicks are isolated from the reference element's own action handler.
    - The same `--uix-button-margin` and `--uix-button-label-text-wrap` CSS variables as the Forge button spark apply. The default margin is `-6px` for a labelled button and `0px` for an icon-only button.

## Action

`action` runs a Home Assistant service call, a standard frontend action, or one of the UIX Broker-specific actions.

```yaml
- type: action
  action: light.turn_on
  target:
    entity_id: light.example

- type: action
  action: fire-dom-event
  uix:
    action: toast
    data:
      message: Done
```

### JavaScript action

`action: javascript` is a UIX Broker action. Put the code in `data.code`. UIX Broker automatically passes `hass`, `anchor`, `event`, and `captured` as variables. `hass` is the active Home Assistant object, `anchor` is the resolved interaction anchor DOM element, `event` is the initiating event, and `captured` is the interaction's captured data.

```yaml
- type: action
  action: javascript
  data:
    code: |
      console.log(anchor, event, captured)
```

Use JavaScript only from trusted UIX configurations.

## Wait

Use `wait` to pause a directive sequence without performing another operation. It requires a non-negative number of milliseconds.

```yaml
directives:
  - type: wait
    wait: 500
  - type: action
    action: light.turn_on
    target:
      entity_id: light.example
```

Every directive also accepts `wait`, a non-negative number of milliseconds. In that form, UIX Broker waits after applying the directive before starting the next one. A `block` directive always runs synchronously, though it can include `wait` to delay later directives.

```yaml
directives:
  - type: event
    name: broker-started-event
    wait: 250
  - type: action
    action: light.turn_on
```
