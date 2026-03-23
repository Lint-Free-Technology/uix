import { html, LitElement, nothing, PropertyValues } from "lit";
import { HuiBadge, HuiCard, LovelaceElement, UIX_FORGE_ALLOWED_CONFIG_KEYS, UIX_FORGE_DEFAULT_TEMPLATE_VALUE, UIX_FORGE_NESTED_TEMPLATE_MARKER, UIX_FORGE_TYPE, UixForgeConfig, UixForgeConfigBuilder, UixForgeConfigPath, UixMacroConfig } from "./uix-forge-types";
import { property, state } from "lit/decorators.js";
import { hass, translate } from "../helpers/hass";
import { bind_template, hasTemplate, unbind_template } from "../helpers/templates";
import { apply_uix, buildMacros, ModdedElement } from "../helpers/apply_uix";
import { UIX_FORGE_MOLD_CLASSES, UixForgeMold } from "./molds/uix-mold";
import { UixForgeSparkController } from "./sparks/uix-spark-controller";

declare global {
  interface HTMLElementTagNameMap {
    [UIX_FORGE_TYPE]: UixForge;
  }
}

function _mergeFoundryConfig(foundry: any, local: any): any {
  if (!foundry) return local ?? {};
  if (!local) return foundry ?? {};
  const result = { ...foundry };
  for (const key of Object.keys(local)) {
    const lv = local[key];
    const fv = result[key];
    if (
      lv !== null &&
      typeof lv === "object" &&
      !Array.isArray(lv) &&
      fv !== null &&
      typeof fv === "object" &&
      !Array.isArray(fv)
    ) {
      result[key] = _mergeFoundryConfig(fv, lv);
    } else {
      result[key] = lv;
    }
  }
  return result;
}

export class UixForge extends LitElement {
  @property({attribute: false}) hass: any;
  @property({attribute: false}) preview: boolean;
  @property({attribute: false}) layout: boolean;
  @property({attribute: false}) connectedWhileHidden: boolean;
  @state() config: UixForgeConfig;
  @state() forgedElement: LovelaceElement;
  @state() templatesReady: boolean;
  private _mold: UixForgeMold;
  private _macros: UixMacroConfig;
  private _templateNestingOpen: string;
  private _templateNestingClose: string;
  private _showError: boolean;
  private _forgeConfig: UixForgeConfigBuilder;
  private _forgedElementConfig: UixForgeConfigBuilder;
  private _sparkController: UixForgeSparkController;
  private _disconnectTimeout?: number;
  private _foundryUpdateListener?: EventListener;
  private _resolvedUix?: any;

  constructor() {
      super();
      this.connectedWhileHidden = true;
      this.templatesReady = false;
      this._showError = false;
      this._forgeConfig = new UixForgeConfigBuilder(this.refreshForge.bind(this));
      this._forgedElementConfig = new UixForgeConfigBuilder(this.refreshForgedElement.bind(this));
      this._sparkController = new UixForgeSparkController(this);
  }

  public static getStubConfig(): UixForgeConfig {
    return {
      type: `custom:${UIX_FORGE_TYPE}`,
    };
  }

  private _resolveFoundry(
    config: { foundry?: string; forge?: any; element?: any; uix?: any },
    visited: Set<string> = new Set()
  ): { forge: any; element: any; uix: any } | null {
    const foundryName = config.foundry;

    if (foundryName) {
      const coordinator = (window as any).uixCoordinator;
      // If the coordinator foundries haven't been loaded yet, return null to indicate "pending"
      if (!coordinator?.foundries || (Object.keys(coordinator.foundries).length === 0 && !coordinator.ready)) {
        return null;
      }
      const foundryData = coordinator.foundries[foundryName];
      if (!foundryData) {
        throw new Error(`Foundry '${foundryName}' not found. Check that it is defined in the UIX integration.`);
      }
      if (visited.has(foundryName)) {
        throw new Error(`Circular foundry reference detected: '${foundryName}'.`);
      }
      const nextVisited = new Set(visited);
      nextVisited.add(foundryName);

      // Recursively resolve the foundry's own base (if it also references another foundry)
      const baseResolved = this._resolveFoundry(foundryData, nextVisited);
      if (baseResolved === null) return null;

      // foundryData overrides base, local config overrides foundry
      const mergedForge = _mergeFoundryConfig(_mergeFoundryConfig(baseResolved.forge, foundryData.forge), config.forge);
      const mergedElement = _mergeFoundryConfig(_mergeFoundryConfig(baseResolved.element, foundryData.element), config.element);
      const mergedUix = _mergeFoundryConfig(_mergeFoundryConfig(baseResolved.uix, foundryData.uix), config.uix ?? {});
      return { forge: mergedForge, element: mergedElement, uix: mergedUix };
    }

    return {
      forge: config.forge ?? {},
      element: config.element ?? {},
      uix: config.uix ?? {},
    };
  }

