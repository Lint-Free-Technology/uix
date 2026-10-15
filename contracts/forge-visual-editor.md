# Forge visual editor contract

## Status and scope

This contract defines the UIX Forge visual editor. It builds on [the layered
configuration contract](./forge-layered-configuration.md), which remains the
authoritative runtime contract for `element_base`, `element`, and
`element_disabled_paths`.

The editor is a UI for the existing layered configuration; it does not add an
editor-only representation, provenance flag, or a new Forge runtime mode. It
supports the commonly edited direct element molds: dashboard cards
(`forge.mold: card`) and badges (`forge.mold: badge`). Other molds, including
entities rows, remain supported through YAML.

This contract supports selecting a shared Foundry and producing a copy-only
Foundry YAML export, but deliberately excludes creating, saving, or editing a
shared Foundry, changing the wrapped element type after creation, and
per-array-item overrides. They are outside this contract's scope.

## Persisted representation

After choosing a Native element, a Forge created by the visual editor uses
layered configuration:

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
- `element_base.type` is required. A local `element.type` is invalid in layered
  mode. The layered configuration contract defines the separate inherited
  Foundry type-anchor exception; selecting or editing Foundries is outside this
  visual editor's scope.
- A template, scalar, array, or `null` in `element` replaces its target; an
  authored mapping merges recursively. Array entries are not independently
  addressable.
- A disabled value remains in `element`, is not evaluated by Forge, and is
  recorded in `element_disabled_paths`.
- The presence of `element_base`, including an empty overlay, remains the sole
  persisted selection of layered behaviour. Removing all template values does not
  revert an element to non-layered Forge behaviour.

Before a Native element or a Foundry is selected, the picker creates only this
unresolved but valid editor state:

```yaml
type: custom:uix-forge
forge:
  mold: card
```

It must not persist a placeholder `element.type` or `element_base.type`. The
Native tab offers its picker in this state; it does not render a wrapped-element
editor or Native UIX styling panel. The Element tab may still add custom
Forge-owned values. A direct `element.type` remains a non-layered source and
uses the explicit conversion flow instead.

This unresolved state is valid for both supported picker contexts. A Card Forge
uses its existing transient blank-card preview; a Badge Forge has no preview
until an element type resolves. Neither preview fallback is persisted.

The configuration passed to Home Assistant and saved in the dashboard is the
complete authored Forge configuration above. UI-only state is never persisted.

## How Forge is presented in the UI

UIX Forge is presented as a contextual Home Assistant element, not as a YAML
toolbar transformation. It appears in the relevant picker for each supported
mold: the dashboard card picker for `card` and the badge picker for `badge`.
Selecting it creates a `custom:uix-forge` configuration with the matching
`forge.mold` and takes the user to the Forge editor. The initial configuration
has no element type. The user then chooses the wrapped element type, whose
configuration is saved in `element_base`. The unresolved initial state is not a
placeholder native element or a non-layered Forge representation.

Rows, picture elements, and card features are deliberately excluded. Home
Assistant chooses a row editor from its entity rather than from a row-type
picker, and the latter two have no Forge visual editor. UIX Forge retains the
existing **Wrap in UIX Forge** YAML action in those editors. It produces the
existing non-layered source using `forge.mold: row`, `picture-element`, or
`card-feature`, which remains editable in Home Assistant's YAML editor.

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

`UixForge.getConfigElement()` supplies the Forge editor for a direct, local
Card or Badge configuration, whether its Native type is selected or unresolved.
The editor contains four
transient ownership tabs:

1. **Native** — an embedded Home Assistant element editor for
   `element_base`, plus the wrapped-element picker;
2. **Forge** — a Forge behavior editor for the outer direct `forge` mapping;
3. **Element** — the Forge-owned `element` table, its enablement, and the
   selected-value YAML editor.
4. **Foundry** — selection of the shared Foundry to merge with the local
   configuration.
