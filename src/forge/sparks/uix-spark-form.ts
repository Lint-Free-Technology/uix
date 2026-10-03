import { PropertyValues } from "lit";
import {
  createHaForm,
  createHaFormButton,
  dispatchHaFormAction,
  haFormDataForSchema,
  haFormDefaultData,
  UixHaFormButtonConfig,
  UixHaFormDensity,
  UixHaFormElement,
  UixHaFormSchema,
  UIX_HA_FORM_DENSITIES,
  updateHaForm,
} from "../../helpers/dom/ha-form";
import { ensureCustomElement } from "../../helpers/dom/ensure-element";
import { UixForgeSparkBase } from "./uix-spark-base";
import type { UixForgeSparkController } from "./uix-spark-controller";

const FORM_ID_ATTR = "data-uix-forge-form-id";

const FORM_CSS = `
  .uix-forge-form {
    box-sizing: border-box;
    display: block;
    padding: var(--uix-form-padding, var(--ha-space-4, 16px));
    pointer-events: auto;
    width: 100%;
  }
  .uix-forge-form ha-form {
    display: block;
  }
  .uix-forge-form-actions {
    display: flex;
    flex-wrap: wrap;
    gap: var(--uix-form-actions-gap, var(--ha-space-2, 8px));
    justify-content: flex-end;
    margin-top: var(--uix-form-actions-margin-top, var(--ha-space-4, 16px));
  }
`;

type FormButtonConfig = UixHaFormButtonConfig & {
  action?: Record<string, any>;
};

export class UixForgeSparkForm extends UixForgeSparkBase {
  type = "form";

  private after = "";
  private before = "";
  private schema: UixHaFormSchema[] = [];
  private density: UixHaFormDensity = "spacious";
  private submit?: FormButtonConfig;
  private clear?: FormButtonConfig;
  private submitClears = true;
  private _data: Record<string, any>;
  private _wrapperElement: HTMLElement | null = null;
  private _actionsConfig = "";
  private _placement: {
    wrapper: HTMLElement;
    parent: Node;
    element: HTMLElement;
    before: boolean;
  } | null = null;
  private readonly _id: string;
  private readonly _stopPropagation = (event: Event) => event.stopPropagation();

  constructor(controller: UixForgeSparkController, config: Record<string, any>) {
    super(controller, config);
    this._id = `uix-forge-form-${Math.random().toString(36).slice(2, 11)}`;
    this._applyConfig(config);
    this._data = haFormDefaultData(this.schema);
  }

  configUpdated(config: Record<string, any>): void {
    super.configUpdated(config);
    const previousSchema = this.schema;
    this._applyConfig(config);
    this._data = haFormDataForSchema(this.schema, this._data, previousSchema);
    const form = this._wrapperElement?.querySelector(":scope > ha-form") as UixHaFormElement | null;
    if (form) form.data = this._data;
    const generation = this._beginUpdate();
    void this._attach(generation);
  }

  private _applyConfig(config: Record<string, any>): void {
    this.after = config.after || config.for || (config.before ? "" : this._defaultTarget());
    this.before = config.before || "";
    this.schema = Array.isArray(config.schema) ? config.schema : [];
    this.density = UIX_HA_FORM_DENSITIES.includes(config.density)
      ? config.density
      : "spacious";
    this.submit = this._buttonConfig(config.submit);
    this.clear = this._buttonConfig(config.clear);
    this.submitClears = config.submit?.clear !== false;
  }

  private _defaultTarget(): string {
    return this.controller.forge.forgedElementConfig?.type === "markdown"
      ? "hui-markdown-card $ ha-markdown"
      : this.defaultTarget("");
  }

  private _buttonConfig(config: unknown): FormButtonConfig | undefined {
    if (config === true) return {};
    return config && typeof config === "object" && !Array.isArray(config)
      ? config as FormButtonConfig
      : undefined;
  }

  updated(_changedProperties: PropertyValues): void {
    const generation = this._beginUpdate();
    void this._attach(generation);
  }

  connectedCallback(): void {
    const generation = this._beginUpdate();
    void this._attach(generation);
  }

  disconnectedCallback(): void {
    this._beginUpdate();
    this._remove();
  }

  private _remove(): void {
    this._placement = null;
    if (!this._wrapperElement) return;
    this._publishData(null);
    this._removeWrapperListeners(this._wrapperElement);
    this._wrapperElement.remove();
    this._wrapperElement = null;
    this._actionsConfig = "";
  }

  private async _attach(generation: number): Promise<void> {
    const selector = this.after || this.before;
    if (!selector) {
      this._remove();
      return;
    }

    try {
      await ensureCustomElement("ha-form");
    } catch (error) {
      console.warn("UIX Forge: form spark could not load ha-form", error);
      return;
    }
    if (generation !== this._callGeneration) return;

    const elements = await this.controller.target(selector, this._cancel);
    const element = elements?.[0];
    if (generation !== this._callGeneration) return;
    if (!element) {
      this._remove();
      return;
    }

    const parent = element.parentElement || element.parentNode;
    if (!parent) {
      this._remove();
      return;
    }

    const existingWrapper = (parent as ParentNode).querySelector?.(
      `div[${FORM_ID_ATTR}="${this._id}"]`,
    ) as HTMLElement | null;
    if (this._wrapperElement && !existingWrapper) this._remove();

    let wrapper = existingWrapper;
    if (!wrapper) {
      wrapper = document.createElement("div");
      wrapper.className = "uix-forge-form";
      wrapper.setAttribute(FORM_ID_ATTR, this._id);

      const style = document.createElement("style");
      style.textContent = FORM_CSS;
      wrapper.appendChild(style);
      this._addWrapperListeners(wrapper);
    }

    this._placeWrapper(wrapper, parent, element);
    this._wrapperElement = wrapper;
    this._updateElement(wrapper);
  }

