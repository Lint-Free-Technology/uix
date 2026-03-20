import { PropertyValues } from "lit";
import { UixForgeSparkBase } from "./uix-spark-base";

export class UixForgeSparkIcon extends UixForgeSparkBase {
  type = "icon";

  private after: string = "";
  private before: string = "";
  private icon: string = "";
  private entity: string = "";
  private _cancel: (() => void)[] = [];
  private _iconElement: HTMLElement | null = null;

  constructor(controller: any, config: Record<string, any>) {
    super(controller, config);
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
    this.entity = config.entity || "";
  }

  updated(_changedProperties: PropertyValues): void {
    this._cancelPending();
    this._remove();
    this._attach();
  }

  connectedCallback(): void {
    this._cancelPending();
    this._remove();
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
    if (!this.icon && !this.entity) return;

    const elements = await this.controller.target(selector, this._cancel);
    const element = elements?.[0];
    if (!element) return;

    const parent = element.parentElement || element.parentNode;
    if (!parent) return;

    const iconEl = document.createElement("ha-state-icon") as any;
    if (this.icon) {
      iconEl.icon = this.icon;
    } else if (this.entity) {
      const hass = this.controller.forge.hass;
      if (hass?.states?.[this.entity]) {
        iconEl.stateObj = hass.states[this.entity];
      }
    }
    if (element.getAttribute("slot")) {
      iconEl.setAttribute("slot", element.getAttribute("slot")!);
    }

    if (this.after) {
      const nextSibling = element.nextSibling;
      if (nextSibling) {
        parent.insertBefore(iconEl, nextSibling);
      } else {
        parent.appendChild(iconEl);
      }
    } else {
      parent.insertBefore(iconEl, element);
    }

    this._iconElement = iconEl;
  }
}
