---
description: Learn all about styling section background color and opacity
---
# Styling section backgrounds

Section backgrounds are a sibling to a section element so cannot be targeted by section UI eXtension directly. Two options are available to style section backgrounds. One is a simple method using special UIX vars for color and opacity, building on from the options provided by Home Assistant. The second option allows for styling teh background directly using UIX styling.

## Option 1: use UIX CSS variables.

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

## Options 2: add UIX styling to section background config

You can add UIX styling options to the background config and it will target the background element. The whole section config is available in templates.

For background and opacity you are best to set `--ha-section-background-color` and `--ha-section-background-opacity`. You can style the background and opacity directly but you would need to use `!important`.

!!! example
    ```yaml
    type: grid
    cards: []
    background:
      uix:
        style: |
          :host {
            --ha-section-background-color: yellow;
            border: 2px solid red;
            box-shadow: 10px 5px 5px red;
          }
    ```
