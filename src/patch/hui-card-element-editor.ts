import { LitElement } from "lit";
import { patch_element, patch_object } from "../helpers/patch_function";

class ConfigCardElementPatch extends LitElement {
  _uixData?;
  _config?;

  setConfig(_orig, config, ...rest) {
    const newConfig = JSON.parse(JSON.stringify(config));

    // Save uix config
    this._uixData = {
      uix: undefined,
      card_mod: undefined,
      entities: [],
    };
    if (newConfig.uix) {
      this._uixData.uix = newConfig.uix;
    } else if (newConfig.card_mod) {
      this._uixData.card_mod = newConfig.card_mod;
    }
    delete newConfig.uix;
    delete newConfig.card_mod;

    // Save uix config for individual entities
    if (Array.isArray(newConfig.entities)) {
      for (const [i, e] of newConfig.entities?.entries?.()) {
        this._uixData.entities[i] = { uix: undefined, card_mod: undefined };
        if (e.uix) {
          this._uixData.entities[i].uix = e.uix;
        } else if (e.card_mod) {
          this._uixData.entities[i].card_mod = e.card_mod;
        }
        delete e.uix;
        delete e.card_mod;
      }
    }

    _orig(newConfig, ...rest);

    // Home Assistant cards may migrate their config, 
    // so we need to restore UIX config to that config and not the newConfig we just created. 
    // This is why we use this._config instead of newConfig.
    const newConfigAfter = (this._config ?? newConfig);

    // Restore UIX config for entities
    if (Array.isArray(newConfigAfter.entities)) {
      for (const [i, e] of newConfigAfter.entities?.entries?.()) {
        if (this._uixData?.entities[i]?.uix) {
          e.uix = this._uixData.entities[i].uix;
        }
        if (this._uixData?.entities[i]?.card_mod) {
          e.card_mod = this._uixData.entities[i].card_mod;
        }
      }
    }
  }
}

@patch_element("hui-card-element-editor")
class HuiCardElementEditorPatch extends LitElement {
  _configElement?: ConfigCardElementPatch;
  value?: any;
  showVisibilityTab?: boolean;
  sectionConfig?: any;

  /**
   * Forge owns outer visibility and grid layout through forge.hidden and
   * forge.grid_options. Do not let the containing HA card editor expose its
   * own tabs for those same outer values.
   */
  renderConfigElement(_orig, ...args) {
    if (this.value?.type !== "custom:uix-forge") return _orig?.(...args);

    // Shadow Lit's reactive accessors for the duration of the synchronous
    // render. Assigning the public properties directly would schedule another
    // update and make the suppress/restore cycle render forever.
    const shadow = (property: string, value: any) => {
      const own = Object.getOwnPropertyDescriptor(this, property);
      Object.defineProperty(this, property, {
        configurable: true,
        enumerable: own?.enumerable ?? true,
        writable: true,
        value,
      });
      return own;
    };
    const showVisibilityTab = shadow("showVisibilityTab", false);
    const sectionConfig = shadow("sectionConfig", undefined);
    try {
      return _orig?.(...args);
    } finally {
      if (showVisibilityTab) Object.defineProperty(this, "showVisibilityTab", showVisibilityTab);
      else delete (this as any).showVisibilityTab;
      if (sectionConfig) Object.defineProperty(this, "sectionConfig", sectionConfig);
      else delete (this as any).sectionConfig;
    }
  }

  async getConfigElement(_orig, ...args) {
    const retval = await _orig(...args);

    patch_object(retval, ConfigCardElementPatch);

    return retval;
  }

  _handleUIConfigChanged(_orig, ev, ...rest) {
    const uixData = this._configElement?._uixData;
    if (uixData && (uixData.uix)) {
      ev.detail.config.uix = uixData.uix;
    }
    if (uixData && uixData.card_mod) {
      ev.detail.config.card_mod = uixData.card_mod;
    }
    _orig(ev, ...rest);
  }

}