  public setConfig(config: UixForgeConfig) {
    if (!config) throw new Error("No config");
    if (!config.foundry && !config.forge) {
      throw new Error("forge config or foundry is required");
    }
    if (!config.foundry && !config.element) {
      throw new Error("element config is required");
    }
    Object.keys(config).forEach((k) => {
      if (!UIX_FORGE_ALLOWED_CONFIG_KEYS.includes(k)) {
        throw new Error(`unexpected config key ${k}`);
      }
    });

    this.templatesReady = false;
    this.config = config;

    const resolved = this._resolveFoundry(config);
    if (!resolved) {
      // Foundry not yet available – defer until foundries are loaded
      if (!this._foundryUpdateListener) {
        this._foundryUpdateListener = () => this._onFoundryUpdate();
        window.addEventListener("uix-foundries-updated", this._foundryUpdateListener);
      }
      return;
    }

    this._resolvedUix = resolved.uix;

    this._applyResolvedConfig(resolved.forge, resolved.element);
  }

  private _applyResolvedConfig(resolvedForge: any, resolvedElement: any) {
    if (!resolvedForge || Object.keys(resolvedForge).length === 0) {
      throw new Error("forge config is required (not provided locally or via foundry)");
    }
    if (!resolvedElement || Object.keys(resolvedElement).length === 0) {
      throw new Error("element config is required (not provided locally or via foundry)");
    }
    // Only support card, badge, and row molds at this time
    if (resolvedForge.mold !== "card" && resolvedForge.mold !== "badge" && resolvedForge.mold !== "row") {
      throw new Error("only forge mold of card, badge, or row is supported at this time");
    }
    if (resolvedForge.macros && typeof resolvedForge.macros !== "object") {
      throw new Error("forge macros must be an object");
    }
    if (resolvedForge.template_nesting && typeof resolvedForge.template_nesting !== "string") {
      throw new Error("forge template_nesting must be a string");
    }
    if (resolvedForge.template_nesting && resolvedForge.template_nesting.length !== 4) {
      throw new Error("forge template_nesting must be four characters");
    }
    this._mold = new UIX_FORGE_MOLD_CLASSES[resolvedForge.mold](this);
    this._macros = resolvedForge.macros;
    this._showError = resolvedForge.show_error || false;
    this._templateNestingOpen = resolvedForge.template_nesting ? resolvedForge.template_nesting.slice(0, 2) : "<<";
    this._templateNestingClose = resolvedForge.template_nesting ? resolvedForge.template_nesting.slice(2) : ">>";
    const forgeConfig = { ...resolvedForge };
    delete forgeConfig.type;
    delete forgeConfig.mold;
    delete forgeConfig.macros;
    delete forgeConfig.show_error;
    delete forgeConfig.template_nesting;
    this.forgeConfig = forgeConfig;
    this.forgedElementConfig = { ...resolvedElement };
    Promise.all([
      this.bindTemplates(this._forgeConfig),
      this.bindTemplates(this._forgedElementConfig),
      this._forgeConfig.configIsReady(),
      this._forgedElementConfig.configIsReady()
    ]).then(() => {
      if (!this.forgedElement) {
        this.forgeElement();
      }
      this.templatesReady = true;
      this.refreshForge([]);
      this._sparkController.setConfig(this.forgeConfig.sparks);
    });
  }

