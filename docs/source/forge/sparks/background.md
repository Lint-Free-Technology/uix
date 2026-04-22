---
description: Learn about the background spark for UIX Forge — inject a rich background layer (colour, image, video, or live camera feed) behind any element inside a UIX Forge element.
icon: material/image-outline
---
# :material-image-outline: Background spark

The `background` spark places a styled background layer behind a target element inside a [UIX Forge](../index.md) forged element. The background container sits at `z-index: -1` so it is rendered below all sibling content without disrupting layout.

Supported background sources (first non-empty value wins):

| Source | Key | Description |
| ------ | --- | ----------- |
| Solid colour or CSS shorthand | `background` | Any CSS `background` value, or a mapping of sub-properties. |
| Image URL | `image_url` | Static image applied as `background-image`. Shows a spinner while loading. |
| Entity picture | `image_entity` | Reads `entity_picture` from any entity and signs the URL. Shows a spinner while loading. |
| Video | `video_url` | `<video>` element (autoplay, muted, loop). |
| Camera | `camera_entity` | Live `ha-camera-stream` stream. Supports zoom, pan, and position. Shows a spinner while loading. |

---

## Basic usage

```yaml
type: custom:uix-forge
forge:
  mold: card
  sparks:
    - type: background
      for: hui-tile-card $ ha-card
      background:
        color: "rgba(220, 53, 69, 0.6)"
      dissolve_target:
        - background: "none"
element:
  type: tile
  entity: light.bed_light
```

