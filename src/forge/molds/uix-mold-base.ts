import { UixForge } from "../uix-forge";
import { UixForgeConfigPath } from "../uix-forge-types";

export abstract class UixForgeMoldBase {
  abstract type: string;

  forge: UixForge;

  constructor(forge: UixForge) {
    this.forge = forge;
  }

  isCard(): boolean {
      return this.type === "card";
    }

  isBadge(): boolean {
    return this.type === "badge";
  }

  isRow(): boolean {
    return this.type === "row";
  }

  isElement(): boolean {
    return this.type === "element";
  }

  isRows(): boolean {
    return this.type === "rows";
  }

  isBadges(): boolean {
    return this.type === "badges";
  }

  isElements(): boolean {
    return this.type === "elements";
  }

  isSingular(): boolean {
    return this.isRow() || this.isBadge() || this.isElement();
  }

  isPlural(): boolean {
    return this.isRows() || this.isBadges() || this.isElements();
  }

  isError() : boolean {
    return false;
  }
  abstract refresh(path: UixForgeConfigPath): void;

  connectedCallback() {}

  disconnectedCallback() {}

  hidden(): boolean {
    return false;
  }

  getGridOptions(): Record<string, any> {
    return {};
  }

  isPreview(): boolean {
    return this.forge.preview;
  }

  async cardHelpers() {
    return await (window as any).loadCardHelpers();
  }
}