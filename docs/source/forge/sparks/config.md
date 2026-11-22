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
| `remove_matching` | remove direct array items matching `where`, from one target or every matching `all` list |
| `wrap_strategy` | augment a child strategy emitted by another strategy without copying its source config |
| `wrap_card` | augment a generated card without copying its source config |
| `append` / `prepend` | add an item at either end of an array |
| `insert_before` / `insert_after` | insert beside a selected or indexed array item |

`merge` recursively merges mappings; scalars, lists, and `null` replace the value at that key. Array entries are never merged individually.

`remove_matching` deliberately filters only the immediate items in one target array; it does not recursively search a generated strategy tree. Use `select` to find a stable parent array, then `where` as a partial matcher for its entries. This keeps an exclusion from changing unrelated entity references in actions, conditions, or nested card configuration.

### Patch fields

| Field | Used by | Meaning |
| --- | --- | --- |
| `op` | every patch | The operation from the table above. |
| `path` | every operation | A direct JSON Pointer target. Use one of `path`, `select`, or `all`. |
| `select` | every operation | Finds one stable array member, optionally followed by `select.path` to reach its target. |
| `all` | `remove_matching`, `wrap_card` | Walk every nested array stored under this exact mapping key. `wrap_card` requires exactly `all: cards`; it and `remove_matching` cannot be combined with `path` or `select`. |
| `value` | `merge`, `replace`, `wrap_strategy`, `wrap_card`, `append`, `prepend`, `insert_before`, `insert_after` | The data to write. |
| `where` | `remove_matching`, `wrap_card` with `all` | A partial matcher applied to every direct item of the target array. |

### `select` and `where` matchers

`path`, `select.in`, and `select.path` are JSON Pointers. `all` is different again: it is the literal mapping key for every array to visit, not a JSON Pointer or wildcard. `match` and `where` are partial configuration matchers. Their `$` names are matcher operators, not JSON Pointer syntax; the prefix prevents them being confused with ordinary Home Assistant config keys such as `type` or `entity`.

| Matcher form | Meaning |
| --- | --- |
| `type: tile` | A direct key/value match. Mapping matches are partial, so unspecified keys do not matter. |
| `$contains: [...]` | The candidate array contains each specified matcher. Used to recognise a parent section by one of its cards. |
| `$in_entities: no_favs` | The scalar value belongs to the raw IDs selected by the Entities Spark named `no_favs`. |

To match every direct card-like entry that has a selected entity, omit `type` entirely:

```yaml
where:
  entity:
    $in_entities: no_favs
```

This is the equivalent of a type wildcard for the target array. Add `type: tile` only when you deliberately want to limit the removal to Tiles; an ordinary `type: "*"` is a literal string and is not a wildcard.

Use `all: cards` when the same exclusion belongs in every generated card list, including nested stacks and sections. Use `all: entities` for every generated entity-row list. In either case, only direct members of those arrays are filtered; UIX does not inspect arbitrary nested entity references.

```yaml
- op: remove_matching
  all: cards
  where:
    entity:
      $in_entities: no_favs
```

