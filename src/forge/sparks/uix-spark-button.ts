import { PropertyValues } from "lit";
import { UixForgeSparkBase } from "./uix-spark-base";
import { actionHandlerBind } from "./action-handler";

const BUTTON_ID_ATTR = "data-uix-forge-button-id";

const BUTTON_VARIANTS = ["brand", "neutral", "danger", "warning", "success"] as const;
const BUTTON_APPEARANCES = ["accent", "filled", "plain"] as const;

type ButtonVariant = typeof BUTTON_VARIANTS[number];
type ButtonAppearance = typeof BUTTON_APPEARANCES[number];

export class UixForgeSparkButton extends UixForgeSparkBase {
  type = "button";

  private for: string = "";
  private label: string = "";
  private size: string = "";
  private variant: ButtonVariant | "" = "";
  private appearance: ButtonAppearance | "" = "";
  private startIcon: string = "";
  private endIcon: string = "";
  private tapAction: Record<string, any> | null = null;
  private holdAction: Record<string, any> | null = null;
  private doubleTapAction: Record<string, any> | null = null;
  private _cancel: (() => void)[] = [];
  private _buttonElement: HTMLElement | null = null;
  private readonly _id: string;

  constructor(controller: any, config: Record<string, any>) {
    super(controller, config);
    this._id = `uix-forge-button-${Math.random().toString(36).slice(2, 11)}`;
    this._applyConfig(config);
  }

  configUpdated(config: Record<string, any>): void {
    super.configUpdated(config);
    this._applyConfig(config);
  }

  private _applyConfig(config: Record<string, any>) {
    this.for = config.for || "";
    this.label = config.label || "";
    this.size = config.size || "";
    this.variant = BUTTON_VARIANTS.includes(config.variant) ? config.variant as ButtonVariant : "";
    this.appearance = BUTTON_APPEARANCES.includes(config.appearance) ? config.appearance as ButtonAppearance : "";
    this.startIcon = config.start_icon || "";
    this.endIcon = config.end_icon || "";
    this.tapAction = config.tap_action || null;
    this.holdAction = config.hold_action || null;
    this.doubleTapAction = config.double_tap_action || null;
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
    if (this._buttonElement) {
      this._buttonElement.remove();
      this._buttonElement = null;
    }
  }

  private async _attach() {
    if (!this.for) return;

    const elements = await this.controller.target(this.for, this._cancel);
    const element = elements?.[0];
    if (!element) return;

    const parent = element.parentElement || element.parentNode;
    if (!parent) return;

    const existingInParent = (parent as ParentNode).querySelector?.(
      `ha-button[${BUTTON_ID_ATTR}="${this._id}"]`
    ) as HTMLElement | null;

    if (this._buttonElement && !existingInParent) {
      this._buttonElement.remove();
      this._buttonElement = null;
    }

    let buttonEl = existingInParent as any;
    if (!buttonEl) {
      buttonEl = document.createElement("ha-button") as any;
      buttonEl.setAttribute(BUTTON_ID_ATTR, this._id);

      const slot = element.getAttribute("slot");
      if (slot) {
        buttonEl.setAttribute("slot", slot);
      }

      buttonEl.addEventListener("action", (ev: CustomEvent) => {
        this._handleAction(ev, buttonEl);
      });

      parent.appendChild(buttonEl);
    }

    this._updateElement(buttonEl);
    this._buttonElement = buttonEl;
  }

  private _updateElement(buttonEl: any) {
    if (this.size) {
      buttonEl.setAttribute("size", this.size);
    } else {
      buttonEl.removeAttribute("size");
    }

    if (this.variant) {
      buttonEl.setAttribute("variant", this.variant);
    } else {
      buttonEl.removeAttribute("variant");
    }

    if (this.appearance) {
      buttonEl.setAttribute("appearance", this.appearance);
    } else {
      buttonEl.removeAttribute("appearance");
    }

    let labelEl = buttonEl.querySelector(`:scope > .uix-button-label`);
    if (this.label) {
      if (!labelEl) {
        labelEl = document.createElement("span");
        labelEl.className = "uix-button-label";
        buttonEl.appendChild(labelEl);
      }
      labelEl.innerHTML = this.label;
    } else if (labelEl) {
      labelEl.remove();
    }

    let startIconEl = buttonEl.querySelector(`:scope > ha-icon[slot="start"]`);
    if (this.startIcon) {
      if (!startIconEl) {
        startIconEl = document.createElement("ha-icon");
        startIconEl.setAttribute("slot", "start");
        buttonEl.insertBefore(startIconEl, buttonEl.firstChild);
      }
      (startIconEl as any).icon = this.startIcon;
    } else if (startIconEl) {
      startIconEl.remove();
    }

    let endIconEl = buttonEl.querySelector(`:scope > ha-icon[slot="end"]`);
    if (this.endIcon) {
      if (!endIconEl) {
        endIconEl = document.createElement("ha-icon");
        endIconEl.setAttribute("slot", "end");
        buttonEl.appendChild(endIconEl);
      }
      (endIconEl as any).icon = this.endIcon;
    } else if (endIconEl) {
      endIconEl.remove();
    }

    const hasHold = !!(this.holdAction && this.holdAction.action !== "none");
    const hasDoubleClick = !!(this.doubleTapAction && this.doubleTapAction.action !== "none");
    const hasTap = !!(this.tapAction && this.tapAction.action !== "none");
    if (hasTap || hasHold || hasDoubleClick) {
      actionHandlerBind(buttonEl, { hasHold, hasDoubleClick });
    }
  }

  private _handleAction(ev: CustomEvent, buttonEl: any) {
    const action = (ev.detail as any)?.action as string;
    if (!action) return;

    const actionKey = `${action}_action`;
    const config: Record<string, any> = {};
    if (this.tapAction) config.tap_action = this.tapAction;
    if (this.holdAction) config.hold_action = this.holdAction;
    if (this.doubleTapAction) config.double_tap_action = this.doubleTapAction;

    if (!config[actionKey]) return;

    buttonEl.dispatchEvent(
      new CustomEvent("hass-action", {
        bubbles: true,
        composed: true,
        detail: { config, action },
      })
    );
  }
}
