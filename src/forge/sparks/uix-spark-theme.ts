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
      .then(async () => {
        if (await this._restore()) this._notifyThemeUpdate();
      });
  }

  private _scheduleUpdate(): void {
    const generation = this._beginUpdate();
    this._transition = this._transition
      .catch(() => {})
      .then(async () => {
        const restored = await this._restore();
        if (generation !== this._callGeneration) return;
        const applied = await this._apply(generation);
        if (generation !== this._callGeneration) return;
        if (restored || applied) this._notifyThemeUpdate();
      });
  }

  private _notifyThemeUpdate() {
    document.dispatchEvent(
      new CustomEvent("uix-update", {
        detail: { reason: "theme", variablesChanged: false },
      })
    );
  }

  private async _restore(): Promise<boolean> {
    const targetElement = this._targetElement;
    if (!targetElement) return false;
    this._targetElement = null;
    return applyFrontendThemeOnElement(targetElement, undefined);
  }

  private async _apply(generation: number): Promise<boolean> {
    if (!this._theme) return false;
    const elements = await this.controller.target(this._for, this._cancel);
    const element = elements?.[0];
    if (!element) return false;
    if (generation !== this._callGeneration) return false;

    this._targetElement = element;
    const applied = await applyFrontendThemeOnElement(element, this._theme);
    if (generation !== this._callGeneration) {
      await applyFrontendThemeOnElement(element, undefined);
      if (this._targetElement === element) this._targetElement = null;
      return false;
    }
    return applied;
  }
}
