import { ModdedElement, apply_uix } from "../helpers/apply_uix";
import { patch_element, patch_object } from "../helpers/patch_function";
import { await_element } from "../helpers/selecttree";
import {
  applyElementConfigDefaults,
  hasElementConfigDefaults,
  registerElementConfigRebuild,
} from "../helpers/element-config";

function applyPictureElementConfigDefaults(config: any): any {
  if (!hasElementConfigDefaults()) return config;
  if (!config || !Array.isArray(config.elements)) return config;
  let elements = config.elements;
  for (let i = 0; i < config.elements.length; i++) {
    const element = applyElementConfigDefaults("element", config.elements[i]);
    if (element !== config.elements[i]) {
      if (elements === config.elements) elements = [...config.elements];
      elements[i] = element;
    }
  }
  return elements === config.elements ? config : { ...config, elements };
}

/*
Patch the hui-picture-elements-card specifically in order to handle individual styling of each element
*/

@patch_element("hui-picture-elements-card")
class PictureElementsCardPatch extends ModdedElement {
  _uixElementConfigSource;

  setConfig(_orig, config, ...args) {
    this._uixElementConfigSource = config;
    registerElementConfigRebuild(this, (host: any) => host.setConfig(host._uixElementConfigSource));
    _orig?.(applyPictureElementConfigDefaults(config), ...args);

    const apply = async () => { 
      for (const [i, el] of (this as any)._elements.entries()) {
        await await_element(el);
        patch_object(el, ModdedElement);
        const config = (this as any)._config.elements[i];
        const cls = `type-${config?.type?.replace?.(":", "-")}`;
        apply_uix(el, "element", config?.uix ?? config?.card_mod, { config }, true, cls);
      }
    }
    Promise.all([this.updateComplete]).then(() => apply());
  }
}

/*
Patch conditional element specifically as it creates elements dynamically
*/

@patch_element("hui-conditional-element")
class HuiConditionalElementPatch extends ModdedElement {
  _uixElementConfigSource;

  setConfig(_orig, config, ...args) {
    this._uixElementConfigSource = config;
    registerElementConfigRebuild(this, (host: any) => host.setConfig(host._uixElementConfigSource));
    _orig?.(applyPictureElementConfigDefaults(config), ...args);
    const apply = async () => {
      for (const [i, el] of (this as any)._elements.entries()) {
        await await_element(el);
        patch_object(el, ModdedElement);
        const config = (this as any)._config.elements[i];
        const cls = `type-${config?.type?.replace?.(":", "-")}`;
        apply_uix(el, "element", config?.uix ?? config?.card_mod, { config }, true, cls);
      }
    }
    Promise.all([this.updateComplete]).then(() => apply());
  }
}
