---
title: Dialog styling delay
description: Learn how UIX can delay applying dialog styles until after a dialog is fully shown, reducing visual flicker and animation artifacts
---
# Dialog styling delay

!!! note
    Dialog styling delay available in 7.1.0-beta.1

By default, UIX applies styles to dialogs as soon as they are opened. On some devices this can produce a brief visual flicker as the styles are applied mid-animation causing Browser repaint during animation. UIX provides a **dialog styling delay** option that defers style application until after the dialog's open animation completes, eliminating any flicker or animation artifacts.

## Enabling via the integration UI

The dialog styling delay is **disabled by default**. To enable it:

1. In Home Assistant, go to **Settings → Devices & Services → UI eXtension → Configure**.
2. Select **Performance settings** from the menu.
3. Toggle **Delay UIX styling for dialogs until fully shown** on.
4. Save.

The setting takes effect immediately across all connected browser sessions — no page reload required.

## How it works

When the delay is enabled, UIX listens for the `after-show` event fired by Home Assistant dialogs once their open animation has completed. Styles are only applied at that point rather than immediately when the dialog is opened, which prevents mid-animation style recalculations that can cause animation flicker.

!!! info
    The need for delaying UIX styling for dialogs may be Browser dependent. Safari / WebKit devices, particularly iOS seem to suffer more from the issue of applying dialog styles without delay.

## Client-side override API

`window.uixCoordinator` exposes a `setDialogApplyAfterShowOverride()` method that lets external integrations — such as [Browser Mod](https://github.com/thomasloven/hass-browser_mod) — apply **per-browser**, **per-user**, or **per-device** settings without requiring a backend configuration change. For Browser Mod you would apply a [**Default action**](https://github.com/thomasloven/hass-browser_mod/blob/master/documentation/configuration-panel.md#default-action) javascript action.

The override takes precedence over the server-pushed integration config.

```js
// Enable the delay for this browser session:
window.uixCoordinator.setDialogApplyAfterShowOverride(true);

// Disable the delay for this browser session:
window.uixCoordinator.setDialogApplyAfterShowOverride(false);

// Remove the override and revert to server-configured defaults:
window.uixCoordinator.setDialogApplyAfterShowOverride(null);
```

Because `ha-dialog` and `ha-more-info-dialog` read the coordinator value when a dialog opens, the override takes effect immediately for the next dialog opened — no page reload required.

### Using with Browser Mod

Browser Mod lets you run JavaScript per browser session via [**Default action**](https://github.com/thomasloven/hass-browser_mod/blob/master/documentation/configuration-panel.md#default-action), making it a natural fit for per-device overrides. For example, to enable the delay on a slow wall-mounted tablet:

```yaml
# In your Browser Mod configuration for a specific browser ID:
- action: browser_mod.javascript
  code:
    window.uixCoordinator?.setDialogApplyAfterShowOverride(true);
```

### Using with custom:button-card

[`custom:button-card`](https://github.com/custom-cards/button-card) can be used to add a toggle button directly on a dashboard to enable or disable the delay at runtime.

```yaml
# Enable the dialog styling delay for this browser session:
type: custom:button-card
name: Enable Dialog Delay
icon: mdi:timer-play-outline
tap_action:
  action: javascript
  javascript: |
    [[[ window.uixCoordinator?.setDialogApplyAfterShowOverride(true); ]]]

---

# Disable the dialog styling delay for this browser session:
type: custom:button-card
name: Disable Dialog Delay
icon: mdi:timer-off-outline
tap_action:
  action: javascript
  javascript: |
    [[[ window.uixCoordinator?.setDialogApplyAfterShowOverride(false); ]]]
```

??? example "Full toggle example"
    ```yaml
    type: custom:button-card
    grid_options:
      rows: 2
      columns: 6
    section_mode: true
    update_timer: 500ms
    variables:
      dialogApplyAfterShow: |
        [[[ return window.uixCoordinator?.dialogApplyAfterShow; ]]]
    styles:
      card:
        - "--dialog-icon-color": >
            [[[ return variables.dialogApplyAfterShow ? "var(--state-active-color)"
            : "var(--state-inactive-color)"; ]]]
        - "--ha-ripple-hover-color": >
            [[[ return variables.dialogApplyAfterShow ? "var(--state-active-color)"
            : "var(--state-inactive-color)"; ]]]
    name: >
      [[[ return variables.dialogApplyAfterShow ? "UIX Dialog Delay ON" : "UIX
      Dialog Delay OFF"; ]]]
    icon: >
      [[[ return variables.dialogApplyAfterShow ? "mdi:timer-play-outline" :
      "mdi:timer-off-outline"; ]]]
    color: var(--dialog-icon-color)
    tap_action:
      action: javascript
      javascript: >
        [[[ variables.dialogApplyAfterShow ?
        window.uixCoordinator?.setDialogApplyAfterShowOverride(false) :
        window.uixCoordinator?.setDialogApplyAfterShowOverride(true); ]]]
    ```

## Configuration reference

| Setting | Default | Description |
|---|---|---|
| Delay UIX styling for dialogs until fully shown | Off | When enabled, UIX applies dialog styles after the open animation completes rather than immediately. |

## When to use the dialog styling delay

The delay is beneficial when:

- Dialogs show a **brief flash or animation artifacts** like may be seen with the bottom sheet dialog variant.
- You are on a **slow or low-powered device** where style calculations during the open animation are noticeable.

!!! warning
    Enabling dialog styling delay option means styles are applied slightly later than normal. On fast devices, the difference will likely be minor, but on very slow devices there may be a noticeable delay. If some devices need this option enabled and others do not, consider using Browser Mod with Default action to set the override via JavaScript.
