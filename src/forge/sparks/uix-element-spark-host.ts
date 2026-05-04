import { UixSparkHost } from "./uix-spark-host";

/**
 * UixElementSparkHost wraps a regular patched HTMLElement so that it can be
 * used as the host for a UixForgeSparkController, enabling foundry-based sparks
 * to be applied to themed elements (e.g. persistent-notification-item) without
 * requiring a uix-forge custom card.
 *
 * Sparks reach back to `controller.forge.*` — this adapter satisfies all of
 * those accesses in a way that makes sense for a plain element host:
 *
 *   - `hass`               — the element's own `hass` property.  Most Home
 *                            Assistant built-in elements receive `hass` through
 *                            the HA component tree, so `(element as any).hass`
 *                            is expected to be populated.  If the element does
 *                            not have a `hass` property it will be `undefined`,
 *                            which is handled gracefully by sparks via optional
 *                            chaining (`hass?.user`, etc.).
 *   - `forgedElement`      — the element itself (sparks navigate *within* it).
 *   - `hidden`             — always `false`; the element is visible when UIX runs.
 *   - `mold`               — `undefined`; no forge mold concept for plain elements.
 *   - `forgedElementConfig`— the element's `config` property if present, else `{}`.
 *   - `refreshForgeTemplates` / `refreshForge` — no-ops; the element manages its
 *                            own reactive update cycle through HA/Lit.
 */
export class UixElementSparkHost implements UixSparkHost {
  private readonly _element: HTMLElement;

  constructor(element: HTMLElement) {
    this._element = element;
  }

  get hass(): any {
    return (this._element as any).hass;
  }

  get forgedElement(): HTMLElement | null {
    return this._element;
  }

  get hidden(): boolean {
    return false;
  }

  get mold(): undefined {
    return undefined;
  }

  get forgedElementConfig(): any {
    return (this._element as any).config ?? {};
  }

  refreshForgeTemplates(): void {
    // No-op: themed elements manage their own update cycle.
  }

  refreshForge(_path?: string[]): void {
    // No-op: themed elements manage their own update cycle.
  }
}
