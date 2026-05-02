import { ModdedElement, apply_uix } from "../helpers/apply_uix";
import { patch_element } from "../helpers/patch_function";

/*
Patch hui-view for theme styling

There is no style passed to apply_uix here, everything comes only from themes.

*/

@patch_element("hui-view")
class HuiViewPatch extends ModdedElement {
  updated(_orig, changedProperties) {
    _orig?.(changedProperties);
    if (changedProperties.has("narrow") || 
        changedProperties.has("lovelace") ||
        changedProperties.has("index")) {
      apply_uix(this, "view", undefined, {}, false);
    }
  }
}
