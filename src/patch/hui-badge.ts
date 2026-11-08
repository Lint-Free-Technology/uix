import { patch_element } from "../helpers/patch_function";
import { ModdedElement, apply_uix } from "../helpers/apply_uix";
import {
  applyElementConfigDefaults,
  registerElementConfigRebuild,
} from "../helpers/element-config";

const EXCLUDED_BADGES = [
  "entity-filter",
];

@patch_element("hui-badge")
class HuiBadgePatch extends ModdedElement {
  _element: ModdedElement;
  config;
  _uixElementConfigSource;
  _uixElementConfigGenerated;
  _uixElementConfigRefresh = false;

  _applyElementConfigDefaults() {
    if (this.config !== this._uixElementConfigGenerated) {
      this._uixElementConfigSource = this.config;
    }
    registerElementConfigRebuild(this, (host: any) => {
      host._uixElementConfigRefresh = true;
      if (host._element) host._updateElement();
      else host._loadElement();
    });
    if (this.config === this._uixElementConfigSource || this._uixElementConfigRefresh) {
      const generatedConfig = applyElementConfigDefaults("badge", this._uixElementConfigSource);
      this._uixElementConfigGenerated = generatedConfig;
      this.config = generatedConfig;
      this._uixElementConfigRefresh = false;
    }
  }

  async _add_uix() {
    if (!this._element) return;
    if (EXCLUDED_BADGES.includes(this.config?.type?.toLowerCase())) return;
    
    const cls = `type-${this.config?.type?.replace?.(":", "-")}`;

    await apply_uix(
      this._element,
      "badge",
      this.config?.uix ?? this.config?.card_mod,
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
