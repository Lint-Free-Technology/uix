import { UixForgeConfigPath } from "../uix-forge-types";
import { UixForgeMoldBase } from "./uix-mold-base";

const NEAREST_ROUTED_TYPES = new Map([
  ["state-icon", "hui-state-icon-element"],
  ["state-badge", "hui-state-badge-element"],
  ["icon", "hui-icon-element"],
  ["state-label", "hui-state-label-element"],
]);

export class UixForgeMoldPictureElement extends UixForgeMoldBase {
  type = "picture-element";

  hasStyle(): boolean {
    return true;
  }

  connectedCallback() {
    super.connectedCallback();
    if (this.isNearestRoutedType()) {
      this.forge?.addEventListener("action", this.actionDelegationHandler);
    }
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    if (this.isNearestRoutedType()) {
      this.forge?.removeEventListener("action", this.actionDelegationHandler);
    }
  }

  getAuxiliaryFunctions(): Record<string, Function> {
    return {
      ...super.getAuxiliaryFunctions(),
      "setupNearestRoutedTypeDelegation": this.setupNearestRoutedTypeDelegation.bind(this),
    };
  }

  private actionDelegationHandler = (event: Event) => {
    event.stopPropagation();
    if (!this.isNearestRoutedType()) return;
    const customEvent = event as CustomEvent;
    const actionEvent = new CustomEvent("action", {
      detail: customEvent.detail
    });
    this.getPictureElement()?.dispatchEvent(actionEvent);
  }

  private getHitInfo() {
    return this.getPictureElement()?.getHitInfo?.() ?? {};
  }

  private getPictureElement(): any {
    return this.forge.forgedElement?.querySelector(NEAREST_ROUTED_TYPES.get(this.forge?.forgedElementConfig?.type) as string);
  }

  private isNearestRoutedType(): boolean {
    return NEAREST_ROUTED_TYPES.has(this.forge?.forgedElementConfig?.type);
  }

  style(): string {
    return `
      .element{
        position: absolute;
        transform: translate(-50%, -50%);
      }
    `;
  }

  setupNearestRoutedTypeDelegation() {
    if (this.isNearestRoutedType() && this.forge) {
      (this.forge as any).delegatedActions = true;
      (this.forge as any).getHitInfo = () => { return this.getHitInfo(); };
    } else {
      (this.forge as any).delegatedActions = false;
      (this.forge as any).getHitInfo = undefined;
    }
  }

  refresh(path: UixForgeConfigPath): void {
    this.forge.refreshForgedElement(path);
  }
}