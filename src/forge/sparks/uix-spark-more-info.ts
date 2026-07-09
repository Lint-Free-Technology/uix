import { PropertyValues } from "lit";
import { ModdedElement, apply_uix } from "../../helpers/apply_uix";
import { UixForgeSparkBase } from "./uix-spark-base";
import type { UixForgeSparkController } from "./uix-spark-controller";

const MORE_INFO_ID_ATTR = "data-uix-forge-more-info-id";

const MORE_INFO_CSS = `
  .uix-forge-more-info {
    display: block;
    width: 100%;
    pointer-events: auto;
  }
  .uix-forge-more-info-details-head {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    min-height: var(--uix-more-info-details-head-height, 40px);
    padding: var(--uix-more-info-details-head-padding, 0 var(--ha-space-4, 16px));
    gap: var(--uix-more-info-details-head-gap, var(--ha-space-2, 8px));
  }
  .uix-forge-more-info-details-head ha-icon-button {
    width: var(--uix-more-info-details-toggle-width, 32px);
    cursor: pointer;
    border-radius: 50%;
    background-size: cover;
    --mdc-icon-size: var(--uix-more-info-details-toggle-width, 32px);
    --ha-icon-button-size: var(--uix-more-info-details-toggle-width, 32px);
    --mdc-icon-button-size: var(--uix-more-info-details-toggle-width, 32px);
    transition: transform var(--uix-more-info-details-transition-duration, 150ms) cubic-bezier(0.4, 0, 0.2, 1);
    color: var(--uix-more-info-details-toggle-color, var(--primary-text-color));
    display: inline-flex;
  }
  .uix-forge-more-info-details-head ha-icon-button.uix-forge-more-info-details-toggle.open {
    transform: rotate(180deg);
  }
  .uix-forge-more-info-details-head ha-icon {
    display: flex;
  }
  .uix-forge-more-info-details {
    overflow: hidden;
    transition: calc(var(--uix-more-info-details-transition-duration, 150ms) * 2) cubic-bezier(0.4, 0, 0.2, 1);
    transition-property: max-height, margin-top;
    margin-top: 0;
    max-height: 0;
  }
  .uix-forge-more-info-details.expanded {
    margin-top: var(--uix-more-info-details-margin-top, 8px);
    max-height: var(--uix-more-info-details-max-height, 80vh);
  }
`;

interface MoreInfoEntityRegistryEntry {
  entity_id: string;
  [key: string]: any;
}

interface MoreInfoInfoElement extends HTMLElement {
  hass?: any;
  entityId?: string;
  entity?: string;
  entry?: MoreInfoEntityRegistryEntry | null;
}

interface MoreInfoDetailsElement extends HTMLElement {
  hass?: any;
  entry?: MoreInfoEntityRegistryEntry | null;
  params?: { entityId: string };
  yamlMode?: boolean;
}

export class UixForgeSparkMoreInfo extends UixForgeSparkBase {
  type = "more-info";

  private after: string = "";
  private before: string = "";
  private entity: string = "";
  private details: boolean = false;
  private _wrapperElement: HTMLElement | null = null;
  private readonly _stopPropagation = (ev: Event) => ev.stopPropagation();
  // `undefined` means not loaded yet, `null` means the registry lookup failed
  // or found no entry, and an object is the loaded registry entry.
  private _entry: MoreInfoEntityRegistryEntry | null | undefined = undefined;
  private _entryEntityId: string = "";
  private _detailsOpen: boolean = false;
  private _detailsYamlMode: boolean = false;
  private readonly _id: string;

  constructor(controller: UixForgeSparkController, config: Record<string, any>) {
    super(controller, config);
    this._id = `uix-forge-more-info-${Math.random().toString(36).slice(2, 11)}`;
    this._applyConfig(config);
  }

  configUpdated(config: Record<string, any>): void {
    super.configUpdated(config);
    this._applyConfig(config);
    const gen = this._beginUpdate();
    this._attach(gen);
  }

