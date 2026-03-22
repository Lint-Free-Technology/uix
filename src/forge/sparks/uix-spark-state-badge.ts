import { PropertyValues } from "lit";
import { UixForgeSparkBase } from "./uix-spark-base";

const STATE_BADGE_ID_ATTR = "data-uix-forge-state-badge-id";

export class UixForgeSparkStateBadge extends UixForgeSparkBase {
  type = "state-badge";

  private after: string = "";
  private before: string = "";
  private entity: string = "";
  private overrideIcon: string = "";
  private overrideImage: string = "";
  private color: string = "";
  private stateColor: boolean | undefined = undefined;
  private _cancel: (() => void)[] = [];
  private _badgeElement: HTMLElement | null = null;
  private readonly _id: string;

  constructor(controller: any, config: Record<string, any>) {
    super(controller, config);
    this._id = `uix-forge-state-badge-${Math.random().toString(36).slice(2, 11)}`;
    this._applyConfig(config);
  }

  configUpdated(config: Record<string, any>): void {
    super.configUpdated(config);
    this._applyConfig(config);
  }

  private _applyConfig(config: Record<string, any>) {
    this.after = config.after || "";
    this.before = config.before || "";
    this.entity = config.entity || "";
    this.overrideIcon = config.override_icon || "";
    this.overrideImage = config.override_image || "";
    this.color = config.color || "";
    this.stateColor = config.state_color !== undefined ? config.state_color : undefined;
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
    if (this._badgeElement) {
      this._badgeElement.remove();
      this._badgeElement = null;
    }
  }

  private async _attach() {
    const selector = this.after || this.before;
    if (!selector) return;
    if (!this.entity && !this.overrideIcon && !this.overrideImage) return;

    const elements = await this.controller.target(selector, this._cancel);
    const element = elements?.[0];
    if (!element) return;

    const parent = element.parentElement || element.parentNode;
    if (!parent) return;

    // Find an existing state-badge element for this spark instance in the current parent
    const existingInParent = (parent as ParentNode).querySelector?.(
      `state-badge[${STATE_BADGE_ID_ATTR}="${this._id}"]`
    ) as HTMLElement | null;

    // If our tracked element moved to a different parent, remove it
    if (this._badgeElement && !existingInParent) {
      this._badgeElement.remove();
      this._badgeElement = null;
    }

    let badgeEl = existingInParent as any;
    if (!badgeEl) {
      badgeEl = document.createElement("state-badge") as any;
      badgeEl.setAttribute(STATE_BADGE_ID_ATTR, this._id);

      if (element.getAttribute("slot")) {
        badgeEl.setAttribute("slot", element.getAttribute("slot")!);
      }

      if (this.after) {
        const nextSibling = element.nextSibling;
        if (nextSibling) {
          parent.insertBefore(badgeEl, nextSibling);
        } else {
          parent.appendChild(badgeEl);
        }
      } else {
        parent.insertBefore(badgeEl, element);
      }
    }

    this._updateElement(badgeEl);
    this._badgeElement = badgeEl;
  }

  private _updateElement(badgeEl: any) {
    const hass = this.controller.forge.hass;
    badgeEl.hass = hass;

    if (this.entity && hass?.states?.[this.entity]) {
      badgeEl.stateObj = hass.states[this.entity];
    } else {
      badgeEl.stateObj = undefined;
    }

    badgeEl.overrideIcon = this.overrideIcon || undefined;
    badgeEl.overrideImage = this.overrideImage || undefined;
    badgeEl.color = this.color || undefined;

    if (this.stateColor !== undefined) {
      badgeEl.stateColor = this.stateColor;
    }
  }
}
