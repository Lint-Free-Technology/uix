---
description: Learn how to display a full-screen camera stream, video, or image as a view background using UIX theme CSS variables.
---
# View Backgrounds

UIX can display a full-screen **camera stream**, **video**, or **image** as a background behind your Home Assistant views and config panels.  The background is controlled entirely through CSS variables set in your theme and supports Jinja2 templates, so you can switch sources per view without any custom code.

!!! info "How it works"
    UIX attaches the background to `ha-drawer`, which wraps all content in Home Assistant (Lovelace views *and* config panels).  Variables must be set on `:host` inside the `uix-drawer` theme key so they are readable via `getComputedStyle(ha-drawer)`.  Because `ha-drawer` persists across navigation, the background element is **reused** when navigating between views with the same camera — no teardown/recreate cycle.

## CSS variables

| Variable | Description |
|---|---|
| `--uix-view-background-camera-entity` | Camera entity ID — UIX renders a muted `ha-camera-stream` |
| `--uix-view-background-image-entity` | Any entity with `entity_picture` — UIX signs and renders the URL as a cover-sized background image |
| `--uix-view-background-video` | Plain video URL — UIX renders a `<video autoplay muted loop playsinline>` |
| `--uix-view-background-image` | Plain image URL — UIX renders a cover-sized CSS `background-image` |
| `--uix-view-background-cover` | `view` (default) or `full` — controls viewport coverage (see [below](#coverage-modes)) |

**Priority order**: `camera-entity` → `image-entity` → `video` → `image`.  All four slots can be active simultaneously as independent layers.

## Coverage modes

The `--uix-view-background-cover` variable controls how much of the viewport the background fills.

| Value | Description |
|---|---|
| `view` *(default)* | Background fills only the **content area** — offset below the top bar (`--header-height`) and to the right of the sidebar.  The offset adjusts automatically when the sidebar is resized or toggled. |
| `full` | Background fills the **entire viewport**, sitting behind the top bar and sidebar. |

## Basic examples

### Camera stream background

```yaml
my-theme:
  uix-theme: my-theme
  uix-drawer: |
    :host {
      --uix-view-background-camera-entity: camera.garden;
      --uix-view-background-cover: view;
    }
  uix-view-background: |
    :host { opacity: 0.7; }
```

### Video background

```yaml
my-theme:
  uix-theme: my-theme
  uix-drawer: |
    :host {
      --uix-view-background-video: /local/background.mp4;
      --uix-view-background-cover: full;
    }
  uix-view-background: |
    :host { opacity: 0.5; }
```

### Image background

```yaml
my-theme:
  uix-theme: my-theme
  uix-drawer: |
    :host {
      --uix-view-background-image: /local/background.jpg;
      --uix-view-background-cover: view;
    }
```

## Switching per view with templates

Because the `uix-drawer` style supports Jinja2 templates and the `panel` template variable reflects the current view, you can switch the background source automatically:

```yaml
my-theme:
  uix-theme: my-theme
  uix-drawer: |
    :host {
      --uix-view-background-camera-entity:
        {% if panel.viewUrlPath == 'garage' %}camera.garage
        {% elif panel.viewUrlPath == 'driveway' %}camera.driveway
        {% endif %};
      --uix-view-background-cover: view;
    }
```

See [Templates](./templates.md) for full template variable documentation.

## Styling the background with `uix-view-background`

UIX injects a `uix-node` into each background container's shadow root.  This lets you style the background content using the `uix-view-background` theme key — exactly like any other UIX theme target.

Common uses include opacity, grayscale, blur, and brightness:

```yaml
my-theme:
  uix-theme: my-theme
  uix-drawer: |
    :host {
      --uix-view-background-camera-entity: camera.garden;
    }
  uix-view-background: |
    :host {
      opacity: 0.6;
      filter: grayscale(30%) blur(2px);
    }
```

## Loading spinner

While the media is loading UIX shows a CSS-only animated spinner centred on the background container.  The spinner fades out automatically once the media is ready (camera stream starts playing, video can play, or image has loaded).

The spinner can be customised via `uix-view-background` — it uses the class `.uix-spinner` (the track ring) and the pseudo-element `.uix-spinner::after` (the animated arc).

```yaml
my-theme:
  uix-theme: my-theme
  uix-drawer: |
    :host {
      --uix-view-background-image: /local/background.jpg;
    }
  uix-view-background: |
    :host { opacity: 0.7; }

    /* Make the spinner larger */
    .uix-spinner::after {
      width: 80px;
      height: 80px;
    }

    /* Change spinner colour to match your theme */
    .uix-spinner::after {
      border-color: rgba(0, 128, 255, 0.2);
      border-top-color: rgba(0, 128, 255, 0.9);
    }
```

## Tab visibility recovery

Browsers suspend WebRTC/HLS streams and video playback when a tab is backgrounded for a long time.  UIX automatically recreates camera stream and video elements when you return to the tab, recovering the stream or playback without any manual intervention.

Static image backgrounds are not affected.
