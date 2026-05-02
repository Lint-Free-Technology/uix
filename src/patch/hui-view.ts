import { ModdedElement, apply_uix } from "../helpers/apply_uix";
import { patch_element } from "../helpers/patch_function";
import { PropertyValueMap } from "lit";

/*
Patch hui-view for theme styling

There is no style passed to apply_uix here, everything comes only from themes.

*/

@patch_element("hui-view")
class HuiViewPatch extends ModdedElement {
  _uixLastHassOnlyUpdate = 0;
  _uixPendingHass: any = undefined;
  _uixFlushTimer: ReturnType<typeof setTimeout> | undefined = undefined;

  updated(_orig, changedProperties) {
    _orig?.(changedProperties);
    if (changedProperties.has("narrow") || 
        changedProperties.has("lovelace") ||
        changedProperties.has("index")) {
      apply_uix(this, "view", undefined, {}, false);
    }
  }

  shouldUpdate(_orig, ...args): boolean {
    const _changedProperties = args[0] as PropertyValueMap<any> | undefined;
    if (_changedProperties?.size === 1 && _changedProperties.has("hass")) {
      const coordinator = (window as any).uixCoordinator;
      if (coordinator?.hassThrottleEnable) {
        const oldHass = _changedProperties.get("hass");
        const newHass = (this as any).hass;
        // Only throttle when entity states changed, so that other hass changes
        // (themes, localize, etc.) always pass through immediately.
        if (oldHass?.states !== newHass?.states) {
          const now = Date.now();
          const elapsed = now - this._uixLastHassOnlyUpdate;
          const throttleMs = coordinator.hassThrottleMs;
          if (elapsed < throttleMs) {
            // Throttled: always save the LATEST hass so the flush applies the
            // most recent state, not the first one in the throttle window.
            this._uixPendingHass = newHass;
            // Reschedule the flush timer on every throttled call so it always
            // fires 50ms after the LAST throttled update, not the first.
            if (this._uixFlushTimer !== undefined) {
              clearTimeout(this._uixFlushTimer);
            }
            this._uixFlushTimer = setTimeout(() => {
              this._uixFlushTimer = undefined;
              if (this._uixPendingHass !== undefined) {
                const pending = this._uixPendingHass;
                this._uixPendingHass = undefined;
                (this as any).hass = pending;
              }
            }, throttleMs + 50);
            return false;
          }
          // Update is allowed through: record timestamp and cancel any pending flush.
          this._uixLastHassOnlyUpdate = now;
          this._uixPendingHass = undefined;
          if (this._uixFlushTimer !== undefined) {
            clearTimeout(this._uixFlushTimer);
            this._uixFlushTimer = undefined;
          }
        }
      }
    }
    return _orig ? _orig(...args) : true;
  }
}
