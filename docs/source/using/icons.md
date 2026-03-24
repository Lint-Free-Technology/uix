---
description: Learn all about styling icons including change icons and their color.
---
# Styling icons

With UI eXtension installed, the `<ha-icon>` element - used e.g. by `entities`, `glance` and many more cards - will set it's icon to the value found in the CSS variable `--uix-icon` (if present).

It will also set the icon color to the value found in the CSS variable `--uix-icon-color` if present. This ignores entity state, but will still dim unless you also set `--uix-icon-dim` to `none`.

```yaml
- entity: light.bed_light
  uix:
    style: |
      :host {
        --uix-icon: mdi:bed;
      }
```

## Overriding entity background images

UIX can also substitute the background image displayed by the following elements:

- `ha-entity-marker` (map card entity markers)
- `ha-tile-icon` (tile card icons)
- `ha-state-badge` (state badges)
- `ha-user-badge` (user badges)
- `ha-person-badge` (person badges)

Define a CSS variable of the form `--uix-image-for-<entity_id>`, where every `.` in the entity ID is replaced with `_`. When an element is rendered for the matching entity, the background image is replaced with the supplied URL.

```yaml
type: tile
entity: person.jim
uix:
  style: |
    ha-tile-icon {
      --uix-image-for-person_jim: url('/local/photos/jim.jpg');
    }
```

The variable can be set at any ancestor level in the DOM—UIX will detect it on the element via computed styles. If the variable is not set, or the element's entity does not match, the original image is left unchanged.
