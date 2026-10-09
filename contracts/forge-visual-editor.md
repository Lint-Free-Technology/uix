# Forge visual editor contract

## Status and scope

This contract defines the UIX Forge visual editor. It builds on [the layered
configuration contract](./forge-layered-configuration.md), which remains the
authoritative runtime contract for `element_base`, `element`, and
`element_disabled_paths`.

The editor is a UI for the existing layered configuration; it does not add an
editor-only representation, provenance flag, or a new Forge runtime mode. It
supports the commonly edited direct element molds: dashboard cards
(`forge.mold: card`), badges (`forge.mold: badge`), and entities rows
(`forge.mold: row`). Other molds remain supported through YAML.

This contract deliberately excludes editing shared Foundries, changing the
wrapped element type after creation, and per-array-item overrides. They are
outside this contract's scope.

## Persisted representation

Every Forge created by the visual editor uses layered configuration:

```yaml
type: custom:uix-forge
forge:
  mold: card
element_base:
  type: tile
element:
  entity: light.kitchen
  name: "{{ states('sensor.room_label') }}"
element_disabled_paths:
  - [name]
```

`element_base` is the Native layer: the wrapped card's card-owned base
configuration, including any templates owned by that card. `element` is the
Forge overlay, owned by Forge. The complete forged-element configuration is
the composition of the base and active overlay. `element_disabled_paths` is
the persisted enablement state for the overlay. The runtime composition,
template ownership, disabled-path semantics, Foundry resolution, and `uix`
merging are exactly those in the layered configuration contract.

In particular:

- The editor saves the authored layers, never an evaluated preview.
- `element_base.type` is required. `element.type` is invalid in layered mode.
- A template, scalar, array, or `null` in `element` replaces its target; an
  authored mapping merges recursively. Array entries are not independently
  addressable.
- A disabled value remains in `element`, is not evaluated by Forge, and is
  recorded in `element_disabled_paths`.
- The presence of `element_base`, including an empty overlay, remains the sole
  persisted selection of layered behaviour. Removing all overrides does not
  revert an element to non-layered Forge behaviour.

The configuration passed to Home Assistant and saved in the dashboard is the
complete authored Forge configuration above. UI-only state is never persisted.

## How Forge is presented in the UI

UIX Forge is presented as a contextual Home Assistant element, not as a YAML
toolbar transformation. It appears in the relevant picker for each supported
mold: the dashboard card picker for `card`, the badge picker for `badge`, and
the entities-row picker for `row`. Selecting it creates a
`custom:uix-forge` configuration with the matching `forge.mold` and takes the
user to the Forge editor. The first step chooses the wrapped element type; the
resulting native element configuration is saved in `element_base`. The editor
must not create a non-layered Forge as an intermediate or default
representation.

### Bringing an existing card into Forge

To bring an ordinary dashboard card into Forge, users copy the card with Home
Assistant's existing copy action, add UIX Forge from the card picker, then use
the wrapped card picker's Paste configuration option. The pasted configuration
becomes `element_base` in full: it is the card-owned base, not a Forge overlay.
The user can then add only the values that Forge should own to `element`.

This flow replaces the need for a one-click YAML wrapper. It must preserve the
pasted source as card-owned configuration, including the card's own templates
and its `uix` configuration. The user documentation for the Forge editor must
describe this copy → create Forge → paste-base workflow.

`UixForge.getConfigElement()` supplies the Forge editor for a direct, local,
layered configuration using one of those molds. The editor contains:

1. a Forge behavior editor for the outer `forge` configuration;
2. an embedded Home Assistant element editor for the Native `element_base`;
3. a Forge-overrides section containing the override tree and YAML editor; and
4. the normal Home Assistant preview, which renders the composed forged
   element.

The embedded editor is Home Assistant's context-appropriate element editor:
`hui-card-element-editor`, `hui-badge-element-editor`, or
`hui-row-element-editor` (or a base YAML fallback when the wrapped element
supplies no usable visual editor). It receives only `element_base`, never the
merged result and never evaluated Forge values. The outer Home Assistant
code/visual editor switch is separate from Forge's own Native/Forge mode
switch.

The editor fixes the wrapped element type after it has been selected. Changing
that type requires an explicit policy for retaining or resetting potentially
incompatible overlays; it must not happen as a side effect of a Native editor
event.

### Forge behavior editor

