import { PropertyValues } from "lit";
import { ModdedElement, apply_uix } from "../../helpers/apply_uix";
import { UixForgeSparkBase } from "./uix-spark-base";
import type { UixForgeSparkController } from "./uix-spark-controller";
import { selectTree } from "../../helpers/selecttree";
import { hass_base_el } from "../../helpers/hass";

// https://github.com/home-assistant/frontend/blob/7f04b0884b186e3d8ed26fcb04b3813efd12604b/src/components/ha-card.ts#L11
const HA_CARD_CSS = `
  background: var(
    --ha-card-background,
    var(--card-background-color, white)
  );
  -webkit-backdrop-filter: var(--ha-card-backdrop-filter, none);
  backdrop-filter: var(--ha-card-backdrop-filter, none);
  box-shadow: var(--ha-card-box-shadow, none);
  box-sizing: border-box;
  border-radius: var(--ha-card-border-radius, var(--ha-border-radius-lg));
  border-width: var(--ha-card-border-width, 1px);
  border-style: solid;
  border-color: var(--ha-card-border-color, var(--divider-color, #e0e0e0));
  color: var(--primary-text-color);
  display: block;
  transition: all 0.3s ease-out;
  position: relative;
`;

const MORE_INFO_ID_ATTR = "data-uix-forge-more-info-id";

