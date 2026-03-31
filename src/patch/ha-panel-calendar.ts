import { patch_element } from "../helpers/patch_function";
import { ModdedElement, apply_uix } from "../helpers/apply_uix";

/*
Patch ha-panel-calendar for theme styling

There is no style passed to apply_uix here, everything comes only from themes.
*/

@patch_element("ha-panel-calendar")
class HaPanelCalendarPatch extends ModdedElement {
  updated(_orig, ...args) {
    _orig?.(...args);
    apply_uix(this, "calendar", { prepend: true });
  }
}
