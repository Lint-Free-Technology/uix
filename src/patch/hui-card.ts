import { patch_element } from "../helpers/patch_function";

import { apply_uix } from "../helpers/apply_uix";
import { ModdedElement } from "../helpers/apply_uix";

const EXCLUDED_CARDS = [
  "conditional",
  "entity-filter",
];
@patch_element("hui-card")
class HuiCardPatch extends ModdedElement {
  _uix = [];
  _element: ModdedElement;
  config;

  async _add_uix() {
    if (!this._element) return;
    if (EXCLUDED_CARDS.includes(this.config?.type?.toLowerCase())) return;

    const element = this._element as any;
    let config;
    // First look in card's config which may have merged templates which hui-card will not have
    // hui-card's _loadElement will have called card's setConfig so as long as any template loading 
    // is done sync then merged config should be available on element's config
    config = element?.config || element?._config;
    if (!config?.uix && !config?.card_mod) {
      // Then take hui-card config
      config = this.config;
    }
    // Take class type always from hui-card as card's config may not have type
    const cls = `type-${this.config?.type?.replace?.(":", "-")}`;

    await apply_uix(
      this._element,
      "card",
      config?.uix ?? config?.card_mod,
      { config },
      true,
      cls
    );
  }

  _loadElement(_orig, ...args) {
    _orig?.(...args);
    this._add_uix();
  }
}
