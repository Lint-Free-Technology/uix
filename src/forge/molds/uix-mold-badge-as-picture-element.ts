import { HuiBadge, UixForgeConfigPath } from "../uix-forge-types";
import { UixForgeMoldBase } from "./uix-mold-base";

export class UixForgeMoldBadgeAsPictureElement extends UixForgeMoldBase {
  type = "badge_as_picture_element";
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

  handleBadgeVisibilityChanged = (event: Event) => {
    const customEvent = event as CustomEvent;
    // badge-visibility-changed: value=true means the badge IS visible,
    // so we want to set hidden to the opposite of that
    const newHidden = !(customEvent.detail?.value ?? true);
    customEvent.stopPropagation();
    if (newHidden === this._hidden) return;
    this._hidden = newHidden;
    this.updatePictureElementVisibility();
  }

  updatePictureElementVisibility() {
    // Picture-elements cards have no visibility event mechanism.
    // Apply visibility directly on the forge element's own CSS so that
    // it hides/shows itself without disturbing the picture-elements layout.
    if (this.forge.hidden) {
      this.forge.style.setProperty("display", "none");
    } else {
      this.forge.style.removeProperty("display");
    }
  }

  connectedCallback(): void {
    this.forge.addEventListener("badge-visibility-changed", this.handleBadgeVisibilityChanged);
  }

  disconnectedCallback(): void {
    this.forge.removeEventListener("badge-visibility-changed", this.handleBadgeVisibilityChanged);
  }

  refresh(path: UixForgeConfigPath): void {
    if (path.length === 1 && path[0] === "hidden") {
      this.updatePictureElementVisibility();
    } else {
      this.forge.refreshForgedElement(path);
    }
    this.forge.updateComplete.then(() => {
      const styleConfig = this.forge.forgedElementConfig?.style;
      if (styleConfig) {
        for (const [prop, value] of Object.entries(styleConfig)) {
          this.forge.style.setProperty(String(prop), String(value));
        }
      }
    });
  }
}
