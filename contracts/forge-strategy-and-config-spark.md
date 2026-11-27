# Forge strategy and configuration Spark contract

## Status and scope

This contract defines two related Forge capabilities: the `strategy` mold, which returns blank/direct Dashboard, View, and Section configs or delegates to a base Home Assistant strategy, and the `config` Spark, which transforms a resolved config before Forge gives it to Home Assistant for rendering. The [Forge Entities Spark contract](./forge-entities-spark.md) separately defines the reusable pre-generation `type: entities` Spark.

The strategy mold is YAML-only. UIX must not provide a visual editor, picker, or Home Assistant editor integration for it.

The [Forge layered configuration contract](./forge-layered-configuration.md) remains authoritative for Foundry resolution, `element_base`, `element`, `element_disabled_paths`, template ownership, template nesting, and UIX configuration merging. This contract extends those rules; it does not create a second configuration model for strategies.

## Design principles

- `element` has the same meaning for a strategy mold as for every other Forge mold: it is Forge-owned configuration, templates are resolved by Forge, and it overlays `element_base` when layered configuration is in use.
- `element_base` remains element-owned pass-through configuration. Its values, including templates, are passed unchanged to direct scope output or a delegated Home Assistant strategy.
- A strategy mold renders the config appropriate to the enclosing Home Assistant strategy scope, rather than mounting a `uix-forge` DOM element.
- A configuration Spark transforms generated configuration data, not the DOM. It runs before the target is created or refreshed and can therefore be used with every Forge mold.
- Transformations are declarative YAML. UIX does not embed JavaScript, JQ, JSONPath expressions, or another executable language in dashboard configuration.

## `mold: strategy`

Home Assistant resolves a custom strategy independently for Dashboard, View, and Section contexts. UIX registers the corresponding custom strategy entry points, all using `custom:uix-forge`; each delegates to the same Forge strategy implementation while preserving the scope supplied by Home Assistant.

```yaml
# A View strategy. The same structure is valid under a Dashboard or Section
# `strategy:` key, where Home Assistant supplies that different scope.
views:
  - path: overview
    strategy:
      type: custom:uix-forge
      forge:
        mold: strategy
      element:
        type: home-overview
```

The outer `strategy.type` identifies UIX Forge to Home Assistant. A blank/direct strategy returns its resolved `element` mapping as the current scope's config, so a View becomes useful when `element.cards` or `element.sections` is supplied, a Section when `element.cards` is supplied, and a Dashboard when `element.views` is supplied.

When `element.type` is a recognised built-in Home Assistant strategy for the current scope, Forge treats `element` as that base strategy configuration and delegates to it. View strategies use Home Assistant's normal View generator. Section strategies use a temporary hidden native Section renderer. Dashboard strategies load Home Assistant's native Dashboard strategy editor without opening its dialog and ask that editor to resolve the requested strategy; on Frontends that do not expose that editor action, Forge uses the native hidden Dashboard chooser path instead. Both Dashboard paths lazily load the built-in base strategy. A `custom:` type delegates when its matching Home Assistant custom-strategy element is already registered for the current scope; otherwise it remains direct output configuration. A custom type must not be used as both a strategy and an output type. A base strategy may not be `custom:uix-forge`.

### Resolution and generation

For a strategy mold, Forge resolves its configuration exactly as it does for a standard mold:

1. Wait for the UIX coordinator's initial Foundry response, then resolve global, mold-specific global, named, inherited, and local Foundry fragments in the normal order.
2. When layered configuration is selected, exclude disabled `element` paths before resolving Forge templates. `element_base` remains untouched.
3. Resolve active Forge-owned templates, including normal nesting and pass-through handling. A valid JSON object or array template result is an opaque structural replacement.
4. Compose `element_base` and the resolved active `element` values when layered configuration is selected.
5. Run Entities Sparks, in resolved Spark order, over the resolved `element` mapping and retain any named query-only entity-ID results.
6. When that `element` selects a base strategy, invoke it through Home Assistant's normal resolver for View, Section, and Dashboard scopes; otherwise use the mapping directly as the scope config.
7. Run Configuration Sparks, in resolved Spark order, over that config.
8. Return the transformed config to Home Assistant, which performs its normal scope-specific strategy handling and rendering.

