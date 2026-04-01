---
description: Learn all about styling section background color and opacity
---
# Styling section backgrounds

UIX can style a section background color and opacity using the CSS variables `--uix-section-background-color` and `--uix-section-background-opacity` as applied to the section or parent. As usual for UIX CSS styling, templates are supported.

!!! info
    The section background `hui-section-background` is a sibling to the section, so setting `--ha-section-backgroundc-color` is section UIX styling will not apply. UIX applies direct styling of `--section-background-color` and `--section-background-opacity` to `hui-section-background` on each update.

To apply the background, the section background config must be set. Minimal shorthand background config supported by Home Assistant is `background: true`, which will include the `hui-section-background`  using defaults for background color and opacity.

!!! example
    ```yaml
    type: grid
    cards: []
    background: true
    uix:
      style: |
        :host {
            --uix-section-background-color: {{ 'red' if is_state('input_boolean.test_boolean', 'on') else 'green' }};
            --uix-section-background-opacity: {{ states('input_number.increment_test') | float / 100 }};
        }
    ```