  private _placeWrapper(wrapper: HTMLElement, parent: Node, element: HTMLElement): void {
    const slot = element.getAttribute("slot");
    if (slot) wrapper.setAttribute("slot", slot);
    else wrapper.removeAttribute("slot");

    const before = !!this.before && !this.after;
    if (
      this._placement?.wrapper === wrapper &&
      this._placement.parent === parent &&
      this._placement.element === element &&
      this._placement.before === before
    ) {
      return;
    }

    if (before) {
      if (wrapper.nextSibling !== element) parent.insertBefore(wrapper, element);
    } else if (element.nextSibling !== wrapper) {
      parent.insertBefore(wrapper, element.nextSibling);
    }
    this._placement = { wrapper, parent, element, before };
  }

  private _updateElement(wrapper: HTMLElement): void {
    let form = wrapper.querySelector(":scope > ha-form") as UixHaFormElement | null;
    if (!form) {
      form = createHaForm(this.controller.forge.hass, this.schema, this._data, this.density);
      const style = wrapper.querySelector(":scope > style");
      wrapper.insertBefore(form, style?.nextSibling ?? wrapper.firstChild);
    } else {
      updateHaForm(form, this.controller.forge.hass, this.schema, undefined, this.density);
    }
    this._updateActions(wrapper, form);
    this._publishData(this._data);
  }

  private _updateActions(wrapper: HTMLElement, form: UixHaFormElement): void {
    const hasActions = !!this.submit || !!this.clear;
    let actions = wrapper.querySelector(":scope > .uix-forge-form-actions") as HTMLElement | null;
    if (!hasActions) {
      actions?.remove();
      this._actionsConfig = "";
      return;
    }
    const actionsConfig = JSON.stringify({ clear: this.clear, submit: this.submit });
    if (!actions) {
      actions = document.createElement("div");
      actions.className = "uix-forge-form-actions";
      wrapper.appendChild(actions);
    } else if (actionsConfig === this._actionsConfig) {
      return;
    }
    actions.replaceChildren();

    if (this.clear) {
      const button = createHaFormButton(
        this.clear,
        "Clear",
        { variant: "neutral", appearance: "filled" },
      );
      button.addEventListener("click", () => {
        dispatchHaFormAction(button, this.clear?.action, form.data ?? {});
        this._clear(form);
      });
      actions.appendChild(button);
    }

    if (this.submit) {
      const button = createHaFormButton(
        this.submit,
        "Submit",
        { variant: "brand", appearance: "accent" },
      );
      button.addEventListener("click", () => {
        if (form.reportValidity?.() === false) return;
        const action = this.submit?.action;
        if (!action || typeof action !== "object" || Array.isArray(action)) return;
        dispatchHaFormAction(button, action, form.data ?? {});
        if (this.submitClears) this._clear(form);
      });
      actions.appendChild(button);
    }
    this._actionsConfig = actionsConfig;
  }

  private _clear(form: UixHaFormElement): void {
    this._data = {};
    form.data = this._data;
    this._publishData(this._data);
  }

  private _addWrapperListeners(wrapper: HTMLElement): void {
    wrapper.addEventListener("click", this._stopPropagation);
    wrapper.addEventListener("mousedown", this._stopPropagation);
    wrapper.addEventListener("touchstart", this._stopPropagation);
    wrapper.addEventListener("keydown", this._stopPropagation);
    wrapper.addEventListener("value-changed", this._handleValueChanged as EventListener);
  }

  private _removeWrapperListeners(wrapper: HTMLElement): void {
    wrapper.removeEventListener("click", this._stopPropagation);
    wrapper.removeEventListener("mousedown", this._stopPropagation);
    wrapper.removeEventListener("touchstart", this._stopPropagation);
    wrapper.removeEventListener("keydown", this._stopPropagation);
    wrapper.removeEventListener("value-changed", this._handleValueChanged as EventListener);
  }

  private _handleValueChanged = (event: CustomEvent<{ value?: Record<string, any> }>): void => {
    event.stopPropagation();
    this._data = event.detail?.value ?? {};
    const form = this._wrapperElement?.querySelector(":scope > ha-form") as UixHaFormElement | null;
    if (form) form.data = this._data;
    this._publishData(this._data);
  };

  private _publishData(data: Record<string, any> | null): void {
    this._wrapperElement?.dispatchEvent(new CustomEvent("uix-form-data-changed", {
      bubbles: true,
      composed: true,
      detail: { id: this._id, data },
    }));
  }
}
