import { UixForge } from "../uix-forge";
import { UixForgeConfigPath } from "../uix-forge-types";

export abstract class UixForgeMoldBase {
  abstract type: string;

  forge: UixForge;

  constructor(forge: UixForge) {
    this.forge = forge;
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