import { patch_element } from "../helpers/patch_function";
import { ModdedElement, apply_uix } from "../helpers/apply_uix";

/*
Patch ha-panel-history for theme styling, state-history-charts is also patched as
it will not exist when no history elements are selected so styling from ha-panel-history may not work.

There is no style passed to apply_uix here, everything comes only from themes.
*/

@patch_element("ha-panel-history")
class HaPanelHistoryPatch extends ModdedElement {
  updated(_orig, ...args) {
    _orig?.(...args);
    apply_uix(this, "history", { prepend: true });
  }
}

@patch_element("state-history-charts")
class StateHistoryChartsPatch extends ModdedElement {
  updated(_orig, ...args) {
    _orig?.(...args);
    apply_uix(this, "state-history-charts", { prepend: true });
  }
}
