---
title: Realms
description: Choose where a UIX Broker interaction listens for events.
---
# Realms

The interaction `realm` determines where Broker listens and how its `listen` value is interpreted.

| Realm | `listen` | Event source | Anchor support |
| --- | --- | --- | --- |
| `browser` | DOM event name, such as `click` or `show-dialog` | Browser events on `window` during the capture phase | Event-path expressions from the composed path and `select_tree` paths |
| `shortcut` | [Tinykeys](https://jamiebuilds.github.io/tinykeys/) keybinding, such as `"$mod+Shift+K"` | Browser keyboard event | Event-path expressions from composed path and `select_tree` paths |
| `server` | Home Assistant event-bus [event](https://www.home-assistant.io/docs/configuration/events/) name such as `state_changed`, `component_loaded` or `call_service` | Active frontend connection | `select_tree` paths only |

All realms support [rules](rules.md) and [directives](directives.md). The selected [interaction anchor](interaction-anchors.md) element is always in the current browser, so an event captured from the `server` realm can still update a browser element or dispatch an event to it.

## Listener registrations

Broker registers one browser listener for each distinct `browser`-realm event name and one Home Assistant event-bus subscription for each distinct `server`-realm event name. Interactions that use the same enabled `listen` value share that registration; Broker evaluates their anchors and rules after the event arrives.

For example, two `browser` interactions that both listen for `uix-applied` use one `window` listener, and two `server` interactions that both listen for `state_changed` use one event-bus subscription. Split interactions by their target, rules, or directives when that makes the configuration clearer—grouping them is not needed to reduce listener registrations.

## Browser

`browser` listens at `window` during the capture phase. Use it for DOM events such as `click`, `change`, `show-dialog`, and Home Assistant's custom browser events. `listen` can be one event name or a list when the same interaction should respond to multiple events.

```yaml
- realm: browser
  listen: show-dialog
  anchor: '&home-assistant $ hui-dialog-create-card'
  debug: true
  rules:
    - '@captured.dialogTag': hui-dialog-create-card
  directives:
    - type: property
      set: _currTab
      value: card
```

For example, run one interaction after Broker starts and whenever a panel update emits `uix-update`:

```yaml
- realm: browser
  listen:
    - uix-broker-ready
    - uix-update
  anchor: '&home-assistant'
  directives:
    - type: call
      method: requestUpdate
```

The browser event's `detail` object is the root of captured data. See [Captured-data rules](./rules.md#captured-data-rules) and [Event directive](./directives.md#event) for how captured data is matched and
reused.

### UIX Styling lifecycle events

UIX Styling dispatches the following bubbling, composed browser events from its
`<uix-node>`:

- `uix-applied` — after UIX is attached or reapplied to an element. It can fire
  again when the host updates or UIX configuration is reapplied, so consumers
  should make their directives idempotent.
- `uix-styles-update` — when that UIX node updates its rendered CSS text,
  including template-driven updates. The latest text is available as
  `detail.uix_node._rendered_styles`, but Lit has not yet committed its
  `<style>` element. To read calculated styles in a later directive, first use
  an [`action: javascript`](./directives.md#javascript-action) directive with
  `data.code: "return event.detail.uix_node.updateComplete;"`. The action waits
  for that Promise before the next directive runs.
- `uix-theme-update` — after that UIX node reprocesses a theme update. This
  event fires even when the resulting UIX CSS is unchanged.

All three events provide the originating `<uix-node>` as `detail.uix_node`. Use
the event-path anchor `"< target"` to select its parent element, which is the
element that UIX is applied to whether the node is in light DOM or a shadow root.

For example, set a map's `themeMode` when UIX is applied to its containing map
card and when its theme updates:

```yaml
- realm: browser
  listen:
    - uix-applied
    - uix-theme-update
  anchor: "< target"
  rules:
    - hui-map-card
  directives:
    - type: property
      anchor: "$ ha-map"
      set: themeMode
      value: dark
```

## Shortcut

`shortcut` uses [Tinykeys](https://jamiebuilds.github.io/tinykeys/) to register a browser keybinding at `window`. Its `listen` value uses Tinykeys syntax. `$mod` means `Meta` on macOS and `Control`
on Windows and Linux.

```yaml
- realm: shortcut
  listen: "$mod+Shift+Y"
  anchor: target
  directives:
    - type: call
      method: focus
```

Keybindings can use a key, a code, modifiers, and sequences. Home Assistant also uses Tinykeys for its own shortcuts. Use keybindings that do not conflict with Home Assistant, browser, or operating-system shortcuts. You can disable Home Assistant keyboard shortcuts for the browser to make those keybindings available to UIX Broker, which continues to register keybindings when Home Assistant keyboard shortcuts are disabled.

The initiating `KeyboardEvent` is available to JavaScript actions as `event`. Its composed path can also be used by [interaction anchors](./interaction-anchors.md).

## Server

`server` subscribes to the Home Assistant event bus through the active frontend connection. It has no browser event target, so its interaction anchor must use `select_tree` paths.

```yaml
- realm: server
  listen: state_changed
  anchor: "&home-assistant $$ dynamic-custom-card"
  rules:
    - type: captured
      path: data.entity_id
      match: light.kitchen
  directives:
    - type: property
      set: customCardProperty
      value: "@captured.data.entity_id"
```

For server interactions, captured data has a `data` key containing the Home Assistant event payload (for example, `data.entity_id` or `data.new_state.state`). In rules and directives, captured data can be referenced with `"@captured.data..."`; quotation marks are required for `@` in YAML.

## Blocking

The `block` directive is available in the browser and shortcut realms. Its anchor and host-element rules are resolved synchronously; if a `select_tree` anchor cannot be found immediately, the complete interaction is skipped. This preserves browser propagation and default-action timing. Server events cannot be blocked.

!!! note
    Tinykeys ignores keys pressed in input, textarea, select, and contenteditable areas, so a `shortcut`-realm `block` will not run in these situations. To block a key in these situations, use the `browser` realm with `listen: keydown`, together with captured-data and/or synchronous host-element rules.

    When a shortcut binding does run, `block` prevents the native default action and stops later listeners on `window`. It cannot undo a Home Assistant shortcut handler that has already run.

## Templates

UIX Broker deliberately does not provide a realm that subscribes directly to Jinja2 templates. The [`template` directive](./directives.md#template) can render a template once while an interaction is running, but it does not listen for later changes. For reactive behaviour, use a script, automation, or template entity with a trigger, then fire a custom event on the Home Assistant event bus and listen for it in the `server` realm.

!!! tip
    You can use the [`custom_event`](https://github.com/reubn/hass_custom_event) integration to fire custom events on the Home Assistant event bus, then listen for them in the `server` realm.