  private _applyConfig(config: Record<string, any>) {
    this.after = config.after || config.for || this.defaultTarget("");
    this.before = config.before || "";
    this.entity = config.entity || this.controller.forge.forgedElementConfig?.entity || "";
    this.details = config.details === true;
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
    if (this._wrapperElement) {
      this._removeWrapperListeners(this._wrapperElement);
      this._wrapperElement.remove();
      this._wrapperElement = null;
    }
  }

  private async _attach(generation: number) {
    const selector = this.after || this.before;
    if (!selector || !this.entity) {
      this._remove();
      return;
    }

    const elements = await this.controller.target(selector, this._cancel);
    const element = elements?.[0];
    if (!element) return;
    if (generation !== this._callGeneration) return;

    const parent = element.parentElement || element.parentNode;
    if (!parent) return;

    const existingWrapper = (parent as ParentNode).querySelector?.(
      `div[${MORE_INFO_ID_ATTR}="${this._id}"]`
    ) as HTMLElement | null;

    if (this._wrapperElement && !existingWrapper) {
      this._removeWrapperListeners(this._wrapperElement);
      this._wrapperElement.remove();
      this._wrapperElement = null;
    }

    let wrapperEl = existingWrapper;
    if (!wrapperEl) {
      wrapperEl = document.createElement("div");
      wrapperEl.className = "uix-forge-more-info";
      wrapperEl.setAttribute(MORE_INFO_ID_ATTR, this._id);
      wrapperEl.style.pointerEvents = "auto";

      const styleEl = document.createElement("style");
      styleEl.textContent = MORE_INFO_CSS;
      wrapperEl.appendChild(styleEl);

      const slot = element.getAttribute("slot");
      if (slot) {
        wrapperEl.setAttribute("slot", slot);
      }

      this._addWrapperListeners(wrapperEl);

      if (this.before) {
        parent.insertBefore(wrapperEl, element);
      } else {
        const nextSibling = element.nextSibling;
        if (nextSibling) {
          parent.insertBefore(wrapperEl, nextSibling);
        } else {
          parent.appendChild(wrapperEl);
        }
      }
    }

    this._wrapperElement = wrapperEl;
    await this._loadEntry(generation);
    if (generation !== this._callGeneration) return;
    this._updateElement(wrapperEl);
  }

  private async _loadEntry(generation: number): Promise<void> {
    const hass = this.controller.forge.hass;
    if (!hass?.callWS || !this.entity) {
      this._entry = undefined;
      this._entryEntityId = "";
      return;
    }
    // Avoid re-querying on every hass update once a lookup has completed for
    // this entity; config/entity changes reset the loaded state by changing the
    // entity id used below.
    if (this._entryEntityId === this.entity && this._entry !== undefined) return;

    this._entryEntityId = this.entity;
    try {
      const entry = await hass.callWS({
        type: "config/entity_registry/get",
        entity_id: this.entity,
      });
      if (generation === this._callGeneration && this._entryEntityId === this.entity) {
        this._entry = entry;
      }
    } catch (err) {
      console.debug("UIX Forge: more-info spark failed to load entity registry entry", err);
      if (generation === this._callGeneration && this._entryEntityId === this.entity) {
        this._entry = null;
      }
    }
  }

  private _updateElement(wrapperEl: HTMLElement) {
    const hass = this.controller.forge.hass;
    let infoEl = wrapperEl.querySelector(":scope > ha-more-info-info") as MoreInfoInfoElement | null;
    if (!infoEl) {
      infoEl = document.createElement("ha-more-info-info") as MoreInfoInfoElement;
      wrapperEl.appendChild(infoEl);
    }

    infoEl.hass = hass;
    infoEl.entityId = this.entity;
    // Current HA more-info elements use `entityId`; keep `entity` in sync for
    // compatibility with older/custom more-info element implementations.
    infoEl.entity = this.entity;
    infoEl.entry = this._entry;

    void apply_uix(
      wrapperEl as ModdedElement,
      "more-info",
      undefined,
      {
        config: {
          entity: this.entity,
          entity_id: this.entity,
          entityId: this.entity,
        },
      },
      false
    );

    if (this.details) {
      this._ensureDetails(wrapperEl);
    } else {
      wrapperEl.querySelector(":scope > .uix-forge-more-info-details-head")?.remove();
      wrapperEl.querySelector(":scope > .uix-forge-more-info-details")?.remove();
    }
  }