The `for` value accepts the same [DOM navigation syntax](../../concepts/dom.md) as UIX styles, including `$` for shadow-root crossings. Use `hui-tile-card $ ha-card` to target the card surface inside a tile card — the [ha-card adapter](#ha-card-adapter) then automatically applies matching `border-radius` and `margin` so the background follows the card's rounded corners.

---

## Configuration

| Key | Type | Default | Description |
| --- | ---- | ------- | ----------- |
| `type` | string | — | Must be `background`. |
| `for` | string | `element` | UIX selector for the target element. |
| `background` | string or object | — | CSS `background` shorthand string, or a mapping of sub-properties (see below). |
| `image_url` | string | — | URL of a static background image. |
| `image_entity` | string | — | Entity ID whose `entity_picture` attribute provides the background image. |
| `video_url` | string | — | URL of a video to autoplay muted as the background. |
| `camera_entity` | string | — | Entity ID of a `camera.*` entity to stream live as the background. |
| `camera_zoom` | string or number | — | CSS zoom/scale value applied to the stream (e.g. `1.5`, `"150%"`). |
| `camera_pan_x` | string or number | — | CSS translate X applied to the stream (e.g. `"10%"`, `"-20px"`). |
| `camera_pan_y` | string or number | — | CSS translate Y applied to the stream. |
| `camera_position` | string | `center` | Alignment of the stream inside the container. One of `center`, `top`, `bottom`, `left`, `right`, `top-left`, `top-right`, `bottom-left`, `bottom-right`. |
| `camera_stream_cache_ms` | number | `20000` | How long (ms) to keep a `ha-camera-stream` element in the cache after it is removed from the background container. While cached, the element remains **connected** to an off-screen holder so its internal stream (MPEG/HLS/WebRTC session and auth tokens) stays alive. On the next rebuild with the same entity at the same dimensions the cached element is moved directly into the new background container without re-negotiating the stream. |
| `opacity` | number | — | CSS `opacity` applied to the background container (0–1). Use this to dim the background without affecting the foreground element. |
| `dissolve_target` | string or list | — | Make the `for` element transparent so the background shows through (see below). |
| `class` | string | — | Extra CSS class(es) added to the background container `<div>`. |

### `background` sub-property mapping

When `background` is a mapping, each key is translated to its CSS property counterpart:

| Key | CSS property |
| --- | ------------ |
| `color` | `background-color` |
| `image` | `background-image` |
| `position` | `background-position` |
| `size` | `background-size` |
| `repeat` | `background-repeat` |
| `attachment` | `background-attachment` |
| `origin` | `background-origin` |
| `clip` | `background-clip` |

### `dissolve_target`

`dissolve_target` modifies the `for` element so that the background behind it becomes visible. Two forms are supported:

- **String `opacity_<0-100>`** — sets `opacity` on the `for` element (e.g. `opacity_50` for 50% opacity).
- **List of CSS property objects** — each object's key/value pair is applied as an inline style on the `for` element. Property names may use underscores in place of hyphens.

```yaml
# Remove the card's own background using a CSS property list
dissolve_target:
  - background: "none"

# Make the card 50% transparent
dissolve_target: opacity_50
```

---

## ha-card adapter

When `for` resolves to an `ha-card` element, UIX automatically activates the **ha-card adapter**, which:

- Sets `border-radius: var(--ha-card-border-radius, var(--ha-border-radius-lg))` on the background container so it follows the card's rounded corners.
- Sets `margin: calc(-1 * var(--ha-card-border-width, 1px))` to compensate for the card border and ensure the background fills the full card area.
- Inserts the container into `ha-card`'s shadow root so it participates in the correct stacking context.

No extra configuration is needed — the adapter activates automatically when the resolved `for` element is `ha-card`.

---

## Examples

### Solid colour background

```yaml
type: custom:uix-forge
forge:
  mold: card
  sparks:
    - type: background
      for: hui-tile-card $ ha-card
      background:
        color: "rgba(0, 100, 200, 0.4)"
      dissolve_target:
        - background: "none"
element:
  type: tile
  entity: light.bed_light
```

### Static image background

```yaml
type: custom:uix-forge
forge:
  mold: card
  sparks:
    - type: background
      for: hui-tile-card $ ha-card
      image_url: /local/images/bedroom.jpg
      dissolve_target:
        - background: "none"
element:
  type: tile
  entity: light.bed_light
```

### Entity picture as background

```yaml
type: custom:uix-forge
forge:
  mold: card
  sparks:
    - type: background
      for: hui-tile-card $ ha-card
      image_entity: person.alice
      dissolve_target:
        - background: "none"
element:
  type: tile
  entity: person.alice
```

### Video background

```yaml
type: custom:uix-forge
forge:
  mold: card
  sparks:
    - type: background
      for: hui-tile-card $ ha-card
      video_url: /local/videos/ambient.mp4
      dissolve_target:
        - background: "none"
element:
  type: tile
  entity: light.bed_light
```

### Live camera background

```yaml
type: custom:uix-forge
forge:
  mold: card
  sparks:
    - type: background
      for: hui-tile-card $ ha-card
      camera_entity: camera.front_door
      camera_zoom: 1.2
      camera_position: top
      dissolve_target:
        - background: "none"
element:
  type: tile
  entity: camera.front_door
```

### State-driven background colour using a template

All `forge` config values support Jinja2 templates. Use the `background` key together with a template to drive the colour from entity state:

```yaml
type: custom:uix-forge
forge:
  mold: card
  sparks:
    - type: background
      for: hui-tile-card $ ha-card
      background:
        color: >-
          {% if is_state(config.element.entity, 'on') %}
            rgba(255, 200, 0, 0.4)
          {% else %}
            rgba(100, 100, 100, 0.2)
          {% endif %}
      dissolve_target:
        - background: "none"
element:
  type: tile
  entity: light.bed_light
```

### Styling the background container with UIX

Use the `class` key to add a CSS class to the background container, then target it with a UIX style path:

```yaml
type: custom:uix-forge
forge:
  mold: card
  sparks:
    - type: background
      for: hui-tile-card $ ha-card
      image_url: /local/images/bedroom.jpg
      class: my-background
      dissolve_target:
        - background: "none"
  uix:
    style:
      "hui-tile-card $ ha-card $":
        ".my-background": |
          div {
            background-size: cover;
            background-position: center top;
            filter: blur(2px) brightness(0.7);
          }
element:
  type: tile
  entity: light.bed_light
```

!!! tip
    Use the [`uix_forge_path()`](../../concepts/dom.md#uix_forge_path0-forge-helper) browser console helper to find the exact `for` selector path to any element inside the forged card.
