---
title: Directives
description: Apply declarative UIX Broker operations to a selected element.
---
# Directives

Directives run one at a time after every interaction rule matches. Each directive performs one configured operation, using the interaction anchor by default or an explicitly selected directive anchor where supported. Except for `block`, a directive may also have its own `rules`; the directive runs only when all of them match, otherwise Broker skips it and continues with the next directive.

- [Block](#block) — prevent the initiating browser event's default action and propagation.
- [Property](#property) — set or clear a JavaScript object property.
- [Event](#event) — dispatch a `CustomEvent`.
- [Call](#call) — invoke an element method.
- [Button](#button) — insert an interactive Home Assistant button.
- [Badge](#badge) — insert a Web Awesome-styled status badge.
- [Tile icon](#tile-icon) — insert an interactive Home Assistant tile icon.
- [Tooltip](#tooltip) — attach a styled tooltip to an element.
- [Lock](#lock) — require an unlock challenge before an element can be used.
- [Action handler](#action-handler) — bind Home Assistant actions to an existing element.
- [Action](#action) — run a Home Assistant, frontend, or UIX action.
- [Template](#template) — render a Jinja2 template once and save its result.
- [JavaScript](#javascript) — synchronously evaluate JavaScript and save its return value.
- [Wait](#wait) — delay the next directive.

## Directive rules

Add `rules` to any directive except `block` to condition just that directive. The syntax is the same as [interaction rules](./rules.md). For `property`, `event`, `call`, `action-handler`, `button`, `badge`, `tile-icon`, `tooltip`, and `lock`, host-element rules inspect the resolved directive anchor by default. For `action` and `wait`, they inspect the interaction anchor. A rule's own `anchor` remains relative to that default anchor, or can be absolute as usual.

```yaml
directives:
  - type: property
    set: config.mode
    value: advanced
  - type: call
    method: openAdvancedEditor
    rules:
      - type: captured
        path: allow_advanced
        match: true
```

`panel` rules obtain the current panel state when the directive is reached. This lets an earlier directive run regardless of the current panel while a later directive only runs on a matching panel.

`block` does not accept directive rules. Put its condition in the interaction's `rules` so that the event is synchronously blocked only when the complete interaction matches.

## Block

`block` calls `preventDefault()` and `stopImmediatePropagation()` on the initiating browser event.

```yaml
- type: block
```

It is available only in `browser` and `shortcut` realms. The interaction anchor and host-element rule anchors must resolve synchronously; if a required `select_tree` anchor is not already present, UIX Broker skips the complete interaction. A `block` directive is applied before the remaining directives are processed, even when it appears later in the list.

## Directive anchors

`property`, `event`, `call`, `action-handler`, `button`, `badge`, `tile-icon`, `tooltip`, and `lock` directives use the interaction anchor by default. Each can override that default with its own `anchor` configuration. A bare string is relative to the interaction anchor, a string beginning with `&` is a compact absolute document-root `select_tree` path, and `{ select_tree: ... }` is the equivalent long absolute form.

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

Values can refer to captured data or a previous `template` or `javascript` result. `@captured` resolves to the complete captured-data object, while `@captured.path` resolves to the value at that dot-separated path. Array indexes can use either dot notation (`items.0`) or brackets (`items[0]`); use a quoted bracket key for object properties that contain punctuation, such as `settings['icon-color']`. The reference is substituted before the property is set and must be quoted in YAML as it starts with `@`.

```yaml
- type: property
  set: config.entity
  value: "@captured.entity_id"
```

`template` and `javascript` directives save their value under their `id`. A later directive can use `@id` or a property such as `@id.path`; the value keeps its original type, including objects and arrays. References occupy a complete YAML value — Broker does not interpolate them into a longer string.

## Event

`event` dispatches a `CustomEvent`. Its `target` defaults to `anchor`, meaning the selected directive anchor (or the interaction anchor when no directive anchor is set). Set `target: window` or `target: document` to dispatch globally instead; these targets do not use or resolve an event-specific directive anchor. `bubbles` and `composed` default to `false`, matching the DOM API.

```yaml
- type: event
  name: broker-demo-event
  bubbles: true
  composed: true
  data:
    entity: light.bed_light
```

```yaml
- type: event
  target: window
  name: broker-window-event
  data:
    source: uixBroker
- type: event
  target: document
  name: broker-document-event
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

Use `uix` for UIX styling, including styles inside the button's shadow root. Its UIX type is `uix-broker-button`; the resolved button settings are available as `config`, and prior `template` or `javascript` directive results are available as `directive` in UIX templates.

!!! info
    `button` UIX styling available in 8.3.0-beta.3

```yaml
- type: button
  entity: light.living_room
  label: Toggle
  uix:
    style: |
      :host {
        --uix-button-margin: {{ '6px' if is_state(config.entity, 'on') else '0px' }};
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
| `uix` | object | — | UIX configuration applied to the generated button as type `uix-broker-button`. |
| `tap_action` / `hold_action` / `double_tap_action` | action | — | Home Assistant action to run from the button. |

!!! note
    - Set at most one of `after` and `before`.
    - Button clicks are isolated from the reference element's own action handler.
    - Pointer, mouse, touch, and click events stop at the generated button. This prevents a containing element's ripple or action handler from reacting while retaining the button's own action and ripple.
    - The same `--uix-button-margin` CSS variable as the Forge button spark apply. The default margin is `-6px` for a labelled button and `0px` for an icon-only button.
    - Other CSS variables applicable to the Forge button spark also apply.

## Badge

!!! info
    `badge` directive available in 8.3.0-beta.10

`badge` inserts a `uix-badge` beside the directive anchor. The badge uses Home Assistant's patched Web Awesome base and styles, so its variants follow the active Home Assistant theme. UIX keeps the element namespaced and does not register Web Awesome's global `wa-badge` component.

The badge is inserted after the directive anchor by default. Use `after` or `before` to select a different sibling reference, using the same UIX `select_tree` syntax as `button`. When that reference is an `ha-button` or `ha-tile-icon`, UIX automatically shows the badge on that element instead. For any other target, setting `placement` positions the badge on its parent.

```yaml
- type: badge
  content: 3
  variant: danger
  appearance: filled
  pill: true
```

Use `style` for a flat mapping of CSS property names and values, or `uix` for UIX styling. Its UIX type is `uix-broker-badge`; the resolved badge settings are available as `config`, and prior `template` or `javascript` directive results are available as `directive` in UIX templates.

```yaml
- type: badge
  anchor: "$ div.title"
  before: ".label"
  content: Experimental
  variant: warning
  appearance: outlined
  start_icon: mdi:flask-outline
  style:
    margin-inline-start: 8px
```

| Key | Type | Default | Description |
| --- | --- | --- | --- |
| `after` | string | directive anchor | Relative selector for the reference element. Normally, the badge is inserted after it. For an `ha-button` or `ha-tile-icon`, the badge is shown on that element instead. With `placement` set for any other element type, the badge is positioned on its parent. |
| `before` | string | — | Relative selector for the reference element. Normally, the badge is inserted before it. For an `ha-button` or `ha-tile-icon`, the badge is shown on that element instead. With `placement` set for any other element type, the badge is positioned on its parent. |
| `for` | `previous` | — | Use immediately after an element-producing directive to target the element it created. Cannot be combined with `after` or `before`. |
| `content` | string or number | `""` | Text displayed in the badge. |
| `variant` | string | `brand` | `brand`, `neutral`, `success`, `warning`, or `danger`. |
| `appearance` | string | `accent` | `accent`, `filled`, `outlined`, or `filled-outlined`. |
| `pill` | boolean | `false` | Use the fully rounded pill shape. |
| `attention` | string | `none` | `none`, `pulse`, or `bounce`. |
| `placement` | string | — | For `ha-button` and `ha-tile-icon`, chooses where on the element the badge appears. For any other target, positions the badge on its parent instead of inserting it as a sibling. All placement options use compact `var(--ha-font-size-xs)` text with `0.25em 0.5em` padding. `top`, `top-start`, `top-end`, `bottom`, `bottom-start`, `bottom-end`, `left`, `left-start`, `left-end`, `right`, `right-start`, or `right-end`. |
| `start_icon` / `end_icon` | string | — | MDI icon before or after the content. |
| `style` | object | — | Flat map of CSS property names and string or numeric values, set inline on `uix-badge`. |
| `uix` | object | — | UIX configuration applied to the generated badge as type `uix-broker-badge`. |

### Automatic placement

Automatic placement applies only when the resolved directive anchor or `after` / `before` reference is one of these elements. A UIX-generated button spark is treated as its contained `ha-button`.

| Target | Placement | Implementation |
| --- | --- | --- |
| `ha-button` | Top-end corner | UIX adds the badge inside the button, matching Web Awesome's button-badge pattern. Its diameter aligns with the button's rendered top and end edge. A UIX-generated button spark is also recognised. |
| `ha-tile-icon` | Top-end corner | UIX uses the tile icon's documented default slot, Home Assistant's own tile-badge corner offsets, and compact tile-badge sizing. |

For these targets, `after` and `before` identify the element that receives the badge; they do not control sibling insertion.

Without `placement`, other target types use normal sibling insertion. Setting `placement` opts into parent-relative placement: UIX keeps the badge outside the target and positions it at the parent’s edge. It does not measure or alter the selected target, so this works best when the target fills its parent.

All placement modes use Home Assistant's compact `--ha-font-size-xs` font size and tight `0.25em 0.5em` padding by default, keeping badge size consistent.

Set `placement` using the same values as `wa-tooltip`: `top`, `top-start`, `top-end`, `bottom`, `bottom-start`, `bottom-end`, `left`, `left-start`, `left-end`, `right`, `right-start`, and `right-end`. `ha-button` and `ha-tile-icon` default to `top-end`. For every other target, providing `placement` positions the badge on the parent; omitting it keeps the badge as a normal sibling.

Set the [Forge badge CSS variables](../forge/sparks/badge.md#css-variables) through `style` for a single Broker badge, or through `uix` styling for reusable rules. `--uix-badge-offset-x` and `--uix-badge-offset-y` adjust any placed badge after its placement is resolved; positive values move right and down respectively.

```yaml
- type: badge
  after: "$ ha-button"
  content: 3
  variant: danger
  pill: true
  placement: bottom-end
```

Use `for: previous` directly after a `button` directive to show a badge on the button it created. The previous element is the generated `ha-button`, so it is placed automatically.

```yaml
- type: button
  label: Living Room
  end_icon: mdi:lightbulb-fluorescent-tube-outline
  tap_action:
    action: toggle
- type: badge
  for: previous
  content: 3
  variant: danger
  pill: true
```

!!! note
    - Set at most one of `after` and `before`.
    - `for: previous` cannot be combined with `after` or `before`.
    - `ha-button` and `ha-tile-icon` targets receive the badge directly rather than as a sibling.
    - `content` is inserted as text, not HTML.

## Tile icon

!!! info
    `tile-icon` directive available in 8.3.0-beta.3


`tile-icon` inserts a Home Assistant `ha-tile-icon` beside the directive anchor. It uses the same icon rendering and action handling as the [Forge tile-icon spark](../forge/sparks/tile-icon.md). The tile icon is inserted after the directive anchor by default.

Use `after` or `before` to select a different reference element. These paths are relative to the resolved directive anchor and support the usual UIX `select_tree` syntax. The tile icon is inserted as a sibling of the matched reference element.

```yaml
- type: tile-icon
  entity: light.living_room
  tap_action:
    action: toggle
```

```yaml
- type: tile-icon
  anchor: "$ ha-dialog"
  before: "div.header"
  entity: light.living_room
  icon: mdi:star
  color: orange
  tap_action:
    action: more-info
```

Use `style` for a flat mapping of CSS property names and values. The properties are set inline on the generated `ha-tile-icon`, which is useful for positioning and sizing the icon where dashboard styling cannot reach it.

```yaml
- type: tile-icon
  entity: light.living_room
  style:
    margin-inline-start: 8px
    "--tile-icon-size": 28px
    z-index: 1
```

Use `uix` for UIX styling, including styles inside the tile icon's shadow root. Its UIX type is `broker-tile-icon`; the resolved tile-icon settings are available as `config`, and prior `template` or `javascript` directive results are available as `directive` in UIX templates.

```yaml
- type: tile-icon
  entity: light.living_room
  uix:
    style: |
      :host {
        --tile-icon-size: {{ '32px' if is_state(config.entity, 'on') else '24px' }};
      }
```

| Key | Type | Default | Description |
| --- | --- | --- | --- |
| `after` | `string` | directive anchor | Relative selector for the reference element. The tile icon is inserted after it. |
| `before` | `string` | — | Relative selector for the reference element. The tile icon is inserted before it. |
| `entity` | `string` | — | Entity whose state icon is rendered. It supplies the default tap action: `toggle` for toggleable entities, otherwise `none`. |
| `icon` | `string` | — | MDI icon. With `entity`, it overrides the entity's normal state icon. |
| `icon_path` | `string` | — | SVG path passed to `ha-tile-icon` as `iconPath`. |
| `image_url` | `string` | — | Image URL passed to `ha-tile-icon` as `imageUrl`. |
| `color` | CSS color | — | Tile icon colour. With `entity`, this is applied while the entity is active. |
| `style` | object | — | Flat map of CSS property names and string or numeric values, set inline on `ha-tile-icon`. |
| `uix` | object | — | UIX configuration applied to the generated tile icon as type `broker-tile-icon`. |
| `tap_action` / `hold_action` / `double_tap_action` | action | — | Home Assistant action to run from the tile icon. |

!!! note
    - Set at most one of `after` and `before`.
    - Supply an icon source with `icon`, `icon_path`, `image_url`, or `entity`.
    - Entity-based tile icons update when Home Assistant state updates.
    - Pointer, mouse, touch, and click events stop at the generated icon. This prevents a containing element's ripple or action handler from reacting while retaining the tile icon's own action and ripple.
    - Broker adds the `data-uix-broker-tile-icon` attribute to each generated tile icon, so it can be selected from UIX styling.

## Tooltip

`tooltip` attaches a Home Assistant `wa-tooltip` beside the selected target. Its options and CSS variables match the [Forge tooltip spark](../forge/sparks/tooltip.md). By default, `for` is the resolved directive anchor; a selector is relative to that anchor and uses the normal UIX `select_tree` syntax. The target must resolve to an element, not a terminal shadow root.

```yaml
- type: tooltip
  content: Open the living-room light controls
  placement: bottom
```

Use `for: previous` directly after a UI directive to attach the tooltip to the element it created. It works with `button`, `badge`, and `tile-icon`, and will work with later element-producing directives without needing an element selector.

```yaml
- type: button
  icon: mdi:lightbulb
  tap_action:
    action: toggle
- type: tooltip
  for: previous
  content: Toggle the light
  placement: bottom
```

```yaml
- type: tooltip
  for: "$ ha-dialog ha-icon-button"
  content: Close
  without_arrow: true
```

Use `style` for a flat mapping of CSS properties. This is particularly useful for setting the `--uix-tooltip-*` variables directly on the generated tooltip.

```yaml
- type: tooltip
  for: previous
  content: Toggle the light
  style:
    "--uix-tooltip-background-color": var(--primary-color)
    "--uix-tooltip-content-color": white
    "--uix-tooltip-max-width": 24ch
```

`trigger` accepts Web Awesome's space-separated `hover`, `focus`, `click`, and `manual` activation modes. When `hover` is enabled, the tooltip remains open while the pointer moves from the target into the tooltip body, allowing constrained content to be scrolled. `manual` does not activate automatically; use `open` to set its state when the directive runs.

```yaml
- type: tooltip
  for: previous
  trigger: manual
  open: true
  content: This tooltip is opened by the directive
```

| Key | Type | Default | Description |
| --- | --- | --- | --- |
| `for` | string | directive anchor | Target selector, or `previous` for the preceding element-producing directive. |
| `content` | string or number | `""` | HTML content of the tooltip body. Numbers are rendered as text. |
| `placement` | string | `"top"` | `top`, `top-start`, `top-end`, `bottom`, `bottom-start`, `bottom-end`, `left`, `left-start`, `left-end`, `right`, `right-start`, or `right-end`. |
| `distance` | number | `8` | Gap in pixels between tooltip and target. |
| `skidding` | number | `0` | Offset in pixels along the target axis. |
| `show_delay` | number | `150` | Milliseconds before the tooltip shows. |
| `hide_delay` | number | `150` | Milliseconds before the tooltip hides. |
| `trigger` | string | `"hover focus"` | Space-separated activation modes: `hover`, `focus`, `click`, or `manual`. |
| `open` | boolean | `false` | Set the tooltip's open state when the directive runs. This is particularly useful with `trigger: manual`. |
| `without_arrow` | boolean | `false` | Hide the directional arrow. |
| `style` | object | — | Flat map of CSS property names and string or numeric values, set inline on `wa-tooltip`. |

The tooltip is inserted as a sibling of its target. Set the `--uix-tooltip-*` CSS variables on the target's parent or an ancestor to customise it; see the [Forge tooltip spark CSS variables](../forge/sparks/tooltip.md#css-variables-reference).

## Lock

`lock` overlays the directive anchor and prevents it being used until the current user completes the configured PIN, passphrase, or confirmation challenge. It uses the same access matching, retry handling, icons, and `--uix-lock-*` CSS variables as the [Forge lock spark](../forge/sparks/lock.md).

```yaml
- type: lock
  action: tap
  duration: 5s
  entity: light.living_room
  unlocked_action:
    action: toggle
  locks:
    - code: 1234
      admins: true
```

The directive anchor is the locked element by default. Set `for` to a relative selector to lock a descendant, or use `for: previous` directly after an element-producing directive such as `button`, `badge`, or `tile-icon`.

```yaml
- type: button
  icon: mdi:account
- type: lock
  for: previous
  locks:
    - confirmation: true
      admins: true
```

Use `anchor` to change the directive's root for `for` selectors. `locks`, `permissive`, `code_dialog`, `action`, `duration`, `icon_locked`, `icon_unlocked`, `icon_locked_color`, `icon_unlocked_color`, `icon_position`, and `icon_size` have the same meaning as the Forge lock spark.

`unlocked_action` is optional. A normal Home Assistant action runs against `entity`; `element_tap`, `element_hold`, and `element_double_tap` dispatch the corresponding action from the locked element's `config` when it has one.

Use `style` for a flat mapping of CSS property names and values on the generated lock overlay. The `--uix-lock-*` CSS variables are generally preferable because they continue to apply as the lock transitions between locked, unlocked, and blocked states.

```yaml
- type: lock
  style:
    "--uix-lock-background": rgba(0, 0, 0, 0.25)
    "--uix-lock-icon-size": 20px
    z-index: 2
```

Use `uix` for UIX Styling on the generated overlay. Its UIX type is `uix-broker-lock`; the resolved lock settings are available as `config`, and results from earlier `template` or `javascript` directives are available as `directive`.

```yaml
- type: lock
  locks:
    - confirmation: true
      admins: true
  uix:
    style: |
      :host {
        --uix-lock-background: {{ 'rgba(0, 0, 0, 0.35)' if config.locks else 'transparent' }};
      }
```

## Action handler

`action-handler` binds Home Assistant's action handler to the directive anchor. Configure one or more standard Home Assistant actions; `tap_action`, `hold_action`, and `double_tap_action` are all supported. The matching action is dispatched from the anchor as a normal `hass-action` event.

Each configured action type is owned by UIX Broker: its `action` event does not reach other listeners on the anchor or its ancestors. Use the directive to replace existing behavior for that action type, not to combine actions. Omit an action type, or set its action to `none`, to leave it untouched.

Set `entity` to pass an entity ID through to entity-based actions such as `toggle` and `more-info`.
`cursor` sets the cursor on only this directive's anchor and defaults to `pointer`; use any CSS cursor value, such as `default` or `auto`, to override it.

```yaml
- type: action-handler
  anchor: "$ div.menu div.title"
  tap_action:
    action: navigate
    navigation_path: /home
```

```yaml
- type: action-handler
  anchor: "$ div.menu div.title"
  cursor: default
  entity: light.living_room
  tap_action:
    action: toggle
  hold_action:
    action: more-info
  double_tap_action:
    action: navigate
    navigation_path: /dashboard-lights
```

| Key | Type | Description |
| --- | --- | --- |
| `entity` | string | Entity ID passed to entity-based actions. |
| `cursor` | string | CSS cursor for the anchor. Defaults to `pointer`. |
| `tap_action` | action | Action to perform on tap. |
| `hold_action` | action | Action to perform on hold. |
| `double_tap_action` | action | Action to perform on double tap. |

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

## Template

`template` renders a Home Assistant Jinja2 template once through the template API; it does not create a template subscription. Its string result is stored under `id` for the remaining directives in that interaction.

Every uncached render is a round trip to the Home Assistant server. Avoid using it on interactions that can run frequently. Set `cache` to a positive number of milliseconds when a slightly stale value is acceptable:

```yaml
- type: template
  id: example
  cache: 5000
  template: "{{ states('sensor.example') }}"
```

The cache is held in the browser and shared by template directives using the same template text and prior directive results. A cached value is used only when it is younger than the directive's `cache` duration; `cache: 0` (or omitting `cache`) always renders again. The cache stores only successful results, is cleared when Broker configuration reloads, and does not observe template changes during the cache period. When `cache` is enabled, prior directive results must be JSON-serializable because they form part of the cache key; circular objects cannot be cached.

```yaml
- type: template
  id: log_provider_url
  template: "/config/logs?provider={{ states('input_select.log_provider') }}"
- type: button
  after: "&home-assistant $ home-assistant-main $ ha-config-system-navigation $ ha-config-navigation-list $ ha-list-item-button:nth-of-type(4) $ a#item div.content"
  icon: mdi:open-in-new
  color: var(--primary-color)
  tap_action:
    action: url
    url_path: "@log_provider_url"
```

`id` must start with a letter or underscore and can then contain letters, numbers, underscores, and hyphens. The name `captured` is reserved for `@captured` event data and cannot be used as an ID. Use dot or bracket array paths to select a saved object or array value, just as for `@captured`. Quoted bracket keys also work, for example `@config_path['icon-color']` or `@config_path["icon-color"]`.

Templates receive prior directive results in the top-level `directive` variable. For example, a prior directive with `id: provider` is available as `{{ directive.provider }}`. This namespace contains only results from earlier directives in the same interaction.

## JavaScript

`javascript` evaluates `code` once and saves its synchronous return value under `id`. The code receives `hass`, `anchor`, `event`, `captured`, and `directive`; `directive` contains prior directive results from the same interaction. Return a scalar, object, or array; the following directives can use it as `@id` without conversion.

```yaml
- type: javascript
  id: config_path
  code: |
    const provider = hass.states['input_select.log_provider'].state;
    return {
      path: `/config/logs?provider=${provider}`,
      label: `Open ${provider.charAt(0).toUpperCase() + provider.slice(1)} logs`,
    };
- type: button
  icon: mdi:open-in-new
  label: "@config_path.label"
  tap_action:
    action: url
    url_path: "@config_path.path"
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
