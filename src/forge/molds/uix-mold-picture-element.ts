import { UixForgeConfigPath } from "../uix-forge-types";
import { UixForgeMoldBase } from "./uix-mold-base";

export class UixForgeMoldPictureElement extends UixForgeMoldBase {
  type = "picture-element";

  hasStyle(): boolean {
    return true;
  }

  style(): string {
    return `
      .element{
        position: absolute;
        transform: translate(-50%, -50%);
      }
    `;
  }

  refresh(path: UixForgeConfigPath): void {
    this.forge.refreshForgedElement(path);
  }
}