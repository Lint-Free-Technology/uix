---
title: Frontend states throttling
description: Learn about how UIX can help tame your Home Assistant Frontend with Frontend states throttling
---
# Frontend states throttling

Home Assistant can be very chatty sending states to the Frontend, with no mechanism to control which states are sent. Therefore if you have a Bluetooth RSSI changing rapidly, it will send the state to the Frontend causing views to refresh. This can be problematic for slow devices or for busy Dashboard views. UIX provides Frontend states throttling which can be used to help mitigate issues caused by rapid state updates.

!!! info "What is throttled?"
    Only updates where `hass.states` has changed are throttled. All other `hass` changes — such as theme updates, localization, and connected user changes — always pass through immediately so the UI stays responsive.

## Enabling via the integration UI

Frontend states throttling is **disabled by default**. To enable it:

1. In Home Assistant, go to **Settings → Devices & Services → UI eXtension → Configure**.
2. Select **Performance settings** from the menu.
3. Toggle **Throttle entity state updates** on.
4. Set the **Throttle interval** — the minimum time (in milliseconds) between state-update re-renders. The default is `200 ms`. The valid range is 50–10,000 ms.
5. Save.

The setting takes effect immediately across all connected browser sessions — no page reload required.

## How it works

When throttling is enabled, UIX patches `hui-view` (the element that wraps every Home Assistant Dashboard) with a custom `shouldUpdate` guard. When entity states change more frequently than the configured interval, intermediate updates are suppressed.

### Flushing the last update

A suppressed (throttled) update is **never lost**. UIX reschedules a flush timer on every throttled call. The timer fires `throttle interval + 50 ms` after the **last** throttled update, and at that point the update is applied to the view — so the UI always converges to the latest known state.

When a natural (non-throttled) update is allowed through before the timer fires, the timer is cancelled and no extra render is triggered.

## Client-side override API

`window.uixCoordinator` exposes a `setThrottleOverride()` method that lets external integrations — such as [Browser Mod](https://github.com/thomasloven/hass-browser_mod) — apply **per-browser**, **per-user**, or **per-device** throttle settings without requiring a backend configuration change. For Browser Mod you would apply a [**Default action**](https://github.com/thomasloven/hass-browser_mod/blob/master/documentation/configuration-panel.md#default-action) javascript action.

The override takes precedence over the server-pushed integration config. Individual fields can be overridden independently; any field not specified in the override falls back to the server value.

```js
// Enable throttle with a 500 ms interval for this browser session:
window.uixCoordinator.setThrottleOverride({ enable: true, ms: 500 });

// Override only the interval (inherits the server enable/disable flag):
window.uixCoordinator.setThrottleOverride({ ms: 1000 });

// Remove the override and revert to server-configured defaults:
window.uixCoordinator.setThrottleOverride(null);
```

Because `hui-view` reads the coordinator values on every `shouldUpdate` call, the override takes effect immediately — no page reload required.

### Using with Browser Mod

Browser Mod lets you run JavaScript per browser session via [**Default action**](https://github.com/thomasloven/hass-browser_mod/blob/master/documentation/configuration-panel.md#default-action), making it a natural fit for per-device throttle overrides. For example, to apply a longer throttle interval on a slow wall-mounted tablet:

```yaml
# In your Browser Mod configuration for a specific browser ID:
- action: browser_mod.javascript
  code:
    window.uixCoordinator?.setThrottleOverride({ enable: true, ms: 1000 });
```

## Using with custom:button-card

[`custom:button-card`](https://github.com/custom-cards/button-card) can be used to add toggle buttons directly on a dashboard to enable, disable, or clear the throttle override at runtime — useful for testing or for dashboards that need dynamic control.

```yaml
# Enable throttling at 500 ms for this browser session:
type: custom:button-card
name: Enable Throttle
icon: mdi:speedometer
tap_action:
  action: javascript
  code: |
    window.uixCoordinator?.setThrottleOverride({ enable: true, ms: 500 });

---

# Disable throttling (clear override) for this browser session:
type: custom:button-card
name: Disable Throttle
icon: mdi:speedometer-slow
tap_action:
  action: javascript
  code: |
    window.uixCoordinator?.setThrottleOverride(null);
```

## Configuration reference

| Setting | Default | Description |
|---|---|---|
| Throttle entity state updates | Off | Enable/disable the states throttle globally. |
| Throttle interval | 200 ms | Minimum time between state-update re-renders. Range: 50–10,000 ms. |

## When to use throttling

Throttling is beneficial when:

- **Rapidly changing entities** (e.g. Bluetooth RSSI, energy monitoring sensors, weather sensors) cause the dashboard to feel sluggish or flicker.
- **Slow or low-powered devices** (wall tablets, older browsers) struggle to keep up with frequent re-renders.
- **Complex dashboards** with many cards or heavy UIX styling slow down noticeably during bursts of state updates.

!!! warning
    Setting the throttle interval too high can make dashboards feel unresponsive. A value of 200–500 ms is a good starting point. The flush mechanism ensures the final state is always rendered even if intermediate updates are suppressed. So if you toggle a sensor rapidly within the throttle time, the second update will not reflect until the throttle time plus 50ms has expired.
