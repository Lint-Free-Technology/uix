import { UixForgeMoldBadge } from "./uix-mold-badge";
import { UixForgeMoldBadgeAsCard } from "./uix-mold-badge-as-card";
import { UixForgeMoldBadgeAsPictureElement } from "./uix-mold-badge-as-picture-element";
import { UixForgeMoldBadgeAsRow } from "./uix-mold-badge-as-row";
import { UixForgeMoldBase } from "./uix-mold-base";
import { UixForgeMoldCard } from "./uix-mold-card";
import { UixForgeMoldCardAsBadge } from "./uix-mold-card-as-badge";
import { UixForgeMoldCardAsRow } from "./uix-mold-card-as-row";
import { UixForgeMoldRow } from "./uix-mold-row";
import { UixForgeMoldRowAsBadge } from "./uix-mold-row-as-badge";
import { UixForgeMoldRowAsCard } from "./uix-mold-row-as-card";
import { UixForgeMoldSection } from "./uix-mold-section";
import { UixForgeMoldPictureElement } from "./uix-mold-picture-element";
import { UixForgeMoldFooter } from "./uix-mold-foooter";

export type UixForgeMold = UixForgeMoldBase;

export const UIX_FORGE_MOLD_CLASSES: Record<string, any> = {
  "badge": UixForgeMoldBadge,
  "badge_as_card": UixForgeMoldBadgeAsCard,
  "badge_as_picture_element": UixForgeMoldBadgeAsPictureElement,
  "badge_as_row": UixForgeMoldBadgeAsRow,
  "card": UixForgeMoldCard,
  "card_as_badge": UixForgeMoldCardAsBadge,
  "card_as_row": UixForgeMoldCardAsRow,
  "row": UixForgeMoldRow,
  "row_as_badge": UixForgeMoldRowAsBadge,
  "row_as_card": UixForgeMoldRowAsCard,
  "section": UixForgeMoldSection,
  "picture-element": UixForgeMoldPictureElement,
  "footer": UixForgeMoldFooter,
};