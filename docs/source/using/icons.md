---
description: Learn all about styling icons including change icons and their color.
---
# Styling icons

With UI eXtension installed, the `<ha-icon>` element - used e.g. by `entities`, `glance` and many more cards - will set its icon to the value found in the CSS variable `--uix-icon` (if present).

It will also set the icon color to the value found in the CSS variable `--uix-icon-color` if present. This ignores entity state, but will still dim unless you also set `--uix-icon-dim` to `none`.

Templates are supported for all CSS variables.

```yaml
- entity: light.bed_light
  uix:
    style: |
      :host {
        --uix-icon: mdi:bed;
      }
```

Special care needs to be taken for elements that use more than the single entity icon in the `:host`, like input_select. In that case one sets the `--uix-icon` styling to:

```yaml
- entity: input_select.select_your_option
  uix:
    style:
      "hui-generic-entity-row $ state-badge $": |
        ha-state-icon {
          --uix-icon:
          {{your_icon_template}};
        }
```
