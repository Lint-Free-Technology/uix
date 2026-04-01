import { PropertyValues } from "lit";
import { UixForgeSparkBase } from "./uix-spark-base";

export class UixForgeSparkAttribute extends UixForgeSparkBase {
  type = "attribute";

  private selector: string = "";
  private attribute: string = "";
  private action: "replace" | "remove" = "replace";
  private value: string = "";
  private _cancel: (() => void)[] = [];
  private _targetElement: HTMLElement | null = null;
  private _originalAttribute: string = "";
  private _originalValue: string | null | undefined = undefined;
  private _hasOriginal: boolean = false;

  constructor(controller: any, config: Record<string, any>) {
    super(controller, config);
    this._applyConfig(config);
  }

  configUpdated(config: Record<string, any>): void {
    super.configUpdated(config);
    this._applyConfig(config);
  }

  private _applyConfig(config: Record<string, any>) {
    this.selector = config.for || "";
    this.attribute = config.attribute || "";
    this.action = config.action || "replace";
    this.value = config.value ?? "";
  }

  updated(_changedProperties: PropertyValues): void {
    this._cancel_pending();
    this._restore();
    this._apply();
  }

  connectedCallback(): void {
    this._cancel_pending();
    this._restore();
    this._apply();
  }

  disconnectedCallback(): void {
    this._cancel_pending();
    this._restore();
  }

  private _cancel_pending() {
    this._cancel.forEach((c) => c());
    this._cancel = [];
  }

  private _restore() {
    if (this._hasOriginal && this._targetElement) {
      if (this._originalValue === null) {
        this._targetElement.removeAttribute(this._originalAttribute);
      } else {
        this._targetElement.setAttribute(this._originalAttribute, this._originalValue);
      }
    }
    this._targetElement = null;
    this._originalValue = undefined;
    this._originalAttribute = "";
    this._hasOriginal = false;
  }

  private async _apply() {
    if (!this.attribute) return;
    const elements = await this.controller.target(this.selector, this._cancel);
    const element = elements?.[0];
    if (!element) return;

    this._targetElement = element;
    this._originalAttribute = this.attribute;
    this._originalValue = element.hasAttribute(this.attribute)
      ? element.getAttribute(this.attribute)
      : null;
    this._hasOriginal = true;

    if (this.action === "remove") {
      element.removeAttribute(this.attribute);
    } else {
      element.setAttribute(this.attribute, this.value);
    }
  }
}
