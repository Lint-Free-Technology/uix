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
- [Action](#action) — run a Home Assistant, frontend, or UIX action.
- [Wait](#wait) — delay the next directive.

## Block

`block` calls `preventDefault()` and `stopImmediatePropagation()` on the initiating browser event.

```yaml
- type: block
```

It is available only in `browser` and `shortcut` realms. The interaction anchor and host-element rule anchors must resolve synchronously; if a required `select_tree` anchor is not already present, UIX Broker skips the complete interaction. A `block` directive is applied before the remaining directives are processed, even when it appears later in the list.

## Directive anchors

`property`, `event`, and `call` directives use the interaction anchor by default. Each can override that default with its own `anchor` configuration. A bare string is relative to the interaction anchor, a string beginning with `&` is a compact absolute document-root `select_tree` path, and `{ select_tree: ... }` is the equivalent long absolute form.

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

Values can refer to captured data. `@captured` resolves to the complete captured-data object, while `@captured.path` resolves to the value at that dot-separated path. The reference is substituted before the property is set and must be quoted in YAML as it starts with `@`.

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

Set `capture_data: true` to copy captured event data into a modified event. The outgoing event's `detail` starts with the initiating interaction's captured data, then overlays values from this directive's `data` object. The `capture_data` option is only available to the `event` directive.

```yaml
- type: event
  name: broker-forwarded-event
  capture_data: true
  data:
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

Every directive accepts `wait`, a non-negative number of milliseconds. UIX Broker waits that long after applying the directive before starting the next one. A `block` directive always runs synchronously, though it can include `wait` to delay later directives.

```yaml
directives:
  - type: event
    name: broker-started-event
    wait: 250
  - type: action
    action: light.turn_on
```
