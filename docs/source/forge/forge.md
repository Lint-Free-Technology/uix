---
title: Forge
description: UIX Forge config details including macros, billets, template nesting and UIX Styling.
---
# UIX Forge

UIX Forge (`custom:uix-forge`) is a custom Lovelace element that combines template-driven configuration with additional behaviors called **sparks**. Use it to:

- **Forge** Home Assistant elements from templates, allowing the Forge-owned configuration to react to entity states, user, browser, and other template variables.
- **Add sparks** — self-contained behaviors that augment the forged element.
- **Apply UIX styles** to the forged element, exactly like any other element. Additionally any spark variables are made available in the `uixForge` template variable.

## Visual editor

The Home Assistant card and badge pickers include **UIX Forge**. Creating it
there opens the Forge visual editor with no preselected element type. Choose a
Native element to create layered configuration: the wrapped element's source
is in `element_base`, while values owned by Forge are in `element`. The initial
configuration deliberately contains no placeholder element type.

Until you choose an element type, Card Forge uses its ordinary transient blank
preview and Badge Forge has no preview. Neither fallback is saved in the
dashboard configuration.

The editor has five transient tabs. **Native** edits `element_base` using the
wrapped element's Home Assistant editor. **Forge** edits the outer `forge`
mapping (with its `mold` locked to the current context). **Element** edits
the Forge-owned `element` layer and its enablement. **Foundry** chooses a
shared Foundry to merge with the local configuration. The final icon-only
**Export** tab provides a Foundry YAML copy. Only the selected tab is
available, so its ownership boundary applies to keyboard interaction as well
as clicks. The selected tab is local UI state and is never saved.

When a Foundry is selected, an information notice sits below these tabs and
above the current panel to name the Foundry in use and direct you to the
**Foundry** tab for its resolved configuration.

When a Forge or Element template directly references `config.entity`, the
editor also shows a shared **Global Forge entity (in use)** entity picker below
that notice. It writes the outer Forge `entity` value, which is available to
Forge templates without being passed to the wrapped element. Direct references
in the selected Foundry are recognised too. References reached only through a
macro cannot be inferred, so set the outer `entity` in YAML for that case.

The Foundry picker shows each Foundry's resolved `forge.mold` and `element.type`
(`none` when either is absent), on separate metadata lines. It marks a Foundry
compatible when its mold is either absent or matches the Card/Badge editor
context and, once a Native type is selected, its type is either absent or
matches that Native type. A mismatched mold is shown in red, disabled, and
listed last; it cannot be selected. A type mismatch is shown in red and
requires confirmation. Confirming it clears the local Native configuration
before selecting the Foundry; Forge-owned Element values remain in place.
Foundries with an invalid, missing, or cyclic inheritance chain are omitted so
they cannot prevent the picker from showing healthy Foundries. A Foundry with
a templated or otherwise dynamic `element.type` is valid in YAML-only Forge,
but is disabled in this visual picker because it cannot safely provide a
Native type anchor.

A Foundry may also include `element_base` for native, pass-through source such
as templates evaluated by the wrapped element. This remains YAML-only in the
visual editor: the picker does not select it and any configuration inheriting
it stays in YAML mode so that native source is not altered.

After selecting a Foundry, the tab shows its resolved `forge` and `element`
mapping in a read-only YAML editor below the picker. This includes inherited
named Foundries, but not global Foundries or the local card configuration. A
Foundry-owned `element_base` is included for review. The code area is limited
to 200px high while Home Assistant retains control of its toolbar, scrolling,
and normal fullscreen expansion.

When the selected Foundry has a concrete `element.type`, the editor uses it as
the Native type and locks type changes. Clear or replace the Foundry to choose
a different Native type. Dynamic types remain YAML-only and are never copied
into the Native layer.

Global Foundry type anchors are applied in the same way. An empty Native state
can still open the picker to choose the required type, while an existing Native
card is protected from incompatible type changes. Clearing or changing a
Foundry is refused when it would expose an incompatible global type anchor.

The **Export** tab displays copy-only YAML that can be pasted into a Foundry.
It resolves the selected named Foundry inheritance, then preserves Native
`element_base` alongside the active Element overlay instead of flattening the
two. This preserves native templates exactly as authored. It does not evaluate
templates, include global Foundries, or save a Foundry; the outer `entity`,
disabled paths, and Foundry reference are excluded because they belong to the
consuming card rather than a reusable Foundry. Only save `element_base` in a
Foundry from YAML generated by this UI editor's Export tab; do not hand-author
that editor-preserved source.

The Forge tab can switch between **Show visual editor** and **Show code
editor**. Code mode keeps the complete Forge YAML available. Visual mode has
three tabs:

- **General**, beginning with the context-locked mold, for `hidden`,
  and `grid_options`. Its collapsed **Control** section contains `show_error`,
  `template_nesting`, and `delayed_hass`. Its separate collapsed **UIX
  styling** section edits the contents of `forge.uix`.
- **Macros & billets** for the two mapping values.
- **Sparks**, where the top picker adds a registered Spark and each Spark has
  its own tab. Within it, a second picker offers that Spark's supported options
  and a source table for configured options. An option is edited as
  template/code source, an object or list YAML source, or an explicit `null`
  value. Newly added options show a dismissible notice explaining that they
  start as `null` and can become a template source or object mapping.
Each Spark declares its supported option names, not typed form fields, so a
template remains source rather than being coerced by a selector. The Forge
code editor remains the YAML-object editor for complete Spark configurations,
including removing Sparks or editing complete Spark source.

If a Spark list contains a non-object entry, correct that list in the Forge
code editor before returning to visual Spark editing.

Most newly added Spark options begin as `null` so you can choose their source
in the editor. Options that require a concrete value at runtime instead start
with their valid default.

Native includes an explicit **Choose/Change native element** action. Selecting
an element immediately replaces the Native source and opens its normal Home
Assistant editor. **Cancel** leaves the picker without selecting an element;
Home Assistant's usual editor Cancel and dashboard undo can revert a selected
element. Changing to a different element type is explicit and keeps Forge
template values in place.

