import { patch_element, patch_object } from "../helpers/patch_function";
import { apply_uix } from "../helpers/apply_uix";
import { ModdedElement } from "../helpers/apply_uix";

/*
Patch hui-section-background getting config from sibling hui-grid-section 
Keep current section --uix-section-background-color and --uix-section-background-opacity 
as well for another option
*/

@patch_element("hui-section-background")
class HuiSectionBackgroundPatch extends ModdedElement {
  updated(_orig, ...args) {
    _orig?.(...args);
    const section = this.closest("div.section-container")?.querySelector("hui-section") as LovelaceSection | null;
    if (section) {
      const sectionConfig: LovelaceSectionConfig | undefined = (section as LovelaceSection).config;
      const backgroundConfig = sectionConfig?.background?.uix ?? sectionConfig?.background?.card_mod;
      if (backgroundConfig) {
        apply_uix(
          this,
          "section-background",
          backgroundConfig,
          { config: sectionConfig },
          true,
          "type-section-background"
        );
      }
    }
  }
}
/*
Patch the hui-grid-section element to on first update:
- config is available in this._config as set by parent hui-section
Patch updated to apply section background settings
*/

@patch_element("hui-grid-section")
class HuiGridSectionPatch extends ModdedElement {
  _config;
  _uix;
  async firstUpdated(_orig, ...args) {
    _orig?.(...args);
    await apply_uix(
      this,
      "grid-section",
      this._config.uix ?? this._config.card_mod,
      { config: this._config },
      true,
      "type-grid-section"
    );
    if (this._config.background) {
      apply_section_background(this, this._config);
      this._uix?.[0].addEventListener("uix-styles-update", async () => {
        await this._uix[0].updateComplete;
        apply_section_background(this, this._config);
      });
    }
  }
}

function apply_section_background(element: HTMLElement, config: any) {
  if (element && config?.background) {
    const uixSectionBackgroundColor = getComputedStyle(element).getPropertyValue("--uix-section-background-color");
    const uixSectionBackgroundOpacity = getComputedStyle(element).getPropertyValue("--uix-section-background-opacity");
    const elHuiSectionBackground: HTMLElement | null = element?.closest("div.section-container")?.querySelector("hui-section-background");
    if (elHuiSectionBackground) {
      if (uixSectionBackgroundColor) {
        elHuiSectionBackground.style.setProperty(
          "--section-background-color", uixSectionBackgroundColor
        );
      }
      if (uixSectionBackgroundOpacity) {
        elHuiSectionBackground.style.setProperty(
          "--section-background-opacity", uixSectionBackgroundOpacity
        );
      }
    }
  }
}

/*
Patch the hui-section element on first update:
- patch can only apply to strategies where cards can be modified
- apply uix to cards per types in uix config
*/

@patch_element("hui-section")
class HuiSectionPatch extends ModdedElement {
  _createCards(_orig, ...args) {
    const strategyConfig = (this as LovelaceSection).config?.strategy;
    const dynamicConfig: LovelaceSectionConfig | undefined = { ...args[0] };
    if (strategyConfig && (strategyConfig.uix || strategyConfig.card_mod)) {
      Object.entries(dynamicConfig.cards).forEach(([idx, card]) => {
        if (card.type && (card.type in strategyConfig.uix || card.type in strategyConfig.card_mod)) {
          (strategyConfig.uix?.debug || strategyConfig.card_mod?.debug) &&
            console.log(
              "UIX Debug: adding uix to card",
              card,
              "with",
              strategyConfig.uix?.[card.type] ?? strategyConfig.card_mod?.[card.type]
            );
          dynamicConfig.cards[idx] = {
            ...card,
            uix: strategyConfig.uix?.[card.type] ?? strategyConfig.card_mod?.[card.type],
          };
        }
      });
    }
    _orig?.(dynamicConfig);
  }
}

interface LovelaceSection extends Node {
  config?: LovelaceSectionConfig;
}

interface LovelaceCardConfig {
  type?: string;
  uix?: { [key: string]: any };
  card_mod?: { [key: string]: any };
}

interface LovelaceSectionConfig {
  strategy?: { [key: string]: any };
  type?: string;
  cards?: LovelaceCardConfig[];
  uix?: { [key: string]: any };
  card_mod?: { [key: string]: any };
  background?: {
    uix?: { [key: string]: any };
    card_mod?: { [key: string]: any };
  };
}
