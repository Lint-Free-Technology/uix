import { PropertyValues } from "lit";
import { UixLockOverlay } from "../../helpers/dom/lock-overlay";
import { UixForgeSparkBase } from "./uix-spark-base";

/** Forge wrapper for the shared lock overlay. */
export class UixForgeSparkLock extends UixForgeSparkBase {
  type = "lock";

  private targetSelector = "";
  private entity = "";
  private unlockedAction: Record<string, any> | null = null;
  private readonly lock: UixLockOverlay;

  constructor(controller: any, config: Record<string, any>) {
    super(controller, config);
    this.lock = new UixLockOverlay({
      id: `uix-forge-lock-${Math.random().toString(36).slice(2, 11)}`,
      overlayAttribute: "data-uix-forge-lock-id",
      getUser: () => this.controller.forge.hass?.user,
      isRow: () => this.controller.forge.mold?.isRow() === true,
      onUnlocked: (overlay) => this.executeUnlockAction(overlay),
    });
    this.applyConfig(config);
  }

  configUpdated(config: Record<string, any>): void {
    super.configUpdated(config);
    this.applyConfig(config);
  }

  private applyConfig(config: Record<string, any>): void {
    this.targetSelector = config.for || this.defaultTarget("");
    this.entity = config.entity || "";
    this.unlockedAction = config.unlocked_action || null;
    this.lock.configure(config);
  }

  updated(_changedProperties: PropertyValues): void {
    this.attach(this._beginUpdate());
  }

  connectedCallback(): void {
    this.attach(this._beginUpdate());
  }

  disconnectedCallback(): void {
    this._cancelPending();
    this.lock.detach();
  }

  private async attach(generation: number): Promise<void> {
    const elements = await this.controller.target(this.targetSelector || "element", this._cancel);
    if (generation !== this._callGeneration) return;
    const target = elements?.[0] as HTMLElement | undefined;
    if (target) this.lock.attach(target);
  }

  private executeUnlockAction(source: HTMLElement): void {
    const action = this.unlockedAction?.action;
    if (!action) return;
    if (action.startsWith("element_")) {
      source.dispatchEvent(new CustomEvent("hass-action", {
        bubbles: true,
        composed: true,
        detail: { config: this.controller.forge.forgedElementConfig, action: action.slice("element_".length) },
      }));
      return;
    }
    const config: Record<string, any> = { tap_action: { ...this.unlockedAction } };
    if (this.entity) config.entity = this.entity;
    source.dispatchEvent(new CustomEvent("hass-action", {
      bubbles: true,
      composed: true,
      detail: { config, action: "tap" },
    }));
  }
}
