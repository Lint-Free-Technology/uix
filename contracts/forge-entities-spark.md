# Forge Entities Spark contract

## Status and scope

This contract defines the reusable `type: entities` Forge Spark. It selects Home Assistant entities and writes a generated list into resolved Forge `element` configuration before that configuration is used to create an ordinary Forge target or generate a delegated Home Assistant strategy.

The [Forge layered configuration contract](./forge-layered-configuration.md) remains authoritative for Foundry resolution, `element_base`, `element`, `element_disabled_paths`, template ownership, template nesting, and UIX configuration merging. The [Forge strategy and Configuration Spark contract](./forge-strategy-and-config-spark.md) defines the strategy mold and the later `type: config` phase. This contract adds one pre-generation data-source phase; it does not add an executable query language or a second configuration model.

The Spark is available to every Forge mold. A strategy mold may use it to populate native strategy input, including `maintenance_hidden_entities`, before Home Assistant generates the strategy output.

## Configuration

An Entities Spark has a `type`, target `path`, optional `mode`, optional explicit `entities`, optional `filter`, optional `sort`, optional `element`, and optional `entity_path`.

```yaml
type: custom:uix-forge
forge:
  sparks:
    - type: entities
      path: /maintenance_hidden_entities
      filter:
        include:
          - domain: browser_mod
element:
  type: home-overview
  maintenance_hidden_entities:
    - sensor.keep_visible_elsewhere
```

The Spark selects every current `browser_mod` entity, appends the resulting IDs to the authored `maintenance_hidden_entities` list, and removes duplicates while retaining the first occurrence. The native `home-overview` strategy receives that final list. Forge does not remove rendered Maintenance entities or alter the native strategy's generated output.

### Target and mode

`path` is an RFC 6901 JSON Pointer relative to the resolved `element` mapping. It identifies the array to receive generated entries. It must not be the root.

The final path segment may be absent when its parent is an existing mapping; Forge creates that property as an empty array. Forge does not create missing intermediate mappings or array members. An existing target must be an array.

`mode` controls how generated entries combine with the target array:

| Mode | Behaviour |
| --- | --- |
| `append` (default) | Keeps existing entries, then adds generated entries. |
| `prepend` | Adds generated entries before existing entries. |
| `replace` | Discards existing entries and uses generated entries only. |

The final array is de-duplicated by entity ID after entries are generated. The first occurrence wins, so `append` preserves the position of an authored entry and `prepend` gives the generated entry position precedence. Without an `element`, existing entries must be entity-ID strings. With an `element`, existing entries must be mappings whose `entity_path` resolves to an entity-ID string. Mixed or incompatible output shapes are errors.

## Generated entries

Without `element`, each selected entity produces its entity-ID string. This supports any native option or config array that accepts entity IDs, including `maintenance_hidden_entities`, Map card `entities`, and an Entities card `entities` list.

```yaml
forge:
  sparks:
    - type: entities
      path: /entities
      filter:
        include:
          - label: dashboard_devices
element:
  type: entities
  title: Dashboard devices
```

With `element`, Forge clones that mapping once per selected entity and writes the entity ID at `entity_path`. `entity_path` defaults to `/entity`; it is an RFC 6901 JSON Pointer relative to the generated mapping. The path's parent must exist and be a mapping. The selected entity ID replaces any value at that location.

```yaml
forge:
  sparks:
    - type: entities
      path: /cards
      element:
        type: tile
      filter:
        include:
          - label: dashboard_devices
element:
  type: grid
  cards: []
```

This produces Tile card mappings with `entity` injected automatically; users do not write `entity: "{{ entity_id }}"`. For an output schema that stores the ID elsewhere, set `entity_path` explicitly:

```yaml
forge:
  sparks:
    - type: entities
      path: /some_list
      element:
        target: {}
      entity_path: /target/entity_id
      filter:
        include:
          - label: special
```

Within an Entities Spark, `element` means the generated member of the target array. It is independent of the enclosing Forge's root `element` mapping and does not imply that the member is a card.

## Selection

`entities` is an optional list of explicit entity-ID strings. Those entries are retained even when an entity is currently unavailable or absent from the frontend registry. They are added before filter results. An explicit ID known to Home Assistant can still be removed by a matching `filter.exclude` rule, just as auto-entities applies exclusions after assembling its input list.

`filter.include` and `filter.exclude` use the familiar `auto-entities` shape. A filter mapping matches when all of its rules match. Multiple `include` filters form a union; multiple `exclude` filters form a union and are applied after all inclusions. An omitted `include` list selects no additional entities, so `entities` may be used by itself. An empty include filter (`{}`) selects every entity visible to the current Home Assistant user.

