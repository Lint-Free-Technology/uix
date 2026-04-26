import { UixForgeConfigPath } from "../uix-forge-types";
import { UixForgeMoldBase } from "./uix-mold-base";

export class UixForgeMoldFooter extends UixForgeMoldBase {
  type = "footer";

  setParentDisplay() {
    // set parent forge hui-card to display:contents so it does not take up space where card id defined
    // For sections this also extends to the div.card so check for that as well
    // Only done when not hidden as hui-card will manage display state when hidden
    this.forge.style.display = "contents";
    const parentCard: HTMLElement | null = this.forge.closest("hui-card");
    if (parentCard && !this.forge.hidden) {
      parentCard.style.display = "contents";
      const parentCardSection: HTMLElement | null = parentCard.closest(".card");
      if (parentCardSection) {
        parentCardSection.style.display = "contents";
      }
    }
  }

  refresh(path: UixForgeConfigPath): void {
    if (path.length === 1 && path[0] === "hidden") {
      // dispatch to hui-card so as wherever the footer is hosted does not take up space when hidden, such as row hosting the card
      this.forge.dispatchEvent(new CustomEvent("card-visibility-changed", { detail: { value: this.forge.hidden }, bubbles: true, composed: true }));
      this.setParentDisplay();
    } else {
      this.forge.refreshForgedElement(path);
    }
  }

  hasStyle(): boolean {
    return true;
  }

  style(): string {
    if (this.isPreview()) {
      return `
        hui-view-footer {
          z-index: 1 !important;
        }
        hui-view-footer::before {
          content: "";
          width: calc(100% + 4px);
          height: calc(100% - 8px);
          position: absolute;
          border: 2px dashed #CE3226;
          left: -4px;
          margin-top: 2px;
          border-radius: var(--ha-card-border-radius, var(--ha-border-radius-lg));
        }`;
    } else {
      return `
        * {
          --ha-card-border-width: var(--uix-forge-footer-border-width, 1px) !important;
        }
        hui-view-footer {
          position: fixed;
          left: 0;
          right: 0;
          bottom: var(--uix-forge-footer-bottom, var(--ha-space-2));
          padding: var(--uix-forge-footer-padding, 0 var(--ha-space-2));
          max-width: ${this.forge.forgeConfig.max_width ?? "600"}px;
          margin: 0 auto;
        }
      `;
    }
  }
}