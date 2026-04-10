---
title: UIX Forge
description: Learn about UIX Forge, a powerful custom element that combines templates, sparks, and UIX styling.
---
# UIX Forge

UIX Forge (`custom:uix-forge`) is a custom Lovelace element that combines template-driven configuration with additional behaviours called **sparks**. Use it to:

- **Forge** any standard Home Assistant element from templates, allowing the entire element config to react to entity states, user, browser and other template variables.
- **Add sparks** — self-contained behaviours that augment the forged element.
- **Apply UIX styles** to the forged element, exactly like any other element. Additionally any spark variables are made available in the `uixForge` template variable.

## Basic structure

```yaml
type: custom:uix-forge
forge:
  mold: card
  # optional sparks, macros, hidden, grid_options …
element:
  type: tile
  entity: "{{ 'sun.sun' }}"
  # any valid element config, templates supported
```

`forge` controls how UIX Forge itself behaves; `element` is the configuration of the Home Assistant element that will be rendered inside it.

## Forge options

| Key | Type | Allows Templates | Default | Description |
| --- | ---- | ---------------- | ------- | ----------- |
| `mold` | string | | (required) | How the element is forged, with each `mold` handling required forged element behaviours within Home Assistant Frontend. Currently `"card"`, `"badge"`, `"row"`, `"picture-element"` or `"section"`. |
| `macros` | mapping | | — | [template macros](../using/templates.md#macros) available to all templates in the forge config. Macros are also passed to `uix` config in both forge and forged element. See [UIX Styling - variables and macros](#variables-and-macros) |
| `hidden` | boolean | ✅ | `false` | When truthy the element is hidden. |
| `grid_options` | mapping | ✅ | — | Lovelace grid options (e.g. `rows`, `columns`) for when `mold` is `card`. Ignored for any other `mold`. |
| `show_error` | boolean | | `false` | When `true`, show the Lovelace error card instead of hiding it when the forged element errors. |
| `template_nesting` | string | | `"<<>>"` | Four-character string used to escape `{{ }}` in templates. Use when the element config itself contains Jinja2-like syntax. |
| `sparks` | list | ✅ | `[]` | List of [spark](#sparks) configurations to attach to the forged element. |
| `delayed_hass` | boolean | | - | Flag to delay the passing of hass object to the card until after it is loaded. Used to suppress console errors or other issues for some custom cards. e.g. apexcharts_card. |

!!! info "Template nesting"
    When using template nesting, the template nesting characters are replaced with Jinja `raw` directives before the template is rendered. The replacement includes a marker for internal readiness code to be able to recognise a rendered template with nesting. `<<` is replaced with `{% raw %}{#uix#}{{{% endraw %}` and `>>` is replaced with `{% raw %}}}{#uix#}{% endraw %}`. If you try and create this sequence without using the nesting shorthand, it must be replicated EXACTLY for forge internal readiness checks to complete.

## Element config

Any valid Lovelace element configuration. Every string value in `element` is processed as a template, giving access to the same variables as [UIX templates](../using/templates.md) (`config`, `user`, `browser`, `hash`, `panel`).

The `uix` key inside `element` is passed through as is to [UIX Styling](../using/index.md), with [UIX Styling](../using/index.md) rendering any templates. Use it to style the forged element as you would any other element:

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

### Using with auto-entities

UIX Forge supports `custom:auto-entities` in two ways:

1. When UIX Forge is used as the main card for auto-entities, UIX Forge accepts and passes through `entities` to the element config, though will not be available on `config.element.entities`
2. When using UIX Forge as an entity card via auto-entities include filter `options`, UIX Forge accepts `entity` that auto-entities passes through, but does not pass through to element config and won't be available on `config.element.entity`. 

For both scenarios, if you wish to access `entity` in a template via `config.element.entity` you need to include `entity: this.entity_id` under `element` in your include options for auto auto-entities as per the example below which uses auto-entities for a tile card to give use a templated content for a tooltip spark.

```yaml
type: custom:auto-entities
filter:
  include:
    - options:
        type: custom:uix-forge
        forge:
          mold: card
          sparks:
            - type: tooltip
              for: hui-tile-card $ ha-card
              content: >-
                {{ state_attr(config.element.entity,
                'friendly_name') }} is {{ states(config.element.entity) }}
        element:
          entity: this.entity_id
          type: tile
      area: kitchen
  exclude: []
card:
  square: false
  type: grid
show_empty: true
card_param: cards
```

## UIX styling

Add a `uix` key under `forge` to apply [UIX styling](../using/index.md) to the forge element wrapper itself. Template variables `config.forge`, `config.element`, and `uixForge` are available in the style templates, where `config.forge` and `config.element` are the resolved forge and element configs and `uixForge` contains any [spark](./sparks/tooltip.md) template variables.

```yaml
type: custom:uix-forge
forge:
  mold: card
  uix:
    style: |
      :host {
        --ha-card-border-radius: 20px;
      }
element:
  type: tile
  entity: light.living_room
```

### Element styling

UIX Styling can be applied to the element in the usual way. Only the usual `config` variable is available which is the standard variable resolved by UIX Styling for elements.

!!! warning
    Element UIX Styling will **NOT** contain the forge and spark variables available in forge UIX Styling. If you wish to use these then use UIX Styling on the forge rather than the forged element.

```yaml
type: custom:uix-forge
forge:
  mold: card
  uix:
    style: |
      :host {
        --ha-card-border-radius: 20px;
      }
element:
  type: tile
  entity: light.living_room
  uix:
    style: |
      span.primary::after {
        content: ' - {{ state_translated(config.entity) }}';
      }
```

### Variables and macros

Macros from the forge are passed through to UIX Styling for both the forge and the forged element, making forge macros available to use in UIX Styling for both forge and forged element. This is shown in the example below.

!!! example inline end "Macro example"
    ![Example output](../assets/page-assets/forge/forge-macro-example.gif)

```yaml
type: custom:uix-forge
forge:
  mold: card
  macros:
    state_color:
      params:
        - entity_id
      template: "{{ 'red' if is_state(entity_id, 'on') else 'green' }}"
  uix:
    style: |
      :host {
        --ha-card-border-radius: 20px;
        --ha-card-border-color: {{ state_color(config.element.entity) }};
        --ha-card-border-width: 3px;
      }
element:
  type: tile
  entity: light.bed_light
  name: "{{ entity_name(config.element.entity) }} - {{ state_translated(config.element.entity) }}"
  uix:
    style: |
      span.primary {
        color: {{ state_color(config.entity) }};
      }
```

!!! tip
    If you inspect this carefully, you will note that the forge UIX Styling passes the variable `config.element.entity` to `state_color()` macro, whereas the forged element UIX Styling passes the variable `config.entity` to `state_color()` macro as well as the `state_translated()` function. The `name` template for the element uses `config.element.entity` as this runs in the context of the forge.

If you wish to have a standard macro to access the entity across forge macros, forge UIX styling and forged element UIX Styling you can use an `entity()` macro as shown in the following example.

`entity()` macro template for easy copying

```jinja
{{ config.element.entity | default('') if 'element' in config else config.entity | default('') }}
```

The full example below provides for the same output as the previous example, but uses the `entity()` macro.

!!! example inline end "Macro example using entity()"
    ![Example output](../assets/page-assets/forge/forge-macro-example.gif)

```yaml
type: custom:uix-forge
forge:
  mold: card
  macros:
    entity:
      template: >-
        {{ config.element.entity | default('') if 'element' in config else
        config.entity | default('') }}
    state_color:
      params:
        - entity_id
      template: "{{ 'red' if is_state(entity_id, 'on') else 'green' }}"
  uix:
    style: |
      :host {
        --ha-card-border-radius: 20px;
        --ha-card-border-color: {{ state_color(entity()) }};
        --ha-card-border-width: 3px;
      }
element:
  type: tile
  entity: light.bed_light
  name: "{{ entity_name(entity()) }} - {{ state_translated(entity()) }}"
  uix:
    style: |
      span.primary {
        color: {{ state_color(entity()) }};
      }
```

!!! note "For forged element config"
    - the template for `name` is running in context of forge so the `entity()` macro will resolve to provide `config.element.entity`.
    - the template used for CSS `color` in `uix` config is running in context of UIX Styling for the forged element so the `entity()` macro will resolve to provide `config.entity`.

## Sections

When using UIX Forge for a section in sections view, use the YAML section editor (use three dots menu) and change type to `custom: uix-forge`. Set forge `mold` to `section`.

When using UIX Forge for sections, the following config keys can be set directly to configure how the section shows, though they **do not support templates**:

- `row_span`
- `column_span`
- `background`

```yaml
type: custom:uix-forge
forge:
  hidden: # use hidden to control visibility, templates supported
  # ...
element:
  # ...
# section only main configuration keys. Visibility not supported.
row_span: # row span for section
column_span: # column span for section
background: # background for section
```

When editing the dashboard in UI mode, the section will be surrounded by red dashed border to show that it is configured by UIX Forge in YAML. All cards contained in the section will show in preview mode, but will not be editable. Use YAML for editing the section.

!!! warning
    Visibility in the main config is not supported. Though the Home Assistant visual editor will let you set visibility you will get an error as soon as you save the section. If you need Frontend visibility options not supported by template (screen) use a stack card as your element and set Frontend visibility on that element, templates supported.

## Foundries

A **foundry** is a server-stored UIX Forge template that lets you define reusable `forge`, `element`, and `uix` configs once and share them across many cards. Reference a foundry with the `foundry:` key and override only what you need locally.

See [Foundries](./foundries.md) for a full guide including merge behaviour, nested foundries, and management via the integration options.

## Sparks

Sparks are optional behaviours that you add to the `forge.sparks` list. Each spark has a `type` key and its own options.

Available sparks:

- :speech_balloon: [Tooltip](./sparks/tooltip.md) — attach a styled tooltip to any element inside the forged element.
- :material-button-cursor: [Button](./sparks/button.md) - attach a styled button (`ha-button`) with actions as a sibling before or after any element within the forged element.
- :label: [Attribute](./sparks/attribute.md) — add, replace or remove an attribute of any element within the forged element.
- :zap: [Event](./sparks/event.md) — receive DOM events from `fire-dom-event` actions and expose their data as template variables.
- :star: [Tile Icon](tile-icon.md) — insert a `ha-tile-icon` element as a sibling before or after any element within the forged element.
- :shield: [State badge](./sparks/state-badge.md) - insert a `state-badge` element as a sibling before or after any element within the forged element.
- :material-grid: [Grid](./sparks/grid.md) - apply **CSS Grid** layout to any container element inside a forged element
- :mag: [Search](./sparks/search.md) - queries a container within a forged element with a CSS selector and optional inner text to find, then apply mutations to the found element(s).
- :material-map: [Map](./sparks/map.md) — preserve the zoom level and centre of a map card across Home Assistant state updates.
- :material-lock: [Lock](./sparks/lock.md) — overlay a lock icon on any element to block interaction until the user passes a PIN, passphrase, or confirmation challenge.
