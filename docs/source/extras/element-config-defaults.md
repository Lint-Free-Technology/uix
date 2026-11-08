---
title: Element configuration defaults
description: Apply static default configuration values to matching Home Assistant dashboard elements.
---
# Element configuration defaults

UIX can add static configuration defaults to matching dashboard elements without editing a dashboard. Home Assistant 2026.11's device-and-entity display names are one use case: a default can make matching elements show only the entity portion of a name. Defaults can also set missing configuration keys or object paths, such as `state_color` or `group_config.name`.

## Configure the rule list

Go to **Settings → Devices & Services → UI eXtension → Configure**, then select **Configure element defaults**. Choose **Configure using UI** to add defaults with form fields.

Use one item for each missing key you want to default. A matching element can receive multiple defaults, such as both `name` and `state_color`.

Choose **Configure using YAML** to paste or edit the complete canonical configuration. Both editors read and write the same rules, so you can switch between them at any time.

```yaml
element_config:
  - uix_type: row
    element_type: entity
    config_key: name
    value:
      type: entity
```

Each rule has four keys:

| Key | Description |
| --- | --- |
| `uix_type` | The UIX boundary: `card`, `badge`, `heading-badge`, `row`, `glance`, or `element`. |
| `element_type` | The Home Assistant config `type` to match, such as `tile` or `entity`. |
| `config_key` | A missing key or dot-separated object path to add. Array indexes are not supported. |
| `value` | The static value to use. |

For example, paste this complete configuration into **Configure using YAML** to make matching tile cards, entity rows, and entity badges use only the entity portion of the display name:

```yaml
element_config:
  - uix_type: card
    element_type: tile
    config_key: name
    value: { type: entity }
  - uix_type: row
    element_type: entity
    config_key: name
    value: { type: entity }
  - uix_type: glance
    element_type: entity
    config_key: name
    value: { type: entity }
  - uix_type: badge
    element_type: entity
    config_key: name
    value: { type: entity }
```

## Behavior and limits

UIX only adds a value when the key is absent. Any explicit value, including `null`, `false`, an empty string, an empty list, or an empty map, wins over the global default.

Dot-separated paths create missing object maps, but never replace an existing value. For example, `config_key: group_config.name` adds `name` to an absent or object-valued `group_config`; it does nothing when `group_config` is `null`, a scalar, or an array. Rules for the same UIX type and element type cannot overlap: configure either `group_config` or `group_config.name`, not both.

For example, set a default name for every child of a Fold Entity Row while retaining an existing `group_config.secondary_info` setting:

```yaml
element_config:
  - uix_type: row
    element_type: custom:fold-entity-row
    config_key: group_config.name
    value: { type: entity }
```

Entity rows and Glance entities support both the normal mapping form and Home Assistant's compact string form. For a matching `row`/`entity` or `glance`/`entity` rule, `- sensor.kitchen_temperature` is temporarily passed to Home Assistant as an entity mapping with the configured value. The dashboard source remains the compact string.

Values are static. UIX does not process Jinja templates, UIX templates, macros, or billets in an element configuration default. Rules apply to direct card, badge, heading-badge, entities-card row, Glance entity, and picture-element configuration boundaries, including matching native elements rendered by UIX Forge. Paths add data only within a matched configuration; they do not select further nested element boundaries. Apart from Glance entities, dialogs, card features, map markers, and other nested element boundaries are not included.

Changes apply to connected dashboards when the UIX configuration update arrives. UIX rebuilds only the affected configuration boundary from its original dashboard config; it does not save generated values into your dashboard.
