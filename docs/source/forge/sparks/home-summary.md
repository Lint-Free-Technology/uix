---
title: Home Summary Spark
description: Choose which entities count toward a native Home Assistant Home Summary card.
icon: material/home-analytics
---
# Home Summary Spark

Choose which entities count toward a native Home Overview summary such as Maintenance, Lights, or Security. For example, you can keep an old tablet's battery sensor out of the Maintenance count.

## Filter one Home Summary card

Create the label in Home Assistant and assign it to the entities you want to exclude. Then add this Card Forge to a dashboard. The card still uses Home Assistant's Maintenance summary logic and updates as the remaining entities change.

```yaml
type: custom:uix-forge
forge:
  mold: card
  sparks:
    - type: home-summary
      exclude:
        - label: excluded_from_maintenance
element:
  type: home-summary
  summary: maintenance
```

This changes what the card counts. Its click action still opens the standard Maintenance page, which can show the excluded entities. To filter both the summary and the page it opens, use the [complete Home dashboard example](config.md#wrap-generated-cards). It wraps the generated summary cards and points them at a filtered Maintenance subview.

## Spark options

A Card Forge can use one Home Summary Spark and must wrap a native `type: home-summary` card. If a strategy generates the card, use the Configuration Spark's [`wrap_card` operation](config.md#wrap-generated-cards) to add this Spark to the generated card.

| Option | Type | Default | Meaning |
| --- | --- | --- | --- |
| `type` | string | — | Required. Use `home-summary`. |
| `include` | list of filters or query references | all entities | Count only entities matching any entry. Set `include: []` to count none. |
| `exclude` | list of filters or query references | `[]` | Leave out entities matching any entry, even if `include` picked them. |

### Filters

Write entries directly under `include` or `exclude`. Each entry uses the same rules as [Entities Spark filters](entities.md#filters), such as `domain`, `label`, and `attributes`. For example, this excludes Browser Mod lights and any entity with the Maintenance exclusion label.

```yaml
exclude:
  - domain: light
    integration: browser_mod
  - label: excluded_from_maintenance
```

### Reuse an Entities Spark filter

If several cards or patches need the same list, name an Entities Spark and omit its `path`. The Home Summary Spark reads its result with `$in_entities` from the same Card Forge. The following `forge` block can replace the one in the first example.

```yaml
forge:
  mold: card
  sparks:
    - type: entities
      id: excluded_from_maintenance
      filter:
        include:
          - label: excluded_from_maintenance
    - type: home-summary
      exclude:
        - $in_entities: excluded_from_maintenance
```

Save the query in a Foundry when multiple Forges need the same filter. Each Forge runs the shared query for itself. See [how to share a filter through a Foundry](entities.md#reuse-an-entities-foundry-query-in-another-element).

## Updates

The card continues to receive live updates for the entities it counts. UIX batches filter changes over 500 ms. The filter applies only to this card. Other cards, the destination page, and service actions such as turning off every light in an area keep their normal behaviour.
