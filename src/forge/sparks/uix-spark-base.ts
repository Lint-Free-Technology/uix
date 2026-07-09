import { PropertyValues } from "lit";
import { UixForgeSparkController } from "./uix-spark-controller";

const UIX_FORGE_ELEMENT_DEFAULT_TARGET_SELECTOR = {
  "custom:uix-forge-blank-card": "uix-forge-blank-card $ div.content",
  default: "element"
}

export abstract class UixForgeSparkBase {
  controller: UixForgeSparkController;
  config: Record<string, any> = {};

  abstract type: string;

  /** Cancel callbacks for pending async operations (e.g. target resolution retries). */
  protected _cancel: (() => void)[] = [];

  /**
   * Monotonically-increasing counter incremented before every async update.
   * Async methods check this to bail out if a newer call has superseded them,
   * preventing stale operations from running after an update or reconnect.
   */
  protected _callGeneration = 0;

  constructor(controller: UixForgeSparkController, config: Record<string, any>) {
    this.controller = controller;
    this.config = config;
  }

  templateVariables() {
    return {};
  }

  beforeForgedElementRefresh() {}

  connectedCallback() {}

  disconnectedCallback() {}

  updated(_changedProperties: PropertyValues) {}

  configUpdated(config: Record<string, any>) {
    this.config = config;
  }

  defaultTarget(defaultSelector?: string): string {
    const forgeElementConfig = this.controller.forge.forgedElementConfig;
    if (forgeElementConfig?.type && UIX_FORGE_ELEMENT_DEFAULT_TARGET_SELECTOR[forgeElementConfig.type]) {
      return UIX_FORGE_ELEMENT_DEFAULT_TARGET_SELECTOR[forgeElementConfig.type];
    }
    return defaultSelector ?? UIX_FORGE_ELEMENT_DEFAULT_TARGET_SELECTOR.default;
  }

  /** Cancel all pending async operations (e.g. target resolution retries). */
  protected _cancelPending(): void {
    this._cancel.forEach((c) => c());
    this._cancel = [];
  }

  /**
   * Cancel pending operations, increment the call generation counter, and
   * return the new generation number.
   *
   * Sparks should call this at the start of `updated()` and
   * `connectedCallback()`, then pass the returned number to their async
   * apply/attach method.  After each `await` the async method should bail
   * out if `generation !== this._callGeneration`, ensuring only the most
   * recently issued call proceeds when multiple updates are queued before
   * any microtask runs (e.g. during an edit-mode toggle).
   */
  protected _beginUpdate(): number {
    this._cancelPending();
    return ++this._callGeneration;
  }
}