  private _ensureDetails(wrapperEl: HTMLElement) {
    let headEl = wrapperEl.querySelector(":scope > .uix-forge-more-info-details-head") as HTMLElement | null;
    if (!headEl) {
      headEl = document.createElement("div");
      headEl.className = "uix-forge-more-info-details-head";

      const yamlButton = this._createIconButton("mdi:code-braces", "Toggle YAML mode", () => {
        this._detailsYamlMode = !this._detailsYamlMode;
        this._updateDetails(wrapperEl);
      });
      yamlButton.classList.add("uix-forge-more-info-yaml-toggle");
      headEl.appendChild(yamlButton);

      const toggleButton = this._createIconButton("mdi:chevron-down", "Toggle details", () => {
        this._detailsOpen = !this._detailsOpen;
        this._updateDetails(wrapperEl);
      });
      toggleButton.classList.add("uix-forge-more-info-details-toggle");
      headEl.appendChild(toggleButton);

      wrapperEl.appendChild(headEl);
    }

    let detailsEl = wrapperEl.querySelector(":scope > .uix-forge-more-info-details") as HTMLElement | null;
    if (!detailsEl) {
      detailsEl = document.createElement("div");
      detailsEl.className = "uix-forge-more-info-details";
      const detailsContent = document.createElement("ha-more-info-details") as MoreInfoDetailsElement;
      detailsEl.appendChild(detailsContent);
      wrapperEl.appendChild(detailsEl);
    }

    this._updateDetails(wrapperEl);
  }

  private _createIconButton(icon: string, label: string, handler: (ev: Event) => void): HTMLElement {
    const button = document.createElement("ha-icon-button") as HTMLElement & { label?: string };
    button.label = label;
    button.setAttribute("aria-label", label);
    button.setAttribute("role", "button");
    button.setAttribute("tabindex", "0");
    const iconEl = document.createElement("ha-icon") as HTMLElement & { icon?: string };
    iconEl.icon = icon;
    button.appendChild(iconEl);
    button.onclick = handler;
    button.onkeydown = (ev: KeyboardEvent) => {
      if (ev.key !== "Enter" && ev.key !== " ") return;
      ev.preventDefault();
      handler(ev);
    };
    return button;
  }

  private _addWrapperListeners(wrapperEl: HTMLElement): void {
    wrapperEl.addEventListener("click", this._stopPropagation);
    wrapperEl.addEventListener("mousedown", this._stopPropagation);
    wrapperEl.addEventListener("touchstart", this._stopPropagation);
  }

  private _removeWrapperListeners(wrapperEl: HTMLElement): void {
    wrapperEl.removeEventListener("click", this._stopPropagation);
    wrapperEl.removeEventListener("mousedown", this._stopPropagation);
    wrapperEl.removeEventListener("touchstart", this._stopPropagation);
  }

  private _updateDetails(wrapperEl: HTMLElement) {
    const detailsEl = wrapperEl.querySelector(":scope > .uix-forge-more-info-details") as HTMLElement | null;
    const toggleButton = wrapperEl.querySelector(
      ":scope > .uix-forge-more-info-details-head .uix-forge-more-info-details-toggle"
    ) as HTMLElement | null;
    const detailsContent = detailsEl?.querySelector(":scope > ha-more-info-details") as MoreInfoDetailsElement | null;
    if (!detailsEl || !detailsContent) return;

    detailsEl.classList.toggle("expanded", this._detailsOpen);
    detailsEl.setAttribute("aria-hidden", this._detailsOpen ? "false" : "true");
    toggleButton?.classList.toggle("open", this._detailsOpen);

    detailsContent.hass = this.controller.forge.hass;
    detailsContent.entry = this._entry;
    detailsContent.params = { entityId: this.entity };
    detailsContent.yamlMode = this._detailsYamlMode;
  }
}
