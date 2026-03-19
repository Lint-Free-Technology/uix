import { PropertyValues } from "lit";
import { UixForgeSparkBase } from "./uix-spark-base";
import { apply_uix } from "../../helpers/apply_uix";

export class UixForgeSparkTooltip extends UixForgeSparkBase {
  type = "tooltip";

  private for: string = "";
  private content: string = "";
  private _targetElements: Promise<HTMLElement[] | void> | undefined;
  private _cancel_tooltip: (() => void)[] = [];

  constructor(controller: any, config: Record<string, any>) {
    super(controller, config);
    this.for = config.for || "";
    this.content = config.content || "";
  }

  configUpdated(config: Record<string, any>): void {
    super.configUpdated(config);
    this.for = config.for || "";
    this.content = config.content || "";
  }

  updated(_changedProperties: PropertyValues): void {
    this.cancelTooltip();
    this.attachTooltip();
  }

  connectedCallback(): void {
    this.cancelTooltip();
    this.attachTooltip();
  }

  disconnectedCallback(): void {
    this.cancelTooltip();
    if (this._targetElements) {
      this._targetElements.then((elements) => {
        if (elements?.[0]) {
          elements[0].remove();
        }
      });
    }
  }

  private cancelTooltip() {
    this._cancel_tooltip.forEach((cancel) => cancel());
    this._cancel_tooltip = [];
    this._targetElements = undefined;
  }

  private async attachTooltip() {
    const elements = this._targetElements
      ? await this._targetElements
      : await this.resolveTarget();
    const element = elements?.[0];
    if (!element) return;
    const parent = element.parentElement || element.parentNode;
    if (!element.id) {
      element.id = `for-uix-forge-tooltip-${Math.random().toString(36).substr(2, 9)}`;
    }
    if (parent.querySelector("ha-tooltip")) {
      return;
    }
    const tooltip: any = document.createElement("ha-tooltip");
    tooltip.for = element.id;
    const content = document.createElement("div");
    content.innerHTML = this.content;
    parent.appendChild(tooltip);
    tooltip.appendChild(content);
  }

  private async resolveTarget() {
    this._targetElements = this.controller.target(this.for, this._cancel_tooltip);
    return this._targetElements;
  }
}