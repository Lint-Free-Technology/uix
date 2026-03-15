import { PropertyValues } from "lit";
import { UixForgeSparkBase } from "./uix-spark-base";
import { Uix } from "../../uix";
import { selectTree } from "../../helpers/selecttree";
import { apply_uix } from "../../helpers/apply_uix";

export class UixForgeSparkTooltip extends UixForgeSparkBase {
  type = "tooltip";

  private for: string = "";
  private content: string = "";
  private _tooltipElement: Promise<HTMLElement | void>;
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
    if (this._tooltipElement) {
      this._tooltipElement.then((el) => {
        if (el) {
          el.remove();
        }
      });
    }
  }

  private cancelTooltip() {
    this._cancel_tooltip.forEach((cancel) => cancel());
    this._cancel_tooltip = [];
    this._tooltipElement = Promise.resolve();
  }

  private async attachTooltip() {
    const element = await this._tooltipElement || await this.tooltipElement();
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

  private async tooltipElement() {
    this._tooltipElement = this._tooltip().catch((e) => {
      if (e.message == "NoElements") {
          console.info(`UIX Forge: spark: tooltip: No elements found. Looked for ${this.for}`);
        return;
      }
      if (e.message == "Cancelled") {
        return;
      }
      throw e;
    });
    return this._tooltipElement;
  }

  private async _tooltip(retries = 0): Promise<HTMLElement> {
    const parent = this.controller.forgedElement();
    const element = await selectTree(parent, this.for);
    if (!element) {
      if (retries > 5) throw new Error("NoElements");
      let timeout = new Promise((resolve, reject) => {
        setTimeout(resolve, retries * 100);
        this._cancel_tooltip.push(reject);
      });
      await timeout.catch((e) => {
        throw new Error("Cancelled");
      });
      return this._tooltip(retries + 1);
    }

    return element;
  };
}