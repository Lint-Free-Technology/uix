import { patch_element } from "../helpers/patch_function";
import { ModdedElement, apply_uix } from "../helpers/apply_uix";

/*
Patch ha-panel-app for theme styling.

This styles the Home Assistant app/ingress panel host only. The content of its
iframe deliberately remains out of scope: ingress apps do not have a common
root element or rendering lifecycle for UIX to target.
*/

@patch_element("ha-panel-app")
class HaPanelAppPatch extends ModdedElement {
  updated(_orig, ...args) {
    _orig?.(...args);
    apply_uix(this, "app", { prepend: true });
  }
}
