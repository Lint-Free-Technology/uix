---
title: UIX Forge
description: Learn about UIX Forge, a powerful custom element that combines Jinja2 templates, sparks, and UIX styling.
---
# UIX Forge

UIX Forge (`custom:uix-forge`) is a custom Lovelace element that combines template-driven configuration with additional behaviours called **sparks**. Use it to:

- **Forge** any standard Home Assistant element from a Jinja2 template, so the entire element config can react to entity states, user, browser and other template variables.
- **Add sparks** — self-contained behaviours such as tooltips or DOM-event bridges — that augment the forged element without touching the element's own YAML.
- **Apply UIX styles** to the forged element, exactly like any other element.

## Basic structure

```yaml
type: custom:uix-forge
forge:
  mold: card          # "card" or "badge"
  # optional sparks, macros, hidden, grid_options …
element:
  type: tile
  entity: "{{ config.entity }}"
  # any valid element config, Jinja2 templates supported
```

`forge` controls how UIX Forge itself behaves; `element` is the configuration of the Home Assistant element that will be rendered inside it.

## forge options

| Key | Type | Default | Description |
| --- | ---- | ------- | ----------- |
| `mold` | string | (required) | Shape of the forged element. Currently `"card"` or `"badge"`. |
| `sparks` | list | `[]` | List of [spark](#sparks) configurations to attach to the forged element. |
| `macros` | mapping | — | [Jinja2 macros](../using/templates.md#macros) available to all templates in the forge config. |
| `hidden` | boolean / template | `false` | When truthy the element is hidden. Supports Jinja2 templates. |
| `grid_options` | mapping | — | Lovelace grid options (e.g. `rows`, `columns`) for card-mold elements. |
| `show_error` | boolean | `false` | When `true`, show the Lovelace error card instead of hiding it when the forged element errors. |
| `template_nesting` | string | `"<<>>"` | Four-character string used to escape `{{ }}` in templates. Use when the element config itself contains Jinja2-like syntax. |

## element config

Any valid Lovelace element configuration. Every string value in `element` is processed as a Jinja2 template, giving access to the same variables as [UIX templates](../using/templates.md) (`config`, `user`, `browser`, `hash`, `panel`) plus a `uixForge` dictionary populated by sparks.

The `uix` key inside `element` is passed through to UIX and is **not** templated — use it to style the forged element as you would any other element:

```yaml
type: custom:uix-forge
forge:
  mold: card
element:
  type: tile
  entity: light.living_room
  uix:
    style: |
      ha-card {
        --tile-color: teal;
      }
```

## Sparks

Sparks are optional behaviours that you add to the `forge.sparks` list. Each spark has a `type` key and its own options.

Available sparks:

- :speech_balloon: [Tooltip spark](./sparks/tooltip.md) — attach a styled `wa-tooltip` to any element inside the forged element.
