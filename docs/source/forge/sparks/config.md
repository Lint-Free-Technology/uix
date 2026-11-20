---
title: Configuration
description: Change a Forge config before Home Assistant renders it, including strategy-generated dashboard configs.
icon: material/file-tree
---
# Configuration Spark

The Configuration Spark changes a fully resolved Forge config before Home Assistant creates the card, badge, section, or other forged item. It is especially useful with [Forge strategies](../forge.md#strategies): let Home Assistant generate a Dashboard, View, or Section, then add, replace, or remove exactly the part you need.

This screenshot shows a real Home Assistant `original-states` View strategy after Forge prepends a card to its generated config; its complete View configuration, with ordered Configuration Sparks under `forge.sparks`, follows.

![Configuration Spark prepending a card to a Home Assistant View strategy](../../assets/page-assets/forge/config-spark-strategy.png)

```yaml
views:
  - path: overview
    strategy:
      type: custom:uix-forge
      forge:
        mold: strategy
        sparks:
          - type: config
            patches:
              - op: prepend
                path: /cards
                value:
                  type: markdown
                  content: "## Added by Forge"
                  grid_options:
                    columns: full
      element:
        type: original-states
```

## Paths and operations

`path`, `select.in`, and `select.path` use [JSON Pointer](https://www.rfc-editor.org/rfc/rfc6901). Use `""` for the root, `/cards/0` for the first card, and `~1` or `~0` for literal `/` or `~` characters in a key.

??? info "Why JSON Pointer rather than JSONPath?"
    Think of JSON Pointer as a street address: `/cards/0` means exactly “the first card”. That makes it safe for an edit such as replace, append, or remove. JSONPath is a search language: it can find many matching values, which is useful when extracting data from a REST response but does not say which result an edit should change. When a generated strategy has an array whose position may change, use Forge's `select` matcher to find exactly one item first, then use a JSON Pointer relative to it.

| Operation | Use it to |
| --- | --- |
| `merge` | edit a mapping without replacing its other keys |
| `replace` | replace a value or the complete config |
| `remove` | remove an existing mapping key or array item |
| `append` / `prepend` | add an item at either end of an array |
| `insert_before` / `insert_after` | insert beside a selected or indexed array item |

`merge` recursively merges mappings; scalars, lists, and `null` replace the value at that key. Array entries are never merged individually.

Templates in a patch's `value` may return a JSON object or list (for example with `| tojson`); Forge uses that as the structured patch value. JSON-looking output in ordinary Forge fields remains text, preserving existing Forge configuration behaviour.

## Strategies

Use `custom:uix-forge` as the Home Assistant strategy type. With `element.type: home-overview` (or another recognised built-in strategy), Forge runs that base strategy and then applies patches to its generated config. Built-in Dashboard, View, and Section strategies load when needed. A registered matching `custom:` strategy is delegated too. Otherwise, `element` is the direct blank Dashboard, View, or Section config that Forge returns. `mold: strategy` is YAML-only, but `element`, `element_base`, Foundries, macros, billets, and templates have their normal Forge behaviour.

For a Dashboard strategy, write the Forge `strategy:` at the root of the dashboard configuration. Configuration Spark paths then address the generated dashboard tree, including `/views`, rather than a single View or Section.

```yaml
views:
  - path: overview
    strategy:
      type: custom:uix-forge
      forge:
        mold: strategy
      element:
        type: home-overview
```

The Configuration Spark receives the config produced by `home-overview`, not the small source config above. This lets Home Assistant retain ownership of its strategy while you make a focused augmentation.

### Add a People map after Summaries

The `select` form finds the generated summary section by its configuration instead of assuming a numeric position. It must find exactly one entry by default, so a Home Assistant update cannot silently change the wrong part of a dashboard.

```yaml
views:
  - path: overview
    strategy:
      type: custom:uix-forge
      forge:
        mold: strategy
        sparks:
          - type: config
            patches:
              - op: insert_after
                select:
                  in: /sections
                  match:
                    type: grid
                    cards:
                      $contains:
                        - type: home-summary
                value:
                  type: grid
                  column_span: 4
                  cards:
                    - type: heading
                      heading: People
                      icon: mdi:account-multiple
                      tap_action:
                        action: navigate
                        navigation_path: /map
                    - type: map
                      entities:
                        - device_tracker.phone
                        - device_tracker.tablet
                      grid_options:
                        columns: full
      element:
        type: home-overview
        favorite_entities:
          - light.bed_light
```

![People map section inserted after Home Overview summaries](../../assets/page-assets/forge/config-spark-people-map.png)

`select.in` points to the array to search. `match` is a partial mapping match, so it only needs the distinctive fields. `$contains` matches the Home Summary card somewhere in the section without requiring an exact cards list. With no `select.path`, `insert_after` uses the uniquely matched summary section itself as the anchor and adds the new full-width People section immediately after it.

The native [Heading card](https://www.home-assistant.io/dashboards/heading/) supplies the Overview-style section title and its navigation action. The native [Map card](https://www.home-assistant.io/dashboards/map/) accepts people, device trackers, zones, and other location-capable entities.

## Inspect generated strategies

`uix_strategy_inspect(scope, element)` is a UIX browser-console helper, not YAML configuration. Pass the Home Assistant strategy scope (`"dashboard"`, `"view"`, or `"section"`) and the same strategy type (`element.type`) that you intend to use in the Forged strategy. The helper resolves that generated output without changing the open dashboard. See the [strategy config helper reference](../../concepts/dom.md#uix_strategy_inspectscope-element-strategy-config-helper) for its complete return value.

The returned inspector has `config` for the resolved tree, `paths(term)` to search its JSON Pointer index, and `get(path)` to retrieve one exact value. Its `test(patches)` method accepts the same patch list that belongs under a Configuration Spark's `patches:` key. It applies those patches to an in-memory copy, returns and logs the result, and raises the same path, match, and target errors as Forge would; it never saves configuration or changes the current dashboard.

Do not guess a strategy's generated paths. Open your browser DevTools console on the dashboard, then inspect the same base strategy that you plan to use in Forge:

```js
const overview = await uix_strategy_inspect("view", {
  type: "home-overview",
});
```

The helper logs the full generated config and returns `overview`. Search its JSON Pointer index for distinctive generated values:

```js
overview.paths("home-summary");
overview.paths("favorites");
overview.get("/sections/0/cards");
```

### Try paths in a JSON Pointer tester

`overview.paths()` is usually the quickest way to find a path. If you prefer a visual tester, copy the inspected tree from DevTools, then paste it into [JsonKit's JSON Pointer tester](https://jsonkit.com/jsonpath-tester). Select **JSON Pointer** rather than JSONPath, paste the copied tree as JSON, and try paths such as `/sections/0/cards`. JsonKit says that processing runs in the browser, but remove names, entity IDs, and any other information you would not want to share before using any external site.

```js
copy(JSON.stringify(overview.config, null, 2));
```

The tester confirms that a pointer reaches the value you expect. It does not implement Forge's `select` matching or patch rules, so finish by running the same patch list through `overview.test()`.

After choosing an anchor, call `.test()` on the returned inspector with the exact patch list before saving it into YAML:

```js
overview.test([
  {
    op: "append",
    select: {
      in: "/sections",
      match: {
        cards: {
          $contains: [{ type: "home-summary", summary: "favorites" }],
        },
      },
      path: "/cards",
    },
    value: {
      type: "tile",
      entity: "light.kitchen",
    },
  },
]);
```

Pass `"dashboard"` or `"section"` as the first argument to inspect those strategy scopes. The inspector calls Home Assistant's strategy generator with your current user, locale, registries, and entities, so its output is the relevant tree for the dashboard currently open in your browser.

## Safe failure and optional output

An invalid path, wrong target type, failed required selection, or ambiguous selection makes the Forge strategy fail visibly. UIX never applies only some of a Spark's patches.

Set `required: false` on `select` when a missing match is genuinely optional. It skips only the no-match case; matching more than one item remains an error because UIX cannot know which target you intended.

```yaml
- op: append
  select:
    in: /badges
    match:
      type: entity
      entity: sensor.optional_status
    required: false
  value:
    type: entity
    entity: sensor.next_status
```
