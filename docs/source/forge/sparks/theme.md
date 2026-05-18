---
title: Theme Spark
description: Apply a frontend theme to a forged element or one of its descendants.
---
# Theme Spark

The `theme` spark applies a frontend theme to a target element with `applyFrontendThemeOnElement`.

Use it when you want a forged element to pick up an existing theme without adding extra UIX styling config.

## Configuration

| Key | Type | Required | Default | Description |
|-----|------|----------|---------|-------------|
| `type` | string | ✅ | — | Must be `theme`. |
| `for` | string | | `element` | Target selector path inside the forged element. |
| `theme` | string | | — | Theme name to apply. |

## Example

```yaml
type: custom:uix-forge
forge:
  mold: card
  sparks:
    - type: theme
      for: element
      theme: uix-test-theme
element:
  type: tile
  entity: light.bed_light
```
