import { PropertyValues } from "lit";
import { UixForgeSparkBase } from "./uix-spark-base";
import { computeDomain } from "../../helpers/common/entity/compute_domain";
import { stateActive } from "../../helpers/common/entity/state_active";
import { computeCssColor } from "../../helpers/common/entity/compute_color";
import { stateColorCss } from "../../helpers/common/entity/state_color";
import { hsv2rgb, rgb2hex, rgb2hsv } from "../../helpers/common/color/convert_color";
import { DOMAINS_TOGGLE } from "../../helpers/common/const";
import memoizeOne from 'memoize-one';

const TILE_ICON_ID_ATTR = "data-uix-forge-tile-icon-id";

export const getEntityDefaultTileIconAction = (entityId: string) => {
  const domain = computeDomain(entityId);
  const supportsIconAction =
    DOMAINS_TOGGLE.has(domain) ||
    ["button", "input_button", "scene"].includes(domain);

  return supportsIconAction ? "toggle" : "none";
};

export class UixForgeSparkTileIcon extends UixForgeSparkBase {
  type = "tile-icon";

  private after: string = "";
  private before: string = "";
  private icon: string = "";
  private color: string = "";
  private iconPath: string = "";
  private imageUrl: string = "";
  private entity: string = "";
  private interactive: boolean = false;
  private tapAction: Record<string, any> | null = null;
  private holdAction: Record<string, any> | null = null;
  private doubleTapAction: Record<string, any> | null = null;
  private _cancel: (() => void)[] = [];
  private _iconElement: HTMLElement | null = null;
  private readonly _id: string;

  constructor(controller: any, config: Record<string, any>) {
    super(controller, config);
    this._id = `uix-forge-tile-icon-${Math.random().toString(36).slice(2, 11)}`;
    this._applyConfig(config);
  }

  configUpdated(config: Record<string, any>): void {
    super.configUpdated(config);
    this._applyConfig(config);
  }

  private _applyConfig(config: Record<string, any>) {
    this.after = config.after || "";
    this.before = config.before || "";
    this.icon = config.icon || "";
    this.color = config.color || "";
    this.iconPath = config.icon_path || "";
    this.imageUrl = config.image_url || "";
    this.entity = config.entity || "";
    this.tapAction = config.tap_action || null;
    this.holdAction = config.hold_action || null;
    this.doubleTapAction = config.double_tap_action || null;

    if (!this.tapAction && this.entity) {
      this.tapAction = { action: getEntityDefaultTileIconAction(this.entity) };
    }
  }

  updated(_changedProperties: PropertyValues): void {
    this._cancelPending();
    this._attach();
  }

  connectedCallback(): void {
    this._cancelPending();
    this._attach();
  }

  disconnectedCallback(): void {
    this._cancelPending();
    this._remove();
  }

  private _cancelPending() {
    this._cancel.forEach((c) => c());
    this._cancel = [];
  }

  private _remove() {
    if (this._iconElement) {
      this._iconElement.remove();
      this._iconElement = null;
    }
  }

  private async _attach() {
    const selector = this.after || this.before;
    if (!selector) return;
    if (!this.icon && !this.iconPath && !this.imageUrl && !this.entity) return;

    const elements = await this.controller.target(selector, this._cancel);
    const element = elements?.[0];
    if (!element) return;

    const parent = element.parentElement || element.parentNode;
    if (!parent) return;

    // Find an existing tile-icon element for this spark instance in the current parent
    const existingInParent = (parent as ParentNode).querySelector?.(
      `ha-tile-icon[${TILE_ICON_ID_ATTR}="${this._id}"]`
    ) as HTMLElement | null;

    // If our tracked element moved to a different parent, remove it
    if (this._iconElement && !existingInParent) {
      this._iconElement.remove();
      this._iconElement = null;
    }

    let tileIconEl = existingInParent as any;
    if (!tileIconEl) {
      tileIconEl = document.createElement("ha-tile-icon") as any;
      tileIconEl.setAttribute(TILE_ICON_ID_ATTR, this._id);

      if (element.getAttribute("slot")) {
        tileIconEl.setAttribute("slot", element.getAttribute("slot")!);
      }

      if (this.after) {
        const nextSibling = element.nextSibling;
        if (nextSibling) {
          parent.insertBefore(tileIconEl, nextSibling);
        } else {
          parent.appendChild(tileIconEl);
        }
      } else {
        parent.insertBefore(tileIconEl, element);
      }

      tileIconEl.addEventListener("action", (ev: CustomEvent) => {
        this._handleAction(ev, tileIconEl);
      });
    }

    this._updateElement(tileIconEl);
    this._iconElement = tileIconEl;
  }

