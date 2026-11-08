import { patch_element, patch_object } from "../helpers/patch_function";

import { apply_uix } from "../helpers/apply_uix";
import { ModdedElement } from "../helpers/apply_uix";
import {
  applyElementConfigDefaults,
  registerElementConfigRebuild,
} from "../helpers/element-config";

@patch_element("hui-heading-badge")
class HuiBadgePatch extends ModdedElement {
  _element: ModdedElement;
  config;
  _uixElementConfigSource;
  _uixElementConfigRefresh = false;

  _applyElementConfigDefaults() {
    this._uixElementConfigSource ??= this.config;
    registerElementConfigRebuild(this, (host: any) => {
      host._uixElementConfigRefresh = true;
      if (host._element) host._updateElement();
      else host._loadElement();
    });
    if (this.config === this._uixElementConfigSource || this._uixElementConfigRefresh) {
      this.config = applyElementConfigDefaults("heading-badge", this._uixElementConfigSource);
      this._uixElementConfigRefresh = false;
    }
  }

  async _add_uix() {
    if (!this._element) return;
    
    const cls = `type-${this.config?.type?.replace?.(":", "-")}`;

    await apply_uix(
      this._element,
      "heading-badge",
      this.config.uix ?? this.config.card_mod,
      { config: this.config },
      true,
      cls
    );
    this._uix = this._element._uix;
  }

  _loadElement(_orig?, ...args) {
    this._applyElementConfigDefaults();
    _orig?.(...args);
    this._add_uix();
  }

  _updateElement(_orig?, ...args) {
    this._applyElementConfigDefaults();
    _orig?.(...args);
    this._add_uix();
  }
}
