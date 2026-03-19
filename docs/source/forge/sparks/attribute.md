---
description: Use the attribute spark to replace or remove an HTML attribute on a target element within a UIX Forge element.
---

# Attribute spark

The `attribute` spark lets you **replace** or **remove** an HTML attribute on any element inside a forged element. A common use-case is removing or overriding the `title` attribute on an element so that the browser's native tooltip no longer appears, or so that a custom value is shown instead.

## Configuration

| Key | Type | Required | Default | Description |
| --- | ---- | -------- | ------- | ----------- |
| `type` | `string` | ✅ | — | Must be `attribute`. |
| `for` | `string` | ✅ | — | CSS/UIX selector to the target element. Supports `$` for shadow-root crossings (see [DOM navigation](../../concepts/dom.md)). |
| `attribute` | `string` | ✅ | — | Name of the HTML attribute to target (e.g. `title`). |
| `action` | `string` | | `replace` | What to do with the attribute. Either `replace` (set a new value) or `remove` (delete the attribute entirely). |
| `value` | `string` | | `""` | The new attribute value. Only used when `action` is `replace`. Supports [Jinja2 templates](../../using/templates.md). |

## Usage

### Remove a native tooltip (title attribute)

Weather forecast card has a `title` attribute on the name, which causes a native browser tooltip to appear on hover. To remove it:

```yaml
type: custom:uix-forge
forge:
  mold: card
  sparks:
    - type: attribute
      for: hui-weather-forecast-card $ div.name
      attribute: title
      action: remove
element:
  show_current: true
  show_forecast: false
  type: weather-forecast
  entity: weather.carlingford
  forecast_type: daily
```

### Replace the title attribute with a custom value

```yaml
type: custom:uix-forge
forge:
  mold: card
  sparks:
    - type: attribute
      for: hui-weather-forecast-card $ div.name
      attribute: title
      action: replace
      value: Weather forecast for Carlingford and surrounding districts.
element:
  show_current: true
  show_forecast: false
  type: weather-forecast
  entity: weather.carlingford
  forecast_type: daily
```

### Use a template for the value

The `value` field supports [templates](../../using/templates.md), giving you access to entity states and other template variables:

```yaml
type: custom:uix-forge
forge:
  mold: card
  sparks:
    - type: attribute
      for: hui-tile-card
      attribute: title
      action: replace
      value: |
        {{ relative_time(states[config.element.entity].last_changed) }} ago
element:
  type: tile
  entity: light.bed_light
```

!!! note
    - The spark targets the **first** matching element found by the `for` selector.
    - When `action` is `replace` and `value` is an empty string, an empty attribute (e.g. `title=""`) is set — not removed. Use `action: remove` to delete the attribute entirely.