  get forgedElementConfig() {
    return this._forgedElementConfig.config;
  }

  set forgedElementConfig(config: any) {
    this._forgedElementConfig.config = config;
  }

  get forgeConfig() {
    return this._forgeConfig.config;
  }

  set forgeConfig(config: any) {
    this._forgeConfig.config = config;
  }

  get hidden() {
    if (this._mold.isPreview()) return false;
    if (!this.templatesReady) return true;
    if (this.forgedElement?.hidden) return true;
    let error = false;
    error = this._mold.isError();
    if (error) return !this._showError;
    return this.hiddenByConfig() || this._mold.hidden();
  }

  public getGridOptions() {
    return this._mold.getGridOptions();
  }

  public async computeCardSize() {
    // only called for cards
    if (!this.templatesReady) return 1;
    if (!this.forgedElement) return 1;
    return await this.forgedElement.getCardSize?.() || 1;
  }

  connectedCallback(): void {
    super.connectedCallback();
    this._mold?.connectedCallback();
    this._sparkController.connectedCallback();

    // Listen for foundry updates from the coordinator
    if (this.config?.foundry && !this._foundryUpdateListener) {
      this._foundryUpdateListener = () => this._onFoundryUpdate();
      window.addEventListener("uix-foundries-updated", this._foundryUpdateListener);
    }

    if (this._disconnectTimeout) {
      clearTimeout(this._disconnectTimeout);
      this._disconnectTimeout = undefined;
      return;
    }
    if (this.forgedElement && !this.templatesReady) {
      const resolved = this._resolveFoundry({ ...this.config });
      if (!resolved) return;
      this._resolvedUix = resolved.uix;
      const forgeConfig = { ...resolved.forge };
      delete forgeConfig.type;
      delete forgeConfig.mold;
      delete forgeConfig.macros;
      delete forgeConfig.show_error;
      delete forgeConfig.template_nesting;
      this.forgeConfig = forgeConfig;
      this.forgedElementConfig = { ...resolved.element };
      Promise.all([
        this.bindTemplates(this._forgeConfig),
        this.bindTemplates(this._forgedElementConfig),
        this._forgeConfig.configIsReady(),
        this._forgedElementConfig.configIsReady()
      ]).then(() => {
        this.templatesReady = true;
        this.refreshForge([]);
        this._sparkController.setConfig(this.forgeConfig.sparks);
      });
    }
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    this._mold?.disconnectedCallback();
    this._sparkController.disconnectedCallback();

    if (this._foundryUpdateListener) {
      window.removeEventListener("uix-foundries-updated", this._foundryUpdateListener);
      this._foundryUpdateListener = undefined;
    }

    // Delay unbinding to allow for quick reconnects without rebinding
    this._disconnectTimeout = window.setTimeout(() => {
      super.disconnectedCallback();
      this._forgeConfig.bindings().forEach((binding) => {
      unbind_template(binding.callback);
      });
      this._forgeConfig.bindings().clear();
      this._forgedElementConfig.bindings().forEach((binding) => {
      unbind_template(binding.callback);
      });
      this._forgedElementConfig.bindings().clear();
      this.templatesReady = false;
      this._disconnectTimeout = undefined;
    }, 1000); // 1000ms timeout, adjust as needed
  }

  private _onFoundryUpdate() {
    if (!this.config?.foundry) return;
    // If the forge was waiting for foundry to load initially, complete setup now
    if (!this._mold) {
      const resolved = this._resolveFoundry({ ...this.config });
      if (!resolved) return;
      this._resolvedUix = resolved.uix;
      try {
        this._applyResolvedConfig(resolved.forge, resolved.element);
      } catch (err) {
        console.error("UIX Forge: Error applying foundry config:", err);
      }
      return;
    }
    // Otherwise refresh templates with updated foundry data
    this.refreshForgeTemplates();
  }

