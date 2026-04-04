import { PropertyValues } from "lit";
import { UixForgeSparkBase } from "./uix-spark-base";

export class UixForgeSparkTooltip extends UixForgeSparkBase {
  type = "tooltip";

  private for: string = "";
  private content: string = "";
  private placement: string = "top";
  private skidding: number = 0;
  private distance: number = 8;
  private withoutArrow: boolean = false;
  private showDelay: number = 150;
  private hideDelay: number = 150;
  private _tooltipElement: Element | null = null;

  constructor(controller: any, config: Record<string, any>) {
    super(controller, config);
    this._applyConfig(config);
  }

  configUpdated(config: Record<string, any>): void {
    super.configUpdated(config);
    this._applyConfig(config);
  }

  private _applyConfig(config: Record<string, any>) {
    this.for = config.for || "";
    this.content = config.content || "";
    this.placement = config.placement || "top";
    this.skidding = config.skidding || 0;
    this.distance = config.distance || 8;
    this.showDelay = config.show_delay || 150;
    this.hideDelay = config.hide_delay || 150;
    this.withoutArrow = config.without_arrow || false;
  }

  updated(_changedProperties: PropertyValues): void {
    const gen = this._beginUpdate();
    this._attach(gen);
  }

  connectedCallback(): void {
    const gen = this._beginUpdate();
    this._attach(gen);
  }

  disconnectedCallback(): void {
    this._cancelPending();
    this._remove();
  }

  private _remove() {
    if (this._tooltipElement) {
      this._tooltipElement.remove();
      this._tooltipElement = null;
    }
  }

  private async _attach(generation: number) {
    const elements = await this.controller.target(this.for, this._cancel);
    const element = elements?.[0];
    if (!element) return;
    if (generation !== this._callGeneration) return;

    const parent = element.parentElement || element.parentNode;
    if (!parent) return;
    if (!element.id) {
      element.id = `for-uix-forge-tooltip-${Math.random().toString(36).substring(2, 11)}`;
    }

    // If our tracked tooltip is no longer in this parent, remove it and start fresh
    const existingInParent = (parent as Element).querySelector?.(`wa-tooltip[for="${element.id}"]`) as Element | null;
    if (this._tooltipElement && !existingInParent) {
      this._tooltipElement.remove();
      this._tooltipElement = null;
    }

    const isNew = !this._tooltipElement;
    let tooltip = this._tooltipElement as any;
    if (!tooltip) {
      tooltip = document.createElement("wa-tooltip");
      tooltip.for = element.id;
      tooltip.style.setProperty("display", "contents");
      if (element.getAttribute("slot")) {
        tooltip.setAttribute("slot", element.getAttribute("slot")!);
      }
      element.style.setProperty("pointer-events", "auto");
    }

    // Update content in-place
    let content = tooltip.querySelector("div");
    if (!content) {
      content = document.createElement("div");
      tooltip.appendChild(content);
    }
    content.innerHTML = this.content;

    // Update styles in-place
    let style = tooltip.querySelector("style");
    if (!style) {
      style = document.createElement("style");
      tooltip.appendChild(style);
    }
    style.textContent = this.styles();

    // Update properties in-place
    tooltip.placement = this.placement;
    tooltip.skidding = this.skidding;
    tooltip.distance = this.distance;
    tooltip.showDelay = this.showDelay;
    tooltip.hideDelay = this.hideDelay;
    if (this.withoutArrow) {
      tooltip.setAttribute("without-arrow", "");
    } else {
      tooltip.removeAttribute("without-arrow");
    }

    // Only insert into the DOM when newly created
    if (isNew) {
      parent.appendChild(tooltip);
    }

    this._tooltipElement = tooltip;
  }

  private styles() {
    return `
    wa-tooltip {
      --wa-tooltip-background-color: var(--uix-tooltip-background-color, var(--secondary-background-color));
      --wa-tooltip-content-color: var(--uix-tooltip-content-color, var(--primary-text-color));
      --wa-tooltip-font-family: var(
        --uix-tooltip-font-family,
        var(--ha-tooltip-font-family, var(--ha-font-family-body))
      );
      --wa-tooltip-font-size: var(--uix-tooltip-font-size, var(--ha-tooltip-font-size, var(--ha-font-size-s)));
      --wa-tooltip-font-weight: var(
        --uix-tooltip-font-weight,
        var(--ha-tooltip-font-weight, var(--ha-font-weight-normal))
      );
      --wa-tooltip-line-height: var(
        --uix-tooltip-line-height,
        var(--ha-tooltip-line-height, var(--ha-line-height-condensed))
      );
      --wa-tooltip-padding: var(--uix-tooltip-padding, 8px);
      --wa-tooltip-border-radius: var(
        --uix-tooltip-border-radius,
        var(--ha-tooltip-border-radius, var(--ha-border-radius-sm))
      );
      --wa-tooltip-arrow-size: var(--uix-tooltip-arrow-size, var(--ha-tooltip-arrow-size, 8px));
      --wa-tooltip-border-width: var(--uix-tooltip-border-width, 0px);
      --wa-tooltip-border-color: var(--uix-tooltip-border-color);
      --wa-tooltip-border-style: var(--uix-tooltip-border-style);
      --max-width: var(--uix-tooltip-max-width, 30ch);
    }
    wa-tooltip::part(base__popup) {
      --show-duration: var(--uix-tooltip-show-duration, 100ms);
      --hide-duration: var(--uix-tooltip-hide-duration, 100ms);
      opacity: var(--uix-tooltip-opacity, 1);
    }
    wa-tooltip::part(body) {
      padding: var(--uix-tooltip-padding, 0.25em 0.5em);
      box-shadow: var(--uix-tooltip-box-shadow, var(--ha-card-box-shadow, none));
      font-weight: var(--uix-tooltip-font-weight, var(--ha-tooltip-font-weight, normal));
      font-family: var(--uix-tooltip-font-family, var(--ha-tooltip-font-family, inherit));
      text-align: var(--uix-tooltip-text-align, center);
      text-decoration: var(--uix-tooltip-text-decoration, none);
      text-transform: var(--uix-tooltip-text-transform, none);
      overflow-wrap: var(--uix-tooltip-overflow-wrap, normal);
    }`
  }
}