  private _updateElement(tileIconEl: any) {
    const hasActions = !!(( this.tapAction && this.tapAction.action !== "none") || 
                            (this.holdAction && this.holdAction.action !== "none") || 
                            (this.doubleTapAction && this.doubleTapAction.action !== "none"));
    tileIconEl.interactive = hasActions;

    if (hasActions) {
      tileIconEl.actionHandlerOptions = {
        hasHold: !!(this.holdAction && this.holdAction.action !== "none"),
        hasDoubleClick: !!(this.doubleTapAction && this.doubleTapAction.action !== "none"),
      };
    }

    const existingStateIcon = tileIconEl.querySelector(':scope > ha-state-icon[slot="icon"]');

    if (this.entity) {
      let stateIconEl = existingStateIcon as any;
      if (!stateIconEl) {
        stateIconEl = document.createElement("ha-state-icon");
        stateIconEl.setAttribute("slot", "icon");
        tileIconEl.appendChild(stateIconEl);
      }
      const hass = this.controller.forge.hass;
      if (hass?.states?.[this.entity]) {
        stateIconEl.stateObj = hass.states[this.entity];
        stateIconEl.hass = hass;
        const color = this._computeStateColor(stateIconEl.stateObj, this.color);
        if (color) {
          tileIconEl.style.setProperty("--tile-icon-color", color);
        }
        if (this.icon) {
          stateIconEl.icon = this.icon;
        } else {
          stateIconEl.icon = undefined;
        }
      }
      tileIconEl.icon = undefined;
      tileIconEl.iconPath = undefined;
      tileIconEl.imageUrl = undefined;
    } else {
      if (existingStateIcon) {
        existingStateIcon.remove();
      }
      tileIconEl.imageUrl = this.imageUrl || undefined;
      tileIconEl.iconPath = this.iconPath || undefined;
      tileIconEl.icon = this.icon || undefined;
      if (this.color) {
        tileIconEl.style.setProperty("--tile-icon-color", this.color);
      } else {
        tileIconEl.style.removeProperty("--tile-icon-color");
      }
    }
  }

  private _handleAction(ev: CustomEvent, tileIconEl: any) {
    const action = (ev.detail as any)?.action as string;
    if (!action) return;

    const actionKey = `${action}_action`;
    const config: Record<string, any> = {};
    config.entity = this.entity;
    if (this.tapAction) config.tap_action = this.tapAction;
    if (this.holdAction) config.hold_action = this.holdAction;
    if (this.doubleTapAction) config.double_tap_action = this.doubleTapAction;

    if (!config[actionKey]) return;

    tileIconEl.dispatchEvent(
      new CustomEvent("hass-action", {
        bubbles: true,
        composed: true,
        detail: { config, action },
      })
    );
  }

  private _computeStateColor = memoizeOne(
    (entity: any, color?: string) => {
      // Use custom color if active
      if (color) {
        return stateActive(entity) ? computeCssColor(color) : undefined;
      }

      // Use default color for person/device_tracker because color is on the badge
      if (
        computeDomain(entity.entity_id) === "person" ||
        computeDomain(entity.entity_id) === "device_tracker"
      ) {
        return undefined;
      }

      // Use light color if the light support rgb
      if (
        computeDomain(entity.entity_id) === "light" &&
        entity.attributes.rgb_color
      ) {
        const hsvColor = rgb2hsv(entity.attributes.rgb_color);

        // Modify the real rgb color for better contrast
        if (hsvColor[1] < 0.4) {
          // Special case for very light color (e.g: white)
          if (hsvColor[1] < 0.1) {
            hsvColor[2] = 225;
          } else {
            hsvColor[1] = 0.4;
          }
        }
        return rgb2hex(hsv2rgb(hsvColor));
      }

      // Fallback to state color
      return stateColorCss(entity);
    }
  );
}