  private async bindTemplates(base: any, current: any = undefined, path: string[] = []) {
    const hs = await hass();
    if (current === undefined) {
      current = base.config;
    }
    for (const k of Object.keys(current)) {
      if (current[k] === undefined) continue;
      if (current[k] === null) continue;
      if (k === "uix") continue;
      const currentPath = [...path, k];
      if (typeof current[k] === "object" || Array.isArray(current[k])) {
        await this.bindTemplates(base, current[k], currentPath);
      }
      if (hasTemplate(current[k])) {
        // If already bound, unbind first
        const bindingPath = currentPath.join("|");
        if (base.hasBinding(bindingPath)) {
          const binding = base.getBinding(bindingPath);
          base.deleteBinding(bindingPath);
          if (binding) {
            unbind_template(binding.callback);
          }
        }
        const template = current[k]
          .replaceAll(this._templateNestingOpen, `{% raw %}{{${UIX_FORGE_NESTED_TEMPLATE_MARKER}{% endraw %}`)
          .replaceAll(this._templateNestingClose, `{% raw %}${UIX_FORGE_NESTED_TEMPLATE_MARKER}}}{% endraw %}`);
        const macroStr = buildMacros(this._macros, template);
        const callback = (res: any) => {
          if (typeof res === "string") {
            res = translate(hs, res);
          }
          base.nested = { keys: currentPath, value: res };
          if (this.templatesReady) {
            base.refreshCallback?.(currentPath);
          }
        };
        bind_template(
          callback,
          `${macroStr}${template}`,
          { config: this.config, uixForge: this._sparkController.templateVariables() },
          UIX_FORGE_DEFAULT_TEMPLATE_VALUE
        );
        base.setBinding(bindingPath, callback);
      } else if (typeof current[k] === "string") {
        base.nested = { keys: currentPath, value: translate(hs, current[k]) };
      }
    }
  }

  refreshForgeTemplates() {
    this.templatesReady = false;
    const resolved = this._resolveFoundry({ ...this.config });
    if (!resolved) return;
    this._resolvedUix = resolved.uix;
    const forgeConfig = { ...resolved.forge };
    this._macros = forgeConfig.macros;
    this._templateNestingOpen = forgeConfig.template_nesting ? forgeConfig.template_nesting.slice(0, 2) : "<<";
    this._templateNestingClose = forgeConfig.template_nesting ? forgeConfig.template_nesting.slice(2) : ">>";
    delete forgeConfig.type;
    delete forgeConfig.mold;
    delete forgeConfig.macros;
    delete forgeConfig.show_error;
    delete forgeConfig.template_nesting;
    this.forgeConfig = forgeConfig;
    this.forgedElementConfig = { ...resolved.element };
    Promise.all([
      this.bindTemplates(this._forgeConfig),
      this.bindTemplates(this._forgedElementConfig),
      this._forgeConfig.configIsReady(),
      this._forgedElementConfig.configIsReady()
    ]).then(() => {
      this.templatesReady = true;
      this.refreshForge([]);
    });
  }

  refreshForge(path: UixForgeConfigPath) {
    if (path.includes("sparks")) {
      this._sparkController.setConfig(this.forgeConfig.sparks);
    } else {
      this._mold.refresh(path);
    }
    apply_uix(
      (this as any),
      "card",
      this._resolvedUix,
      { config: 
        { forge: this.forgeConfig, 
          element: this.forgedElementConfig 
        }, 
        uixForge: this._sparkController.templateVariables() 
      },
      true,
      "type-custom-uix-forge"
    );
  }

  refreshForgedElement(path?: UixForgeConfigPath) {
    if (!this.forgedElement) return;
    if (!this.templatesReady) return;
    if (this._mold.isCard()) {
      this.forgedElement.config = this.forgedElementConfig;
      (this.forgedElement as HuiCard).load();
    }
    if (this._mold.isBadge()) {
      this.forgedElement.config = this.forgedElementConfig;
      (this.forgedElement as HuiBadge).load();
    }
    if (this._mold.isRow()) {
      this._mold.cardHelpers().then((helpers) => {
        const newElement = helpers.createRowElement(this.forgedElementConfig);
        newElement.hass = this.hass;
        newElement.preview = this._mold.isPreview();
        this.forgedElement.replaceWith(newElement);
        this.forgedElement = newElement;
      });
    }
    this.refreshForge(["hidden"]);
    if (this._mold.isCard()) {
      this.refreshForge(["grid_options"]);
    }
  }

