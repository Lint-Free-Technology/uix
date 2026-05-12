import { UixForgeConfigPath } from "../uix-forge-types";
import { UixForgeMoldBase } from "./uix-mold-base";

export class UixForgeMoldBadgeAsPictureElement extends UixForgeMoldBase {
  type = "badge_as_picture_element";
  _hidden = false;

  isPictureElement(): boolean {
    return true;
  }

  hidden(): boolean {
    return this._hidden;
  }

  handleBadgeVisibilityChanged = (event: Event) => {
    const customEvent = event as CustomEvent;
    // badge-visibility-changed: value=true means the badge IS visible,
    // so we want to set hidden to the opposite of that
    const newHidden = !(customEvent.detail?.value ?? true);
    customEvent.stopPropagation();
    if (newHidden === this._hidden) return;
    this._hidden = newHidden;
    // Recreate the conditional wrapper with the updated hidden state
    this.forge.refreshForgedElement();
  }

  connectedCallback(): void {
    this.forge.addEventListener("badge-visibility-changed", this.handleBadgeVisibilityChanged);
  }

  disconnectedCallback(): void {
    this.forge.removeEventListener("badge-visibility-changed", this.handleBadgeVisibilityChanged);
  }

  refresh(path: UixForgeConfigPath): void {
    this.forge.refreshForgedElement(path);
  }
}
