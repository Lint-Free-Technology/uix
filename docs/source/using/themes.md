# Themes

!!! info "Theme variable"
    The theme MUST define a variable `uix-theme` which MUST have the same value as the name of the theme. For example:
    ```yaml
    my-awesome-theme:
        uix-theme: my-awesome-theme

        ... other theme variables go here ...
    ```

## Theme variables

- `uix-card`
- `uix-row`
- `uix-glance`
- `uix-badge`
- `uix-heading-badge`
- `uix-assist-chip`
- `uix-element`
- `uix-root`
- `uix-view`
- `uix-more-info`
- `uix-sidebar`
- `uix-config`
- `uix-panel-custom`
- `uix-top-app-bar-fixed`
- `uix-dialog`
- `uix-developer-tools`
- `uix-grid-section`

Also `<any variable>-yaml`.

## Macros

Themes can define reusable Jinja2 macros available to all cards that use the theme. Macros are specified under the `uix-macros-yaml` theme key as a YAML dictionary of macro definitions — see [Templates - Macros](templates.md#macros) for the full macro configuration reference.

```yaml
my-awesome-theme:
    uix-theme: my-awesome-theme

    uix-macros-yaml: |
      is_on:
        params:
          - entity_id
        returns: true
        template: "{%- do returns(states(entity_id) == 'on') -%}"

      badge_color:
        params:
          - entity_id
          - color_on
          - color_off
        template: "{{ color_on if states(entity_id) == 'on' else color_off }}"
```

Card-level `uix.macros` take precedence over theme macros of the same name.

## Classes

Set a class with:
    ```yaml
    uix:
      class: red
    ```