  private forgeElement() {
    if (this.forgedElement) return;
    if (!this.templatesReady) return;
    if (this._mold.isCard()) {
      this.forgedElement = document.createElement("hui-card") as LovelaceElement;
      this.forgedElement.config = this.forgedElementConfig;
      (this.forgedElement as HuiCard).load();
      this.forgedElement.hass = this.hass;
      this.forgedElement.preview = this._mold.isPreview();
      this.forgedElement.layout = this.layout;
      return;
    }
    if (this._mold.isBadge()) {
      this.forgedElement = document.createElement("hui-badge") as LovelaceElement;
      this.forgedElement.config = this.forgedElementConfig;
      (this.forgedElement as HuiBadge).load();
      this.forgedElement.hass = this.hass;
      this.forgedElement.preview = this._mold.isPreview();
      return;
    }
    if (this._mold.isRow()) {
      this._mold.cardHelpers().then((helpers) => {
        this.forgedElement = helpers.createRowElement(this.forgedElementConfig);
        this.forgedElement.hass = this.hass;
        this.forgedElement.preview = this._mold.isPreview();
      });
      return;
    }
  }

  private hiddenByConfig() {
    if (this.forgeConfig.hidden !== undefined) {
      if (typeof this.forgeConfig.hidden === "boolean") {
        return this.forgeConfig.hidden;
      } else if (this.forgeConfig.hidden === "") {
        return true;
      }
    }
    return false;
  }

  protected shouldUpdate(_changedProperties: PropertyValues): boolean {
    if (!this.config) return false;
    return true;
  }

  protected willUpdate(_changedProperties: PropertyValues): void {
    if (!this.forgedElement && this.templatesReady) {
      this.forgeElement();
    }
  }

  protected updated(_changedProperties: PropertyValues): void {
    if (_changedProperties.has("hass")) {
      this.forgedElement && (this.forgedElement.hass = this.hass);
    }
    if (_changedProperties.has("preview")) {
      this.forgedElement && (this.forgedElement.preview = this.preview);
      if (!this.preview) {
        this.refreshForge(["hidden"]);
      }
    }
    if(_changedProperties.has("layout")) {
      this.forgedElement && (this.forgedElement.layout = this.layout);
    }
    if (_changedProperties.has("templatesReady")) {
      this.refreshForgedElement([]);
    }
    this._sparkController.updated(_changedProperties);
  }

  protected render() {
    return this.forgedElement ? html`${this.forgedElement}` : nothing;
  }
}

window.addEventListener("uix-bootstrap", async (ev: CustomEvent) => {
  ev.stopPropagation();
  if (!customElements.get(UIX_FORGE_TYPE)) {
    customElements.define(UIX_FORGE_TYPE, UixForge);
    (window as any).customCards = (window as any).customCards || [];
    (window as any).customCards.push({
      type: "uix-forge",
      name: "UIX Forge",
      preview: true,
      description: "UIX Forge allows you to forge templates into Home Assistant lovelace element configurations. Add Sparks to to get even more customisation",
    });
    (window as any).customBadges = (window as any).customBadges || [];
    (window as any).customBadges.push({
      type: "uix-forge",
      name: "UIX Forge",
      preview: true,
      description: "UIX Forge allows you to forge templates into Home Assistant lovelace element configurations. Add Sparks to to get even more customisation",
    });
  }
  while (customElements.get("home-assistant") === undefined)
    await new Promise((resolve) => window.setTimeout(resolve, 100));

  if (!customElements.get("uix-forge")) {
    customElements.define("uix-forge", UixForge);
  }
});



