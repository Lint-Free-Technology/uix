import { UixForgeConfigPath } from "../uix-forge-types";
import { UixForgeMoldBase } from "./uix-mold-base";

export class UixForgeMoldRow extends UixForgeMoldBase {
  type = "row";
  _hidden = false;

  isError(): boolean {
    return false;
    //TODO
    //return (this.forge.forgedElement as HuiCard)?._element?.tagName?.toLowerCase() === "hui-error-card" ? true : false;
  }

  hidden(): boolean {
    return this._hidden;
  }

  handleRowVisibilityChanged = (event: CustomEvent) => {
    if (event.detail.row !== this.forge.forgedElement) return;
    event.stopPropagation();
    this.updateRowVisibility(event);
  }

  updateRowVisibility(event: CustomEvent = undefined as any) {
    if (event) {
      this._hidden = !event.detail?.value;
    }
    this.forge.dispatchEvent(new CustomEvent("row-visibility-changed", { detail: { row: this.forge, value: !this.forge.hidden }, bubbles: true, composed: true }));
    // entities card sets hidden which will be true until templates are bound, so we need to ensure the row is shown after templates are bound
    if (!this.forge.hidden && this.forge.parentElement?.getAttribute("hidden") !== null) {
      this.forge.parentElement.removeAttribute("hidden");
    } else if (this.forge.hidden && this.forge.parentElement?.getAttribute("hidden") === null) {
      this.forge.parentElement.setAttribute("hidden", "");
    }
  }

  connectedCallback(): void {
    this.forge.addEventListener("row-visibility-changed", this.handleRowVisibilityChanged);
  }

  disconnectedCallback(): void {
    this.forge.removeEventListener("row-visibility-changed", this.handleRowVisibilityChanged);
  }

  refresh(path: UixForgeConfigPath): void {
    if (path.length == 0 || (path.length === 1 && path[0] === "hidden")) {
      this.updateRowVisibility();
    } else {
      this.forge.refreshForgedElement(path);
    }
  }
}