import { HuiBadge, UIX_FORGE_DEFAULT_GRID_OPTIONS, UixForgeConfigPath } from "../uix-forge-types";
import { UixForgeMoldBase } from "./uix-mold-base";

export class UixForgeMoldBadgeAsCard extends UixForgeMoldBase {
  type = "badge_as_card";
  _hidden = false;

  isBadge(): boolean {
    return true;
  }

  isError(): boolean {
    return (this.forge.forgedElement as HuiBadge)?._element?.tagName?.toLowerCase() === "hui-error-badge";
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

  handleBadgeVisibilityChanged = (event: Event) => {
    const customEvent = event as CustomEvent;
    // badge-visibility-changed: value=true means the badge IS visible, 
    // so we want to set hidden to the opposite of that
    this._hidden = !(customEvent.detail?.value ?? true);
    customEvent.stopPropagation();
    this.forge.dispatchEvent(new CustomEvent("card-visibility-changed", {
      detail: { value: !this.forge.hidden },
      bubbles: true,
      composed: true,
    }));
  }

  connectedCallback(): void {
    this.forge.addEventListener("badge-visibility-changed", this.handleBadgeVisibilityChanged);
  }

  disconnectedCallback(): void {
    this.forge.removeEventListener("badge-visibility-changed", this.handleBadgeVisibilityChanged);
  }

  refresh(path: UixForgeConfigPath): void {
    if (path.length === 1 && path[0] === "hidden") {
      this.forge.dispatchEvent(new CustomEvent("card-visibility-changed", {
        detail: { value: !this.forge.hidden },
        bubbles: true,
        composed: true,
      }));
    } else if (path.length >= 1) {
      this.forge.dispatchEvent(new CustomEvent("card-updated", { bubbles: true, composed: true }));
    } else {
      this.forge.refreshForgedElement(path);
    }
  }
}
