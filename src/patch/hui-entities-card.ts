import { patch_object, patch_element } from "../helpers/patch_function";
import { apply_uix } from "../helpers/apply_uix";
import { await_element } from "../helpers/selecttree";
import { ModdedElement } from "../helpers/apply_uix";
import {
  applyEntityRowConfigDefaults,
  registerElementConfigRebuild,
} from "../helpers/element-config";

/*
Patch the hui-entities-card specifically in order to handle individual styling of each row
*/

@patch_element("hui-entities-card")
class HuiEntitiesCardPatch extends ModdedElement {
  _uixElementConfigSource;

  setConfig(_orig, config, ...args) {
    this._uixElementConfigSource = config;
    registerElementConfigRebuild(this, (host: any) => host.setConfig(host._uixElementConfigSource));
    _orig?.(config, ...args);
  }

  _renderEntity(_orig, config, ...rest) {
    const rowConfig = applyEntityRowConfigDefaults(config);
    const retval = _orig?.(rowConfig, ...rest);
    if (rowConfig?.type === "custom:mod-card") return retval;

    if (!retval?.values) return retval;
    const row = retval.values[1];
    if (!row) return retval;

    const cls = rowConfig?.type ?
      `type-${rowConfig.type.replace?.(":", "-")}` : "type-entity";
    const apply = async () => {
      await await_element(row);
      patch_object(row, ModdedElement);
      apply_uix(row, "row", rowConfig?.uix ?? rowConfig?.card_mod, { config: rowConfig }, true, cls);
      row.addEventListener("ll-rebuild", apply);
    };

    Promise.all([this.updateComplete]).then(() => apply());

    return retval;
  }
}

/*
Patch conditional row specifically as it creates rows dynamically
*/

@patch_element("hui-conditional-row")
class HuiConditionalRowPatch extends ModdedElement {
  _element;
  _uixElementConfigSource;

  setConfig(_orig, config, ...args) {
    this._uixElementConfigSource = config;
    registerElementConfigRebuild(this, (host: any) => host.setConfig(host._uixElementConfigSource));
    const rowConfig = applyEntityRowConfigDefaults(config?.row);
    const elementConfig = rowConfig === config?.row ? config : { ...config, row: rowConfig };
    _orig?.(elementConfig, ...args);
    const row = this._element;
    if (!row) return;
    if (!rowConfig || rowConfig?.type === "custom:mod-card") return;
    
    const cls = rowConfig?.type ?
    `type-${rowConfig.type.replace?.(":", "-")}` : "type-entity";
    const apply = async () => {
      await await_element(row);
      patch_object(row, ModdedElement);
      apply_uix(row, "row", rowConfig.uix ?? rowConfig.card_mod, { config: rowConfig }, true, cls);
      row.addEventListener("ll-rebuild", apply);
    };

    Promise.all([this.updateComplete]).then(() => apply());
  }
}