The initial supported rule keys are `domain`, `entity_id`, `name`, `group`, `area`, `floor`, `device`, `label`, `integration`, `hidden_by`, `entity_category`, `state`, and `attributes`, along with `and`, `or`, and `not` composition. These keys deliberately use the same user-facing names as `auto-entities`: use `area` and `label`, not `area_id` or `label_id`; use `entity_id` for matching an entity ID.

String rules support literal values, quoted `*` wildcards, and slash-delimited JavaScript regular expressions. `attributes` is a mapping whose rules all match. `area`, `floor`, `device`, `label`, and `integration` use the registry and frontend metadata available to the current user, including Home Assistant's normal effective area relationship from an entity to its device.

The Spark must use the current Home Assistant state and registry data. Its owner must regenerate when data used by an active rule changes: state and attributes for state-based rules; entity, device, area, floor, label, integration, category, and hidden metadata for registry-based rules; and normal Forge template dependencies for templated Spark values. Changes that cannot affect an active rule must not trigger an Entities Spark regeneration.

Entities Spark regeneration uses a 500 ms trailing debounce, matching the update behaviour users expect from `auto-entities`: relevant changes within the window are coalesced, and the list is regenerated once 500 ms after the most recent relevant change. Until then, the previously generated Forge or strategy configuration remains in use. For a strategy mold, the debounced refresh must call the normal Home Assistant strategy-generation lifecycle with the newly generated source `element`; UIX must not mutate a config already returned to Home Assistant. Unknown or inaccessible registry data never expands the selected set. Invalid filter syntax, an invalid target, an incompatible target list, or an invalid generated entry fails Forge generation visibly rather than returning a partial list.

Filter results have deterministic entity-ID order unless `sort` is supplied. `sort` accepts one sort mapping or an ordered list of mappings. Its supported methods are `domain`, `entity_id`, `name`, `device`, `area`, `state`, and `attribute`; `attribute` requires `attribute`. `reverse`, `ignore_case`, and `numeric` are supported boolean options.

Set `divider: true` on one or more sort levels to insert a `{ type: divider }` entry whenever the corresponding sorted value changes. Set `section: true` to insert a `{ type: section, label }` heading above every corresponding group, including the first. A section wins over a divider for the same group boundary.

`label` optionally gives a section its Home Assistant entity-name parts, using `entity`, `device`, `area`, `floor`, or a `{ type: text, text: ... }` mapping; `separator` is the string placed between parts. The group's first entity supplies those name parts. Without `label`, Forge uses the plain sort value. If the active Home Assistant frontend cannot format entity names, Forge also falls back to that plain sort value.

Dividers and sections are entity-row entries, so they are valid for any target array whose consumer accepts native Entities-card row configuration, including an Entities card and custom rows such as `custom:fold-entity-row`; they are invalid with the Spark's `element` option, which generates one structured entry for every entity. When divider or section sorting is configured, generated and authored entity rows are cleaned: leading and trailing dividers are removed, consecutive dividers are collapsed, dividers adjacent to sections are removed, and adjacent sections with the same label are collapsed. Sections are retained at either end of a list. Explicit `entities` retain their authored order before generated filter results in `append` mode, or after them in `prepend` mode when no sort is supplied. `type`, `options`, `card`, `card_param`, `show_empty`, and `else` are intentionally invalid: they are `auto-entities` card-wrapper concerns, whereas this Spark produces a general list.

## Resolution order and compatibility

Forge resolves Foundries, `element_base`, `element`, and Forge-owned templates before running Entities Sparks. Forge resolves Forge-owned template values within each Entities Spark using the ordinary template context before executing it. The Spark therefore observes the composed resolved root `element` and can augment an array supplied by an `element_base`, a Foundry, or local configuration. It never evaluates or rewrites element-owned templates from `element_base`.

All Entities Sparks run in their resolved order. A later Entities Spark observes the target arrays produced by earlier ones. For normal molds, Forge then creates or refreshes the forged target from the modified config. For a strategy mold, Forge then delegates to a selected base strategy or returns direct scope output; any `type: config` Sparks run only after that step.

Existing Forge configurations are unchanged unless they explicitly include a `type: entities` Spark. Existing `type: config` semantics and DOM Spark ordering remain unchanged.

## Inspection

UIX exposes `uix_entities_inspect(forge, spark?)` in the browser console. `forge` is normally the rendered `<uix-forge>` element, for example `$0` after selecting it in DevTools; the helper uses that element's active resolved Forge configuration. For a strategy, which has no Forge wrapper element, `forge` is the complete Forge configuration mapping. `spark` is an optional Spark identifier or zero-based Entities Spark index; when omitted, exactly one Entities Spark must be present.

The helper returns the generated IDs, entries, included IDs, excluded IDs, and per-filter match counts using the current user's Home Assistant state and registry data. It does not alter the open dashboard or persist configuration. The inspector must share the runtime selector, output generation, ordering, and debounce-independent validation implementation. This lets a user verify a Browser Mod, area, label, or integration filter before saving dashboard YAML.