Direct strategy output has no required `type`; an empty mapping is a valid blank strategy. A selected base strategy must resolve to a concrete non-empty string type and must not be `custom:uix-forge`.

The generated result must be valid for the current scope: Dashboard strategies produce a dashboard config, View strategies produce a view config, and Section strategies produce a section config. UIX does not coerce a result from one scope into another.

Values adjacent to the outer `strategy:` key remain Home Assistant-owned configuration. Home Assistant merges those values with the generated result using its ordinary strategy rules; UIX neither deep-merges nor transforms them.

### Supported Forge configuration

The strategy mold supports the normal Forge `element`, `element_base`, `element_disabled_paths`, `foundry`, `forge.macros`, `forge.billets`, `forge.template_nesting`, and `forge.sparks` configuration. Foundries and layered configuration therefore work without a strategy-specific variation.

Because a strategy returns scope configuration rather than wrapping an element, layered strategy configuration is the one exception to the normal layered element type requirement: `element_base` does not need `type`, and `element` may set or omit it. Template ownership is unchanged: only `element` is Forge-resolved, while `element_base` remains pass-through.

`forge.hidden`, `forge.grid_options`, `forge.show_error`, `forge.delayed_hass`, and `forge.uix` have no strategy-scope meaning and are invalid with `mold: strategy`. DOM Sparks are also invalid because the strategy mold does not create a Forge wrapper element. Only the pre-generation `type: entities` Spark and post-generation `type: config` Spark are valid for this mold.

Forge-owned templates in strategy configuration receive the normal UIX `user`, `browser`, hash, and latest known panel context, as well as Forge context, nesting, pass-through, and structural-output rules. Strategy generation must not wait for the initial Lovelace view render solely to obtain panel context; before it is known, Forge supplies an empty panel mapping and the current hash. A strategy regenerates only when its delegated strategy requests it or an Entities Spark result changes; replacing a top-level Home Assistant states or registry object for an unrelated update must not regenerate it. A strategy is a configuration factory, not the live-data owner for the cards it generates: generated native cards retain their own Home Assistant subscriptions and updates without requiring strategy regeneration. UIX must forward the delegated strategy's precise dependency decision rather than treating those card updates as a generation dependency, because regeneration can recreate the generated configuration and repeat its generation-time data requests. Forge templates use one-shot rendering and do not independently subscribe to their individual Home Assistant dependencies, so their values are re-evaluated only during that normal strategy regeneration. A strategy is a static Home Assistant extension point, not a mounted Forge element: UIX must not patch Home Assistant to request an otherwise idle regeneration. Consequently, a time-only template such as `{{ now() }}` is refreshed by the next normal strategy update, but cannot independently wake a strategy. Element-base templates are not interpreted or subscribed to by Forge.

An error during Forge resolution, an Entities Spark, base-strategy generation, or a Configuration Spark fails the whole strategy generation. UIX must return no partially transformed result; Home Assistant displays its standard error result for the affected strategy scope. For an ordinary Forge mold, a transform error replaces the target configuration with a visible complete target appropriate to that mold rather than leaving a stale or partly transformed target mounted: a card-compatible mold receives a detailed Markdown card, while badges, rows, picture elements, and Sections receive valid native error, row, icon, or Section configurations. A Forge-owned transform error is visible regardless of `forge.show_error` until a later successful transform clears it.

## Configuration Spark

`type: config` is a pre-render Spark. It receives a cloned, fully resolved configuration tree and produces another configuration tree. For normal molds, this is the config Forge will pass to the forged card, badge, row, section, picture element, footer, or card feature. For `mold: strategy`, it is either the direct scope config or the config returned by the delegated base strategy.

```yaml
forge:
  sparks:
    - type: config
      patches:
        - op: merge
          path: ""
          value:
            title: Kitchen
```

Configuration Sparks run after template resolution and element-layer composition, but before Forge creates, configures, or refreshes the rendered target. All configuration Sparks run before DOM Sparks. Multiple configuration Sparks and the patches within each Spark run in their resolved order, so a later patch observes the output of every earlier patch.

