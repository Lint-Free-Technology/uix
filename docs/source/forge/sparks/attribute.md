---
description: Use the attribute spark to replace or remove an HTML attribute on a target element within a Forge card.
---

# Forge Spark — attribute

The `attribute` spark lets you **replace** or **remove** an HTML attribute on any element inside a Forge card. A common use-case is removing or overriding the `title` attribute on a `hui-generic-entity-row` info element so that the browser's native tooltip no longer appears, or so that a custom value is shown instead.

## Configuration

| Key | Type | Required | Default | Description |
|-----|------|----------|---------|-------------|
| `type` | `string` | ✅ | — | Must be `attribute`. |
| `for` | `string` | ✅ | — | CSS/UIX selector to the target element. Supports `$` for shadow-root crossings (see [DOM navigation](../../concepts/dom.md)). |
| `attribute` | `string` | ✅ | — | Name of the HTML attribute to target (e.g. `title`, `aria-label`). |
| `action` | `string` | | `replace` | What to do with the attribute. Either `replace` (set a new value) or `remove` (delete the attribute entirely). |
| `value` | `string` | | `""` | The new attribute value. Only used when `action` is `replace`. Supports [Jinja2 templates](../../using/templates.md). |

## Usage

### Remove a native tooltip (title attribute)

Entity rows in Home Assistant often carry a `title` attribute on their info class element, which causes a native browser tooltip to appear on hover. To remove it:

```yaml
type: custom:forge-card
entities:
  - entity: light.living_room
sparks:
  - type: attribute
    for: "hui-generic-entity-row $ .info"
    attribute: title
    action: remove
```

### Replace the title attribute with a custom value

```yaml
type: custom:forge-card
entities:
  - entity: light.living_room
sparks:
  - type: attribute
    for: "hui-generic-entity-row $ .info"
    attribute: title
    action: replace
    value: "My custom tooltip text"
```

### Use a template for the value

The `value` field supports [Jinja2 templates](../../using/templates.md), giving you access to entity states and other template variables:

```yaml
type: custom:forge-card
entities:
  - entity: light.living_room
sparks:
  - type: attribute
    for: "hui-generic-entity-row $ .info"
    attribute: title
    action: replace
    value: >
      {{ states('light.living_room') | capitalize }}
```

## Notes

- The spark targets the **first** matching element found by the `for` selector.
- The original attribute value is automatically **restored** when the spark is disconnected (e.g. when the card is removed from the dashboard).
- If the target element does not yet exist when the card loads, the spark retries automatically for a short period before giving up.
- When `action` is `replace` and `value` is an empty string, an empty attribute (e.g. `title=""`) is set — not removed. Use `action: remove` to delete the attribute entirely.
