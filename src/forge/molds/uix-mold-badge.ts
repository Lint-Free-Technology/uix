import { HuiBadge, UixForgeConfigPath } from "../uix-forge-types";
import { UixForgeMoldBase } from "./uix-mold-base";

export class UixForgeMoldBadge extends UixForgeMoldBase {
  type = "badge";

  connectedCallback(): void {
    this.forge.preview = (this.forge.parentElement as HuiBadge)?.preview || false;
  }

  disconnectedCallback(): void {
    this.forge.preview = (this.forge.parentElement as HuiBadge)?.preview || false;
  }
  
  isError(): boolean {
    return (this.forge.forgedElement as HuiBadge)?._element?.tagName?.toLowerCase() === "hui-error-badge" ? true : false;
  }

  refresh(path: UixForgeConfigPath): void {
    if (path?.length === 1 && path[0] === "hidden") {
        this.forge.dispatchEvent(new CustomEvent("badge-visibility-changed", { detail: { value: this.forge.hidden },bubbles: true, composed: true }));
    } else {
      this.forge.dispatchEvent(new CustomEvent("badge-updated", { bubbles: true, composed: true }));
    }  
  }

  isPreview(): boolean {
    return (this.forge.parentElement as HuiBadge)?.preview || false;
  }
}