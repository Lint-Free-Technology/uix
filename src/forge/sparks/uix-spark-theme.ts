import { PropertyValues } from "lit";
import { applyFrontendThemeOnElement } from "../../helpers/frontend_themes";
import type { UixForgeSparkController } from "./uix-spark-controller";
import { UixForgeSparkBase } from "./uix-spark-base";

interface UixForgeSparkThemeConfig {
  for?: string;
  theme?: string;
}

export class UixForgeSparkTheme extends UixForgeSparkBase {
  type = "theme";

  private _for: string = "";
  private _theme: string = "";
  private _targetElement: HTMLElement | null = null;
  private _transition: Promise<void> = Promise.resolve();

  constructor(controller: UixForgeSparkController, config: UixForgeSparkThemeConfig) {
    super(controller, config);
    this._applyConfig(config);
  }

  configUpdated(config: UixForgeSparkThemeConfig): void {
    super.configUpdated(config);
    this._applyConfig(config);
  }

  private _applyConfig(config: UixForgeSparkThemeConfig) {
    this._for = config.for || this.defaultTarget();
    this._theme = config.theme || "";
  }

  updated(_changedProperties: PropertyValues): void {
    this._scheduleUpdate();
  }

  connectedCallback(): void {
    this._scheduleUpdate();
  }

  disconnectedCallback(): void {
    this._beginUpdate();
    this._transition = this._transition
      .catch(() => {})
      .then(() => this._restore());
  }

  private _scheduleUpdate(): void {
    const generation = this._beginUpdate();
    this._transition = this._transition
      .catch(() => {})
      .then(async () => {
        await this._restore();
        if (generation !== this._callGeneration) return;
        await this._apply(generation);
      });
  }

  private _notifyThemeUpdate() {
    document.dispatchEvent(
      new CustomEvent("uix-update", {
        detail: { reason: "theme", variablesChanged: false },
      })
    );
  }

  private async _restore(): Promise<void> {
    const targetElement = this._targetElement;
    if (!targetElement) return;
    this._targetElement = null;
    await applyFrontendThemeOnElement(targetElement, undefined);
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
      await applyFrontendThemeOnElement(element, undefined);
      if (this._targetElement === element) this._targetElement = null;
      return;
    }
    this._notifyThemeUpdate();
  }
}