The same named query-only result is available to Forge element templates as `uixForge.entities["no_favs"]`, which is useful when a card label or description should explain the matching set as well as remove it. See [Entities Spark: Use a query result in templates](entities.md#use-a-query-result-in-templates).

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

### Wrap a generated child strategy

Some Dashboard strategies emit child View strategies rather than their final card configuration. For example, Home emits a `home-overview` View strategy followed by area, media-player, and other-device subviews. `wrap_strategy` turns one emitted child strategy into a Forge strategy while preserving its complete original source mapping as `element_base`. Home Assistant then resolves the wrapped child normally, including its own lifecycle and lazy loading.

Target a non-root strategy mapping with `path` or `select.path`. The `value` is the child Forge configuration without `type` or `element_base`: Forge supplies `type: custom:uix-forge` and copies the matched original mapping into `element_base`. If `value` includes `forge`, its `mold` must be `strategy`; a Foundry may supply that Forge configuration instead. An existing `custom:uix-forge` strategy cannot be wrapped again.

### Add a People map after Home Dashboard Summaries

This complete Dashboard strategy keeps Home Assistant's generated area subviews while augmenting only its generated Overview View. The outer Configuration Spark first finds Home's `home-overview` descriptor and wraps it. The nested Configuration Spark then finds the Overview summary section by its configuration instead of assuming a numeric position. Both selections must find exactly one entry by default, so a Home Assistant update cannot silently change the wrong part of the dashboard.

```yaml
title: My Home
views: []
strategy:
  type: custom:uix-forge
  forge:
    mold: strategy
    sparks:
      - type: config
        patches:
          - op: wrap_strategy
            select:
              in: /views
              match:
                strategy:
                  type: home-overview
              path: /strategy
            value:
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
    type: home
    favorite_entities:
      - light.bed_light
```

![People map section inserted after Home Overview summaries](../../assets/page-assets/forge/config-spark-people-map.png)

The outer `select.in` points to Home's generated View list. Its `select.path` targets that View's `strategy` mapping, which `wrap_strategy` retains as the nested `element_base`; Home's own `favorite_entities` and future source fields therefore remain intact. The nested `select.in` points to the generated Overview section list. Its `match` is a partial mapping match, so it only needs the distinctive fields. `$contains` matches the Home Summary card somewhere in the section without requiring an exact cards list. With no nested `select.path`, `insert_after` uses the uniquely matched summary section itself as the anchor and adds the new full-width People section immediately after it.

The native [Heading card](https://www.home-assistant.io/dashboards/heading/) supplies the Overview-style section title and its navigation action. The native [Map card](https://www.home-assistant.io/dashboards/map/) accepts people, device trackers, zones, and other location-capable entities.

### Wrap generated cards

`wrap_card` turns a generated card into a Card Forge and keeps the exact original card mapping as `element_base`. The wrapper `value` therefore contains only the Forge additions; do not copy its `type`, `summary`, actions, or layout fields. Target one card with an array-member `path` or `select`, or use `all: cards` to wrap every direct matching card throughout the generated tree. The latter is useful for Home Overview because it generates matching summary cards in both the main content and sidebar.

A Home Summary card is only the shortcut: filtering it alone leaves its destination unchanged. The following complete Home dashboard replaces the Maintenance route as well. It keeps Home's generated Overview and area subviews, wraps the native Maintenance summary in both the main content and sidebar, and appends a filtered dashboard-local Maintenance subview.

First create this Foundry in UIX. It owns the reusable entity query without imposing a card or strategy mold, so either consumer can merge it with its own Forge configuration.

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

```yaml
title: Filtered Home Maintenance
views: []
strategy:
  type: custom:uix-forge
  forge:
    mold: strategy
    sparks:
      - type: config
        patches:
          - op: wrap_strategy
            select:
              in: /views
              match:
                strategy:
                  type: home-overview
              path: /strategy
            value:
              forge:
                mold: strategy
                sparks:
                  - type: config
                    patches:
                      - op: wrap_card
                        all: cards
                        where:
                          type: home-summary
                          summary: maintenance
                        value:
                          foundry: maintenance-exclusions
                          forge:
                            mold: card
                            sparks:
                              - type: home-summary
                                exclude:
                                  - $in_entities: excluded_from_maintenance
                          element:
                            tap_action:
                              action: navigate
                              # Replace this dashboard URL path if different.
                              navigation_path: /filtered-home-maintenance/maintenance
          - op: append
            path: /views
            value:
              title: Maintenance
              path: maintenance
              subview: true
              strategy:
                type: custom:uix-forge
                foundry: maintenance-exclusions
                forge:
                  mold: strategy
                  sparks:
                    - type: config
                      patches:
                        - op: remove_matching
                          all: cards
                          where:
                            entity:
                              $in_entities: excluded_from_maintenance
                element:
                  type: maintenance
  element:
    type: home
```

Assign the Home Assistant label `excluded_from_maintenance` to every entity that should not contribute to Maintenance. The Foundry's query is evaluated separately by each consuming Forge, so the wrapped summary and the Maintenance strategy both use the same selection without sharing a parent DOM context. The first nested Forge uses the [Home Summary Spark](home-summary.md) so the native Maintenance status is truthful, then replaces its action. `navigation_path` must be the absolute route to this dashboard's subview: replace `/filtered-home-maintenance` with the dashboard URL path that Home Assistant assigned or that you configured. Do not hide the native Maintenance summary in the parent Home strategy: Forge needs it to wrap it.

![Native Maintenance summary filtered and redirected by Forge](../../assets/page-assets/forge/config-spark-maintenance-shortcut.png)

The appended View is another Forge strategy using the same Foundry. Its Configuration Spark's `remove_matching` removes only generated cards with a direct matching `entity`. `subview: true` keeps this implementation View out of the dashboard's tab bar while allowing the summary card to navigate to it. The result below is the filtered destination: the labelled Carbon dioxide maintenance item is absent.

![Filtered Maintenance subview generated by the Home dashboard](../../assets/page-assets/forge/config-spark-maintenance-exclusion.png)

This does not rewrite unrelated nested entity references, service targets, or any other destination. To replace Lights, Security, or another summary destination, add a corresponding wrapper and View strategy deliberately; filtering one Home Summary card never creates or filters those pages automatically.

??? info "Creating and editing this Dashboard strategy"
    Create the dashboard with the complete raw dashboard mapping above: `title`, an empty `views` list, and `strategy`. After Home Assistant saves a strategy dashboard, its raw editor can show only the mapping under `strategy:`. At that point edit the `type: custom:uix-forge` mapping already present; do not paste a second outer `title`/`views`/`strategy` dashboard mapping into it.

    Use `uix_dashboard_inspect()` on an ordinary Home dashboard to inspect Home's authored strategy options before reproducing them in Forge. It saves its result as `window.uix_inspect.dashboard`; `window.uix_inspect.dashboard.strategy` is the strategy input to copy into Forge's `element`.

### Remove labelled Favorites suggestions

Home emits its Overview as a child strategy, so first wrap that child. Home Overview then generates its Favorites Tiles after Entities Sparks have run, so the nested Forge strategy uses a query-only Entities Spark to collect the excluded IDs and a Configuration Spark to filter the generated Favorites card list. The nested `select` anchor finds the unique Favorites heading rather than relying on `/sections/0` staying in the same position.

```yaml
title: My Home
views: []
strategy:
  type: custom:uix-forge
  forge:
    mold: strategy
    sparks:
      - type: config
        patches:
          - op: wrap_strategy
            select:
              in: /views
              match:
                strategy:
                  type: home-overview
              path: /strategy
            value:
              forge:
                mold: strategy
                sparks:
                  - type: entities
                    id: no_favs
                    filter:
                      include:
                        - label: no-favs
                  - type: config
                    patches:
                      - op: remove_matching
                        select:
                          in: /sections
                          match:
                            cards:
                              $contains:
                                - type: heading
                                  heading: Favorites
                          path: /cards
                        where:
                          entity:
                            $in_entities: no_favs
                      - op: remove
                        select:
                          in: /sections
                          match:
                            type: grid
                            cards:
                              $contains:
                                - type: heading
                                  heading: Other areas
  element:
    type: home
```

The query-only Spark does not add a key to the nested `element`; its `id` names the selected entity-ID set. The `where` matcher intentionally omits `type`, so it matches any direct Favorites card that has an `entity` belonging to that set. If no selected entity is currently a Favorite, the first patch is a successful no-op. The second patch has no `select.path`, so its uniquely matched `grid` section is the removal target; it removes the complete Other areas section, rather than only its heading. The same 500 ms Entities Spark debounce regenerates the nested strategy when the labelled set changes.

## Inspect generated strategies

`uix_dashboard_inspect()` and `uix_strategy_inspect(scope, element)` are UIX browser-console helpers, not YAML configuration. On the native Home panel, first run `uix_dashboard_inspect()` to read its authored `rawConfig`, generated config, and top-level `strategy` options; it saves that report as `window.uix_inspect.dashboard`. For example, `window.uix_inspect.dashboard.strategy` is the complete source mapping to copy into a Forge Dashboard `element`. `uix_strategy_inspect` saves its latest report as `window.uix_inspect.strategy`. Then pass the Home Assistant strategy scope (`"dashboard"`, `"view"`, or `"section"`) and that same strategy mapping to `uix_strategy_inspect` to resolve the generated output without changing the open dashboard. See the [current dashboard helper reference](../../concepts/dom.md#uix_dashboard_inspect-current-dashboard-helper) and [strategy config helper reference](../../concepts/dom.md#uix_strategy_inspectscope-element-strategy-config-helper) for their complete return values.

The returned inspector has `config` for the resolved tree, `paths(term)` to search its JSON Pointer index, and `get(path)` to retrieve one exact value. Its `test(patches, entitySets?)` method accepts the same patch list that belongs under a Configuration Spark's `patches:` key. It applies those patches to an in-memory copy, returns and logs the result, and raises the same path, match, and target errors as Forge would; it never saves configuration or changes the current dashboard.

Do not guess a strategy's generated paths. Open your browser DevTools console on the dashboard, then inspect the same base strategy that you plan to use in Forge:

```js
uix_dashboard_inspect();
await uix_strategy_inspect("dashboard", window.uix_inspect.dashboard.strategy);
await uix_strategy_inspect(
  "view",
  window.uix_inspect.strategy.config.views.find(
    (view) => view.strategy?.type === "home-overview",
  ).strategy,
);
```

The helper logs the full generated config, returns it, and saves it as `window.uix_inspect.strategy`. Search its JSON Pointer index for distinctive generated values:

```js
window.uix_inspect.strategy.paths("home-summary");
window.uix_inspect.strategy.paths("favorites");
window.uix_inspect.strategy.get("/sections/0/cards");
```

### Try paths in a JSON Pointer tester

`window.uix_inspect.strategy.paths()` is usually the quickest way to find a path. If you prefer a visual tester, copy the inspected tree from DevTools, then paste it into [JsonKit's JSON Pointer tester](https://jsonkit.com/jsonpath-tester). Select **JSON Pointer** rather than JSONPath, paste the copied tree as JSON, and try paths such as `/sections/0/cards`. JsonKit says that processing runs in the browser, but remove names, entity IDs, and any other information you would not want to share before using any external site.

```js
copy(JSON.stringify(window.uix_inspect.strategy.config, null, 2));
```

The tester confirms that a pointer reaches the value you expect. It does not implement Forge's `select` matching or patch rules, so finish by running the same patch list through `window.uix_inspect.strategy.test()`.

After choosing an anchor, call `window.uix_inspect.strategy.test()` with the exact patch list before saving it into YAML:

```js
window.uix_inspect.strategy.test([
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

For a `remove_matching` patch using `$in_entities`, inspect the named Entities Spark from the complete Forge configuration (the mapping containing `forge` and `element`, not only `element`), then pass its selected IDs as the second `test()` argument:

```js
await uix_entities_inspect(forgeConfig, "no_favs");
window.uix_inspect.strategy.test(patches, { no_favs: window.uix_inspect.entities.ids });
```

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