5. **Export** — a copy-only Foundry YAML representation of the configured
   Forge.

Only the selected tab's controls are rendered. This is both the interaction
lockout and the ownership boundary; a hidden tab cannot receive pointer or
keyboard edits. The normal Home Assistant preview renders the composed forged
element in every tab.

The embedded editor is Home Assistant's context-appropriate card or badge
editor: `hui-card-element-editor` or `hui-badge-element-editor`. It receives
only `element_base`, never the merged result and never evaluated Forge values.
The outer Home Assistant code/visual editor switch is separate from Forge's
own Native/Forge/Element tab switch.

The embedded editor cannot change the wrapped element type. Native exposes an
explicit **Choose/Change native element** action. The picker is loaded before
rendering and selecting an element immediately replaces
`element_base`, then opens its normal Home Assistant element editor. **Cancel**
leaves the picker without selecting an element. Home Assistant's usual editor
Cancel and dashboard undo remain responsible for reverting an already selected
element. A type change must never be a side effect of a Native editor event.

Once an element is selected, the Native tab presents a toolbar around that
editor. Its left control toggles the element editor between **Code** and
**Visual** modes, labelled **Show code editor** and **Show visual editor**
according to the available next mode (and disabled when Home Assistant cannot
offer a visual mode); its right **Change Element Type** control returns to the
picker. These are
transient editor controls and do not themselves alter Forge configuration.

### Foundry selection

The **Foundry** tab uses Home Assistant's `ha-generic-picker`. It owns the
picker field and popover (or narrow-screen bottom sheet), including the
interactive `ha-list-item-option` around every row. The editor supplies an
`ha-combo-box-item` as each row's content: its name is the headline,
`mold: <forge.mold>, type: <element.type>` is trailing supporting text, and
the supporting text reports its compatibility. A missing resolved Foundry value
is displayed as `none`; inherited Foundry anchors are resolved for this list.

Compatibility is evaluated from the resolved Foundry anchor (including its
inherited Foundries, but excluding global and local configuration), against the
editor context and currently selected Native type:

- A Foundry `forge.mold`, when present, must equal the contextual `card` or
  `badge` mold.
- If Native has a type, a Foundry `element.type`, when present, must equal it.
- A missing Foundry mold or type does not make it incompatible.
- A templated or otherwise dynamic Foundry `element.type` is not a reliable
  Native type anchor. It remains valid in YAML-only/non-layered Forge, but the
  visual picker shows it disabled and directs the user to the YAML editor.

Compatible options report **Compatible with selected native card**. Incompatible
type options report **Incompatible with selected native card** in the error
colour; compatible options use the success colour. A Foundry whose mold does
not match reports its incompatible mold and required contextual mold, is
disabled, and cannot be selected.
Invalid, missing, or cyclic Foundries are omitted from the visual picker rather
than preventing the remaining Foundries from rendering. Dynamic-type Foundries
are also disabled, but remain visible with their YAML-only explanation.
Compatible Foundries are listed first, then type-incompatible Foundries, then
disabled mold-incompatible Foundries; each group is ordered alphabetically by
Foundry name. The trailing metadata is two normal-weight `--ha-font-size-s`
lines: `mold: …` and `type: …`.
Selecting a compatible Foundry writes its name to local `foundry` and leaves
the authored Native configuration intact. Selecting an incompatible Foundry
first presents a warning. Confirming it writes the name and removes the local
`element_base`, including its Native UIX styling; it does not discard the
Forge-owned `element`, `forge`, or disabled-path source. This leaves the Native
selection unresolved for a later choice. The outer Forge runtime then applies
normal Foundry merging.

When a selected Foundry resolves to a concrete `element.type`, the editor
writes that same type to local `element_base.type` (preserving a compatible
existing Native configuration). Native type selection is then locked: the type
picker and **Change element type** action are unavailable until the Foundry is
cleared or replaced by one without a type. Dynamic types are YAML-only and are
never copied into `element_base` by the visual editor.

