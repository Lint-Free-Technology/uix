import { PropertyValues } from "lit";
import { applyFrontendThemeOnElement } from "../../helpers/frontend_themes";
import { UixForgeSparkBase } from "./uix-spark-base";

export class UixForgeSparkTheme extends UixForgeSparkBase {
  type = "theme";

  private _for: string = "element";
  private _theme: string = "";
  private _targetElement: HTMLElement | null = null;

  constructor(controller: any, config: Record<string, any>) {
    super(controller, config);
    this._applyConfig(config);
  }

  configUpdated(config: Record<string, any>): void {
    super.configUpdated(config);
    this._applyConfig(config);
  }

  private _applyConfig(config: Record<string, any>) {
    this._for = config.for || "element";
    this._theme = config.theme || "";
  }

  updated(_changedProperties: PropertyValues): void {
    const gen = this._beginUpdate();
    this._restore();
    this._apply(gen);
  }

  connectedCallback(): void {
    const gen = this._beginUpdate();
    this._restore();
    this._apply(gen);
  }

  disconnectedCallback(): void {
    this._cancelPending();
    this._restore();
  }

  private _notifyThemeUpdate() {
    document.dispatchEvent(
      new CustomEvent("uix_update", {
        detail: { variablesChanged: false },
      })
    );
  }

  private _restore() {
    if (!this._targetElement) return;
    void applyFrontendThemeOnElement(this._targetElement, undefined, true);
    this._targetElement = null;
    this._notifyThemeUpdate();
  }

  private async _apply(generation: number) {
    if (!this._theme) return;
    const elements = await this.controller.target(this._for, this._cancel);
    const element = elements?.[0];
    if (!element) return;
    if (generation !== this._callGeneration) return;

    this._targetElement = element;
    await applyFrontendThemeOnElement(element, this._theme);
    if (generation !== this._callGeneration) {
      void applyFrontendThemeOnElement(element, undefined, true);
      this._targetElement = null;
      return;
    }
    this._notifyThemeUpdate();
  }
}
