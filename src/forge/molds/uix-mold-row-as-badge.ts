import { HuiBadge, UixForgeConfigPath } from "../uix-forge-types";
import { UixForgeMoldBase } from "./uix-mold-base";

export class UixForgeMoldRowAsBadge extends UixForgeMoldBase {
  type = "row_as_badge";
  _hidden = false;

  isRow(): boolean {
    return true;
  }

  hidden(): boolean {
    return this._hidden;
  }

  isPreview(): boolean {
    return (this.forge.parentElement as HuiBadge)?.preview || false;
  }

  handleRowVisibilityChanged = (event: Event) => {
    const customEvent = event as CustomEvent;
    if (customEvent.detail.row !== this.forge.forgedElement) return;
    customEvent.stopPropagation();
    // row-visibility-changed: value=true means the row IS visible
    this._hidden = !customEvent.detail?.value;
    this.forge.dispatchEvent(new CustomEvent("badge-visibility-changed", {
      detail: { value: this.forge.hidden },
      bubbles: true,
      composed: true,
    }));
  }

  connectedCallback(): void {
    this.forge.preview = (this.forge.parentElement as HuiBadge)?.preview || false;
    this.forge.addEventListener("row-visibility-changed", this.handleRowVisibilityChanged);
  }

  disconnectedCallback(): void {
    this.forge.preview = (this.forge.parentElement as HuiBadge)?.preview || false;
    this.forge.removeEventListener("row-visibility-changed", this.handleRowVisibilityChanged);
  }

  refresh(path: UixForgeConfigPath): void {
    if (path.length === 1 && path[0] === "hidden") {
      this.forge.dispatchEvent(new CustomEvent("badge-visibility-changed", {
        detail: { value: this.forge.hidden },
        bubbles: true,
        composed: true,
      }));
    } else if (path.length >= 1) {
      this.forge.dispatchEvent(new CustomEvent("badge-updated", { bubbles: true, composed: true }));
    } else {
      this.forge.refreshForgedElement(path);
    }
  }
}
