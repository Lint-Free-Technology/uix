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
        if (oldHass?.entities !== newHass?.entities) {
          const now = Date.now();
          if (now - this._uixLastHassOnlyUpdate < coordinator.hassThrottleMs) {
            return false;
          }
          this._uixLastHassOnlyUpdate = now;
        }
      }
    }
    return _orig ? _orig(...args) : true;
  }
}