Clearing the picker removes only the local `foundry` key. It preserves the
local Native layer, Forge-owned element layer, and disabled paths, and cancels
any pending incompatible-Foundry confirmation.

While a Foundry is selected, the shared visual-editor shell displays a
non-dismissible information alert below its Native/Forge/Element/Foundry tab
group and above the selected panel's `.section`: `Foundry <name> is in use. Use
Foundry tab to review config.` The name is bold. Because the alert belongs to
the shell rather than the Foundry pane, it remains visible on every
visual-editor tab and does not alter configuration.

The shell also detects literal `config.entity` references anywhere in the
direct Forge-owned `forge` or `element` source, and in the selected Foundry's
resolved named-Foundry source. When found, it renders a bordered panel below
the Foundry notice and above the selected tab panel, containing an entity
selector labelled **Global Forge entity (in use)**. Its value is the top-level
Forge `entity` key, which supplies `config.entity` to Forge templates without
being passed to the wrapped element. Clearing the picker removes that key.
Detection is intentionally textual and does not attempt to infer references
hidden behind macro invocations; those configurations remain YAML-authored.

When a named Foundry is selected and can be resolved, the tab displays its
resolved `{ forge, element }` mapping directly below the picker in a read-only
`ha-yaml-editor`. This view follows inherited named Foundries but excludes
global Foundries and the local card source. It exposes no resolver bookkeeping
or `element_base` fields, and supplies Home Assistant's code editor with a
`--code-mirror-max-height` of 200px. The editor therefore manages its own code
area, toolbar, scrolling, and normal fullscreen expansion control. It is
inspection-only and never emits a configuration change.

The warning says that **Selecting** the Foundry clears the Native element. Its
confirmation action is **Continue**, styled with Home Assistant's warning
variant and warning icon; **Cancel** leaves the current configuration intact.

### Export

The final icon-only **Export** tab uses `mdi:export` and has the accessible
label **Export**. It displays the text `Copy the yaml code below to use this
configured <card | badge> as a Foundry` and a read-only `ha-yaml-editor`.

The displayed object is a copy-only Foundry source, never an edit or save
operation. It resolves the selected named Foundry and its inheritance, but not
global Foundries, then emits only `forge` and `element`. If the local Forge is
layered, it composes `element_base` with active `element` source and moves that
complete result to `element`; disabled overlay paths do not contribute. It
therefore contains neither `element_base`, `element_disabled_paths`, the
local `foundry` reference, nor per-instance top-level fields such as `entity`.
Templates remain authored source; the export does not evaluate them.

### Forge behavior editor

The Forge tab has a transient **Show code editor**/**Show visual editor**
switch. Code mode is the source-preserving YAML editor for the direct `forge`
mapping, and remains the lossless fallback for all supported source. Visual
mode edits the same mapping in three tabs; switching modes never changes the
authored representation. `forge.mold` is displayed as the current,
context-locked mold and is not editable in either mode.

1. **General** begins with the current context-locked mold, then provides an
   `ha-form` for `hidden` (template selector) and `grid_options` (object
   selector). A collapsed **Control** expansion panel contains `show_error`,
   `template_nesting`, and `delayed_hass`. A second collapsed **UIX styling**
   panel edits the contents of `forge.uix` as a mapping.
2. **Macros & billets** provides separate mapping-only `ha-yaml-editor`
   controls for `macros` and `billets`.
3. **Sparks** provides one tab per configured Spark. Each registered Spark
   class declares only its supported option names. The tab begins with a picker
   of registered Spark types, which appends a new minimal `{ type }` Spark and
   selects it. Each Spark tab offers its missing option names in a picker and
   lists every configured option except the locked Spark `type`. Added options
   start as active `null`. An option's source is
   edited with the same staged source controls as an element Template:
   strings use a code editor, mappings and arrays use `ha-yaml-editor`, and
   `null` explicitly offers a template source or mapping. Like element
   Templates, the code-editor toolbar offers **Convert to object mapping** and
   **Set to null**, while the YAML-editor toolbar offers **Set to null**. The full `sparks`
   YAML object remains available in Forge code mode for removing Spark entries
   or editing complete Spark source. Each configured Spark tab also has a
   destructive **Remove spark** button plus labelled **Move spark left** and
   **Move spark right** controls below its option list and above its
   documentation alert. Moving a Spark reorders the persisted `forge.sparks`
   list and keeps the moved Spark selected. Removing one removes only that
   Spark entry and selects the next available tab.

Immediately after adding a Spark option, the table displays a transient,
dismissible local notice naming that option and explaining that it is `null`;
it directs the user to **Edit as template** or **Convert to object mapping**.
The notice is editor-only and is never saved.
Every **UIX styling** panel provides a mapping-only `ha-yaml-editor`, followed
by a clear reminder that the field is the *contents* of that mapping and must
not contain another `uix:` key. The Native tab's panel edits
`element_base.uix`, the Element tab's panel edits `element.uix`, and the
General panel edits `forge.uix`.

Each visual Forge pane and UIX styling panel ends with a non-dismissible information help alert.
Only those documentation-link alerts use a question-mark icon rather than Home
Assistant's default info icon. They link to the Forge guide for **General** and
**Macros & billets**, the selected Spark's documentation for a Spark tab, and
the UIX styling section for **UIX styling**. UIX styling's separate content
reminder retains the standard info icon.

Visual controls merge only the fields they own into the existing direct
`forge` mapping, preserving unrepresented source. Code mode remains
authoritative for structures not representable by the visual controls. YAML
source controls use Home Assistant's `ha-yaml-editor`, including its syntax
feedback and editor affordances. Forge still applies its own mapping, layer
ownership, and wrapped-type validation to the parsed value.

### Editing tabs

The Forge editor has transient **Native**, **Forge**, and **Element** tabs:

| Control | Native | Forge | Element |
| --- | --- | --- | --- |
| Forge behavior editor | Unavailable | Editable in visual or code mode | Unavailable |
| Wrapped element editor and picker | Editable | Unavailable | Unavailable |
| Template table and enablement | Unavailable | Unavailable | Editable |
| Selected template YAML | Unavailable | Unavailable | Editable |
| Preview | Live composed result | Live composed result | Live composed result |

Native edits always update `element_base`, even when an active overlay masks
their result in the preview. Forge edits always update `forge`; Element edits
always update `element` and/or `element_disabled_paths`. Neither Forge nor
Element may modify `element_base`.

When Forge is edited as a card, Home Assistant's containing
`hui-card-element-editor` must not expose outer visibility or layout tabs.
Those controls would write top-level values outside the Forge ownership model.
Outer card visibility and grid layout belong to `forge.hidden` and
`forge.grid_options`, respectively, and are edited in the Forge tab.

The selected tab is local editor state. It does not emit `config-changed` and
does not make the dashboard dirty.

### Template selection and table

The **Element** tab calls the Forge-owned values in `element` “templates” in
the UI, matching Home Assistant's user-facing terminology. A stored value may
still be a literal, mapping, array, `null`, or a Forge template; its runtime
meaning remains exactly the layered configuration contract's `element` source.

At the top of the tab, a searchable Home Assistant picker lists every mapping
path in `element_base` which is not already represented by `element`. It lists
each nesting level separately, for example both `tap_action` and
`tap_action.action`. Selecting a Native path copies that Native source value to
the same path in `element`, makes it active, and adds its new table row. It then
disappears from the picker. The picker also accepts a custom dotted path
for a value not present in `element_base`; a custom path starts as active
`null`. The root `type` path is neither offered nor accepted because
`element.type` is invalid in layered configuration. The root `uix` path is
also excluded from the picker and table because its mapping is edited in the
tab's separate **UIX styling** panel.
Immediately after adding a custom path, the table displays a transient local
notice naming that path and explaining that its active value is `null`; it
directs the user to **Edit as template** or **Convert to object
mapping**. The notice is editor-only and is never saved.

The table mirrors mapping nesting in `element`; it shows the full source path
and reserves its final **Actions** column for labelled Home Assistant icon
buttons, in order: pencil **Edit**, toggle **Enable** or **Disable**, and
cross **Remove**. Their labels provide their tooltips and accessible names.
Edit switches the tab from the picker and table to that value's complete
source editor. The toggle controls whether that source path contributes to
composition:

```text
name                                                   [Edit] [On]  [Remove]
tap_action                                             [Edit] [On]  [Remove]
  action                                               [Edit] [On]  [Remove]
  confirmation                                         [Edit] [Off] [Remove]
