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
  _uixPendingOldHass: any = undefined;
  _uixFlushTimer: ReturnType<typeof setTimeout> | undefined = undefined;

  updated(_orig, changedProperties) {
    _orig?.(changedProperties);
    if (changedProperties.has("narrow") || 
        changedProperties.has("lovelace") ||
        changedProperties.has("index") ||
        changedProperties.has("_cards") ||
        changedProperties.has("_badges") ||
        changedProperties.has("_sections")) {
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
            // Throttled: save the old hass from before the throttle window
            // started (only on the first throttle). LitElement already stores
            // the latest hass even when shouldUpdate returns false, so we only
            // need the old value to pass to requestUpdate when flushing.
            if (this._uixFlushTimer === undefined) {
              this._uixPendingOldHass = oldHass;
            }
            // Reschedule the flush timer on every throttled call so it always
            // fires 50ms after the LAST throttled update, not the first.
            if (this._uixFlushTimer !== undefined) {
              clearTimeout(this._uixFlushTimer);
            }
            this._uixFlushTimer = setTimeout(() => {
              this._uixFlushTimer = undefined;
              const pendingOld = this._uixPendingOldHass;
              this._uixPendingOldHass = undefined;
              if (pendingOld !== undefined) {
                // this.hass is already the latest value; just trigger a render
                // by signalling the change from the pre-window old hass.
                (this as any).requestUpdate('hass', pendingOld);
              }
            }, throttleMs + 50);
            return false;
          }
          // Update is allowed through: record timestamp and cancel any pending flush.
          this._uixLastHassOnlyUpdate = now;
          this._uixPendingOldHass = undefined;
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
