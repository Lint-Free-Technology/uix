import { HuiCard, UIX_FORGE_DEFAULT_GRID_OPTIONS, UixForgeConfigPath } from "../uix-forge-types";
import { UixForgeMoldBase } from "./uix-mold-base";

export class UixForgeMoldCard extends UixForgeMoldBase {
  type = "card";

  isError(): boolean {
    return (this.forge.forgedElement as HuiCard)?._element?.tagName?.toLowerCase() === "hui-error-card" ? true : false;
  }

  getGridOptions(): Record<string, any> {
    if (!this.forge.forgedElement) return UIX_FORGE_DEFAULT_GRID_OPTIONS;
    if (this.forge.forgeConfig?.grid_options) {
      // Check that all grid_options values are not empty strings
      for (const key in this.forge.forgeConfig.grid_options) {
        if (
          Object.prototype.hasOwnProperty.call(this.forge.forgeConfig.grid_options, key) &&
          !this.forge.forgeConfig.grid_options[key]
        ) {
          return UIX_FORGE_DEFAULT_GRID_OPTIONS;
        }
      }
      return this.forge.forgeConfig.grid_options;
    }
    return this.forge.forgedElement.getGridOptions?.() || UIX_FORGE_DEFAULT_GRID_OPTIONS;
  }

  refresh(path: UixForgeConfigPath): void {
    if (path.length === 1 && path[0] === "hidden") {
      this.forge.dispatchEvent(new CustomEvent("card-visibility-changed", { detail: { value: this.forge.hidden },bubbles: true, composed: true }));
    } else if (path.length >= 1 && path[0] === "grid_options") {
      this.forge.dispatchEvent(new CustomEvent("card-updated", { bubbles: true, composed: true }));
    } else {
      this.forge.refreshForgedElement(path);
    }
  }
}