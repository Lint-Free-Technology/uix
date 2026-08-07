import { UixForge } from "../uix-forge";
import { UixForgeConfigPath } from "../uix-forge-types";

export abstract class UixForgeMoldBase {
  abstract type: string;

  forge: UixForge;

  constructor(forge: UixForge) {
    this.forge = forge;
  }

  templateVariables() {
    return {};
  }

  hasStyle(): boolean {
    return false;
  }

  style(): string {
    return "";
  }

  isSection(): boolean {
    return this.type === "section";
  }

  isFooter(): boolean {
    return this.type === "footer";
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

  isPictureElement(): boolean {
    return this.type === "picture-element";
  }

  isCardFeature(): boolean {
    return this.type === "card-feature";
  }

  isRows(): boolean {
    return this.type === "rows";
  }

  isBadges(): boolean {
    return this.type === "badges";
  }

  isPictureElements(): boolean {
    return this.type === "picture-elements";
  }

  isSingular(): boolean {
    return this.isRow() || this.isBadge() || this.isPictureElement();
  }

  isPlural(): boolean {
    return this.isRows() || this.isBadges() || this.isPictureElements();
  }

  isError() : boolean {
    return false;
  }

  isCardBlankClear(): boolean {
    return this.type === "card_as_row" || this.type === "card_as_badge";
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

  getAuxiliaryFunctions(): Record<string, Function> {
    return {};
  }

  async callAuxiliaryFunction(functionName: string, ...args: any[]): Promise<any> {
    const auxiliaryFunctions = this.getAuxiliaryFunctions();
    if (functionName in auxiliaryFunctions) {
      return await auxiliaryFunctions[functionName].apply(this, args);
    }
  }
}