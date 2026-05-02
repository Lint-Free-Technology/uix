import { patch_element } from "../helpers/patch_function";
import { ModdedElement, apply_uix} from "../helpers/apply_uix";
import { selectTree } from "../helpers/selecttree";
import { PropertyValueMap } from "lit";

/*
Patch hui-root for theme styling

There is no style passed to apply_uix here, everything comes only from themes.
*/

// hui-root may have been used before the patch was applied
const apply = () => {
  selectTree(
    document,
    "home-assistant$home-assistant-main$partial-panel-resolver ha-panel-lovelace$hui-root",
    false
  ).then((root) => root?.firstUpdated());
};

@patch_element("hui-root", apply)
class HuiRootPatch extends ModdedElement {
  _uixLastHassOnlyUpdate = 0;

  firstUpdated(_orig, ...args) {
    _orig?.(...args);
    apply_uix(this, "root");
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
