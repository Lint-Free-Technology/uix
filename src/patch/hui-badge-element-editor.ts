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

  _valueChanged(_orig, ev, ...rest) {
    const uixData = this._uixData;
    if (uixData && (uixData.uix)) {
      ev.detail.value.uix = uixData.uix;
    }
    if (uixData && uixData.card_mod) {
      ev.detail.value.card_mod = uixData.card_mod;
    }
    _orig(ev, ...rest);
  }
}

@patch_element("hui-badge-element-editor")
class HuiBadgeElementEditorPatch extends LitElement {
  _configElement?: ConfigBadgeElementPatch;
  value?: any;

  /**
   * Badge visibility belongs to the Forge wrapper, not its Native badge.
   * Keep the containing Home Assistant editor from exposing a competing tab.
   */
  _handleTabChanged(_orig, event: CustomEvent, ...rest) {
    if (this.value?.type === "custom:uix-forge" && ["visibility", "layout"].includes(event.detail?.name)) {
      event.stopPropagation();
      return;
    }
    return _orig?.(event, ...rest);
  }

  updated(_orig, ...args) {
    _orig?.(...args);
    const blockOuterTabs = this.value?.type === "custom:uix-forge";
    this.renderRoot?.querySelectorAll<HTMLElement>("ha-tab-group-tab[panel=visibility], ha-tab-group-tab[panel=layout]")
      .forEach((tab) => tab.toggleAttribute("hidden", blockOuterTabs));
  }

  async getConfigElement(_orig, ...args) {
    const retval = await _orig(...args);

    patch_object(retval, ConfigBadgeElementPatch);

    return retval;
  }

}
