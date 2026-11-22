---
title: Entities
description: Generate entity IDs or entity-based configuration entries before Forge renders an element or Home Assistant strategy.
icon: material/format-list-bulleted
---
# Entities Spark

The Entities Spark builds an entity list from Home Assistant data before Forge creates its target. Use it wherever a config accepts entity IDs, such as an Entities card, Map card, or a native strategy option. It uses the familiar `auto-entities` filter vocabulary but writes ordinary Home Assistant configuration, so no wrapper card is involved.

## Create cards without an auto-entities wrapper

Without `element`, the Spark writes entity-ID strings. With `element`, it clones that mapping for each match and automatically writes the ID to `/entity`. This makes a Grid of Tile cards direct and readable:

```yaml
type: custom:uix-forge
forge:
  mold: card
  sparks:
    - type: entities
      path: /cards
      element:
        type: tile
      filter:
        include:
          - area: bedroom
        exclude:
          - state: unavailable
element:
  type: grid
  columns: 2
  square: false
  cards: []
```

This example discovers the Bedroom entities at render time; the screenshot shows the generated Bed Light Tile card.

![Entities Spark generating a native Tile card](../../assets/page-assets/forge/entities-spark-grid.png)

## Spark options

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `type` | string | — | Required. Must be `entities`. |
| `id` / `spark_id` | string | — | Optional stable Spark identifier for Foundry merging and inspection. Required when `path` is omitted; its selected IDs can then be used by a Configuration Spark or Home Summary Spark `$in_entities` matcher and element templates. |
| `path` | JSON Pointer | — | Target array in the resolved Forge `element`, such as `/entities`, `/cards`, or `/maintenance_hidden_entities`. Required unless this is a query-only Spark with `id` or `spark_id`. A missing final mapping key is created as an array. |
| `mode` | `append`, `prepend`, or `replace` | `append` | Controls how generated entries combine with entries already at `path`. Duplicate entity IDs are removed, retaining the first entry. |
| `entities` | list of entity IDs | — | Optional explicit IDs added before filter results. They can be combined with `filter`. |
| `filter.include` | list of filters | — | Adds entities matching any filter. Use `[{}]` to start with every entity available to the current user. |
| `filter.exclude` | list of filters | — | Removes entities matching any filter after explicit IDs and includes have been assembled. |
| `sort` | mapping or list of mappings | — | Orders generated entities by `domain`, `entity_id`, `name`, `device`, `area`, `state`, or an `attribute`. Each level may set `reverse`, `ignore_case`, `numeric`, `divider`, or `section`; a section may also set `label` and `separator`. |
| `element` | mapping | — | Optional mapping cloned once per selected entity. Without it, the Spark writes entity-ID strings. |
| `entity_path` | JSON Pointer | `/entity` | Location within each generated `element` mapping where Forge writes the selected entity ID. |

Omit `path` to make a query-only Spark. It must have an `id` or `spark_id`; Forge keeps its selected raw entity IDs as a named result for a later [Configuration Spark](config.md), [Home Summary Spark](home-summary.md), and element templates, without writing anything into `element`. Query-only Sparks support `entities` and `filter`; `mode`, `sort`, `element`, and `entity_path` do not apply.

### Use a query result in templates

A named query-only result is a raw list of entity IDs at `uixForge.entities["spark-id"]` while Forge resolves its `element`. Use bracket notation so IDs containing `-` remain valid. The Spark's own configuration is resolved first, so it cannot read the result it is defining; a path-backed Spark ID is available to `$in_entities`, but not this template mapping.

```yaml
type: custom:uix-forge
forge:
  mold: card
  sparks:
    - type: entities
      id: excluded_maintenance
      filter:
        include:
          - label: exclude-maintenance
element:
  type: shortcut
  label: Maintenance
  description: >-
    {{ uixForge.entities["excluded_maintenance"] | count }} excluded entities
```

Forge rebinds element templates after the usual 500 ms Entities Spark refresh debounce, so the description follows changes to the selected result. If two query-only Sparks resolve to the same ID, that template value is unavailable; use unique IDs.

`mode` defaults to `append`, so existing entity IDs remain first and duplicates are removed. Use `prepend` to give generated entries priority, or `replace` when Forge should own the whole list.

### Reuse a Foundry query in another element

A Foundry can centralise a complex entity filter without choosing where its result is written. Define the named Spark without `path`, then let each consuming Forge decide whether it remains query-only or receives a local output path.

```yaml
# Foundry: maintenance-exclusions
forge:
  sparks:
    - type: entities
      id: excluded_from_maintenance
      filter:
        include:
          - label: excluded_from_maintenance
```