The Native editor toolbar has a **Show code editor**/**Show visual editor**
mode switch on the left and **Change Element Type** on the right. The mode
control is disabled when Home Assistant cannot provide a visual editor for the
wrapped element.

Native and Element each also include a collapsed **UIX styling** section. The
Native panel edits `element_base.uix`; the Element panel edits `element.uix`.
Every UIX styling editor accepts the contents of its mapping only, so do not
include an outer `uix:` key.

For Card Forges, Home Assistant's outer visibility and layout controls are
blocked because they would write the outer card configuration. Use
`forge.hidden` and `forge.grid_options` in the Forge tab instead.

To bring an existing card into Forge, use Home Assistant's copy action on the
ordinary card, create UIX Forge from the card picker, then choose **Paste
configuration** in the wrapped Native card picker. The complete pasted card is
stored as `element_base`, including card-owned templates and `uix`
configuration. Add only the values Forge should own under the Forge Element
tab.

The Element tab starts with a searchable Native-path picker. It offers each
available `element_base` path, including nested choices such as
`tap_action.action`, plus custom dotted paths, except `uix`, which is edited
in the dedicated UIX styling panel. Choosing a Native path copies
its current source into `element` and adds it to the table. The table uses
an Actions column: pencil **Edit**, on/off **Enable/Disable**, and cross
**Remove** buttons, each with a tooltip. Editing is kept as a local draft, so
incomplete source does not alter the preview.
Custom paths start as an active `null` value. After adding one, the table names
the new path and explains that its editor can become a template source or an
object mapping.
Its footer offers **Cancel**, **Preview**, and **Save & Exit**: Preview applies
a valid draft temporarily and enables that template for the preview, Cancel
reverts a preview, and Save & Exit applies a valid draft while retaining its
prior enabled/disabled state before returning to the table. Preview and Save &
Exit validate YAML and show its syntax error without applying an invalid draft.
YAML source remains exactly as typed while you edit it; it is not reformatted
after each keystroke.
A string template uses Home Assistant's template selector and code editor, so
enter bare Forge source such as `{{ states('light.kitchen') }}` without YAML
quotes and use its built-in test control. To replace a scalar source, such as
`tap_action: none`, with an object, choose **Convert to object mapping** and
confirm the warning; it deliberately starts a new empty object rather than
guessing how to reinterpret the scalar. **Set to null** is a separate explicit
choice: it creates an active `null` replacement, which clears the matching
Native/base value. It does not mean “use the base value”; use **Disable** or
**Remove** for that. A null value can later become a template source or object
mapping without losing any source. Mappings and other typed configuration
values continue to use the YAML editor. Disabling retains its source in `element` and writes its key path to
`element_disabled_paths`; it is different from removing the value. A disabled
parent suppresses its subtree but preserves each child's saved state. Arrays
and a template that produces a structural value are edited as a single
replacement value. The wrapped element's top-level `type` is not available as
a template because layered `element.type` is invalid.
Enable/Disable becomes available after a Native element is selected; this
prevents the visual editor from creating disabled paths before there is a
Native source to suppress. Editing another template preserves valid disabled
paths inherited from a selected Foundry or global overlay.

Existing direct non-layered Card and Badge Forges show a **Convert to layered
editor** action. Conversion moves only `element.type` to
`element_base.type`; every other source value remains a Forge-owned template
value.
Review templates which inspect `config.element.type` or treat
`config.element` as the complete element source: layered templates use
`config.element_base` for the Native layer and `config.element` for the
Forge-owned overlay. Foundry-backed Forges, dynamic element types, other
molds, and all full-configuration cases remain available through Home
Assistant's YAML editor. Rows, picture elements, and card features remain
YAML-authored: use the :bulb: button in their YAML editor to wrap an existing
element in Forge.

## Basic structure

```yaml
type: custom:uix-forge
forge:
  mold: card
  # optional sparks, macros, hidden, grid_options …
element:
  type: tile
  entity: "{{ 'sun.sun' }}"
  # Forge processes template values in non-layered configuration.
```

`forge` controls how UIX Forge itself behaves; `element` is the configuration of the Home Assistant element that will be rendered inside it.

## Forge options

| Key | Type | Allows Templates | Default | Description |
| --- | ---- | ---------------- | ------- | ----------- |
| `mold` | string | | (required) | How the element is forged, with each `mold` handling required forged element behaviors within Home Assistant Frontend. Standard molds: `"card"`, `"badge"`, `"row"`, `"picture-element"`, `"section"`, `"footer"`, `"card-feature"`. Cross-context molds: `"card_as_row"`, `"card_as_badge"`, `"row_as_card"`, `"row_as_badge"`, `"badge_as_card"`, `"badge_as_row"`, `"badge_as_picture_element"`. See [Cross-context molds](#cross-context-molds). |
| `macros` | mapping | | — | [template macros](../using/templates.md#macros) available to all templates in the forge config. Macros are also passed to `uix` config in both forge and forged element. See [UIX Styling - variables and macros](#template-variables-and-macros). |
| `billets` | mapping | | — | [billets](#billets) — named YAML values available as template constants in all templates in the forge config. See [Billets](#billets) |
| `hidden` | boolean | ✅ | `false` | When truthy the element is hidden. |
| `grid_options` | mapping | ✅ | — | Lovelace grid options (e.g. `rows`, `columns`) for when `mold` is `card`. Ignored for any other `mold`. |
| `show_error` | boolean | | `false` | When `true`, show the Lovelace error card instead of hiding it when the forged element errors. |
| `template_nesting` | string | | `"<<>>"` | Four-character string used to escape nested templates. A single setting controls both Jinja forms: with the default `<<>>`, use `<<...>>` for `{{...}}` and `<%...%>` for `{%...%}` in the same nested template. Use it in a non-layered `element` or layered `element` overlay when a Forge template must emit Jinja-like syntax. `element_base` templates pass through unchanged and do not need nesting. When nesting multiple Forge layers deep, add an extra `<>` pair per additional layer (e.g. `<<< >>>` and `<<% %>>` for two layers of nesting). |
| `sparks` | list | ✅ | `[]` | List of [spark](./sparks/index.md) configurations to attach to the forged element. |
| `delayed_hass` | boolean | | - | Flag to delay the passing of hass object to the card until after it is loaded. Used to suppress console errors or other issues for some custom cards. e.g. apexcharts_card. |

!!! warning
    [Theme macros](../using/themes.md#macros) are only available in UIX styling templates, not in UIX Forge element/forge templates.
    Use UIX Forge [Global foundries](../forge/foundries.md#global-foundries) to define `forge.macros` available globally or per `mold`.

## Element config

Any valid Lovelace element configuration. In non-layered configuration, `element` is the complete forged-element configuration and Forge processes its string values as templates. In [layered configuration](#layered-configuration), `element` is the Forge-owned overlay; use `element_base` for the element-owned base.

The `uix` key inside `element` is passed through as is to [UIX Styling](../using/index.md), with [UIX Styling](../using/index.md) rendering any templates. Use it to style the forged element as you would any other element:

!!! example inline end "Forge example"
    ![Example forge output](../assets/page-assets/forge/basic-element.png)

```yaml
type: custom:uix-forge
forge:
  mold: card
element:
  type: tile
  entity: light.bed_light
  uix:
    style: |
      ha-card {
        --tile-color: teal !important;
      }
```

### Element entities config

You can also use direct templates in the config, eg. template the entities inside a `type: entities` card. This can be an alternative for using [auto-entities](https://github.com/Lint-Free-Technology/lovelace-auto-entities) custom plugin for entities templates.

```yaml
type: custom:uix-forge
forge:
  mold: card
element:
  type: entities
  entities: |
    {{ integration_entities('sun') }}
```

![Element entities config example](../assets/page-assets/forge/basic-element-entities.png)

### Blank card config

When using UIX Forge molds `card`, `card_as_row` or `card_as_badge`, a default blank card, `custom:uix-forge-blank-card` will be used when no `element` or `element.type` is set. This allows for a blank card to which UIX Forge [sparks](./sparks/index.md) can be applied directly.

A default config with no sparks will show a placeholder message.

```yaml
type: "custom:uix-forge"
forge:
  mold: card
```

![Empty uix-forge-blank-card example](../assets/page-assets/forge/blank-card-no-config.png)

Setting `element.title` will show a card with title only.

```yaml
type: "custom:uix-forge"
forge:
  mold: card
element:
  title: "Blank Card Title"
```

![uix-forge-blank-card with title example](../assets/page-assets/forge/blank-card-title.png)

The blank card can be styled to be transparent in context by setting `element.clear`. For molds `card_as_row` and `card_as_badge` this is done automatically when the blank card is in use.

This example is of UIX Forge using `mold: card_as_row` as an entities row to generate a blank card over which an [`overlay-icon` spark](./sparks/overlay-icon.md) is displayed.

```yaml
type: entities
title: Entities Card
entities:
  - type: custom:uix-forge
    forge:
      mold: card_as_row
      sparks:
        - type: overlay-icon
          icon: mdi:shimmer
          icon_color: red
          icon_position:
            left: 10px
            top: 8px
      uix:
        style: |
          :host {
            --uix-forge-blank-card-height: 40px;
          }
```

![uix-forge-blank-card used as card_as_row](../assets/page-assets/forge/blank-card-as-row.png)

!!! tip
    The blank card content div will be given a height of `var(--row-height, 56px)` when no other content has been applied via a spark, either as a sibling to or child of the div. However when there is a sibling to the div but it is empty, the height will be `0px`. IN all cases this height can be styled explicitly using `--uix-forge-blank-card-height` CSS var as per the `card_as_row` example.

## Layered configuration

!!! info
    Layered configuration available in 9.0.0-beta.0

Layered configuration wraps an element that owns its own templates. It works with every supported Forge mold and does not require a visual editor.

Add `element_base` to use layered configuration. It holds the wrapped element's complete element-owned configuration; Forge passes it through without detecting, evaluating, rewriting, or requiring escapes for its template strings. `element` holds the Forge-owned overlay and Forge processes its active values using normal template rules.

```yaml
type: custom:uix-forge
entity: light.kitchen
forge:
  mold: card
element_base:
  type: markdown
  # This template belongs to the Markdown card and passes through Forge unchanged.
  content: |
    ## Temp: {{ states('sensor.kitchen_sensor') }}
element:
  title: "{{ config.entity }}"
```

`element` is a mapping in layered mode. Its mappings merge recursively over `element_base`; scalars and arrays replace the value at their path. `null` is an ordinary value, not a delete instruction. An empty array deliberately clears the base array. `type` belongs in `element_base` and cannot be overridden. A Forge template that returns an object or array replaces its complete target rather than merging with the base; emit a JSON object or array (for example with `| tojson`) for structural template output.

| Top-level key | Layered role |
| --- | --- |
| `element_base` | Required element-owned base. It must provide `type`; its template strings are passed to the wrapped element unchanged. |
| `element` | Optional Forge-owned overlay. Its active string values are processed as Forge templates, then composed over `element_base`. It cannot set `type`. |
| `element_disabled_paths` | Optional local-only list of inactive overlay paths. It is retained for UI editing and is not allowed in a Foundry. |

!!! note "Native visibility templates"
    Put a card's native `visibility` configuration in `element_base`. Layered mode passes its template conditions through to Home Assistant unchanged, so a native card can evaluate its own visibility templates without Forge nesting or ignore markers. This is separate from Forge's own `forge.hidden` behavior.

```yaml
element_base:
  type: entities
  entities:
    - light.kitchen
    - light.dining_room
element:
  # Replaces the complete entities array with the template result.
  entities: "{{ integration_entities('light') | list | tojson }}"
```

### Disabled template values

All `element` values are active by default. `element_disabled_paths` retains an element source value without applying it. Each path is a list of mapping keys so a key containing `.` remains unambiguous. Disabling a parent disables the whole subtree; its child selections remain stored and become active again if the parent path is removed from `element_disabled_paths`.

```yaml
element:
  name: "{{ states('sensor.room_label') }}"
  tap_action:
    action: more-info
    confirmation:
      text: Confirm
element_disabled_paths:
  - [name]
  - [tap_action, action]
```

The example retains both template sources, but the rendered element uses its base `name` and base `tap_action.action`; the active `tap_action.confirmation` mapping still composes with the base. A disabled path must point to a value in the resolved `element` overlay. Array entries are replacement units and cannot be individually disabled.

### Foundries and template context

Foundries may provide `element` and `element_base` fragments, but never
`element_disabled_paths`. Global and named Foundries participate in the same
resolution order:

```text
global → global_<mold> → inherited/named Foundry → local configuration
```

A Foundry may provide `element_base` as an element-owned pass-through base.
It merges through Foundry inheritance before a local `element_base`, and its
templates are evaluated by Home Assistant or the wrapped element rather than
Forge. Foundry and local `element` fragments form the resolved Forge-owned
overlay. `element_disabled_paths` belongs only to the local card and applies
after that overlay resolves, allowing a card to suppress a Foundry-provided
value without changing the Foundry.

Any Forge with a local or Foundry-provided `element_base` uses layered
configuration. A Foundry may use `element.type` as a reusable native-type
anchor, provided local `element_base.type` is the same concrete string. Forge
removes only that inherited matching type from the overlay; all other Foundry
`element` fields remain overlays.

```yaml
uix_foundries:
  kitchen_tile:
    forge:
      mold: card
    element:
      type: markdown
      title: "{{ config.entity }}"

# A dashboard card supplies its Native layer and retains the Foundry overlay.
type: custom:uix-forge
foundry: kitchen_tile
element_base:
  type: markdown
  content: |
    ## {{ states('sensor.room_label') }}
element:
  entity: light.kitchen
```

In Forge templates, `config.element_base` contains the resolved base and `config.element` contains the resolved overlay source before evaluation. Forge composes these layers into the forged element configuration. The `uix` mappings from both layers are merged as part of that composition; UIX Styling receives the merged `uix` configuration, and its templates follow the usual UIX Styling behavior.

## Template variables and macros

Macros from the forge are passed through to UIX Styling for both the forge and the forged element, making forge macros available to use in UIX Styling for both forge and forged element.

Templates will run in different contexts for forging, UIX styling the forge and UIX styling the element. The table below summarizes the different contexts.

<!-- markdownlint-disable MD033 -->
<!-- markdownlint-disable MD046 -->
| Context | Template variables |
| - | - |
| Templates in forge and non-layered `element`, except `uix` styling | **forge config**: `config.forge`<br/> **element config**: `config.element`<br/>`config.entity` is available if included in global `uix-forge` config. |
| Templates in layered `element`, except `uix` styling | **forge config**: `config.forge`<br/> **element base**: `config.element_base`<br/>**forge overlay**: `config.element`<br/>`config.entity` is available if included in global `uix-forge` config. |
| Templates in forge `uix` styling | **forge config**: `config.forge`<br/>**element config**: `config.element` (the complete resolved element configuration, or the resolved Forge overlay in layered configuration)<br/>**additional in layered configuration**: `config.element_base` (the resolved base)<br/>`config.entity` is available if included in global `uix-forge` config. |
| Templates in element `uix` styling. Here the template is run in regular `uix` styling context for the forged element | **forge config**: unavailable<br/>**element config**: `config`<br/>`config.entity` is available if included in global `uix-forge` config. |

!!! tip
    If you specify `entity` on global `uix-forge` config it will always be available no matter the context. You always need to specifically specify the element entity if it needs one - you can use a template to use `config.entity`.
    ```yaml
    type: custom:uix-forge
    entity: light.bed_light
    forge:
      mold: card
    element:
      type: tile
      entity: "{{ config.entity }}"
      uix:
        style: |
          :host {
            --ha-card-border-color: {{ 'green' if is_state(config.entity, 'on') else 'red' }};
            --ha-card-border-width: 2px;
          }
    ```

    ![Example using config entity](../assets/page-assets/forge/config-entity.png)

!!! warning
    To use `config.entity` as a template variable in either `forge` or `element` templates you need to define `entity` in global `uix-forge` config as a string (templates not supported). If you wish to compose an entity in a [foundry](foundries.md) from a variable string part you can use `billets` and [billet interpolation](#billet-interpolation).

    Example of a file foundry with an entity using billet interpolation.

    ```yaml
    uix_foundries:
      uix_media_player:
        forge:
          mold: card
          billets:
            player_entity: media_player.cast_{player}
            player: ~ 
            name: ~ 
            icon: music
        element:
          type: custom:mini-media-player
          artwork: material
          adaptive_color: true
          entity: "{{ player_entity }}"
          icon: mdi:{{ icon }}
          name: >
            {% if is_state_attr(player_entity,'app_name','Spotify') %}
              {{ name }}: Spotify
            {% elif is_state_attr(player_entity,'app_name','Music Assistant') %}
              {{ name }}: Music Assistant
            {% else %}
              {{ name }}
            {% endif %}
    ```

### Full example including macro

!!! example inline end "Full example including macro"
    ![Example output](../assets/page-assets/forge/config-entity-full.png)

```yaml
type: custom:uix-forge
entity: light.bed_light
forge:
  mold: card
  macros:
    state_color:
      params:
        - entity_id
      template: "{{ 'red' if is_state(entity_id, 'on') else 'green' }}"
  uix:
    style: |
      :host {
        --ha-card-border-radius: 20px;
        --ha-card-border-color: {{ state_color(config.entity) }};
        --ha-card-border-width: 3px;
      }
element:
  type: tile
  entity: "{{ config.entity }}"
  name: "{{ device_name(config.entity) }} - {{ state_translated(config.entity) }}"
  uix:
    style: |
      span.primary {
        color: {{ state_color(config.entity) }};
      }
```

### Billets

Billets are named YAML values defined under `forge.billets`. They are available as template constants in all forge templates **and** in any `uix:` style on the forge card or the forged element, and can be used **without parentheses**, unlike macros. Billet string values may reference other billets via `{name}` substitution — see [Billet interpolation](#billet-interpolation) below.

!!! warning
    Billets cannot contain Jinja2 templates themselves, except inside nested `uix` objects where the template is rendered by UIX Styling and not UIX Forge.

```yaml
type: custom:uix-forge
entity: light.bed_light
forge:
  mold: card
  grid_options:
    columns: 7
  billets:
    my_color: teal
    max_brightness: 255
    tags:
      - living_room
      - ambient
element:
  type: tile
  entity: "{{ config.entity }}"
  name: "{{ my_color | capitalize }} light"
  tap_action:
    action: perform-action
    perform_action: light.turn_on
    target:
      entity_id: "{{ config.entity }}"
    data:
      brightness: "{{ max_brightness }}"
  uix:
    style: |
      ha-card {
        --tile-color: {{ my_color }} !important;
      }
      ha-tile-info span:nth-of-type(2):after {
      {%- if is_state_attr(config.entity, 'brightness', max_brightness) -%}
        content: ' - {{ tags | join(', ') }} - MAX';
        font-weight: 900;
      {%- else -%}
        content: ' - {{ tags | join(', ') }}';
      {% endif -%}
      }
```

![Example using billets](../assets/page-assets/forge/billets.gif)

#### Billet types

The YAML type of a billet determines how it is represented in templates:

| YAML type | Example | Jinja2 type | Template usage |
| --------- | ------- | ----------- | -------------- |
| Empty (`~` or `null`) | `my_billet: ~` | `none` | `{{ my_billet }}` → empty |
| String | `my_billet: hello` | `str` | `{{ my_billet }}` → `hello` |
| Number | `my_billet: 42` | `int` or `float` | `{{ my_billet + 1 }}` → `43` |
| Boolean | `my_billet: true` | `bool` | `{% if my_billet %}…{% endif %}` |
| List | `my_billet: [1, 2, 3]` | `list` | `{{ my_billet \| join(', ') }}` |
| Mapping | `my_billet: {a: 1}` | `dict` | `{{ my_billet.a }}` |

Each billet is injected as a `{%- set name = value -%}` statement, preserving the native Jinja2 type for all YAML types — no macro wrapper is needed.

#### Billet interpolation

String billet values may reference other billets using `{name}` syntax — a simple substitution performed before the billets are turned into Jinja2 variables. Use `{name[N]}` to reference element `N` (0-indexed) from a list billet:

```yaml
forge:
  billets:
    room: "bed"                         # plain string
    entity_id: "light.{room}_light"     # → "light.bed_light"
    scenes:
      - bright
      - dim
    default_scene: "{scenes[0]}"        # → "bright"
```

Billet references are resolved in dependency order, so declaration order does not matter:

```yaml
billets:
  entity: "light.{room}_light" # → "light.bedroom_light"  (resolved after room)
  room: "{base}room"           # → "bedroom"  (resolved after base)
  base: "bed"
```

!!! note "Circular references"
    If billets reference each other in a cycle (directly or through a chain), none of the cycle members can be resolved. UIX logs an error for each and leaves their values unchanged.

#### Billets and foundries

Billets follow the same override behavior as macros: a foundry can define billets, and local forge config can override individual billet entries. Only the billets whose names are referenced in a template are included in that template's preamble.

See [Billets in foundries](./foundries.md#billets-in-foundries) for patterns on defining empty billet slots in a foundry and handling the `none` case in templates.

### Ignoring templates in element config

`{# uix-forge.ignore #}`

In non-layered configuration, if you need to pass through a whole template unchanged to the forged element, you can have UIX Forge ignore the template altogether. Use this when the forged element accepts templates as part of config and template nesting is not required. In layered configuration, put the wrapped element's template in `element_base` instead; it passes through without an ignore marker.

Templates are ignored by UIX Forge when they include `{# uix-forge.ignore #}`.

Example markdown cards showing use of `{# uix-forge.ignore #}`.

```yaml
cards:
  # forged markdown card where `content` templates is rendered by UIX Forge where `config.entity` is valid
  - type: custom:uix-forge
    entity: light.bed_light
    forge:
      mold: card
    element:
      type: markdown
      content: |
        **config.entity:** {{ config.entity | default('light.ceiling_lights') }}

  # forged markdown card where `content` template is ignored by UIX Forge
  # config.entity does not exist for markdown card and will get default text
  - type: custom:uix-forge
    entity: light.bed_light
    forge:
      mold: card
    element:
      type: markdown
      content: |
        {# uix-forge.ignore #}
        **config.entity:** {{ config.entity | default('light.ceiling_lights') }}
```

![Markdown card with ignored template example](../assets/page-assets/forge/ignored-template.png)

When you need for a template to include both local forge or element template and a template for the card itself template nesting needs to be used.

!!! warning "Ignoring templates and multiple nesting of UIX Forge"
    As templates are ignored using a Jinja2 comment, `{# #}` the template as rendered will not have the comment. So when using with multiple nesting of UIX Forge template nesting will need to be used to control how templates are rendered.

### Template nesting

If a non-layered `element`, or a layered `element` overlay, needs to emit Jinja-style templates or the same markers (e.g. ha-nunjucks), you need to either ignore or nest those templates. Templates in `element_base` pass through unchanged. The default nesting characters are `<<>>`. This can be adjusted in forge config if required. Jinja statement/flow-control delimiters (`{% %}`) are inferred from the nesting character config. When default nesting characters `<<>>` are in use, use `<% %>` for single nesting of Jinja statements/flow-control syntax.

??? example "Single level template nesting example"
    Below is an example using `custom:template-entity-row` which itself supports templates. This requires any template that needs to be rendered by `custom:template-entity-row` to be nested in `<<>>` nesting characters.
    ```yaml
    type: custom:uix-forge
    entity: input_boolean.test_boolean
    forge:
      mold: card
    element:
      type: entities
      entities:
        - type: custom:template-entity-row
          entity: "{{ config.entity }}"
          state: |
            <<states(config.entity,with_unit=True)>>
    ```
    The rendered config for the `entities` card is below. You will see that the nested template gets rendered to a final template with `{#uix#}` template comments surrounding the template. This template will then be rendered in `custom:template-entity-row`, with `config.entity` being a reference to the rendered config entity, which is `input_boolean.test_boolean`.
    ```yaml
    type: entities
    entities:
      - type: 'custom:template-entity-row'
        entity: input_boolean.test_boolean
        state: '{#uix#}{{states(config.entity,with_unit=True)}}{#uix#}'
    ```

#### Multiple nesting levels

When there are multiple forge layers, each additional layer requires one extra `<` / `>` pair (e.g. `<<<` / `>>>` and `<<% %>>` for two levels). UIX strips one nesting level internally at each intermediate forge layer, so the correct number of delimiters reaches the final forge layer automatically — you only need to set `template_nesting` to the total number of layers deep the value needs to travel.

??? example "Multiple nesting levels example with output"
    ```yaml
    type: custom:uix-forge
    entity: media_player.kitchen # overall entity in global uix-forge config
    forge:
      mold: card
      sparks:
        - type: grid
          for: "hui-grid-card $ #root"
          columns: 40% auto
          column_gap: 0px
    element:
      type: grid
      square: false
      cards:
        - type: custom:uix-forge
          entity: "{{ config.entity }}" # use config.entity directly for nested forge
          forge:
            mold: card
          element:
            entity: "{{ config.entity }}" # use config.entity directly for nested forge element
            type: tile
            state_content: is_volume_muted
        - type: custom:uix-forge
          entity: "{{ config.entity }}" # use config.entity directly for nested forge
          forge:
            mold: card
          element:
            type: custom:custom-features-card
            features:
              - type: custom:service-call
                entries:
                  - type: button
                    entity_id: << config.entity >> # use first level nesting
                    icon: mdi:volume-high
                    haptics: true
                    tap_action:
                      action: perform-action
                      perform_action: media_player.volume_mute
                      target:
                        entity_id: |
                          <<< config.entity >>> {# use second level nesting #}
                      data:
                        is_volume_muted: true
    ```

    ![Nesting example](../assets/page-assets/forge/forge-nesting.gif)

??? example "Multiple nesting levels with markdown card"
    This example shows that the markdown output will render the first level nested template and just output the second level nested template, showing exactly how nesting works.

    ```yaml
    type: custom:uix-forge
    forge:
      mold: card
    element:
      type: markdown
      content: |
        <<% if true %>><<< True >>><<% endif %>>
        <% if true %><< True >><% endif %>
    ```

    ![Template nesting in markdown card content](../assets/page-assets/forge/template-nesting-markdown.png)

#### Template nesting and macros

Template nesting **is not** supported in macros. It is impossible to get a rendered template text from a macro. Macros are available to UIX Forge templates and UIX Styling, but templates **are not** available to be rendered in the context of any nested/forged card including Home Assistant markdown card.

!!! tip
    Whether to nest markdown content templates or not depends on your use case. If templates are not nested, they are rendered by UIX Forge and the whole markdown card will be updated when the template updates. If your markdown templates are dynamic and update frequently you are best to use template nesting so the markdown card renders the template, using its optimized rendering to update only the output line that has changed. If you need to put complex logic in a macro for markdown card, you can store that in custom_templates in Home Assistant and then call as a nested template. e.g. if you macro in custom_templates is `content()` then you can use `<< content() >>` in your markdown card to have the markdown card render the `content()` macro.

#### Using billets in nested templates

Billet values are fully available as Jinja2 variables inside `<<...>>` expressions. When UIX builds the template, billet variables are set as Jinja2 `{%- set ... -%}` statements before Home Assistant evaluates the template body. This means `{{ billet_name }}` written inside `<<...>>` is evaluated by HA's template engine and the resolved value becomes part of the expression that the receiving card gets.

!!! note "Coming from decluttering-card?"
    In tools like decluttering-card, a variable placeholder such as `[[id]]` is substituted as plain text into the string before anything else happens. In UIX Forge the mechanism is different but the end result is the same: UIX Forge injects billet variables into the generated Jinja2 template, and Home Assistant evaluates them together with the rest of the template body, so `{{ id }}` inside `<<...>>` is replaced with the billet's value before the receiving card ever sees the string.

    The important difference is that you must use standard Jinja2 expression syntax — `{{ billet_name }}` — not the billet-to-billet interpolation syntax (`{billet_name}`). The `{...}` interpolation syntax is only available inside billet *value* strings (for one billet referencing another), not inside template expressions.

A common use-case is driving an `auto-entities` filter template from a billet. For example, with an `id` billet holding a room slug, you can build the device entity list for that room:

```yaml
type: custom:uix-forge
forge:
  mold: card
  billets:
    id: living_room
element:
  type: custom:auto-entities
  filter:
    template: >-
      <<device_entities(device_id('switch.{{id}}'))
      |reject('search','device')|list>>
  card:
    type: entities
```

When UIX processes the template, it prepends `{%- set id = "living_room" -%}`. HA then evaluates the template body, resolving `{{id}}` to `living_room`. The expression received by `auto-entities` is:

```jinja
{#uix#}{{ device_entities(device_id('switch.living_room'))|reject('search','device')|list }}{#uix#}
```

`auto-entities` evaluates this Jinja2 expression and populates the card with the matching entities. Override the `id` billet per instance (or in a foundry) to reuse the same forge across multiple rooms without duplicating the filter logic.

!!! tip
    Because billet values are resolved at UIX template evaluation time, they are **baked into** the expression that the receiving card gets. If you need the receiving card to re-evaluate a value dynamically (e.g. based on changing HA state), express that logic directly as a Jinja2 function call inside the `<<...>>` block rather than relying on a billet for the dynamic part.

??? warning "Read if you wish to create your own nesting sequence"
    When using template nesting, the template nesting characters are replaced with Jinja `raw` directives before the template is rendered. The replacement includes a marker for internal readiness code to be able to recognize a rendered template with nesting. With the default `<<>>`, `<<` is replaced with `{% raw %}{#uix#}{{{% endraw %}` and `>>` is replaced with `{% raw %}}}{#uix#}{% endraw %}`; flow-control delimiters are inferred automatically, so `<%` is replaced with `{% raw %}{#uix#}{%{% endraw %}` and `%>` is replaced with `{% raw %}%}{#uix#}{% endraw %}`. If you try and create these sequences without using the nesting shorthand, they must be replicated EXACTLY for forge internal readiness checks to complete.

### Using with auto-entities

!!! tip
   For simple entities templating you may wish to just forge an entities card and template. `entities:` config. See [Element entities config](#element-entities-config).

UIX Forge supports `custom:auto-entities` in two ways:

1. When UIX Forge is used as the main card for auto-entities, UIX Forge accepts and passes through `entities` to the element config, though will not be available on `config.element.entities`
2. When using UIX Forge as an entity card via auto-entities include filter `options`, UIX Forge accepts `entity` that auto-entities passes through, but does not pass through to element config. It will be available in templates using `config.entity` and you can use `{{ config.entity }}` when you need to specify an entity for the card options.

??? example "auto-entities example"
    ```yaml
    type: custom:auto-entities
    filter:
      include:
        - options:
            type: custom:uix-forge
            # auto-entities will populate entity in config, so we can use it in templates
            forge:
              mold: card
              sparks:
                - type: tooltip
                  for: hui-tile-card $ ha-card
                  content: >-
                    {{ state_attr(config.entity,
                    'friendly_name') }} is {{ states(config.entity) }}
            element:
              entity: "{{ config.entity }}"
              type: tile
          area: bedroom
      exclude: []
    card:
      square: false
      type: grid
    show_empty: true
    card_param: cards
    ```

    ![Example using auto-entities](../assets/page-assets/forge/forge-auto-entities.gif)

## UIX styling

Add a `uix` key under `forge` to apply [UIX styling](../using/index.md) to the forge element wrapper itself. Template variables `config.forge`, `config.element`, and `uixForge` are available in the style templates. In layered configuration, `config.element` is the resolved Forge overlay and `config.element_base` is also available; otherwise `config.element` is the complete resolved element config. `uixForge` contains any [spark](./sparks/tooltip.md) template variables. `config.entity` will also be available if set in the global `uix-forge` config.

```yaml
type: custom:uix-forge
forge:
  mold: card
  uix:
    style: |
      :host {
        --ha-card-border-radius: 50px;
      }
element:
  type: tile
  entity: light.bed_light
```

![Example using uix styling](../assets/page-assets/forge/uix-styling.png)

### Element styling

UIX Styling can be applied to the element in the usual way. Only the usual `config` variable is available which is the standard variable resolved by UIX Styling for elements.

!!! warning
    Element UIX Styling will **NOT** contain the forge and spark variables available in forge UIX Styling. If you wish to use these then use UIX Styling on the forge rather than the forged element.

```yaml
type: custom:uix-forge
forge:
  mold: card
  uix:
    style: |
      :host {
        --ha-card-border-radius: 50px;
      }
element:
  type: tile
  entity: light.bed_light
  uix:
    style: |
      span.primary::after {
        content: ' - {{ state_translated(config.entity) }}';
      }
```

![Example using uix element styling](../assets/page-assets/forge/uix-element-styling.png)

### Theme styling

The theme type given to UIX forge container matches the mold type, including [cross-context molds](#cross-context-molds). This can be useful in targeting the UIX forge container and styling the contained element.

??? example "Theme cross-context mold: card_as_badge"
    Here styling is given to all cards used as badges by applying theme styling to `uix-card-as-badge-yaml`. The theming assumes all cards used as badges are home-summary cards. *`energy` is commented out as the demo integration used for image generation does not have energy set up.*

    Theme:
    ```yaml
    uix-card-as-badge-yaml: |
      .: |
        :host {
          --ha-tile-info-primary-font-size: var(--ha-font-size-s);
          --ha-card-border-radius: var(--ha-badge-border-radius, calc(var(--ha-badge-size, 36px) / 2));
        }
      hui-home-summary-card $: |
        ha-tile-container {
          line-height: 0;
        }
        ha-tile-icon {
          --mdc-icon-size: 18px;
          --tile-icon-size: 18px;
        }
      hui-home-summary-card $ ha-tile-info $: |
        div.info {
          flex-direction: row;
          align-items: center;
          gap: var(--ha-space-2);
        }
        div.info slot.primary span,
        div.info slot.secondary span {
          overflow: visible;
        }
      hui-home-summary-card $$ ha-tile-container $: |
        .container {
          margin: 0;
        }
        .content {
          gap: var(--ha-space-2) !important;
          padding: 8px 10px !important;
          min-height: unset !important;
        }
    ```

    Dashboard with home-summary cards as badges:
    ```yaml
    - type: sections
      max_columns: 10
      title: Home Summary Cards as Badges
      path: home-summary-cards-as-badges
      header:
        layout: center
        badges_position: bottom
        badges_wrap: wrap
      badges:
        - type: custom:uix-forge
          forge:
            mold: card_as_badge
          element:
            type: home-summary
            summary: light
            tap_action:
              action: navigate
              navigation_path: /light?historyBack=1
        - type: custom:uix-forge
          forge:
            mold: card_as_badge
          element:
            type: home-summary
            summary: climate
            tap_action:
              action: navigate
              navigation_path: /climate?historyBack=1
        - type: custom:uix-forge
          forge:
            mold: card_as_badge
          element:
            type: home-summary
            summary: security
            tap_action:
              action: navigate
              navigation_path: /security?historyBack=1
        - type: custom:uix-forge
          forge:
            mold: card_as_badge
          element:
            type: home-summary
            summary: media_players
            tap_action:
              action: navigate
              navigation_path: /home/media-players
        # - type: custom:uix-forge
        #  forge:
        #    mold: card_as_badge
        #  element:
        #    type: home-summary
        #    summary: energy
        #    tap_action:
        #      action: navigate
        #      navigation_path: >-
        #        /energy/overview?historyBack=1&backPath=/dashboard-root/view-path
        - type: custom:uix-forge
          forge:
            mold: card_as_badge
          element:
            type: home-summary
            summary: maintenance
            tap_action:
              action: navigate
              navigation_path: >-
                /maintenance?historyBack=1&backPath=/dashboard-root/view-path
    ```

    ![Theming home-summary badges as cards](../assets/page-assets/forge/forge-theme.png)

## Sections

When using UIX Forge for a section in sections view, use the YAML section editor (use three dots menu) and change type to `custom: uix-forge`. Set forge `mold` to `section`.

When using UIX Forge for sections, the following config keys can be set directly to configure how the section shows, though they **do not support templates**:

- `row_span`
- `column_span`
- `background`

```yaml
type: custom:uix-forge
forge:
  hidden: # use hidden to control visibility, templates supported
  # ...
element:
  # ...
# section only main configuration keys. Visibility not supported.
row_span: # row span for section
column_span: # column span for section
background: # background for section
```

When editing the dashboard in UI mode, the section will be surrounded by red dashed border to show that it is configured by UIX Forge in YAML. All cards contained in the section will show in preview mode, but will not be editable. Use YAML for editing the section.

!!! warning
    Visibility in the main config is not supported for `mold: section`. Though the Home Assistant visual editor will let you set visibility you will get an error as soon as you save the section. If you need Frontend visibility options not supported by template (e.g. screen) use a stack card as your element and set Frontend visibility on that element, templates supported.

## Footer

Use `mold: footer` to overlay a fixed-position card at the bottom of the viewport. The forged element appears pinned at the bottom of the screen regardless of where the `custom:uix-forge` card is placed in the dashboard. The forge element itself renders as `display: contents`, so it does not take up space in the grid.

You can use `mold: footer` on sections, masonry and panel dashboards. On a sections dashboard using in place of standard Home Assistant footer gives you added visibility flexibility by using a template for `hidden`.

When editing the dashboard in UI mode, the footer is surrounded by a red dashed border to indicate it is configured by UIX Forge in YAML.

!!! note
    The footer element `<hui-view-footer>` is given the CSS position `fixed` rather than the standard `sticky` of a section footer. This is required as `sticky` is only relative to parent element, so the forged footer can only 'break out' to be a footer using `fixed` position. This will give a lightly different appearance in that the footer will be centered to the window and not just the dashboard area. Use asymmetrical padding via `--uix-forge-footer-padding` to adjust if required.

The following forge config key controls the maximum width of the footer:

| Key | Type | Allows Templates | Default | Description |
| --- | ---- | ---------------- | ------- | ----------- |
| `max_width` | string | | `600` | Maximum width of the footer in pixels. |

```yaml
type: custom:uix-forge
forge:
  mold: footer
  max_width: 400
element:
  type: tile
  entity: light.bed_light
```

The following CSS variables can be set on the forge element or any ancestor to customise the footer appearance:

| Variable | Default | Description |
| -------- | ------- | ----------- |
| `--uix-forge-footer-border-width` | `1px` | Border width of the forged card within the footer. |
| `--uix-forge-footer-bottom` | `var(--ha-space-2)` | Distance from the bottom of the viewport. |
| `--uix-forge-footer-padding` | `0 var(--ha-space-2)` | Padding applied to the footer container. |

### Visibility

Use `forge.hidden` (templates supported) to show or hide the footer:

```yaml
type: custom:uix-forge
forge:
  mold: footer
  hidden: "{{ is_state('input_boolean.show_footer', 'off') }}"
element:
  type: tile
  entity: light.bed_light
```

## Card features

Use `mold: card-feature` when using UIX Forge as a card feature. Templates will have an additional `context` variable available which is provided by the host card. `context` usually includes `entity_id` which is the entity set on the host card.

```yaml
type: tile
entity: light.bed_light
features:
  - type: custom:uix-forge
    forge:
      mold: card-feature
    element:
      type: |
        {{ "light-brightness" if is_state(context.entity_id, "on") else "toggle" }}
features_position: inline
```

![Inline card feature example](../assets/page-assets/forge/card-feature-inline.png)

If you are using multiple card features in bottom position and using `hidden` template, you will need to use auto row height to prevent the host card from occupying the additional space when the card feature is hidden.

```yaml
type: tile
entity: light.bed_light
grid_options:
  columns: 12
  rows: auto
features:
  - type: toggle
  - type: custom:uix-forge
    entity: light.bed_light
    forge:
      mold: card-feature
      hidden: |
        {{ is_state(context.entity_id, "off") }}
    element:
      type: light-brightness
features_position: bottom
```

![Bottom hidden template card feature example](../assets/page-assets/forge/card-feature-bottom-hidden.png)

## Cross-context molds

Cross-context molds let you **forge one element type while acting as a different element type** in the parent container. This is the cleanest replacement for the fragile `custom:hui-element` and `custom:hui-xxx-card` hacks, which lack visibility support and can break across HA updates.

| Mold | Forges | Acts as |
| ---- | ------ | ------- |
| `card_as_row` | `hui-card` (card element) | Row inside an entities / fold-entity-row |
| `card_as_badge` | `hui-card` (card element) | Badge in a badge container |
| `row_as_card` | Row element | Card in a card grid |
| `row_as_badge` | Row element | Badge in a badge container |
| `badge_as_card` | `hui-badge` (badge element) | Card in a card grid |
| `badge_as_row` | `hui-badge` (badge element) | Row inside an entities / fold-entity-row |
| `badge_as_picture_element` | `hui-badge` (badge element) | Picture element inside a picture-elements card |

Each cross-context mold intercepts the inner element's native visibility event, updates its own hidden state, and re-fires the appropriate event for the parent container. `forge.hidden` (templates supported) works across all cross-context molds.

For `badge_as_picture_element`, the badge element config needs to include the regular picture element positioning in `style` object.

### card_as_row — embedding a card as a row

The most common use-case: embed a `glance`, `markdown`, `tile`, or any other card-type element directly inside an `entities` card (or `custom:fold-entity-row`). The card is created as a real `hui-card` element while UIX Forge signals the parent entities card exactly like a regular row.

```yaml
type: entities
title: "Bedroom"
icon: mdi:bed
entities:
  - type: "custom:uix-forge"
    forge:
      mold: card_as_row
    element:
      type: glance
      entities:
        - entity: light.bed_light
          name: Bed
        - entity: light.ceiling_lights
          name: Ceiling
        - entity: light.kitchen_lights
          name: Kitchen
  - entity: light.bed_light
```

![Glance card embedded as a row inside an entities card](../assets/page-assets/forge/card-as-row.png)

### badge as picture-element - embedding a badge as a picture-element

```yaml
type: picture-elements
elements:
  - type: custom:uix-forge
    forge:
      mold: badge_as_picture_element
    element:
      type: entity
      entity: light.bed_light
      style:
        top: 25%
        left: 50%
image: https://demo.home-assistant.io/stub_config/floorplan.png
```

![badge embedded in a picture-elements card](../assets/page-assets/forge/badge-as-picture-element.png)

!!! tip "Visibility"
    Unlike `custom:hui-element` or `custom:hui-xxx-card`, `forge.hidden` works correctly with `card_as_row`. You can use templates to conditionally show or hide the embedded card and the entities card will respond properly:
    ```yaml
    type: "custom:uix-forge"
    forge:
      mold: card_as_row
      hidden: "{{ is_state('sun.sun', 'below_horizon') }}"
    element:
      type: glance
      entities:
        - entity: sun.sun
    ```
