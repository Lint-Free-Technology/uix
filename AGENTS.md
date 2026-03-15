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

## Browser Console Debugging Helpers

UIX ships two functions attached to `window` for use in the browser DevTools console. Open DevTools, select an element in the **Elements** panel (it becomes `$0`), then call one of the helpers.

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

### `uix_path($0)` — specific helper

Reports the exact UIX path to the selected element and generates a ready-to-paste YAML snippet.

```js
uix_path($0)
```

| Section | What it shows |
|---------|---------------|
| 📦 **Closest UIX Parent** | Same as `uix_tree` |
| 📍 **UIX Path to Target** | The exact YAML style key (using `$` for shadow-root crossings) to reach `$0` |
| 🎨 **CSS Target** | Tag name, ID, classes, and a suggested CSS selector for `$0` |
| 📝 **Boilerplate UIX YAML** | A paste-ready card-level YAML snippet. Shown only for types that support a card-level `uix:` key. |
| 📝 **Boilerplate Theme YAML** | A paste-ready theme YAML snippet. Shown for all types. For theme-only types this is the only boilerplate shown; uses the `-yaml` variable variant when shadow-root crossings appear in the path. |

**Example output (selecting an `<h3>` inside a markdown card — shows both card and theme boilerplate):**

```
💡 UIX Path 💡
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
| Debugging guide | <https://uix.lf.technology/debugging/> |
| FAQ | <https://uix.lf.technology/faq> |
| UIX Guides (community tutorials) | <https://uix-guides.lf.technology> |
| GitHub repository | <https://github.com/Lint-Free-Technology/uix> |
| GitHub discussions | <https://github.com/Lint-Free-Technology/uix/discussions> |