```

- Disable stores the path in `element_disabled_paths`; it does not delete the
  source value.
- A disabled parent disables its entire subtree while retaining each child's
  own saved selection. Re-enabling it restores those selections.
- Removing a template value is a distinct action from disabling it.
- **Remove** deletes that source path and any disabled-path entries at or below
  it.
- Literal arrays and template-produced structural values are a single
  replacement node. Their complete YAML may be edited, but they have no
  independently enabled child entries.

Enablement controls require a selected Native `element_base`, because a custom
template can exist before there is a base path to suppress. Custom paths may
still be added and edited in that state, but the visual editor must not write
`element_disabled_paths` until Native source exists. When an edit or Preview
does write disabled paths, it retains every path that still exists in the full
resolved overlay, including inherited Foundry and global overlay values.

The table greys an exact disabled row or a row disabled by its parent. It must
distinguish a row's stored toggle state from its effective state under a
disabled parent, and remain faithful to the layered configuration contract's
disabled-path validation rules.

Editing source is a local draft: typing, including transient invalid YAML, must
not emit `config-changed` or alter the preview. Its footer
contains **Cancel**, **Preview**, and **Save & Exit**, in that left-to-right
order. **Preview** applies the current valid draft to the normal Home Assistant
preview temporarily, including temporarily enabling the edited path. If it or
one of its parents is disabled, Preview omits that disabled path only from its
transient preview configuration. **Cancel** returns to the picker and table and
restores the exact pre-edit configuration when Preview was used. **Save & Exit**
applies the current valid draft, restores the pre-edit disabled-path state, and
returns to the picker and table. YAML-invalid
drafts remain editable and show Home Assistant's YAML feedback. Preview and
Save & Exit validate the current YAML parse when pressed and, when invalid,
show the error without applying configuration.
If an earlier Preview succeeded and a later Preview is invalid, that later
failure must not clear the preview state: **Cancel** still restores the
pre-edit configuration.
The YAML editor must retain its local text while typing; it must not serialize
the parsed YAML back into the field after each keystroke.

An individual string template value uses an `ha-form` field with Home
Assistant's `template` selector, rather than a YAML editor. This accepts a bare
Forge source such as `{{ states('light.kitchen') }}`, provides Home Assistant's
template test control and error/result display, and avoids YAML's flow-mapping
parsing rules. The source editor offers a one-way **Convert to object mapping**
action for turning a scalar replacement such as `tap_action: none` into a
mapping. It first warns that it will discard the local scalar draft, and only
an explicit confirmation replaces that draft with an empty mapping. It never
attempts to parse or reinterpret scalar source as YAML.

`null` is a separate explicit source kind, never an empty template source. The
source and YAML editor toolbars offer **Set to null**, which warns before
discarding the current local draft. A literal-null view identifies the active
replacement and offers **Edit as template** and **Convert to object
mapping** without a warning, because no source is being retained. An enabled
literal `null` replaces the matching Native/base value; **Disable** or
**Remove** remains the deliberate way to let that value apply again. Mappings,
arrays, booleans, and numbers use `ha-yaml-editor` so their YAML types are
preserved. The template selector is source editing, not a Forge evaluator; it
remains locally staged until Preview or Save & Exit. The selector does not
publish its asynchronous test error as a form validity event, so test errors
remain displayed by the selector but do not disable Preview or Save & Exit,
matching Home Assistant's normal template form behavior.

## Non-layered Forge migration

The visual editor does not silently reinterpret non-layered Forge
configurations.
When it receives a direct, local non-layered Forge using `card` or `badge`, it
presents a **Convert to layered editor** action and keeps YAML editing
available until the user chooses it.

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

- `forge.mold` is exactly `card` or `badge`;
- `element` is a mapping with a concrete, non-template `type` string;
- the configuration does not already resolve through a Foundry; and
- the source has no unsupported combination that the layered configuration
  contract rejects.

Top-level non-layered compatibility shortcuts (`entities`, `color`, and
`state_color`) and an `element.state_color` migration are not convertible:
they are applied only in non-layered runtime mode. They remain YAML-authored
until an explicit migration can preserve their behavior.

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
| Select a Native element | Yes |
| Edit Forge behavior | Yes |
| Add, remove, enable, or disable a template value | Yes |
| Type in a template YAML draft | No |
| Preview a valid template YAML draft | Temporarily; Cancel restores the pre-edit source |
| Save & Exit a valid template YAML draft | Yes |
| Run the explicit conversion | Yes |
| Change tab, or expansion | No |
| A template result changes with Home Assistant state | No |

Invalid Forge YAML is retained as a local draft, visibly reports its error,
and cannot cause a previous valid configuration to be saved silently. The last
valid composed preview may remain visible while the draft is invalid. The
outer full-configuration YAML editor remains an escape hatch for all supported
Forge configuration, including molds without a visual editor.

Outer layout and visibility remain Forge concerns. For the `card` mold, the
embedded Native editor must not expose controls that write outer-card layout
or top-level `visibility`; the Forge behavior editor owns
`forge.grid_options` and `forge.hidden`. The badge editor must likewise be
prevented from writing configuration that belongs to its containing Home
Assistant collection. The Forge editor does not introduce support for a
top-level `visibility` key.

## Retirement of the YAML-editor bulb button

The `mdi:lightbulb-on-outline` **Wrap in UIX Forge** buttons injected into the
card and badge YAML editors are retired with this editor. They create
non-layered configurations and duplicate the now-supported UI entry point
while bypassing its clear ownership model.

Remove the button injection and its wrapping handlers from those patched
editors. Do not replace them with another YAML-toolbar action. The row,
picture-element, and card-feature buttons remain because those molds are
outside this editor's scope. The supported card and badge paths are: create
UIX Forge from the matching picker and paste a copied ordinary card as its
Native base; use the explicit in-editor conversion for an existing direct
non-layered Forge; or continue authoring YAML when the configuration is
outside the UI scope.

## Compatibility and acceptance criteria

- Existing non-layered Forge YAML remains valid and unchanged unless the user
  explicitly converts it.
- Migration moves only `element.type`; all other source values retain their
  Forge ownership and source text. The editor clearly warns that templates
  which need the card type or the complete pre-conversion `config.element` must be
  reviewed for the layered template context.
- A Tile card, a custom card such as Bubble Card, and a badge can use their
  own context-appropriate editor inside a layered Forge.
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
- Foundry inheritance is neither flattened into persisted card source nor
  editable through this editor. Export may present a separate copy-only,
  flattened Foundry snapshot.
- No retired bulb button is injected into the card or badge YAML editor; the
  row, picture-element, and card-feature editors retain their bulb buttons.

Implementation must update the user-facing Forge documentation with the visual
editor, its scope, the copy → create Forge → paste-base workflow, and the
explicit conversion path. Focused regression tests cover conversion,
event/dirty behavior, native/overlay isolation, disabled paths, paste handling,
and removal of the toolbar injection.
