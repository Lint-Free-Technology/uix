---
description: Use the more-info spark to embed Home Assistant more-info content inside a UIX Forge element.
icon: material/information-outline
---

# :material-information-outline: More-info spark

The `more-info` spark inserts Home Assistant's `ha-more-info-info` element as a sibling before or after a target element inside a UIX Forge element.

It is most useful with [Blank card config](../forge.md#blank-card-config), where a Forge card has no `element` config and the spark uses the blank card content as its default insertion target.

## Basic usage

```yaml
type: custom:uix-forge
forge:
  mold: card
  sparks:
    - type: more-info
      entity: light.bed_light
```

## With details

Set `details: true` to add a collapsible details section underneath the main more-info content. The details header includes:

- a `Details` subheading
- a code button to toggle the details view's YAML mode, shown only while the details section is expanded
- a chevron button to expand or collapse the details section

The collapsible details content is wrapped in an `ha-card` so it inherits normal Home Assistant card styling such as borders, background, and shadow.

```yaml
type: custom:uix-forge
forge:
  mold: card
  sparks:
    - type: more-info
      entity: light.living_room
      details: true
```

## Configuration

| Key | Type | Required | Default | Description |
| --- | ---- | -------- | ------- | ----------- |
| `type` | `string` | ✅ | — | Must be `more-info`. |
| `after` | `string` | | see description | UIX selector for the reference element. The more-info content is inserted as a sibling **after** the matched element. When the UIX Forge element is using [Blank card config](../forge.md#blank-card-config), the default is `uix-forge-blank-card $ div.content`. Otherwise, it defaults to `""`. |
| `before` | `string` | | — | UIX selector for the reference element. The more-info content is inserted as a sibling **before** the matched element. |
| `for` | `string` | | — | Alias used as the target selector when `after` is not set. |
| `entity` | `string` | | `element.entity` | Entity ID shown in the embedded more-info content. If omitted, the spark uses the forged element's `entity` config when available. |
| `details` | `boolean` | | `false` | Adds a collapsible `ha-more-info-details` section under the main info content. |

!!! note
    The spark targets the **first** element matched by `after`, `for`, or `before`.

## Theme styling

The spark applies UIX `more-info` styling to the wrapper containing `ha-more-info-info`, so theme-level `uix-more-info-yaml` paths can target the embedded content the same way they target the more-info dialog:

```yaml
my-theme:
  uix-theme: my-theme
  uix-more-info-yaml: |
    ha-more-info-info $ more-info-content $: |
      more-info-light {
        color: var(--primary-color);
      }
```

## CSS variables

| Variable | Default | Description |
| --- | --- | --- |
| `--uix-more-info-details-head-height` | `40px` | Minimum height of the details toggle row. |
| `--uix-more-info-details-head-padding` | `0 var(--ha-space-4, 16px)` | Padding for the details toggle row. |
| `--uix-more-info-details-head-gap` | `var(--ha-space-2, 8px)` | Gap between details action buttons. |
| `--uix-more-info-details-card-padding` | `var(--ha-space-6, 24px)` | Padding inside the details card. |
| `--uix-more-info-details-toggle-width` | `32px` | Size of the details action buttons and icons. |
| `--uix-more-info-details-transition-duration` | `150ms` | Base transition duration for the details dropdown. |
| `--uix-more-info-details-yaml-transition-duration` | `350ms` | Fade duration for showing and hiding the YAML toggle button. |
| `--uix-more-info-details-toggle-color` | `var(--primary-text-color)` | Details action button color. |
| `--uix-more-info-details-margin-top` | `8px` | Top margin applied to the details card. |
| `--uix-more-info-details-max-height` | `80vh` | Maximum expanded details height. |