const MORE_INFO_CSS = `
  .uix-forge-more-info {
    display: block;
    width: 100%;
    pointer-events: auto;
    --safe-area-inset-bottom: 0px;
  }
  .uix-forge-more-info-details-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    min-height: var(--uix-more-info-details-head-height, 40px);
    padding: var(--uix-more-info-details-head-padding, 0 var(--ha-space-4, 16px));
    gap: var(--uix-more-info-details-head-gap, var(--ha-space-2, 8px));
  }
  .uix-forge-more-info-details-title {
    flex: 1;
    min-width: 0;
    color: var(--primary-text-color);
    font-family: var(--ha-font-family-body);
    font-size: var(--ha-font-size-l);
    font-weight: var(--ha-font-weight-medium);
    line-height: var(--ha-line-height-condensed);
  }
  .uix-forge-more-info-yaml-toggle {
    opacity: 0;
    pointer-events: none;
    transition: opacity var(--uix-more-info-details-transition-duration, 350ms) cubic-bezier(0.4, 0, 0.2, 1);
  }
  .uix-forge-more-info-details-head.expanded .uix-forge-more-info-yaml-toggle {
    opacity: 1;
    pointer-events: auto;
    transition: opacity var(--uix-more-info-details-transition-duration, 350ms) cubic-bezier(0.4, 0, 0.2, 1);
  }
  .uix-forge-more-info-details-head ha-icon-button {
    width: var(--uix-more-info-details-toggle-width, 32px);
    cursor: pointer;
    border-radius: 50%;
    background-size: cover;
    --mdc-icon-size: var(--uix-more-info-details-toggle-width, 32px);
    --ha-icon-button-size: var(--uix-more-info-details-toggle-width, 32px);
    --mdc-icon-button-size: var(--uix-more-info-details-toggle-width, 32px);
    transition: transform var(--uix-more-info-details-transition-duration, 350ms) cubic-bezier(0.4, 0, 0.2, 1);
    color: var(--uix-more-info-details-toggle-color, var(--primary-text-color));
    display: inline-flex;
  }
  .uix-forge-more-info-details-head ha-icon-button.uix-forge-more-info-details-toggle.open {
    transform: rotate(180deg);
  }
  .uix-forge-more-info-details-head ha-icon {
    display: flex;
  }
  div.uix-forge-more-info-details-wrap[no-info] {
    padding: var(--uix-more-info-details-no-info-outer-padding, var(--ha-space-6, 24px));
  }
  .uix-forge-more-info-details-wrap {
    padding: var(--uix-more-info-details-outer-padding, 0 var(--ha-space-6, 24px) var(--ha-space-6, 24px));
  }
  div.uix-forge-more-info-details {
    ${HA_CARD_CSS}
    overflow: hidden;
  }
  .uix-forge-more-info-details-content {
    overflow: hidden;
    transition: max-height var(--uix-more-info-details-transition-duration, 350ms) cubic-bezier(0.4, 0, 0.2, 1);
    max-height: 0;
  }
  div.uix-forge-more-info-details.expanded .uix-forge-more-info-details-content {
    max-height: var(--uix-more-info-details-max-height, unset);
    overflow: scroll;
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
  private info: boolean = true;
  private _wrapperElement: HTMLElement | null = null;
  private readonly _stopPropagation = (ev: Event) => ev.stopPropagation();
  // Delay (in milliseconds) as a safe yield after dialog element presence is confirmed to ensure child components are fully mounted and their event listeners are bound.
  private static readonly DIALOG_MOUNT_SAFE_DELAY_MS = 100;

  private async _waitForMoreInfoDialog(base: any): Promise<HTMLElement | undefined> {
    // Poll for the ha-more-info dialog and ha-adaptive-dialog to be present in the DOM, 
    // with a timeout of 20 retries (1 second total).
    let retries = 20;
    while (retries > 0) {
      const shadow = base.shadowRoot;
      if (shadow) {
        const innerDialog = shadow.querySelector("ha-more-info-dialog")?.shadowRoot?.querySelector("ha-adaptive-dialog");
        if (innerDialog) {
          return innerDialog;
        }
      }
      await new Promise((resolve) => setTimeout(resolve, 50));
      retries--;
    }
    return undefined; // Return undefined if the dialog is not found within the timeout
  }

  private readonly _handleShowChildView = async (ev: Event) => {
    ev.stopPropagation();
    const customEv = ev as CustomEvent;
    const detail = customEv.detail;

    const base = await hass_base_el();

    // Show more-info dialog for the entity
    const event = new CustomEvent("hass-more-info", {
      detail: { entityId: this.entity },
      bubbles: true,
      composed: true,
    });
    const target = this._wrapperElement || base;
    target?.dispatchEvent(event);

    // Wait until the dialog is ready
    const dialog: any = await this._waitForMoreInfoDialog(base);
    if (dialog) {
      await dialog.updateComplete; // Wait for the dialog to finish updating

      // Now fire the show-child-view event with the saved data on the dialog
      const showChildViewEvent = new CustomEvent("show-child-view", {
        detail: detail,
        bubbles: true,
        composed: true,
      });
      dialog.dispatchEvent(showChildViewEvent);
    }
  };
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
    this.info = config.info !== false;
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
    if (this.info) {
      if (!infoEl) {
        infoEl = document.createElement("ha-more-info-info") as MoreInfoInfoElement;
        // Ensure the spark's `<style>` tag remains the first child to preserve
        // the original DOM tree structure/ordering for existing installations.
        const styleEl = wrapperEl.querySelector(":scope > style");
        const referenceNode = styleEl ? styleEl.nextSibling : wrapperEl.firstChild;
        wrapperEl.insertBefore(infoEl, referenceNode);
      }

      infoEl.hass = hass;
      infoEl.entityId = this.entity;
      // Current HA more-info elements use `entityId`; keep `entity` in sync for
      // compatibility with older/custom more-info element implementations.
      infoEl.entity = this.entity;
      infoEl.entry = this._entry;
    } else {
      infoEl?.remove();
    }

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
      wrapperEl.querySelector(":scope > .uix-forge-more-info-details-wrap")?.remove();
      wrapperEl.querySelector(":scope > .uix-forge-more-info-details")?.remove();
    }
  }

  private _ensureDetails(wrapperEl: HTMLElement) {
    wrapperEl.querySelector(":scope > .uix-forge-more-info-details")?.remove();
    let detailsWrapEl = wrapperEl.querySelector(":scope > .uix-forge-more-info-details-wrap") as HTMLElement | null;
    let detailsEl = detailsWrapEl?.querySelector(":scope > .uix-forge-more-info-details") as HTMLElement | null;
    if (!detailsEl) {
      detailsWrapEl = document.createElement("div");
      detailsWrapEl.className = "uix-forge-more-info-details-wrap";
      detailsEl = document.createElement("div");
      detailsEl.className = "uix-forge-more-info-details";
      const headEl = document.createElement("div");
      headEl.className = "uix-forge-more-info-details-head";
      headEl.onclick = () => {
        this._detailsOpen = !this._detailsOpen;
        this._updateDetails(wrapperEl);
      }

      const titleEl = document.createElement("div");
      titleEl.className = "uix-forge-more-info-details-title";
      titleEl.textContent = "Details";
      headEl.appendChild(titleEl);

      const yamlButton = this._createIconButton(
        "mdi:code-braces",
        "Toggle YAML mode",
        (ev: Event) => {
          ev.stopPropagation();
          this._detailsYamlMode = !this._detailsYamlMode;
          this._updateDetails(wrapperEl);
        },
        "uix-forge-more-info-yaml-toggle"
      );
      headEl.appendChild(yamlButton);

      const toggleButton = this._createIconButton(
        "mdi:chevron-down",
        "Toggle details",
        (ev: Event) => {
          ev.stopPropagation();
          this._detailsOpen = !this._detailsOpen;
          this._updateDetails(wrapperEl);
        },
        "uix-forge-more-info-details-toggle"
      );
      headEl.appendChild(toggleButton);

      const contentEl = document.createElement("div");
      contentEl.className = "uix-forge-more-info-details-content";
      const detailsContent = document.createElement("ha-more-info-details") as MoreInfoDetailsElement;
      contentEl.appendChild(detailsContent);
      detailsEl.appendChild(headEl);
      detailsEl.appendChild(contentEl);
      detailsWrapEl.appendChild(detailsEl);
      wrapperEl.appendChild(detailsWrapEl);
    }

    this._updateDetails(wrapperEl);
  }

  private _createIconButton(icon: string, label: string, handler: (ev: Event) => void, className = ""): HTMLElement {
    const button = document.createElement("ha-icon-button") as HTMLElement & { label?: string };
    if (className) button.classList.add(className);
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
    wrapperEl.addEventListener("show-child-view", this._handleShowChildView);
  }

  private _removeWrapperListeners(wrapperEl: HTMLElement): void {
    wrapperEl.removeEventListener("click", this._stopPropagation);
    wrapperEl.removeEventListener("mousedown", this._stopPropagation);
    wrapperEl.removeEventListener("touchstart", this._stopPropagation);
    wrapperEl.removeEventListener("show-child-view", this._handleShowChildView);
  }

  private _updateDetails(wrapperEl: HTMLElement) {
    const detailsWrapEl = wrapperEl.querySelector(":scope > .uix-forge-more-info-details-wrap") as HTMLElement | null;
    const detailsEl = detailsWrapEl?.querySelector(":scope > .uix-forge-more-info-details") as HTMLElement | null;
    const headEl = detailsEl?.querySelector(":scope > .uix-forge-more-info-details-head") as HTMLElement | null;
    const yamlButton = headEl?.querySelector(":scope > .uix-forge-more-info-yaml-toggle") as HTMLElement | null;
    const toggleButton = headEl?.querySelector(":scope > .uix-forge-more-info-details-toggle") as HTMLElement | null;
    const contentEl = detailsEl?.querySelector(":scope > .uix-forge-more-info-details-content") as HTMLElement | null;
    const detailsContent = contentEl?.querySelector(":scope > ha-more-info-details") as MoreInfoDetailsElement | null;
    if (!detailsWrapEl || !detailsEl || !detailsContent) return;

    if (!this.info) {
      detailsWrapEl?.setAttribute("no-info", "true");
    } else {
      detailsWrapEl?.removeAttribute("no-info");
    }

    detailsEl.classList.toggle("expanded", this._detailsOpen);
    contentEl?.setAttribute("aria-hidden", this._detailsOpen ? "false" : "true");
    headEl?.classList.toggle("expanded", this._detailsOpen);
    yamlButton?.setAttribute("aria-hidden", this._detailsOpen ? "false" : "true");
    yamlButton?.setAttribute("tabindex", this._detailsOpen ? "0" : "-1");
    toggleButton?.classList.toggle("open", this._detailsOpen);

    detailsContent.hass = this.controller.forge.hass;
    detailsContent.entry = this._entry;
    detailsContent.params = { entityId: this.entity };
    detailsContent.yamlMode = this._detailsYamlMode;
    if (this._detailsYamlMode) {
      selectTree(detailsContent.shadowRoot, "ha-yaml-editor", false, 2000).then((yamlEditor) => {
        if (yamlEditor) {
          yamlEditor.inDialog = false;
        }
      }).catch(() => {});
    }
  }
}
