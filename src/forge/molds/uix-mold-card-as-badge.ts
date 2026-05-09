import { HuiBadge, HuiCard, UixForgeConfigPath } from "../uix-forge-types";
import { UixForgeMoldBase } from "./uix-mold-base";

export class UixForgeMoldCardAsBadge extends UixForgeMoldBase {
  type = "card_as_badge";
  _hidden = false;

  isCard(): boolean {
    return true;
  }

  isError(): boolean {
    return (this.forge.forgedElement as HuiCard)?._element?.tagName?.toLowerCase() === "hui-error-card";
  }

  hidden(): boolean {
    return this._hidden;
  }

  isPreview(): boolean {
    return (this.forge.parentElement as HuiBadge)?.preview || false;
  }

  handleCardVisibilityChanged = (event: Event) => {
    const customEvent = event as CustomEvent;
    // card-visibility-changed: value=true means the card IS hidden
    this._hidden = customEvent.detail?.value ?? false;
    customEvent.stopPropagation();
    this.forge.dispatchEvent(new CustomEvent("badge-visibility-changed", {
      detail: { value: this.forge.hidden },
      bubbles: true,
      composed: true,
    }));
  }

  connectedCallback(): void {
    this.forge.preview = (this.forge.parentElement as HuiBadge)?.preview || false;
    this.forge.addEventListener("card-visibility-changed", this.handleCardVisibilityChanged);
  }

  disconnectedCallback(): void {
    this.forge.preview = (this.forge.parentElement as HuiBadge)?.preview || false;
    this.forge.removeEventListener("card-visibility-changed", this.handleCardVisibilityChanged);
  }

  refresh(path: UixForgeConfigPath): void {
    if (path?.length === 1 && path[0] === "hidden") {
      this.forge.dispatchEvent(new CustomEvent("badge-visibility-changed", {
        detail: { value: this.forge.hidden },
        bubbles: true,
        composed: true,
      }));
    } else if (path.length >= 1 && path[0] === "grid_options") {
      // Not applicable for badge context - ignore
    } else if (path.length >= 1) {
      this.forge.dispatchEvent(new CustomEvent("badge-updated", { bubbles: true, composed: true }));
    } else {
      this.forge.refreshForgedElement(path);
    }
  }
}