For example, the complete [filtered Maintenance dashboard](config.md#wrap-generated-cards) keeps this Spark query-only and uses `$in_entities` from a Home Summary Spark and a Configuration Spark. An ordinary Entities card can instead add a target to the same Spark ID:

```yaml
type: custom:uix-forge
foundry: maintenance-exclusions
forge:
  mold: card
  sparks:
    - type: entities
      id: excluded_from_maintenance
      path: /entities
      mode: replace
element:
  type: entities
  title: Excluded from Maintenance
  entities: []
```

Foundry merging combines the same `type` and `id`, so this card receives the Foundry filter while its local `path` writes the selected IDs into the native Entities card. It has become a path-backed Entities Spark in this Forge; this is not a copy of a query result passed from another element.

Do not put `path` in the shared Foundry when it must also feed a Home Summary Spark. Home Summary `$in_entities` intentionally accepts only a genuinely query-only Spark, whereas a Configuration Spark can use either a query-only or path-backed result.

### Filters

`filter.include` adds entities matching any include filter; `filter.exclude` removes entities matching any exclude filter afterwards. A filter's keys all match.

Use `area` and `label`, as with auto-entities; reserve `entity_id` for an entity-ID match. Literal strings, quoted `*` wildcards, and slash-delimited regular expressions are supported. A text rule never matches missing metadata, so `area: "*"` means an entity with an area, not every entity without one.

Each filter mapping matches when all of its rules match. `include` and `exclude` each accept a list of those mappings.

| Rule | Matches |
| --- | --- |
| `domain` | Entity domain, such as `light`, `sensor`, or `browser_mod`. |
| `entity_id` | Full entity ID. |
| `name` | Entity friendly name. |
| `state` | Current entity state. |
| `attributes` | A mapping of state attribute names and values; every listed attribute must match. Use `:` to address a nested attribute value. |
| `group` | A group entity ID, matching its member entities (not the group entity itself). |
| `area` | An area name or ID, including entities that inherit their device's area. |
| `floor` | A floor name or ID, through the entity's effective area. |
| `device` | A device ID, user-assigned name, or original name. |
| `label` | A label name or ID on the entity, its device, or its effective area. |
| `integration` | The entity's integration/platform metadata. |
| `entity_category` | Entity registry category, such as `config` or `diagnostic`. |
| `and` | A list of nested filters; every nested filter must match. |
| `or` | A list of nested filters; at least one nested filter must match. |
| `not` | One nested filter that must not match. |

```yaml
filter:
  include:
    - integration: browser_mod
      domain: sensor
    - and:
        - area: Garage
        - attributes:
            device_class: battery
  exclude:
    - entity_id: sensor.keep_visible_elsewhere
```

The list refreshes 500 ms after the most recent relevant state or registry change. Changes that do not alter the selected result do not refresh Forge.

## Generate entity rows without auto-entities

To make a conventional filtered Entities card, omit the Spark `element`. Forge writes the selected entity-ID strings directly to the card's `entities` list.

```yaml
type: custom:uix-forge
forge:
  mold: card
  sparks:
    - type: entities
      path: /entities
      filter:
        include:
          - attributes:
              device_class: battery
        exclude:
          - state: unavailable
      sort:
        method: name
element:
  type: entities
  title: Batteries
  entities: []
```

This is the direct Forge equivalent of an `auto-entities` card, directly forging an ordinary native Entities card.

## Write entity IDs at another path

For a schema that stores the entity ID somewhere other than `/entity`, set `entity_path` as a JSON Pointer relative to each generated mapping.

```yaml
- type: entities
  path: /some_list
  element:
    target: {}
  entity_path: /target/entity_id
  filter:
    include:
      - area: Garage
```

## Group entity rows

`divider: true` inserts a native divider row when a sort value changes. `section: true` inserts a native section heading above every group, including the first; it takes precedence over a divider at the same group boundary. Both work with any list that accepts entity-row configuration, including an Entities card and a `custom:fold-entity-row`; neither is available when `element` is generating cards or other structured entries.

### Add dividers between groups

```yaml
type: custom:uix-forge
forge:
  mold: card
  sparks:
    - type: entities
      path: /entities
      filter:
        include:
          - domain: sensor
      sort:
        - method: area
          divider: true
        - method: name
element:
  type: entities
  title: Sensors by area
  entities: []
```

Forge inserts `{ type: divider }` between area groups, removes duplicate entity IDs, and removes leading, trailing, and consecutive divider rows when it combines the generated list with authored entries.

### Add a heading above each group

Without `label`, a section heading uses the group's sort value. Set `label` to Home Assistant name parts from the first entity in that group: `entity`, `device`, `area`, `floor`, or a literal `text` part. `separator` controls the text placed between parts.

```yaml
type: custom:uix-forge
forge:
  mold: card
  sparks:
    - type: entities
      path: /entities
      filter:
        include:
          - domain: sensor
      sort:
        - method: area
          section: true
          label:
            - type: text
              text: "Area: "
            - area
          separator: ""
        - method: name
element:
  type: entities
  title: Sensors by area
  entities: []
```

This produces `{ type: section, label: "Area: Kitchen" }` before the Kitchen sensor group. Forge removes dividers beside a section and collapses adjacent headings with the same label, but retains headings at the beginning or end of a list.

## Inspect a list

`uix_entities_inspect(forge, spark?)` is a browser-console helper. Select a rendered `<uix-forge>` in DevTools and pass `$0`. It saves its latest result as `window.uix_inspect.entities`, so you can refer to its `ids`, generated `entries`, and filter `counts` in subsequent console commands.

```js
await uix_entities_inspect($0);
window.uix_inspect.entities.ids;
```

When a Forge has more than one Entities Spark, pass its `id`/`spark_id` or zero-based Entities Spark index. Strategy Forges do not create a wrapper element, so pass their complete Forge configuration mapping instead. The helper returns generated IDs and entries, included and excluded IDs, and the match count for each include filter. It never changes the dashboard or saves configuration.
