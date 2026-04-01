import { UixForgeMoldBadge } from "./uix-mold-badge";
import { UixForgeMoldBase } from "./uix-mold-base";
import { UixForgeMoldCard } from "./uix-mold-card";
import { UixForgeMoldRow } from "./uix-mold-row";
import { UixForgeMoldSection } from "./uix-mold-section";
import { UixForgeMoldPictureElement } from "./uix-mold-picture-element";

export type UixForgeMold = UixForgeMoldBase;

export const UIX_FORGE_MOLD_CLASSES: Record<string, any> = {
  "badge": UixForgeMoldBadge,
  "card": UixForgeMoldCard,
  "row": UixForgeMoldRow,
  "section": UixForgeMoldSection,
  "picture-element": UixForgeMoldPictureElement
};