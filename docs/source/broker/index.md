---
title: UIX Broker
description: Create declarative frontend event interactions for Home Assistant with UIX Broker.
---
# UIX Broker

UIX Broker turns browser events, keyboard shortcuts, and Home Assistant event-bus events into declarative interactions. An interaction selects a browser element, checks optional rules, then runs directives in their configured order. The `block` directive is an exception: it blocks the initiating event synchronously before the remaining directives run.

```text
Realm → Listen → Interaction anchor → Rules (Optional anchors) → Directives (Optional anchors)
```

Use UIX Broker when an interface behaviour can be configured rather than written as a custom card, script, or patch. UIX Broker can react to a click, customise an event before redispatching it, focus an element, update an object property, and invoke a safe element method. It can also add buttons, badges, text, tile icons, tooltips, and unlock challenges; bind or run Home Assistant actions; render templates; evaluate JavaScript; and pause between operations.

```yaml
uix_broker:
  - realm: browser
    listen: click
    anchor: target
    rules:
      - ".action-button"
    directives:
      - type: block
      - type: event
        name: another-action
        data:
          source: action-button
```

## UIX Broker guides

- [Broker](./broker.md) — interaction structure, configuration sources, lifecycle, and debugging.
- [Realms](./realms.md) — browser events, keyboard shortcuts, and Home Assistant event-bus events.
- [Interaction Anchors](./interaction-anchors.md) — composed event-path and `select_tree` element selection.
- [Rules](./rules.md) — host-element, captured-data, browser-identity, user, administrator-status, URL-fragment, search-parameter, and panel matching.
- [Directives](./directives.md) — `block`, `property`, `event`, `call`, `button`, `badge`, `text-content`, `tile-icon`, `tooltip`, `lock`, `action-handler`, `action`, `template`, `javascript`, and `wait`.
- [Examples](./examples.md) — examples. Also see [UIX Guides](https://uix-guides.lf.technology), where further detailed examples may be published.

!!! note
    For browser-identity matching, [Browser Mod](https://github.com/thomasloven/hass-browser_mod) is required.