The Forge behavior editor is a source-preserving YAML editor for the direct
`forge` mapping. It is the first-class UI for Forge-owned behavior that does
not belong to either element layer. `forge.mold` is displayed as the current,
context-locked mold and is not editable here. All other supported `forge`
options remain editable as authored YAML, including:

- `hidden`, and, for the `card` mold, `grid_options`;
- `sparks`, including the complete source for each spark;
- `macros`, `billets`, `template_nesting`, `show_error`, and `delayed_hass`;
  and
- `uix`, which styles the Forge wrapper rather than the wrapped element.

YAML is authoritative because these options can contain templates and
spark-specific structures. Any convenience control must round-trip to the same
`forge` mapping and leave the YAML editor available; it must not replace or
restrict any supported Forge source. Editing this panel emits the complete
updated Forge configuration and follows the same draft, validation, and
dirty-state rules as the override YAML editor.

### Editing modes

The Forge editor has transient **Native** and **Forge** modes:

| Control | Native mode | Forge mode |
| --- | --- | --- |
| Forge behavior editor | Read-only | Editable |
| Wrapped element editor | Editable | Locked |
| Override tree and enablement | Read-only | Editable |
| Override YAML | Read-only | Editable |
| Preview | Live composed result | Live composed result |

Native edits always update `element_base`, even when an active overlay masks
their result in the preview. Forge edits always update `element` and/or
`element_disabled_paths`, never `element_base`. A locked control must prevent
both pointer and keyboard changes, and its events must not modify either
layer.

The selected mode, selected override path, and tree expansion are local editor
state. They do not emit `config-changed` and do not make the dashboard dirty.

### Override tree

The tree mirrors mapping nesting in `element`. Selecting a node opens its
source in the Forge YAML editor. A checkbox controls whether that source path
contributes to composition:

```text
[x] name                 {{ states('sensor.room_label') }}
[x] tap_action
    [x] action           more-info
    [ ] confirmation     {{ ... }}
[ ] entities             {{ integration_entities('light') | list | tojson }}
```

- Unchecking stores the path in `element_disabled_paths`; it does not delete
  the source value.
- A disabled parent disables its entire subtree while retaining each child's
  own saved selection. Re-enabling it restores those selections.
- Removing an override is a distinct action from disabling it.
- New mapping paths may be added whether or not the Native layer has that
  path.
- Literal arrays and template-produced structural values are a single
  replacement node. Their complete YAML may be edited, but they have no
  independently enabled child entries.

The tree must distinguish a node's stored checkbox state from its effective
state under a disabled parent. Its behavior must remain faithful to the
layered configuration contract's disabled-path validation rules.

## Non-layered Forge migration

The visual editor does not silently reinterpret non-layered Forge
configurations.
When it receives a direct, local non-layered Forge using `card`, `badge`, or
`row`, it presents a **Convert to layered editor** action and keeps YAML
editing available until the user chooses it.

For a convertible configuration, conversion is intentionally small and
source-preserving. Move only the inner card `type` from `element` to
`element_base`; leave every other `element` property in place as an active
Forge overlay:

```yaml
# Non-layered Forge
type: custom:uix-forge
forge:
  mold: card
element:
  type: tile
  entity: light.kitchen
  name: "{{ states('sensor.room_label') }}"
  uix:
    style: |
      ha-card { border-color: teal; }
```

```yaml
# Layered Forge edited by the UI
type: custom:uix-forge
forge:
  mold: card
element_base:
  type: tile
element:
  entity: light.kitchen
  name: "{{ states('sensor.room_label') }}"
  uix:
    style: |
      ha-card { border-color: teal; }
```

This preserves every non-`type` source value as Forge-owned, including
templates, nested-template escaping, and `uix` overlay styling. It also avoids
guessing which literal values should become card-owned. Users can deliberately
move a value to the Native layer by recreating it there with the card editor,
then removing or disabling the overriding Forge value.

Layered templates deliberately see `config.element` as the overlay and
`config.element_base` as the base. Consequently, conversion changes the
meaning of a Forge template that inspects `config.element.type` or treats
`config.element` as the entire non-layered element source. Before committing
the conversion, the editor must state this transition and show the affected
source. It may identify direct `config.element.type` references as a helpful
warning, but it must not rewrite templates automatically: indirect references
and arbitrary Jinja make that unsafe. Users must change an affected reference
to `config.element_base.type` or remain on non-layered YAML.

Conversion is available only when all of the following are true:

