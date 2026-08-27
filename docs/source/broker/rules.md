---
title: Rules
description: Match UIX Broker interactions against elements, captured data, and browser identity.
---

# Rules

!!! note
    UIX Broker is available in 8.2.0-beta.2

Every interaction rule must match before Broker runs its directives. Rules use the interaction anchor by default, but can also specify a relative or absolute override anchor.

For non-`block` interactions, UIX Broker retries a missing rule override anchor every 50 ms for up to two seconds. This is useful for interfaces, such as dialogs, that mount after their initiating event fires.

## Host-element rules

Compact string rules use [UIX host-element path](../concepts/dom.md#hostelement-path-selection) matching against the interaction anchor or an override anchor.

`Tag`, `class`, `id`, `attribute`, and `property` selectors are supported.

Compact rules match against the interaction anchor, allowing for terse one-line rule definitions.

The rule list below matches when the interaction anchor:

- is `ha-button.action-button[data-action]`;
- has an object property `config.entity` that equals `light.example`;
- has an object property `controller` that is present but `undefined`; and
- does not have the object property `uixBrokerGuard`.

```yaml
rules:
  - "ha-button.action-button[data-action]"
  - "{.config.entity=light.example}"
  - "{.controller=undefined}"
  - "{!.uixBrokerGuard}"
```

Use the expanded form when a rule must inspect a different anchor element. Its `anchor` config selects the element to test, and its `match` applies [UIX host-element path](../concepts/dom.md#hostelement-path-selection) matching to that selected element. A rule `anchor` is relative to the interaction anchor; prefix it with `&` for an absolute document root `select_tree` path. The expanded `select_tree` form is also available and is always absolute to the document root.

```yaml
rules:
  # Relative rule anchor with a tag match
  - anchor: "$ ha-dialog"
    match: "ha-dialog"

  # Compact absolute rule anchor with a tag match
  - anchor: "&home-assistant $$ ha-automation-sidebar"
    match: "ha-automation-sidebar"

  # Long absolute rule anchor with a host-element object property match
  - anchor:
      select_tree: "home-assistant $$ ha-automation-sidebar"
    match: "{._yamlMode=false}"
```

!!! tip
    Rule anchors use the same [select-tree syntax](./interaction-anchors.md#select-tree-anchors) as directive anchors and are retried while a non-`block` interaction is running.

!!! tip
    Host-element object property match `{.property=undefined}` matches only when the property exists and its value is `undefined`. `{!.property}` matches only when the property is absent.

## Typed rules

Typed rules have a `type` key. The supported types are `browserid` and `captured`.

### Browser identity

The `browserid` rule matches a [Browser Mod](https://github.com/thomasloven/hass-browser_mod) browser id. Use the key `id`, `browser_id`, or `value` for the expected browser identity.

```yaml
rules:
  - type: browserid
    id: kitchen-tablet
```

## Captured-data rules

Use `type: captured` to match data collected from the initiating event. `path` is a dot-separated optional-chaining path relative to captured data; do not start it with `@captured`.

For browser and shortcut interactions, captured data starts at the DOM event's `detail`. For server interactions, Home Assistant event data is under `data`. Array indexes are supported.

```yaml
rules:
  - type: captured
    path: data.new_state.state
    match:
      operator: ">="
      value: 20
```

Simple match values support exact values, wildcards, regular expressions, and numeric comparisons:

```yaml
rules:
  - type: captured
    path: button
    match: "save*"
  - type: captured
    path: room
    match: "/^kitchen/i"
  - type: captured
    path: count
    match: ">= 20"
```

### Advanced matching

A matcher object supports `operator`, `value` (or `match`), `ignore_case`, `exists`, and nested `and`, `or`, and `not` compositions.

Supported operators are `>`, `<`, `=`, `<=`, `>=`, `==`, `!=`, `contains`, `starts_with`, `ends_with`, and `is_undefined`.

```yaml
rules:
  - type: captured
    path: button
    match:
      or:
        - "save*"
        - "/^submit$/i"
  - type: captured
    path: count
    match:
      and:
        - "> 0"
        - "<= 10"
  - type: captured
    path: data.value
    match:
      operator: is_undefined
      exists: true
```

`is_undefined` with `exists: true` distinguishes a present property whose value is `undefined` from a missing path. Use `exists: false` to explicitly match a missing path.

### Compact captured-data form

For compact configurations, map one or more captured paths directly in an object rule. Every entry must match. The `@captured` prefix is retained only in this compact form.

```yaml
rules:
  - "@captured.user.role": admin
    "@captured.enabled": true
```
