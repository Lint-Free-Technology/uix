import { LitElement } from "lit";
import { patch_element, patch_object } from "../helpers/patch_function";

class ConfigBadgeElementPatch extends LitElement {
  _uixData?;

  setConfig(_orig, config, ...rest) {
    const newConfig = JSON.parse(JSON.stringify(config));

    // Save uix config
    this._uixData = {
      uix: undefined,
      card_mod: undefined,
    };
    if (newConfig.uix) {
      this._uixData.uix = newConfig.uix;
    } else if (newConfig.card_mod) {
      this._uixData.card_mod = newConfig.card_mod;
    }
    delete newConfig.uix;
    delete newConfig.card_mod;

    _orig(newConfig, ...rest);
  }
}

@patch_element("hui-badge-element-editor")
class HuiBadgeElementEditorPatch extends LitElement {
  _configElement?: ConfigBadgeElementPatch;

  async getConfigElement(_orig, ...args) {
    const retval = await _orig(...args);

    patch_object(retval, ConfigBadgeElementPatch);

    return retval;
  }

  _configChanged(_orig, ev, ...rest) {
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