# Forge Home Summary Spark contract

## Status and scope

This contract defines the `type: home-summary` DOM Spark. It filters the entity universe used by one native Home Assistant `home-summary` card without duplicating the card, mutating Home Assistant's shared data, or writing to the card's private fields.

The Spark is only valid on a normal Card Forge whose final resolved card type is `home-summary`. It is not valid for `mold: strategy`, and an ordinary generated Home Summary card must first be made into a Card Forge with the Configuration Spark's `wrap_card` operation.

## Configuration

`include` and `exclude` are optional lists of entity selectors. An ordinary selector mapping uses the same filter language as an Entities Spark `filter.include` entry: supported keys are `domain`, `entity_id`, `name`, `group`, `area`, `floor`, `device`, `label`, `integration`, `entity_category`, `state`, `attributes`, `and`, `or`, and `not`. A selector may instead be exactly `{ $in_entities: <id> }`, which references a named query-only Entities Spark resolved by this same Forge.

```yaml
forge:
  mold: card
  sparks:
    - type: home-summary
      include:
        - $in_entities: maintenance_entities
      exclude:
        - $in_entities: excluded_from_maintenance
element_base:
  type: home-summary
  summary: maintenance
```

If `include` is omitted, the native card begins with every state visible to the current user. If it is present, the card begins with the union of all included selectors, including empty lists. UIX subtracts the union of `exclude` selectors afterwards. Only one Home Summary Spark may be active on a Forge. Both options are Forge-owned and may use normal Forge templates. They have no `path`, output entries, sort order, or named query result: use an Entities Spark when a generated config list or reusable ID set is required.

Each `$in_entities` reference must resolve to exactly one named query-only Entities Spark in the same resolved Forge. An unknown, duplicated, or path-backed ID is an error. A Foundry can declare that reusable query once, but each Forge that uses the Foundry evaluates the query against its own current Home Assistant context; results are never inherited through parent DOM or Lit context.

## Context projection and refresh

UIX creates a context provider on the individual Forge wrapper. It gives only that wrapped card a projection of Home Assistant's `states` and entity registry collections with the excluded entity IDs omitted. Device, area, and floor registries remain available so retained entities keep their normal relationships. Other cards, strategies, service actions, and Home Assistant's global contexts are never changed.

The native Home Summary card continues to receive live updates through this local context and is not recreated for ordinary state updates. If an inline selector or referenced query-only Entities Spark changes selected membership, UIX recalculates it with the same 500 ms trailing debounce as an Entities Spark, then replaces the local context projection. When every local Entities Spark is used only by this Home Summary Spark, and the same result is not read by a Configuration Spark or an element template, that refresh deliberately does not recreate the native card. A result observed by either of those consumers follows the normal Forge refresh path so its generated configuration or template value remains current. It intentionally does not alter an associated strategy page: filtering a Maintenance summary does not by itself remove cards from the separate Maintenance View strategy.

Existing Forge configurations are unchanged unless they include this Spark.
