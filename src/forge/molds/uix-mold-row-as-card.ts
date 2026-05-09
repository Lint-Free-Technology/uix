import { UIX_FORGE_DEFAULT_GRID_OPTIONS, UixForgeConfigPath } from "../uix-forge-types";
import { UixForgeMoldBase } from "./uix-mold-base";

export class UixForgeMoldRowAsCard extends UixForgeMoldBase {
  type = "row_as_card";
  _hidden = false;

  isRow(): boolean {
    return true;
  }

  hidden(): boolean {
    return this._hidden;
  }

  getGridOptions(): Record<string, any> {
    if (this.forge.forgeConfig?.grid_options) {
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
    return UIX_FORGE_DEFAULT_GRID_OPTIONS;
  }

  handleRowVisibilityChanged = (event: Event) => {
    const customEvent = event as CustomEvent;
    if (customEvent.detail.row !== this.forge.forgedElement) return;
    customEvent.stopPropagation();
    // row-visibility-changed: value=true means the row IS visible
    this._hidden = !customEvent.detail?.value;
    this.forge.dispatchEvent(new CustomEvent("card-visibility-changed", {
      detail: { value: this.forge.hidden },
      bubbles: true,
      composed: true,
    }));
  }

  connectedCallback(): void {
    this.forge.addEventListener("row-visibility-changed", this.handleRowVisibilityChanged);
  }

  disconnectedCallback(): void {
    this.forge.removeEventListener("row-visibility-changed", this.handleRowVisibilityChanged);
  }

  refresh(path: UixForgeConfigPath): void {
    if (path.length === 1 && path[0] === "hidden") {
      this.forge.dispatchEvent(new CustomEvent("card-visibility-changed", {
        detail: { value: this.forge.hidden },
        bubbles: true,
        composed: true,
      }));
    } else {
      this.forge.refreshForgedElement(path);
    }
  }
}
