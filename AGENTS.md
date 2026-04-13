# UIX Agent Guide

## What is UI eXtension (UIX)?

UI eXtension (UIX) is a custom integration for [Home Assistant](https://www.home-assistant.io/) that enables advanced CSS customisation across the entire Home Assistant UI. It comes from the heritage of [card-mod](https://github.com/thomasloven/lovelace-card-mod) by [@thomasloven](https://github.com/thomasloven) and extends it with new features such as Jinja2 macros, improved DOM navigation, and in-browser debugging helpers.

- **Full documentation:** <https://uix.lf.technology/>
- **UIX Guides** (community-curated examples and tutorials): <https://uix-guides.lf.technology>
- **FAQ:** <https://uix.lf.technology/faq>
- **Quick Start:** <https://uix.lf.technology/quick-start>
- **GitHub repository:** <https://github.com/Lint-Free-Technology/uix>
- **GitHub discussions:** <https://github.com/Lint-Free-Technology/uix/discussions>

---

## Installation

### Via HACS (recommended)

Add `https://github.com/Lint-Free-Technology/uix` as a custom HACS repository (type: `Integration`), then download it and add the **UI eXtension** service in Home Assistant **Settings → Devices & Services**.

### Manual

Copy the contents of [`custom_components/uix`](https://github.com/Lint-Free-Technology/uix/tree/master/custom_components/uix) into `<config>/custom_components/uix/`, restart Home Assistant, then add the service as above.

---

## How Users Apply UIX

UIX is configured through a `uix:` key added to a card, entity, badge, or element in a Lovelace/dashboard YAML configuration. It requires no resource URL management—UIX handles that automatically.

### Basic card style

```yaml
type: entities
show_header_toggle: false
entities:
  - light.bed_light
uix:
  style: |
    ha-card {
      background: red;
    }
```

### Using CSS variables

Home Assistant themes expose CSS variables that UIX can both read and override:

```yaml
uix:
  style: |
    ha-card {
      --ha-card-background: teal;
      color: var(--primary-color);
    }
```

### Styling individual entities

In `entities` and `glance` cards each entity row can be styled independently. Styles are injected into a shadow root so the bottommost element is `:host`:

```yaml
type: entities
entities:
  - entity: light.bed_light
    uix:
      style: |
        :host { color: red; }
  - entity: light.ceiling_lights
    uix:
      style: |
        :host { color: green; }
```

This also applies to view badges and elements in `picture-elements` cards.

---

## DOM Navigation and Shadow Roots

Home Assistant makes heavy use of the [shadow DOM](https://developer.mozilla.org/en-US/docs/Web/Web_Components/Using_shadow_DOM). To style elements inside a shadow root, make `style:` a **dictionary** instead of a string.

- Each **key** is a selector that navigates down through the DOM.
- A dollar sign `$` in the key replaces a `#shadow-root` crossing.
- A key of `.` (period) selects the current root element.
- Selector steps are separated by spaces; only the **first** match is followed at each intermediate step, but the **final** step matches **all** elements.
- A key may begin with `&` to filter the initial element before any traversal (see the [`&` host/element filter](#-hostelement-filter) section below).

### Example: styling `<h3>` inside a markdown card

```yaml
type: markdown
content: |-
  # Example
  ### This heading will be purple
uix:
  style:
    "ha-markdown $": |
      h3 {
        color: purple;
      }
    ".": |
      ha-card {
        background: teal;
      }
```

### Chaining and load-order stability

Breaking a long chain into several dictionary levels lets UIX retry each step independently, which is more reliable when elements load asynchronously:

```yaml
# Stable: UIX can retry from ha-map $ if ha-entity-marker hasn't loaded yet
uix:
  style:
    "ha-map $":
      "ha-entity-marker $":
        div: |
          color: red;
```

### `&` host/element filter

A path key may begin with `&` as its first step to filter the initial element before any traversal. If the initial context is a shadow root, the `&` filter is tested against the **host** element; if it is a regular element, it is tested against that element.

Supported tokens (all present tokens must match):

- `tagname` — element local name match
- `.classname` — class list check
- `#id` — element ID match
- `[attr]`, `[attr=val]`, `[attr^=val]`, `[attr$=val]`, `[attr*=val]`, `[attr~=val]`, `[attr|=val]` — attribute checks

Tokens may be combined (e.g. `&ha-dialog.my-class[data-type="video"]`). Selectors containing spaces are **not** supported. Class selectors may optionally be wrapped in parentheses: `&(.my-class)` equals `&.my-class`.

This is primarily useful in themes to scope a style path to a specific host class or attribute:

```yaml
# Style a dialog only when it has the class type-hui-dialog-web-browser-play-media
my-awesome-theme:
  uix-theme: my-awesome-theme
  uix-dialog-yaml: |
    "&(.type-hui-dialog-web-browser-play-media) $ ha-dialog-header $": |
      section.header-content {
        display: none;
      }
```

---

## Templates (Jinja2)

All style strings support [Jinja2 templates](https://www.home-assistant.io/docs/configuration/templating/) processed by the Home Assistant backend.

### Template variables

| Variable | Description |
|----------|-------------|
| `config` | Full card/entity/badge configuration object (`config.entity` is often useful) |
| `user` | Username of the currently logged-in user |
| `browser` | `browser_id` from [browser_mod](https://github.com/thomasloven/hass-browser_mod) (if installed) |
| `hash` | Everything after `#` in the current URL (updates on navigation) |
| `panel` | Panel/view information dictionary (see below) |

`panel` attributes include: `fullUrlPath`, `panelComponentName`, `panelIcon`, `panelNarrow`, `panelRequireAdmin`, `panelTitle`, `panelUrlPath`, `viewNarrow`, `viewTitle`, `viewUrlPath`.

### Example: state-based background colour

```yaml
type: entities
entities:
  - light.bed_light
uix:
  style: |
    ha-card {
      background:
        {% if is_state('light.bed_light', 'on') %}
          teal
        {% else %}
          purple
        {% endif %};
    }
```

### Debugging templates

Place the comment `{# uix.debug #}` anywhere in a template to enable verbose console logging for that template.

---

## Macros

Macros are reusable Jinja2 snippets defined under `uix.macros` on a card (or under `uix-macros-yaml` in a theme). They are prepended to every template in that card.

### Inline macro (returns a string value)

```yaml
type: tile
entity: light.living_room
uix:
  macros:
    state_color:
      params:
        - entity_id
        - name: color_on
          default: "'yellow'"
        - name: color_off
          default: "'gray'"
      template: "{{ color_on if is_state(entity_id, 'on') else color_off }}"
  style: |
    ha-card {
      background: {{ state_color(config.entity) }};
    }
```

### Macro with `returns: true` (typed return value)

Use `returns: true` when you need an actual boolean or number rather than a string:

```yaml
uix:
  macros:
    is_on:
      params:
        - entity_id
      returns: true
      template: "{%- do returns(is_state(entity_id, 'on')) -%}"
  style: |
    ha-card {
      --tile-color: {{ 'yellow' if is_on(config.entity) else 'gray' }};
    }
```

### Importing macros from a custom template file

```yaml
uix:
  macros:
    state_color: "my_macros.jinja"
  style: |
    ha-card {
      background: {{ state_color(config.entity) }};
    }
```

The named macro must exist in `/config/custom_templates/my_macros.jinja`.

### Macro parameter syntax

Each entry in `params` is either a plain string (parameter name) or a mapping with `name` and `default` keys. The `default` value is injected verbatim as a Jinja2 expression—quote string literals with inner single quotes, e.g. `"'yellow'"`.

---

## Themes

Themes can inject UIX styles globally using theme variables such as `uix-card`, `uix-row`, `uix-badge`, etc. Every theme that uses UIX must define:

```yaml
my-awesome-theme:
  uix-theme: my-awesome-theme
  uix-card: |
    ha-card {
      border-radius: 20px;
    }
```

Themes can also define macros available to all cards using that theme via `uix-macros-yaml`.

---

## Section Backgrounds

Section backgrounds in the Home Assistant sections view are sibling elements to the section, so they cannot be targeted by the section's own UIX styling directly. UIX provides two approaches.

### Option 1: UIX CSS variables

Apply `--uix-section-background-color` and `--uix-section-background-opacity` to the section (or a parent). UIX reads these and applies them to the `hui-section-background` sibling element. The section's `background:` config must be set (minimal: `background: true`).

```yaml
type: grid
cards: []
background: true
uix:
  style: |
    :host {
      --uix-section-background-color: red;
      --uix-section-background-opacity: 0.5;
    }
```

### Option 2: UIX styling on the `background` key

Add a `uix` key directly to the `background` config to target the background element:

```yaml
type: grid
cards: []
background:
  uix:
    style: |
      :host {
        --ha-section-background-color: yellow;
        border: 2px solid red;
      }
```

---

## Image Overrides

UIX can substitute the entity image displayed by `ha-entity-marker`, `ha-tile-icon`, `state-badge`, `ha-user-badge`, and `ha-person-badge` elements.

Define a CSS variable `--uix-image-for-<entity_id>` (replacing every `.` in the entity ID with `_`). When an element renders the matching entity, its background image is replaced with the supplied URL. Templates are supported.

```yaml
type: tile
entity: person.jim
uix:
  style: |
    :host {
      --uix-image-for-person_jim: /local/photos/jim.jpg;
    }
```

The variable can be set at any ancestor level in the DOM. To apply it across the whole frontend, add it via `uix-root(-yaml)`, `uix-config(-yaml)`, and `uix-more-info(-yaml)` theme variables.

---

## UIX Forge

UIX Forge (`custom:uix-forge`) is a custom Lovelace element that combines template-driven configuration with optional behaviours called **sparks**. It lets you:

- **Forge** any standard Home Assistant element from templates, so the entire element config reacts to entity states, user, browser and other template variables.
- **Add sparks** — self-contained behaviours that augment the forged element (tooltips, buttons, locks, etc.).
- **Apply UIX styles** to the forged element or the forge wrapper.

### Basic structure

```yaml
type: custom:uix-forge
forge:
  mold: card          # required — how to mount the element
element:
  type: tile
  entity: "{{ 'sun.sun' }}"
```

`forge` controls how UIX Forge itself behaves; `element` is the configuration of the Home Assistant element rendered inside it. Every string value in `element` is processed as a Jinja2 template with the same variables as UIX templates (`config`, `user`, `browser`, `hash`, `panel`).

### Forge options

| Key | Default | Description |
|-----|---------|-------------|
| `mold` | (required) | How the element is mounted. One of `card`, `badge`, `row`, `section`, `picture-element`. |
| `macros` | — | Template macros available to all templates in the forge. Macros are also passed to any `uix` styling on the forge and forged element. |
| `hidden` | `false` | Template-supported boolean — when truthy the element is hidden. |
| `grid_options` | — | Lovelace grid options for `mold: card` (ignored otherwise). Templates supported. |
| `show_error` | `false` | Show the Lovelace error card instead of hiding when the forged element errors. |
| `template_nesting` | `"<<>>"` | Four-character string for escaping `{{ }}` in nested forges. Add an extra `<>` pair per additional nesting layer (e.g. `"<<<>>>"` for two layers). |
| `sparks` | `[]` | List of spark configurations. Templates supported. |
| `delayed_hass` | — | Delay passing `hass` to the card until after load. Suppresses console errors for some custom cards (e.g. apexcharts-card). |
| `uix` | — | UIX styling applied to the forge wrapper. Template variables `config.forge`, `config.element`, and `uixForge` are available. |

### Template nesting

When the element config itself contains Jinja2-like syntax (e.g. in nested forges or custom card features), wrap the inner template with `<<` / `>>` instead of `{{` / `}}`. UIX expands these before evaluation. For each additional forge nesting layer, add one more `<`/`>` pair (e.g. `<<<value>>>` for two layers deep).

```yaml
element:
  type: tile
  entity: "{{ config.element.entity }}"        # normal template
  name: "<< config.element.entity >>"          # escaped — passes through one forge layer
```

### Foundries

A **foundry** is a named UIX Forge template stored in the UIX integration (Settings → Devices & Services → UI eXtension → Configure). It defines reusable `forge` and `element` configs. Reference it with `foundry:` and override only what you need locally. Local keys are merged on top of the foundry; object values are merged recursively.

```yaml
type: custom:uix-forge
foundry: my_tile
element:
  entity: light.kitchen    # overrides the foundry's entity
```

Foundries support `!secret` references resolved from `secrets.yaml`. Foundries can reference other foundries (nested foundry chains), but circular references are detected and raise an error.

### Auto-entities support

UIX Forge works with `custom:auto-entities` in two ways:

1. UIX Forge is the main card (`card_param: cards`) — it accepts `entities` from auto-entities and passes them to the element config.
2. UIX Forge is used as an entity card via auto-entities `options` — it accepts `entity` from auto-entities.

To access the entity in templates via `config.element.entity`, include `entity: this.entity_id` under `element` in the auto-entities include options.

### UIX styling on a forge

Add a `uix` key under `forge` to style the forge wrapper. Template variables `config.forge`, `config.element`, and `uixForge` are available.

```yaml
type: custom:uix-forge
forge:
  mold: card
  uix:
    style: |
      :host {
        --ha-card-border-radius: 20px;
      }
element:
  type: tile
  entity: light.living_room
```

### Macros in forge

Macros defined under `forge.macros` are available to all templates in the forge *and* are passed through to UIX styling on both the forge wrapper and the forged element. A useful pattern is an `entity()` macro that works in both contexts:

```jinja
{{ config.element.entity | default('') if 'element' in config else config.entity | default('') }}
```

### Sparks

Sparks are attached via the `forge.sparks` list. Each spark has a `type` key and its own options. Most sparks use `for`, `before`, or `after` to specify a selector path to the target element within the forged element (use `uix_forge_path($0)` in DevTools to discover paths).

| Spark type | Description |
|------------|-------------|
| `tooltip` | Attach a styled tooltip to any element inside the forged element. |
| `button` | Insert an `ha-button` (with actions) before or after any element. |
| `attribute` | Add, replace, or remove an attribute of any element. |
| `event` | Receive DOM events from `fire-dom-event` actions and expose their data as template variables via `uixForge`. |
| `tile-icon` | Insert an `ha-tile-icon` element before or after any element. |
| `state-badge` | Insert a `state-badge` element before or after any element. |
| `grid` | Apply CSS grid layout to a container element inside the forged element. |
| `search` | Query a container element with a CSS selector (and optional text regex), then mutate the found elements (add/remove class, attribute, or text). |
| `map` | Preserve the zoom level and centre of a map card across HA state updates. Supports a `tour` mode and a `fit_map` option for maps hidden on initial load (e.g. inside auto-entities). |
| `lock` | Overlay a lock icon on any element to block interaction until the user passes a PIN, passphrase, or confirmation challenge. Supports `--uix-lock-icon-background`, `--uix-lock-icon-border-radius`, `--uix-lock-icon-padding`, `--uix-lock-cursor`, and per-state CSS variable variants. Can target `ha-tile-icon` specifically. |

Multiple sparks of the same type can be added to a single forge.

---

## Browser Console Debugging Helpers

UIX ships three functions attached to `window` for use in the browser DevTools console. Open DevTools, select an element in the **Elements** panel (it becomes `$0`), then call one of the helpers.

### `uix_tree($0)` — general helper

Reports everything UIX knows about the area surrounding the selected element.

```js
uix_tree($0)
```

| Section | What it shows |
|---------|---------------|
| 📦 **Closest UIX Parent** | The nearest ancestor with a UIX node attached, including template variables and UIX type (e.g. `card`, `view`) |
| 👶 **Active UIX Children** | Paths currently being styled as children of the UIX parent, with resolved DOM elements |
| 🗺️ **Available YAML Selectors** | Every valid YAML style key reachable within the UIX parent's subtree, with all CSS selectors valid inside each key's style string |

**Example output:**

```
💡 UIX Tree 💡
  Target element: <hui-card>
  📦 Closest UIX Parent
    Element: <hui-card>
    UIX type: card
  👶 Active UIX Children: none
  🗺️ Available YAML Selectors  (2 YAML selectors, 5 CSS selectors)
    ".":  (2 CSS selectors)
      ha-card  <ha-card>
      ha-card ha-markdown  <ha-markdown>
    "ha-markdown $":  (3 CSS selectors)
      h3  <h3>
      p  <p>
      p span  <span>
```

Each CSS selector entry is followed by a clickable element reference—click it in the DevTools console to jump to that element in the inspector.

### `uix_style_path($0)` — specific helper

Reports the exact UIX path to the selected element and generates a ready-to-paste YAML snippet.

```js
uix_style_path($0)
```

`uix_path($0)` is a shorthand alias for `uix_style_path($0)`.

| Section | What it shows |
|---------|---------------|
| 📦 **Closest UIX Parent** | Same as `uix_tree` |
| 📍 **UIX Path to Target** | The exact YAML style key (using `$` for shadow-root crossings) to reach `$0` |
| 🎨 **CSS Target** | Tag name, ID, classes, and a suggested CSS selector for `$0` |
| 📝 **Boilerplate UIX YAML** | A paste-ready card-level YAML snippet. Shown only for types that support a card-level `uix:` key. |
| 📝 **Boilerplate Theme YAML** | A paste-ready theme YAML snippet. Shown for all types. For theme-only types this is the only boilerplate shown; uses the `-yaml` variable variant when shadow-root crossings appear in the path. |

**Example output (selecting an `<h3>` inside a markdown card — shows both card and theme boilerplate):**

```
💡 UIX Style Path 💡
  Target element: <h3>
  📦 Closest UIX Parent
    Element: <hui-markdown-card>
    UIX type: card
  📍 UIX Path to Target
    Path: "ha-markdown $":
  🎨 CSS Target
    Tag: h3
    Suggested CSS selector: h3  <h3>
  📝 Boilerplate UIX YAML
    uix:
      style:
        "ha-markdown $": |
          h3 {
            /* your styles for h3 */
          }
  📝 Boilerplate Theme YAML
    my-awesome-theme:
      uix-theme: my-awesome-theme
      uix-card-yaml: |
        "ha-markdown $": |
          h3 {
            /* your styles for h3 */
          }
```

**Example output (selecting an element inside a dialog — shows theme boilerplate only):**

```
💡 UIX Path 💡
  Target element: <ha-dialog-header>
  📦 Closest UIX Parent
    Element: <ha-more-info-dialog>
    UIX type: dialog
  📍 UIX Path to Target
    Path: "$":
  🎨 CSS Target
    Tag: ha-dialog-header
    Suggested CSS selector: ha-dialog-header  <ha-dialog-header>
  📝 Boilerplate Theme YAML
    my-awesome-theme:
      uix-theme: my-awesome-theme
      uix-dialog-yaml: |
        "$": |
          ha-dialog-header {
            /* your styles for ha-dialog-header */
          }
```

Theme-only types (`dialog`, `root`, `view`, `more-info`, `sidebar`, `config`, `panel-custom`, `top-app-bar-fixed`, `developer-tools`) only show theme boilerplate because they cannot be styled via a card-level `uix:` key.

### `uix_forge_path($0)` — forge helper

Reports the selector path from the closest `uix-forge` parent's forged element to the selected element. Use the path as the value of `for`, `before`, or `after` in a forge spark config.

```js
uix_forge_path($0)
```

| Section | What it shows |
|---------|---------------|
| 📦 **Closest UIX Forge Parent** | The nearest ancestor `uix-forge` element |
| 📍 **Forge Path to Target** | The selector path (using `$` for shadow-root crossings) from the forged element to `$0` |
| 📝 **Boilerplate Spark YAML** | A paste-ready spark YAML snippet showing how to use the path |

---

## Testing

UIX has an automated visual test suite located under `tests/` (currently on the `dev` branch). Tests spin up a real Home Assistant instance in Docker via [`ha-testcontainer`](https://github.com/Lint-Free-Technology/ha-testcontainer) and exercise UIX with a real browser via [Playwright](https://playwright.dev/python/).

### Prerequisites

- Docker
- Python 3.11 or later

```bash
python3 -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -e ".[test]"
playwright install chromium
```

### Running tests

All commands from the **repository root**:

```bash
pytest tests/                                          # everything
pytest tests/visual/test_uix_styling.py               # smoke tests only
pytest tests/visual/test_scenarios.py                 # all scenarios
pytest tests/visual/test_scenarios.py -k card_basic_style  # single scenario
pytest tests/visual/test_scenarios.py -k forge        # all forge scenarios
HA_VERSION=2025.1.0 pytest tests/                     # pin HA version
```

`HA_VERSION` accepts `stable` (default), `beta`, `dev`, or a pinned version string.

### Test structure

```
tests/
├── conftest.py                  # session-scoped HA container + fixtures
├── ha-config/
│   ├── configuration.yaml       # HA config (demo, lovelace: storage, frontend themes)
│   └── themes.yaml              # UIX test themes (e.g. uix-test-theme)
└── visual/
    ├── conftest.py              # Playwright browser context + ha_page fixture
    ├── lovelace_helpers.py      # push_lovelace_config_to() helper
    ├── scenario_runner.py       # YAML scenario engine
    ├── test_scenarios.py        # parametrised test: test_scenario[id]
    ├── test_uix_styling.py      # smoke tests (HA boots, UIX loads, no JS errors)
    ├── scenarios/
    │   ├── styling/             # UIX card/theme/macro/template scenarios
    │   └── forge/               # UIX Forge scenarios
    └── snapshots/               # baseline PNG snapshots for visual comparison
```

### Adding a test scenario

Create a `.yaml` file in `tests/visual/scenarios/` (any sub-directory). No Python changes needed. Schema:

```yaml
id: my_scenario_id          # unique; used as the pytest parametrize ID and -k filter
description: "..."
view_path: my-scenario-id   # URL slug for the Lovelace view (kebab-case recommended)
theme: uix-test-theme       # optional — activates a named theme before navigation

card:                        # full Lovelace card/element YAML pushed to the test dashboard
  type: entities
  entities:
    - light.bed_light
  uix:
    style: "ha-card { background: red; }"

interactions:                # optional — executed in order before assertions
  - type: ha_service
    domain: light
    service: turn_off
    entity_id: light.bed_light   # shorthand for data.entity_id
  - type: wait
    ms: 2000
  - type: hover
    selector: uix-forge          # simple CSS selector (main page)
    settle_ms: 500
  - type: hover                  # shadow-root form
    root: hui-tile-card          # string or list for deeper chains
    selector: ha-tile-icon
    settle_ms: 800
  - type: click                  # same simple/shadow-root forms as hover
    root: hui-tile-card
    selector: ha-tile-icon
    settle_ms: 3000

assertions:
  - type: element_present        # element must exist inside shadow root chain
    root: hui-entities-card      # string or list
    selector: uix-node
  - type: element_absent         # element must NOT exist
    root: hui-entities-card
    selector: uix-node
  - type: css_property           # computed style property check
    root: hui-entities-card
    selector: ha-card
    property: backgroundColor
    expected: "rgb(255, 0, 0)"
  - type: css_variable           # CSS custom property check (getPropertyValue)
    root: hui-tile-card
    selector: ha-card
    property: "--tile-color"
    expected: "teal"
  - type: text_equals
    root: hui-tile-card
    selector: span.primary
    expected: "My Label"
  - type: text_startswith
    root: hui-tile-card
    selector: span.primary
    expected: "My"
  - type: snapshot               # visual snapshot comparison
    name: "01_my_scenario"       # filename under tests/visual/snapshots/
    threshold: 0.02              # fraction of pixels allowed to differ (default exact)
```

When calling `run_interactions` from a custom test, pass the `ha` container fixture when any interaction has `type: ha_service`:

```python
run_interactions(page, scenario, ha=ha)
```

### HA config and themes

- `tests/ha-config/configuration.yaml` — includes `demo:` entities, `lovelace: mode: storage`, and a `frontend: themes:` include.
- `tests/ha-config/themes.yaml` — define test themes here. A theme must set `uix-theme: <theme-name>`. Activate via the `theme:` key in a scenario YAML.

### YAML list style convention

Use block (`-`) list style in scenario YAML files, not bracket (`[]`) style. Empty lists `[]` are the only exception.

---

## Card-mod Compatibility

UIX is a drop-in replacement for card-mod up to version 4.2.1. Card-mod `card-mod:` keys are still accepted, but `uix:` takes precedence when both are present. Key differences:

| Feature | Card-mod | UIX |
|---------|----------|-----|
| Card config key | `card-mod:` | `uix:` |
| Theme key | `card-mod-theme:` | `uix-theme:` |
| Theme thing keys | `card-mod-<thing>(-yaml):` | `uix-<thing>(-yaml):` |
| HTML node | `<card-mod-card>` | `<uix-node>` |
| Template debug | `{# card-mod.debug #}` | `{# uix.debug #}` |

---

## Key Documentation Links

| Resource | URL |
|----------|-----|
| Documentation home | <https://uix.lf.technology/> |
| Quick Start | <https://uix.lf.technology/quick-start> |
| Using UIX (cards, entities, icons, templates, themes) | <https://uix.lf.technology/using/> |
| DOM navigation concepts | <https://uix.lf.technology/concepts/dom> |
| Section backgrounds | <https://uix.lf.technology/using/section-backgrounds> |
| Image overrides | <https://uix.lf.technology/using/images> |
| UIX Forge | <https://uix.lf.technology/forge/> |
| Foundries | <https://uix.lf.technology/forge/foundries> |
| Sparks overview | <https://uix.lf.technology/forge/sparks/> |
| Debugging guide | <https://uix.lf.technology/debugging/> |
| FAQ | <https://uix.lf.technology/faq> |
| UIX Guides (community tutorials) | <https://uix-guides.lf.technology> |
| GitHub repository | <https://github.com/Lint-Free-Technology/uix> |
| GitHub discussions | <https://github.com/Lint-Free-Technology/uix/discussions> |
