import { patch_element } from "../helpers/patch_function";
import { ModdedElement, apply_uix} from "../helpers/apply_uix";
import { selectTree } from "../helpers/selecttree";
import { PropertyValueMap } from "lit";

/*
Patch hui-root for theme styling

There is no style passed to apply_uix here, everything comes only from themes.
*/

// Throttle interval for hass-only updates (ms)
const HASS_THROTTLE_MS = 200;

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
    if (_changedProperties.size === 1 && _changedProperties.has("hass")) {
      const now = Date.now();
      if (now - this._uixLastHassOnlyUpdate < HASS_THROTTLE_MS) {
        return false;
      }
      this._uixLastHassOnlyUpdate = now;
    } else {
      // Non-hass change: reset the timer so the next hass-only update is not
      // incorrectly throttled relative to a potentially long-ago hass update.
      this._uixLastHassOnlyUpdate = 0;
    }
    return _orig ? _orig(...args) : true;
  }
}
