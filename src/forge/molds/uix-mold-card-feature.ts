import { HuiCard, HuiCardFeature, UixForgeConfigPath } from "../uix-forge-types";
import { UixForgeMoldBase } from "./uix-mold-base";

export class UixForgeMoldCardFeature extends UixForgeMoldBase {
  type = "card-feature";

  isError(): boolean {
    return (this.forge.forgedElement as HuiCard)?._element?.tagName?.toLowerCase() === "hui-error-card" ? true : false;
  }

  templateVariables() {
    return { context: (this.forge?.context || {}) };
  }

  connectedCallback(): void {
    this.updateCardFeatureVisibility();
  }

  disconnectedCallback(): void {
    // noop
  }

  isPreview(): boolean {
    // hui-card-feature and parent hui-card-features does not have preview set on them, 
    // so we need to traverse up the tree to find the parent hui-card and check if it's 
    // in preview mode
    let element: any = this.forge.forgedElement;
    let steps = 0;
    while (element && steps < 20) {
      steps++;
      if (element.tagName?.toLowerCase() === "hui-card") {
        return !!element.preview;
      }
      element = element.parentElement || (element.getRootNode ? (element.getRootNode() as ShadowRoot)?.host : null);
    }
    return false;
  }

  updateCardFeatureVisibility() {
    if (!this.forge.forgedElement) return;
    if (!(this.forge.parentNode as any)?.host) return;
    if (this.forge.hidden) {
      (this.forge.parentNode as any).host.style.display = "none";
    } else {
      (this.forge.parentNode as any).host.style.display = "";
    }
  }

  refresh(path: UixForgeConfigPath): void {
    if (path.length == 0 || (path.length === 1 && path[0] === "hidden")) {
      this.updateCardFeatureVisibility();
    } else {
      this.forge.refreshForgedElement(path);
    }
  }
}