---
description: Learn how UIX contexts apply structured, scoped behavior to Home Assistant UI areas.
---
# UIX contexts

!!! info
    UIX Contexts and Entity-name context available in 9.0.0-beta.3

UIX contexts apply structured behaviour to a UIX host and everything below it. They are a way to make a UI area aware of where it appears without adding selection rules to every consumer.

## Defining a context

Theme context bindings use `uix-<thing>-context-yaml` on any UIX target. The value is a YAML list of bindings. The `anchor` selects where a binding applies; use the same [host/element selector](dom.md#hostelement-path-selection) syntax as UIX styling. The first matching binding is used.

An element that already accepts a `uix:` configuration can define a context directly with `uix.context`. Direct configuration takes precedence over a matching theme binding on the same host.

Contexts apply below their host, so a view context reaches its cards and rows. A card or row can provide a more specific direct context for its own subtree.

## Entity-name context

`entity_name` controls which parts make up an automatic entity name. It does not alter a custom display name set by the user.

### Energy dashboard example

```yaml
my-uix-theme:
  uix-theme: my-uix-theme
  uix-root-context-yaml: |
    - anchor: "&ha-panel-energy"
      entity_name:
        rules:
          - when:
              request: [parent_device, device]
            use: [entity]
```

The example changes Energy dashboard labels from the parent-device and device parts to the entity part only.

### View example

A view can remove repeated device names from cards below it by using the existing `view` target. This transforms a request for the device and entity parts into an entity-only name.

```yaml
my-uix-theme:
  uix-theme: my-uix-theme
  uix-view-context-yaml: |
    - anchor: "&hui-view"
      entity_name:
        rules:
          - when:
              request: [device, entity]
            use: [entity]
```

Card-level `uix.context` can still provide a more specific exception where a particular entity needs its device name.

### Card example

A card can remove repeated device names from rows below it by using the existing `card` target. This transforms a request for the device and entity parts into an entity-only name. Here only entities cards with UIX class tag `type-entities` will match.

```yaml
  uix-card-context-yaml: |
    - anchor: "&.type-entities"
      entity_name:
        rules:
          - when:
              - request: default
              - request: [device, entity]
            use: [entity]
```

### Direct card example

You can add a direct context to a card.

```yaml
uix:
  context:
    entity_name:
      rules:
        - when:
            - request: default
            - request:
                - device
                - entity
          use:
            - entity
```

### Rules

`when.request` is either `default` or an exact list of requested entity-name parts. `when` can also be a list when several requests use the same result. `use` accepts the same shorthand list. The allowed shorthand values are `floor`, `area`, `parent_device`, `device`, and `entity`.

```yaml
entity_name:
  rules:
    - when:
        - request: default
        - request: [device, entity]
      use: [entity]
```

The example uses the entity name for both a default request and a request for the device and entity parts.

```yaml
entity_name:
  rules:
    - when:
        request: [parent_device, device]
      use:
        - type: device
        - type: text
          text: "-"
        - type: entity
```

Home Assistant normally separates name parts with a space, so the example renders `Device - Entity`. For complete punctuation control, use the object form and set the separator explicitly.

```yaml
entity_name:
  rules:
    - when:
        request: [parent_device, device]
      use:
        items:
          - type: device
          - type: text
            text: " — "
          - type: entity
        options:
          separator: ""
```

### Direct configuration

An element that already accepts a `uix:` configuration can provide an entity-name context directly.

```yaml
uix:
  context:
    entity_name:
      rules:
        - when:
            request: default
          use: [entity]
```

## Debugging

Select an affected element in your browser's inspector and run `uix_context($0)` in the console. It shows the contexts inherited by that element and includes a `format()` helper to check a specific name request.

```js
uix_context($0).format("sensor.sun_next_dusk", [
  { type: "device" },
  { type: "entity" },
]);
```

Set `debug: true` in a context while configuring it to log the applied context and the first match for each entity-name rule.

```yaml
uix:
  context:
    debug: true
    entity_name:
      rules:
        - when:
            request: default
          use: [entity]
```