- `forge.mold` is exactly `card`, `badge`, or `row`;
- `element` is a mapping with a concrete, non-template `type` string;
- the configuration does not already resolve through a Foundry; and
- the source has no unsupported combination that the layered configuration
  contract rejects.

Blank Forge elements, dynamic/template element types, unsupported molds, and
Foundry-backed configurations stay on the YAML path. A Foundry must never be
flattened into local configuration merely to open the editor. Shared Foundry
configuration is not editable through this editor.

There is no automatic reverse conversion. Removing `element_base` is a manual
YAML change and must obey the layered configuration contract; the visual editor
does not fold card-owned values into an overlay or rewrite templates.

## Home Assistant integration and persistence

For each valid edit, the editor creates a fresh complete Forge configuration
and emits one `config-changed` event. It must not mutate a config object
provided by Home Assistant, emit merely because `setConfig()` or rendering ran,
or write evaluated values back into either source layer. This preserves Home
Assistant's preview, dirty tracking, Save, and Cancel behavior.

| Action | Persists configuration? |
| --- | --- |
| Edit a Native base value | Yes |
| Edit Forge behavior | Yes |
| Edit, add, remove, enable, or disable an override | Yes |
| Run the explicit conversion | Yes |
| Change Native/Forge mode, selection, or expansion | No |
| A template result changes with Home Assistant state | No |

Invalid Forge YAML is retained as a local draft, visibly reports its error,
and cannot cause a previous valid configuration to be saved silently. The last
valid composed preview may remain visible while the draft is invalid. The
outer full-configuration YAML editor remains an escape hatch for all supported
Forge configuration, including molds without a visual editor.

Outer layout and visibility remain Forge concerns. For the `card` mold, the
embedded Native editor must not expose controls that write outer-card layout
or top-level `visibility`; the Forge behavior editor owns
`forge.grid_options` and `forge.hidden`. The `badge` and `row` editors must
likewise be prevented from writing configuration that belongs to their
containing Home Assistant collection. The Forge editor does not introduce
support for a top-level `visibility` key.

## Retirement of the YAML-editor bulb button

The `mdi:lightbulb-on-outline` **Wrap in UIX Forge** buttons injected into the
card, badge, row, picture-element, and card-feature YAML editors are retired
with this editor. They create non-layered configurations and duplicate
the now-supported UI entry point while bypassing its clear ownership model.

Remove the button injection and its wrapping handlers from those patched
editors. Do not replace them with another YAML-toolbar action. The supported
paths are: create UIX Forge from the card picker and paste a copied ordinary
card as its Native base; use the explicit in-editor conversion for an existing
direct non-layered Forge; or continue authoring YAML when the configuration is
outside the UI scope.

## Compatibility and acceptance criteria

- Existing non-layered Forge YAML remains valid and unchanged unless the user
  explicitly converts it.
- Migration moves only `element.type`; all other source values retain their
  Forge ownership and source text. The editor clearly warns that templates
  which need the card type or the complete pre-conversion `config.element` must be
  reviewed for the layered template context.
- A Tile card, a custom card such as Bubble Card, a badge, and a row can use
  their own context-appropriate editor inside a layered Forge when the wrapped
  element exposes a usable editor; unsupported elements receive the Native YAML
  fallback.
- Copying an ordinary card, creating UIX Forge, and pasting into its wrapped
  card picker creates a layered Forge whose complete copied source is in
  `element_base`; it does not create a Forge overlay or rewrite card templates.
- Native and Forge edits remain isolated, including after save, reload,
  reopening the editor, and Cancel.
- The Forge behavior editor preserves and edits every supported direct `forge`
  option, including templated `hidden`, `grid_options`, and spark sources.
- Parent/child disabled states and their source values survive save and reload.
- Card-owned templates remain byte-for-byte source values through edit, save,
  reload, and render; Forge-owned templates continue to evaluate only in the
  overlay.
- Handwritten layered configurations behave the same whether or not their
  visual editor was opened.
- Foundry inheritance is neither flattened nor editable through this editor.
- No retired bulb button is injected into the affected YAML editors.

Implementation must update the user-facing Forge documentation with the visual
editor, its scope, the copy → create Forge → paste-base workflow, and the
explicit conversion path. Focused regression tests cover conversion,
event/dirty behavior, native/overlay isolation, disabled paths, paste handling,
and removal of the toolbar injection.
