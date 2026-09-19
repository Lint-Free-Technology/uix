---
description: Learn how to style Home Assistant app and ingress panels.
---
# Styling app and ingress panels

!!! info
    app and ingress panel styling added in 8.3.0-beta.15

Home Assistant displays an individual app or ingress page in a
`<ha-panel-app>` element. Use the `uix-app` or `uix-app-yaml` theme key to
style that panel's open shadow root.

This is different from the installed-apps list at `/config/apps/installed`,
which belongs to the configuration panel and uses `uix-config`.

## Example

This example styles the panel header and places a non-interactive CRT overlay
above the ingress iframe:

```yaml
My theme:
  uix-theme: My theme

  uix-app: |
    :host {
      position: relative;
    }

    .header {
      background: #041b0b !important;
      color: #7cff88 !important;
    }

    :host::after {
      content: "";
      position: absolute;
      inset: 0;
      z-index: 1;
      pointer-events: none;
      background: repeating-linear-gradient(
        to bottom,
        rgb(124 255 136 / 8%) 0,
        rgb(124 255 136 / 8%) 1px,
        transparent 1px,
        transparent 3px
      );
    }
```

![App panel styling example](../assets/page-assets/using/app-panel-example.png){ width="450px" }

## Scope

`uix-app` styles the Home Assistant panel chrome and can overlay its iframe.
It does not style the document inside that iframe. Ingress applications do not
share a defined root element or rendering lifecycle, so iframe-content styling
is a separate capability.
