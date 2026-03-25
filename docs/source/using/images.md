---
description: Learn all about styling entity images.
---
# Styling entity images

!!! info
    Styling entity images available in 6.0.0-beta.5 and later

UIX can substitute the background entity image displayed by the following elements:

- `ha-entity-marker` (map card entity markers)
- `ha-tile-icon` (tile card icons)
- `ha-state-badge` (state badges)
- `ha-user-badge` (user badges)
- `ha-person-badge` (person badges)

Define a CSS variable of the form `--uix-image-for-<entity_id>`, where every `.` in the entity ID is replaced with `_`. When an element is rendered for the matching entity, the background image is replaced with the supplied URL.

Templates are supported.

```yaml
type: tile
entity: person.jim
uix:
  style: |
    ha-tile-icon {
      --uix-image-for-person_jim: /local/photos/jim.jpg;
    }
```

!!! tip
    - The variable can be set at any ancestor level in the DOM. UIX will detect it on the element via computed styles. If the variable is not set, or the element's entity does not match, the original image is left unchanged.
    - To style an override across Home Assistant Frontend add `--uix-image-for-<entity_id>` to theme variables `uix-root(-yaml)`, `uix-config(-yaml)` and `uix-more-info(-yaml)`.
