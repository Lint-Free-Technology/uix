import { PropertyValues } from "lit";
import { UixForgeSparkBase } from "./uix-spark-base";
import { actionHandlerBind } from "./action-handler";

const WRAPPER_ID_ATTR = "data-uix-forge-button-id";
const BUTTON_CLASS = "uix-forge-spark-button";
const ICON_BUTTON_CLASS = "uix-forge-spark-icon-button";

const BUTTON_CSS = `
  ha-button.uix-forge-spark-button {
    margin: var(--uix-button-margin, -6px);
  }
  ha-button.uix-forge-spark-icon-button {
    display: inline-block;
    outline: none;
    --ha-button-height: var(--ha-icon-button-size, 48px);
    position: relative;
    isolation: isolate;
    --wa-form-control-padding-inline: var(--ha-icon-button-padding-inline, var(--ha-space-2));
    --wa-color-on-normal: currentColor;
    --wa-color-fill-quiet: transparent;
    --ha-button-label-overflow: visible;
    margin: var(--uix-icon-button-margin, -6px);
  }
  ha-button.uix-forge-spark-icon-button::after {
    content: "";
    position: absolute;
    inset: 0;
    z-index: -1;
    border-radius: 50%;
    background-color: currentColor;
    opacity: 0;
    pointer-events: none;
  }
  ha-button.uix-forge-spark-icon-button::part(base) {
    width: var(--wa-form-control-height);
    aspect-ratio: 1;
    outline-offset: -4px;
  }
  ha-button.uix-forge-spark-icon-button::part(label) {
    display: flex;
  }
  @media (hover: hover) {
    ha-button.uix-forge-spark-icon-button:hover:not([disabled])::after {
      opacity: 0.1;
    }
  }
`;

const BUTTON_VARIANTS = ["brand", "neutral", "danger", "warning", "success"] as const;
const BUTTON_APPEARANCES = ["accent", "filled", "plain"] as const;

type ButtonVariant = typeof BUTTON_VARIANTS[number];
type ButtonAppearance = typeof BUTTON_APPEARANCES[number];

export class UixForgeSparkButton extends UixForgeSparkBase {
  type = "button";

  private after: string = "";
  private before: string = "";
  private entity: string = "";
  private icon: string = "";
  private color: string = "";
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
  private _wrapperElement: HTMLElement | null = null;
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
    this.after = config.after || config.for || "";
    this.before = config.before || "";
    this.entity = config.entity || "";
    this.icon = config.icon || "";
    this.color = config.color || "";
    this.label = config.label || "";
    this.size = config.size || "";
    this.variant = BUTTON_VARIANTS.includes(config.variant) ? config.variant as ButtonVariant : this.icon ? "neutral" : "";
    this.appearance = BUTTON_APPEARANCES.includes(config.appearance) ? config.appearance as ButtonAppearance : this.icon ? "plain" : "";
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
    if (this._wrapperElement) {
      this._wrapperElement.remove();
      this._wrapperElement = null;
    }
  }

  private async _attach() {
    const selector = this.after || this.before;
    if (!selector) return;

    const elements = await this.controller.target(selector, this._cancel);
    const element = elements?.[0];
    if (!element) return;

    const parent = element.parentElement || element.parentNode;
    if (!parent) return;

    const existingWrapper = (parent as ParentNode).querySelector?.(
      `div[${WRAPPER_ID_ATTR}="${this._id}"]`
    ) as HTMLElement | null;

    if (this._wrapperElement && !existingWrapper) {
      this._wrapperElement.remove();
      this._wrapperElement = null;
    }

    let wrapperEl = existingWrapper;
    let buttonEl: any;

    if (!wrapperEl) {
      wrapperEl = document.createElement("div");
      wrapperEl.setAttribute(WRAPPER_ID_ATTR, this._id);
      wrapperEl.style.display = "contents";
      wrapperEl.style.pointerEvents = "auto";

      // Inject icon-button styles into this wrapper so they are scoped to its lifetime
      const styleEl = document.createElement("style");
      styleEl.textContent = BUTTON_CSS;
      wrapperEl.appendChild(styleEl);

      // Stop pointer events from bubbling to the parent card's action handler
      const stopProp = (ev: Event) => ev.stopPropagation();
      wrapperEl.addEventListener("click", stopProp);
      wrapperEl.addEventListener("mousedown", stopProp);
      wrapperEl.addEventListener("touchstart", stopProp);

      const slot = element.getAttribute("slot");
      if (slot) {
        wrapperEl.setAttribute("slot", slot);
      }

      buttonEl = this._createButtonElement();
      wrapperEl.appendChild(buttonEl);

      if (this.before) {
        parent.insertBefore(wrapperEl, element);
      } else {
        // `after` or `for` — insert after the target element
        const nextSibling = element.nextSibling;
        if (nextSibling) {
          parent.insertBefore(wrapperEl, nextSibling);
        } else {
          parent.appendChild(wrapperEl);
        }
      }
    } else {
      buttonEl = wrapperEl.querySelector("ha-button") as any;
      if (!buttonEl) {
        buttonEl = this._createButtonElement();
        wrapperEl.appendChild(buttonEl);
      }
    }

    this._updateElement(buttonEl);
    this._wrapperElement = wrapperEl;
  }

  private _createButtonElement(): any {
    const buttonEl = document.createElement("ha-button") as any;
    buttonEl.addEventListener("action", (ev: CustomEvent) => {
      this._handleAction(ev, buttonEl);
    });
    return buttonEl;
  }

  private _updateElement(buttonEl: any) {
    if (this.icon && !this.label) {
      buttonEl.classList.remove(BUTTON_CLASS);
      buttonEl.classList.add(ICON_BUTTON_CLASS);
      if (this.color) {
        buttonEl.style.color = this.color;
      } else {
        buttonEl.style.removeProperty("color");
      }
    } else {
      buttonEl.classList.add(BUTTON_CLASS);
      buttonEl.classList.remove(ICON_BUTTON_CLASS);
      buttonEl.style.removeProperty("color");
    }

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
    let labelIconEl = buttonEl.querySelector(`:scope > ha-icon.uix-button-icon`) as (HTMLElement & { icon: string }) | null;
    if (this.icon) {
      if (labelEl) labelEl.remove();
      if (!labelIconEl) {
        const newIconEl = document.createElement("ha-icon") as HTMLElement & { icon: string };
        newIconEl.className = "uix-button-icon";
        buttonEl.appendChild(newIconEl);
        labelIconEl = newIconEl;
      }
      labelIconEl.icon = this.icon;
    } else {
      if (labelIconEl) labelIconEl.remove();
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
    if (this.entity) config.entity = this.entity;
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
