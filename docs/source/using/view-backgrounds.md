---
description: Learn how to display a full-screen camera stream, video, or image as a view background using UIX theme CSS variables.
---
# View Backgrounds

!!! note
    View backgrounds available in 6.3.0-beta.6

UIX can display a full-screen **camera stream**, **video**, or **image** as a background behind your Home Assistant dashboard views and config panels.  The background is controlled entirely through CSS variables set in your theme and supports Jinja2 templates, so you can switch sources per view without any custom code.

!!! info "How it works"
    The `ha-drawer` styling patch also controls the view background, which allows the feature to work in dashboard views *and* config panels.  Variables must be set on `:host` inside the `uix-drawer` theme key so they are readable via `getComputedStyle(ha-drawer)`.  Because `ha-drawer` persists across navigation, the background element is **reused** when navigating between views with the same  / video / image — no teardown/recreate cycle.

## CSS variables

| Variable | Description |
|---|---|
| `--uix-view-background-camera-entity` | Camera entity ID — UIX renders a muted `ha-camera-stream` which manages all stream connection and any authentication. |
| `--uix-view-background-image-entity` | Any entity with `entity_picture` — UIX manages any URL authentication and renders a cover-sized background image |
| `--uix-view-background-video` | Plain video URL — UIX renders a `<video autoplay muted loop playsinline>` |
| `--uix-view-background-image` | Plain image URL — UIX renders a cover-sized CSS `background-image` |
| `--uix-view-background-cover` | `view` (default) or `full` — controls viewport coverage (see [below](#coverage-modes)) |

**Priority order**: `camera-entity` → `image-entity` → `video` → `image`.  All four slots can be active simultaneously as independent layers.

!!! tip
    You don't need to include `url()` around any of the CSS variables to use view backgrounds. `url()` will be added if and when required.

## Coverage modes

The `--uix-view-background-cover` variable controls how much of the viewport the background fills.

| Value | Description |
|---|---|
| `view` *(default)* | Background fills only the **content area** — offset below the top bar (`--header-height`) and to the right of the sidebar.  The offset adjusts automatically when the sidebar is resized or toggled. NOTE: For any config panels like developer tools which have double header height, the view will not compensate beyond `--header-height`. |
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

As the `uix-drawer` style supports Jinja2 templates and the `panel` template variable reflects the current view, you can switch the background source automatically:

```yaml
my-theme:
  uix-theme: my-theme
  uix-drawer: |
    :host {
      {%- if panel.viewUrlPath == 'garage' -%}
      --uix-view-background-camera-entity: camera.garage
      {%- elif panel.viewUrlPath == 'driveway' -%}
      --uix-view-background-camera-entity: camera.driveway
      {%- endif -%};
      --uix-view-background-cover: view;
    }
```

See [Templates](./templates.md) for full template variable documentation.

!!! tip "Use template debug to check variables"
    To check what `panel` variables are available for your template, you can use a template in your theme with UIX debug and a CSS comment. Look for `UIX: Template updated` in your Browser console and drill down to `variables` and then `panel`.
    ```yaml
    uix-drawer: |
      {# uix.debug #}
      {{ '/* testing */' }}
    ```

## Styling the background with `uix-view-background`

UIX styling for the view background is available using the theme variables `uix-view-background`.  This lets you style the background content using the `uix-view-background` theme key — exactly like any other UIX theme target.

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

If you wish to adjust position or other attributes of the view background you can adjust the host container display parameters and also the displayed element. The displayed element will be per the table below.

| Type | Element |
| - | - |
| Camera entity | `ha-camera-stream` |
| Entity image | `div.uix-bg-image` |
| Video | `video` |
| Image | `div.uix-bg-image` |

Center a camera view vertically:

```yaml
  uix-view-background: |
    :host {
      display: flex;
      align-items: center;
    }
    ha-camera-stream {
      height: unset !important;
    }
```

### Customising image background CSS properties

Both **entity image** and **plain image** backgrounds render as a `<div class="uix-bg-image">`.  The div defaults to `background-size: cover; background-position: center; background-repeat: no-repeat`.  You can override any of these properties — or add new ones — via the `.uix-bg-image` selector:

```yaml
my-theme:
  uix-theme: my-theme
  uix-drawer: |
    :host {
      --uix-view-background-image: /local/background.png;
    }
  uix-view-background: |
    :host { opacity: 0.8; }

    /* Tile the image instead of stretching it to cover */
    .uix-bg-image {
      background-size: 300px 300px !important;
      background-repeat: repeat !important;
      background-position: top left !important;
    }
```

## Making top app bar and sidebar transparent

You can use UIX styling on `uix-top-app-bar-fixed` to make the top app bar and sidebar transparent. Further config panels may have their own toolbars which you may also need to style via `uix-config`.

[Example](https://github.com/ngocjohn/hass-config/blob/40288532f57eacbbf9dd38b14f20b31ea615a9f5/config/themes/graphite-auto.yaml#L758-L768) as shared by `@ngocjohn` on Home Assistant Community Forum.

```yaml
  uix-top-app-bar-fixed: |
    :host {
      --mdc-top-app-bar-fixed-box-shadow: none;
      --sidebar-background-color: #ffffff00;
      --app-header-background-color: #ffffff00;
      --app-header-backdrop-filter: blur(2em);
      --app-header-border-bottom: none;
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
      width: 120px;
      height: 120px;
    }

    /* Change spinner colour to match your theme */
    .uix-spinner::after {
      border-color: rgba(0, 128, 255, 0.2);
      border-top-color: rgba(0, 128, 255, 0.9);
    }
```

## Tab visibility recovery

Browsers suspend WebRTC/HLS streams and video playback when a tab is in the background for a long time.  UIX automatically recreates camera stream and video elements when you return to the tab, recovering the stream or playback without any manual intervention.

Static image backgrounds are not affected.
