import { UixForgeMoldBadge } from "./uix-mold-badge";
import { UixForgeMoldBase } from "./uix-mold-base";
import { UixForgeMoldCard } from "./uix-mold-card";

export type UixForgeMold = UixForgeMoldBase;

export const UIX_FORGE_MOLD_CLASSES: Record<string, any> = {
  "badge": UixForgeMoldBadge,
  "card": UixForgeMoldCard,
};