Configuration Spark values use the usual Forge template handling. The operation name and all pointer paths are literal structural syntax and cannot be templates. Template results in a patch `value`, and data-bearing Entities Spark fields (`entities`, `filter`, `sort`, and generated-entry `element`), parse a valid JSON object or array as an opaque structural replacement; ordinary Forge template fields preserve their established scalar-string behaviour. Clone, merge, replacement, and generated configuration writes operate only on own data properties; a `__proto__` key remains data and must never alter an object prototype.

### Paths and selection

Direct `path` values and `select.in`/`select.path` values are RFC 6901 JSON Pointers. The empty string (`""`) is the root. `/` separates path segments; `~1` represents `/` and `~0` represents `~`. Array indices are zero-based. A direct path must resolve to an existing value unless the operation explicitly operates on the root mapping. `all` is not a JSON Pointer: it is the literal mapping key of every array to target while walking the generated tree.

`select` locates one member of an array without coupling an augmentation to its generated array index. It is intentionally a small, inspectable matcher rather than a query language:

```yaml
select:
  in: /sections
  match:
    type: grid
    cards:
      $contains:
        - type: home-summary
          summary: favorites
  path: /cards
```

`select.in` must resolve to an array. `match` is a recursive partial matcher: mapping keys listed in the matcher must exist and match; scalar values must be equal; ordinary arrays match exactly in order; and `$contains` is valid only as the sole key of a mapping matched against an array. Its value is one matcher or a list of matchers, each of which must match a distinct member of the candidate array. `select.path`, when present, is a JSON Pointer relative to the selected array member and resolves the final target.

`remove_matching.where` uses the same partial matcher against each direct member of its target array. Within `where`, `{ $in_entities: name }` matches a scalar entity ID contained in the named result from an Entities Spark. The referenced Spark must have an `id` or `spark_id`; an unknown or ambiguous name is an error. Omit `type` when every direct entry with that matching entity should be removed; `type: "*"` is a literal match, not a wildcard. This is a membership check, not a tree traversal: it does not inspect nested values unless `where` explicitly descends through their mapping keys.

Selection must resolve exactly one member. No match or more than one match is an error by default. Set `required: false` to make no match a no-op; an ambiguous match remains an error. This fail-safe default prevents a Home Assistant strategy change from silently modifying an unintended part of the generated dashboard.

An `insert_before` or `insert_after` patch uses the selected member itself as its anchor and therefore cannot set `select.path`. Other operations may use either a direct `path` or a `select` target, but not both. `remove_matching` and `wrap_card` also accept `all`, which is exclusive with `path` and `select`.

### Patch operations

Every patch has `op` and exactly one target (`path`, `select`, or `all`). `value` is required by the operations that add data. Patches mutate an internal copy only; neither the generated base config nor the authored Forge configuration is modified.

| Operation | Target | Behaviour |
| --- | --- | --- |
| `replace` | existing value | Replaces the target completely with `value`. Replacing the root is allowed. |
| `merge` | mapping | Recursively merges mapping `value` into the target. Nested mappings merge; scalars, arrays, and `null` replace. The root mapping is always a valid target. |
| `remove` | existing non-root value | Removes a mapping key or array member. Removing the root is invalid. |
| `remove_matching` | array | Removes every direct array member matching `where`. It removes zero or more members; a missing `where` or non-array target is an error. |
| `wrap_strategy` | existing non-root strategy mapping | Replaces an emitted child strategy descriptor with a Forge strategy while preserving the descriptor as `element_base`. |
| `wrap_card` | existing non-root card mapping, or every matched `all: cards` member | Replaces a generated card with a Card Forge while preserving the original card mapping as `element_base`. |
| `append` | array | Adds `value` as the last array member. |
| `prepend` | array | Adds `value` as the first array member. |
| `insert_before` | selected or directly addressed array member | Inserts `value` immediately before the anchor member. |
| `insert_after` | selected or directly addressed array member | Inserts `value` immediately after the anchor member. |

