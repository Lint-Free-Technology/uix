---
description: Use the search spark to find elements within a shadow-DOM path and apply class, attribute, or text mutations to all matching elements.
icon: material/magnify
---

# :magnifying_glass: Search spark

The `search` spark queries a container element with a CSS selector, optionally filters the results by a text regex, and then applies class, attribute, and/or text mutations to every matching element. It also sets up a `MutationObserver` so that newly added elements (for example, calendar events after month navigation) are automatically processed without any additional configuration.

## Basic usage

Add a `search` entry to `forge.sparks`:

```yaml
type: custom:uix-forge
forge:
  mold: card
  sparks:
    - type: search
      for: hui-calendar-card $ ha-full-calendar $
      query: .event-container
      text: "Meeting"
      actions:
        add_class:
          - highlight
element:
  type: calendar
  entities:
    - calendar.work
```

`query` is a CSS selector passed to `querySelectorAll` on the resolved container. `text` is a regex that is tested against the full text content of each matched element (including text inside child elements such as `<a>` or `<span>`). Only elements that pass the text filter receive the `actions`.

## Configuration

| Key | Type | Required | Default | Description |
| --- | ---- | -------- | ------- | ----------- |
| `type` | `string` | ✅ | — | Must be `search`. |
| `for` | `string` | | `element` | UIX selector for the container element to search within. Supports `$` for shadow-root crossings (see [DOM navigation](../../concepts/dom.md)). Default `element` refers to the root of the forged element. |
| `query` | `string` | ✅ | — | CSS selector passed to `querySelectorAll` on the resolved container. All matching elements receive the configured `actions`. |
| `text` | `string` | | — | Regular expression string. When provided, only elements whose full text content (including text inside child elements) matches the regex are processed. |
| `actions` | `object` | | `{}` | Mutations to apply to each matching element. See [Actions](#actions) below. |

!!! tip
    Use the [`uix_forge_path()`](../../concepts/dom.md#uix_forge_path0-forge-helper) console helper to find the exact selector for `for`.

### Actions

The `actions` object may contain any combination of the following keys. All keys are optional.

| Key | Type | Description |
| --- | ---- | ----------- |
| `add_class` | `list[string]` | CSS class names to add to each matching element. |
| `remove_class` | `list[string]` | CSS class names to remove from each matching element. |
| `add_attribute` | `list[{attribute, value}]` | HTML attributes to set. Each entry must have an `attribute` name and a `value` string. |
| `remove_attribute` | `list[string]` | HTML attribute names to remove from each matching element. |
| `replace_text` | `string` \| `{find, replace}` | Regex-based text replacement applied to every text node inside the element. A **string** is used as the regex pattern and the match is replaced with an empty string. An **object** with `find` and `replace` keys replaces each match with the `replace` value. |
| `prepend_text` | `string` | Text to prepend to every text node inside the element. |
| `append_text` | `string` | Text to append to every text node inside the element. |

!!! note
    All mutations are **reversible**. When the spark is disconnected, or its configuration changes, every class, attribute, and text change is restored to its original value.

## Examples

### Add a CSS class to calendar events matching a regex

```yaml
type: custom:uix-forge
forge:
  mold: card
  sparks:
    - type: search
      for: hui-calendar-card $ ha-full-calendar $
      query: .event-container
      text: "^(Meeting|Standup)"
      actions:
        add_class:
          - work-event
element:
  type: calendar
  entities:
    - calendar.work
  uix:
    style: |
      .work-event {
        background: teal !important;
      }
```

### Remove an attribute from all matched elements

Strip `title` attributes from every link inside a markdown card so the browser's native tooltip does not appear:

```yaml
type: custom:uix-forge
forge:
  mold: card
  sparks:
    - type: search
      for: hui-markdown-card $ ha-markdown $
      query: a[title]
      actions:
        remove_attribute:
          - title
element:
  type: markdown
  content: |
    [Home Assistant](https://home-assistant.io "Open source home automation")
```

### Rewrite text inside matched elements

Replace a static unit label in every sensor row:

```yaml
type: custom:uix-forge
forge:
  mold: card
  sparks:
    - type: search
      for: hui-entities-card $
      query: .secondary
      text: "°F"
      actions:
        replace_text:
          find: "°F"
          replace: "°C"
element:
  type: entities
  entities:
    - sensor.outdoor_temperature
```

### Prepend and append text

Add a prefix and suffix to every matched badge label:

```yaml
type: custom:uix-forge
forge:
  mold: card
  sparks:
    - type: search
      for: hui-entities-card $
      query: .badge-label
      actions:
        prepend_text: "[ "
        append_text: " ]"
element:
  type: entities
  entities:
    - sensor.battery_level
```

### Match text inside child elements

The `text` filter matches the **full** text content of each element, including text wrapped inside child elements like `<a>`, `<span>`, etc.:

```yaml
type: custom:uix-forge
forge:
  mold: card
  sparks:
    - type: search
      for: hui-calendar-card $ ha-full-calendar $
      query: .event-container
      text: "Holiday"         # matches even if "Holiday" is inside <a>Holiday</a>
      actions:
        add_class:
          - holiday-event
element:
  type: calendar
  entities:
    - calendar.holidays
```

!!! note
    - **All** elements returned by `query` receive the actions. Use `text` to narrow the selection to elements whose text content matches a regex.
    - The spark watches the container with a `MutationObserver` so dynamically added elements (e.g. after navigating a calendar month) are processed automatically.
    - Mutations are undone when the spark disconnects or its config changes, so no stale changes are left in the DOM.
