import { UixForgeConfigPath } from "../uix-forge-types";
import { UixForgeMoldBase } from "./uix-mold-base";

export class UixForgeMoldSection extends UixForgeMoldBase {
  type = "section";
  _hidden = false;

  hidden(): boolean {
    return this._hidden;
  }

  handleSectionVisibilityChanged = (event: Event) => {
    const customEvent = event as CustomEvent;
    if (customEvent.detail.section == this.forge) return;
    customEvent.stopPropagation();
    this.updateSectionVisibility(customEvent);
  }

  updateSectionVisibility(event: CustomEvent = undefined as any) {
    if (event) {
      this._hidden = !event.detail?.value;
    }
    const parent = this.forge.parentElement as any;
    if (this.forge.hidden && parent?.getAttribute("hidden") === null) {
      parent.setAttribute("hidden", "");
    } else if (!this.forge.hidden && parent?.getAttribute("hidden") !== null) {
      parent.removeAttribute("hidden");
    }
    this.forge.dispatchEvent(new CustomEvent("section-visibility-changed", { detail: { section: this.forge, value: !this.forge.hidden }, bubbles: true, composed: true }));
  }

  connectedCallback(): void {
    this.forge.addEventListener("section-visibility-changed", this.handleSectionVisibilityChanged);
  }

  disconnectedCallback(): void {
    this.forge.removeEventListener("section-visibility-changed", this.handleSectionVisibilityChanged);
  }

  refresh(path: UixForgeConfigPath): void {
    if (path.length == 0 || (path.length === 1 && path[0] === "hidden")) {
      this.updateSectionVisibility();
    } else {
      this.forge.refreshForgedElement(path);
    }
  }
}