`merge` is the configuration equivalent of editing an object. It never attempts a per-array-item merge. Use `select` with `replace`, `remove`, `remove_matching`, `wrap_strategy`, `wrap_card`, `append`, `prepend`, or an insertion operation when changing generated arrays. `remove_matching` deliberately filters only the direct entries in a target array. With `all: cards` or `all: entities`, it walks mappings and arrays in the generated config and applies that same direct-entry filter to every array stored under the literal named key. It does not search unrelated entity-valued configuration, so actions and conditions are unaffected.

`wrap_strategy` is for a nested `strategy` mapping emitted by a base Dashboard, View, or Section strategy. Its target must be a non-root mapping with a non-empty `type` other than `custom:uix-forge`. It replaces that mapping with `type: custom:uix-forge`, copies the matched mapping to `element_base`, and copies its mapping `value` around it. `value` must not set `type` or `element_base`; it may set `foundry`, `forge`, `element`, and `element_disabled_paths`. If it supplies `forge` directly, `forge.mold` must be `strategy`; a Foundry may supply the Forge configuration instead. UIX does not immediately generate the child: Home Assistant later resolves the replacement through its normal strategy lifecycle and scope.

`wrap_card` is the equivalent operation for a generated card. A direct target must be a non-root member of a card array. With `all: cards`, UIX walks every generated `cards` array and wraps every direct member matching `where`; this permits deliberate multi-card changes such as matching Home Overview's main and sidebar Home Summary cards. `all` must be exactly `cards`, and it requires `where`. A no-match is an error unless `required: false` is set. The wrapper preserves the source mapping as `element_base`, sets `type: custom:uix-forge`, and accepts the same `foundry`, `forge`, `element`, and `element_disabled_paths` values as `wrap_strategy`; when supplied directly, `forge.mold` must be `card`. It cannot wrap an existing `custom:uix-forge` card.

Target-type mismatches, invalid pointers, an invalid matcher, an ambiguous match, a missing required match, and any operation that would create an invalid tree are errors. UIX does not infer a missing parent, auto-create array entries, or silently ignore a failed patch.

### Example: add a People map after Home Dashboard Summaries

The `home` Dashboard strategy emits a `home-overview` child View strategy alongside area subviews. The outer `wrap_strategy` retains that source mapping as the child Forge strategy's `element_base`, then the nested Configuration Spark inserts a People map section after the uniquely matched summary grid. This preserves Home's generated subviews without duplicating their strategy configuration.

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

The exact shape emitted by Home Assistant strategies is not a UIX compatibility promise. Users should select distinctive stable config fields, keep each match unique, and use `required: false` only where an omitted augmentation is genuinely acceptable. A strategy output change that invalidates an augmentation must surface as a visible strategy error rather than produce a best-effort layout.

## Inspection and patch rehearsal

UIX exposes `uix_strategy_inspect(scope, element)` in the browser console so users can generate the actual Home Assistant output, or resolve direct output, before authoring a Configuration Spark. It returns the resulting config, JSON Pointer path search, exact pointer lookup, and a patch rehearsal function.

```js
const overview = await uix_strategy_inspect("view", { type: "home-overview" });
overview.paths("home-summary");
overview.test([{ op: "append", path: "/sections/0/cards", value: { type: "tile", entity: "light.kitchen" } }]);
```

The inspector and its `test()` method must use the same direct/base-strategy resolution and configuration patch implementation as the runtime. For a `$in_entities` patch, pass the inspected raw IDs as the optional second `test()` argument, for example `overview.test(patches, { no_favs: report.ids })`. A successful rehearsal returns the transformed config but does not persist it, alter the open dashboard, or create a rendered target. A failing rehearsal reports the same invalid pointer, target type, selection cardinality, and patch validation errors that runtime generation would report.

## Foundries and compatibility

Entities and Configuration Sparks participate in normal `forge.sparks` Foundry merging, including the established Spark identifier merge rules. Their final execution order is the resolved list order within their respective pre-generation and post-generation phases.

Existing Forge configurations remain unchanged. No existing mold gains a configuration change unless it explicitly includes a `type: config` Spark, and the new `strategy` mold is opt-in through a Home Assistant strategy whose outer type is `custom:uix-forge`.

The strategy entry points rely on Home Assistant's current custom-strategy naming and `generate(config, hass)` lifecycle. UIX must keep compatibility logic isolated at that boundary and must not patch Home Assistant's strategy expansion functions.
