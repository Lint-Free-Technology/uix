---
description: Learn about the background spark for UIX Forge — inject a rich background layer (colour, image, video, or live camera feed) behind any element inside a UIX Forge element.
icon: material/image-outline
---
# :material-image-outline: Background spark

The `background` spark places a styled background layer behind a target element inside a [UIX Forge](../index.md) forged element. The background container sits at `z-index: -1` so it is rendered below all sibling content without disrupting layout.

Supported background sources (first non-empty value wins):

| Source | Key | Description |
| ------ | --- | ----------- |
| Camera | `camera_entity` | Live `ha-camera-stream` stream. Supports zoom, pan, and position. Shows a spinner while loading. |
| Entity picture | `image_entity` | Reads `entity_picture` from any entity and signs the URL. Shows a spinner while loading. |
| Video | `video_url` | `<video>` element (autoplay, muted, loop). Supports `media-source://` URIs. |
| Image URL | `image_url` | Static image applied as `background-image`. Shows a spinner while loading. Supports `media-source://` URIs. |
| Solid colour or CSS shorthand | `background` | Any CSS `background` value, or a mapping of sub-properties. |

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
| `camera_entity` | string | — | Entity ID of a `camera.*` entity to stream live as the background. |
| `camera_zoom` | string or number | — | CSS zoom/scale value applied to the stream (e.g. `1.5`, `"150%"`). |
| `camera_pan_x` | string or number | — | CSS translate X applied to the stream (e.g. `"10%"`, `"-20px"`). |
| `camera_pan_y` | string or number | — | CSS translate Y applied to the stream. |
| `camera_position` | string | `center` | Alignment of the stream inside the container. One of `center`, `top`, `bottom`, `left`, `right`, `top-left`, `top-right`, `bottom-left`, `bottom-right`. |
| `camera_stream_cache_ms` | number | `20000` | How long (ms) to keep a `ha-camera-stream` element in the cache after it is removed from the background container. While cached, the element remains **connected** to an off-screen holder so its internal stream (MPEG/HLS/WebRTC session and auth tokens) stays alive. On the next rebuild with the same entity at the same dimensions the cached element is moved directly into the new background container without re-negotiating the stream. |
| `image_entity` | string | — | Entity ID whose `entity_picture` attribute provides the background image. |
| `video_url` | string | — | URL of a video to autoplay muted as the background. Accepts `media-source://` URIs (see [Media source URIs](#media-source-uris)). |
| `image_url` | string | — | URL of a static background image. Accepts `media-source://` URIs (see [Media source URIs](#media-source-uris)). |
| `background` | string or object | — | CSS `background` shorthand string, or a mapping of sub-properties (see below). |
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

### Media source URIs

`video_url` and `image_url` accept Home Assistant [media source](https://www.home-assistant.io/integrations/media_source/) URIs in the form `media-source://media_source/local/<filename>`. UIX resolves these automatically before setting the background using the HA WebSocket `media_source/resolve_media` command — no manual URL signing is needed.

Files placed in the `/media` directory of your HA instance are accessible as `media-source://media_source/local/<filename>`.

```yaml
# Image from the local media library
- type: background
  for: hui-tile-card $ ha-card
  image_url: "media-source://media_source/local/bedroom.jpg"

# Video from the local media library
- type: background
  for: hui-tile-card $ ha-card
  video_url: "media-source://media_source/local/ambient.mp4"
```

---

## ha-card adapter

When `for` resolves to an `ha-card` element, UIX automatically activates the **ha-card adapter**, which:

- Sets `border-radius: var(--ha-card-border-radius, var(--ha-border-radius-lg))` on the background container so it follows the card's rounded corners.
- Sets `margin: calc(-1 * var(--ha-card-border-width, 1px))` to compensate for the card border and ensure the background fills the full card area.
- Inserts the container into `ha-card`'s shadow root so it participates in the correct stacking context.

No extra configuration is needed — the adapter activates automatically when the resolved `for` element is `ha-card`.

---

## hui-section adapter

When `for` resolves to a `hui-section` element — which happens automatically when `mold: section` is used with no explicit `for` — UIX activates the **hui-section adapter**, which:

- Sets `padding: var(--ha-space-2)` on the background container to inset it from the section edges, matching the visual padding of the section.
- Sets `border-radius: var(--ha-section-border-radius, var(--ha-border-radius-xl))` on the background container so it follows the section's rounded corners.
- Applies `--ha-card-background: none` to the section element itself so that all cards within the section inherit a transparent card background, allowing the section background to show through.

```yaml
type: custom:uix-forge
forge:
  mold: section
  sparks:
    - type: background
      background:
        color: "rgba(0, 100, 200, 0.2)"
cards: []
```

No `for` is needed — when `mold: section` the default `for: element` resolves to the `hui-section` element and the adapter activates automatically.

---

## Examples

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

### Video from media library

```yaml
type: custom:uix-forge
forge:
  mold: card
  sparks:
    - type: background
      for: hui-tile-card $ ha-card
      video_url: "media-source://media_source/local/ambient.mp4"
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

### Image from media library

```yaml
type: custom:uix-forge
forge:
  mold: card
  sparks:
    - type: background
      for: hui-tile-card $ ha-card
      image_url: "media-source://media_source/local/bedroom.jpg"
      dissolve_target:
        - background: "none"
element:
  type: tile
  entity: light.bed_light
```

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

### Section background

```yaml
type: custom:uix-forge
forge:
  mold: section
  sparks:
    - type: background
      background:
        color: "rgba(0, 100, 200, 0.15)"
cards: []
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
