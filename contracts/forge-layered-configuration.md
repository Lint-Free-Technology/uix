# Forge layered configuration contract

## Status and scope

This is the Stage 1 contract for Forge layered configuration. It defines the YAML model and runtime behaviour for every supported Forge mold. Visual editing may support only a subset of molds in a later stage; hand-authored YAML is supported for all of them now.

## Configuration model

A Forge uses either non-layered configuration or layered configuration.

- Without `element_base`, `element` is the complete Forge-owned element configuration. Forge processes its template values.
- With `element_base`, Forge uses layered configuration: `element_base` is the element-owned base and `element` is the Forge-owned overlay.

```yaml
type: custom:uix-forge
forge:
  mold: card
element_base:
  type: markdown
  content: |
    ## {{ states('sensor.room_label') }}
element:
  title: "{{ config.entity }}"
```

In layered configuration:

- `element_base` is required and must provide `type`.
- `element_base` passes through unchanged. Forge does not detect, escape, evaluate, or rewrite its template strings.
- `element` is optional, must be a mapping, and must not set `type`.
- Forge processes active values in `element` as Forge templates.
- `element_disabled_paths` is optional local persisted state for inactive overlay paths.

## Composition

Forge composes the evaluated active overlay over the base.

- Mappings merge recursively.
- Scalars, arrays, and `null` replace the base value at their path.
- An empty array is a deliberate replacement.
- A Forge template result that is an object or array is an opaque replacement at its target path. Structural results are supplied as JSON, for example with `| tojson`.
- `element_disabled_paths` contains non-empty lists of mapping keys. A disabled parent disables its subtree. Paths must resolve in the combined overlay source and cannot address individual array entries.

## Template ownership

`element_base` is owned by the wrapped element. Native template-capable fields, including a card's `visibility` conditions, belong there and are evaluated by Home Assistant or the wrapped card.

`element` is owned by Forge. Its templates receive the normal Forge context, including `config.element_base` (the resolved base) and `config.element` (the resolved overlay source before evaluation).

Template nesting and `uix-forge.ignore` apply to Forge-owned configuration. They are not needed for templates in `element_base`.

## UIX Styling

`uix` may be present in both `element_base` and `element`.

- The two `uix` mappings are recursively merged as part of element composition.
- Values in the Forge-owned `element.uix` overlay win at every overlapping path.
- UIX Styling receives the composed forged-element configuration, so styling placed in `element` continues to work after moving to layered configuration.
- Templates inside either element layer's `uix` configuration remain UIX Styling templates; Forge does not process them.
- `forge.uix` remains separate wrapper styling. It receives the Forge template context, where layered `config.element` is the overlay and `config.element_base` is the base.

## Foundries

Named, global, and mold-specific global Foundries participate identically in the resolution order:

```text
global → global_<mold> → inherited/named Foundry → local configuration
```

Foundries may contribute `element_base` and `element` fragments. Each fragment resolves recursively with its matching fragment before layered composition occurs.

Any resolved `element_base`, including one supplied by a Foundry, selects layered configuration. Foundries must not set `element_disabled_paths`; it remains local persisted UI-editing state and may disable an overlay value supplied by a Foundry.
