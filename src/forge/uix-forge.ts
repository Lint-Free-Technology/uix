import { html, LitElement, nothing, PropertyValues } from "lit";
import { 
  getNestedTemplateRawDelimiters, 
  HuiBadge, 
  HuiCard, 
  HuiCardFeature, 
  LovelaceElement, 
  UIX_FORGE_ALLOWED_CONFIG_KEYS, 
  UIX_FORGE_DEFAULT_TEMPLATE_VALUE, 
  UIX_FORGE_FORGE_MOLDS, 
  UIX_FORGE_NESTED_TEMPLATE_CLOSE, 
  UIX_FORGE_NESTED_TEMPLATE_OPEN, 
  UIX_FORGE_PASSTHROUGH_MARKER, 
  UIX_FORGE_TYPE, UixForgeConfig, 
  UixForgeConfigBuilder, 
  UixForgeConfigPath, 
  UixMacroConfig, 
  UIX_FORGE_ARRAY_MERGE_STRATEGIES, 
  UIX_FORGE_MOLDS_WITH_BLANKS, 
  ignoreTemplate} from "./uix-forge-types";
import { property, state } from "lit/decorators.js";
import { getLovelaceRoot, hass, translate } from "../helpers/hass";
import { bind_template, hasTemplate, unbind_template } from "../helpers/templates";
import { apply_uix, buildMacros, buildBillets, UixConfig } from "../helpers/apply_uix";
import { UIX_FORGE_MOLD_CLASSES, UixForgeMold } from "./molds/uix-mold";
import { UixForgeSparkController } from "./sparks/uix-spark-controller";

declare global {
  interface HTMLElementTagNameMap {
    [UIX_FORGE_TYPE]: UixForge;
  }
}

function _mergeFoundryConfig(foundry: any, local: any, key?: string): any {
  if (foundry === undefined || foundry === null) return local ?? {};
  if (local === undefined || local === null) return foundry ?? {};

  if (Array.isArray(foundry) && Array.isArray(local)) {
    // Explicit local empty array clears inherited entries.
    if (local.length === 0) return [];

    const mergeKey = key && UIX_FORGE_ARRAY_MERGE_STRATEGIES[key];
    if (mergeKey) {
      const result: any[] = [...foundry];
      const strategy = typeof mergeKey === "string"
        ? { idKeys: [mergeKey], requireTypeMatch: false }
        : mergeKey;

      const getIds = (item: any, idKeys: string[]): Array<{ key: string; value: any }> => {
        if (!item || typeof item !== "object" || Array.isArray(item)) return [];
        return idKeys
          .filter((idKey) => idKey in item && item[idKey] !== undefined && item[idKey] !== null)
          .map((idKey) => ({ key: idKey, value: item[idKey] }));
      };

      for (const localItem of local) {
        const localIds = getIds(localItem, strategy.idKeys);
        if (localIds.length === 0) {
          result.push(localItem);
          continue;
        }

        const foundIndex = result.findIndex((foundryItem) => {
          if (!foundryItem || typeof foundryItem !== "object" || Array.isArray(foundryItem)) return false;
          if (strategy.requireTypeMatch && foundryItem.type !== localItem.type) return false;
          return localIds.some(({ key: idKey, value }) => foundryItem[idKey] === value);
        });

        if (foundIndex === -1) {
          result.push(localItem);
        } else {
          result[foundIndex] = _mergeFoundryConfig(result[foundIndex], localItem, key);
        }
      }

      return result;
    } else {
      return local;
    }
  }

  if (
    typeof foundry !== "object" ||
    typeof local !== "object" ||
    Array.isArray(foundry) ||
    Array.isArray(local)
  ) {
    return local;
  }

  const result = { ...foundry };
  for (const k of Object.keys(local)) {
    const lv = local[k];
    const fv = result[k];
    if (
      lv !== null &&
      typeof lv === "object" &&
      fv !== null &&
      typeof fv === "object"
    ) {
      result[k] = _mergeFoundryConfig(fv, lv, k);
    } else {
      result[k] = lv;
    }
  }
  return result;
}

const LAYERED_OVERRIDE_INACTIVE = Symbol("layered-override-inactive");

function _isPlainObject(value: any): value is Record<string, any> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function _cloneConfigValue(value: any): any {
  if (Array.isArray(value)) return value.map(_cloneConfigValue);
  if (_isPlainObject(value)) {
    const clone: Record<string, any> = {};
    for (const key of Object.keys(value)) {
      clone[key] = _cloneConfigValue(value[key]);
    }
    return clone;
  }
  return value;
}

function _layeredPathKey(path: string[]): string {
  return JSON.stringify(path);
}

function _isLayeredPathDisabled(path: string[], disabledPaths: UixForgeConfigPath[]): boolean {
  return disabledPaths.some((disabledPath) =>
    disabledPath.length <= path.length && disabledPath.every((segment, index) => segment === path[index])
  );
}

function _activeLayeredOverrideValues(
  value: any,
  disabledPaths: UixForgeConfigPath[],
  path: string[] = []
): any | typeof LAYERED_OVERRIDE_INACTIVE {
  if (_isLayeredPathDisabled(path, disabledPaths)) return LAYERED_OVERRIDE_INACTIVE;
  if (!_isPlainObject(value)) return _cloneConfigValue(value);

  const keys = Object.keys(value);
  if (keys.length === 0) return {};
  const result: Record<string, any> = {};
  let hasActiveChild = false;
  for (const key of keys) {
    const child = _activeLayeredOverrideValues(value[key], disabledPaths, [...path, key]);
    if (child === LAYERED_OVERRIDE_INACTIVE) continue;
    result[key] = child;
    hasActiveChild = true;
  }
  return hasActiveChild ? result : LAYERED_OVERRIDE_INACTIVE;
}

function _composeLayeredValue(
  base: any,
  override: any,
  disabledPaths: UixForgeConfigPath[],
  templatePaths: ReadonlySet<string>,
  path: string[]
): any | typeof LAYERED_OVERRIDE_INACTIVE {
  if (_isLayeredPathDisabled(path, disabledPaths)) return LAYERED_OVERRIDE_INACTIVE;

  // Template output is one opaque replacement unit, even when it happens to
  // evaluate to a mapping or an array.
  if (templatePaths.has(_layeredPathKey(path))) return _cloneConfigValue(override);

  if (!_isPlainObject(override)) return _cloneConfigValue(override);

  const baseIsMapping = _isPlainObject(base);
  const result = baseIsMapping ? _cloneConfigValue(base) : {};
  const keys = Object.keys(override);
  if (keys.length === 0) return result;

  let hasActiveContribution = false;
  for (const key of keys) {
    const composed = _composeLayeredValue(
      baseIsMapping ? base[key] : undefined,
      override[key],
      disabledPaths,
      templatePaths,
      [...path, key]
    );
    if (composed === LAYERED_OVERRIDE_INACTIVE) continue;
    result[key] = composed;
    hasActiveContribution = true;
  }

  // A mapping whose only values are disabled must not materialize a new empty
  // parent. An explicitly-authored empty mapping remains a real replacement.
  if (!baseIsMapping && !hasActiveContribution) return LAYERED_OVERRIDE_INACTIVE;
  return result;
}

/** Compose an element-owned base with the active Forge override source. */
export function composeLayeredElementConfig(
  base: any,
  values: Record<string, any> = {},
  disabledPaths: UixForgeConfigPath[] = [],
  templatePaths: ReadonlySet<string> = new Set()
): any {
  const composed = _composeLayeredValue(base, values, disabledPaths, templatePaths, []);
  return composed === LAYERED_OVERRIDE_INACTIVE ? _cloneConfigValue(base ?? {}) : composed;
}

function _validateFoundryLayeredFields(foundry: any, name: string): void {
  if (foundry?.element_disabled_paths !== undefined) {
    throw new Error(`uix-forge: foundry '${name}' cannot set element_disabled_paths`);
  }
}

type ResolvedForgeConfig = {
  forge: any;
  element: any;
  elementBase: any;
  hasElementBase: boolean;
};

export function _resolveFoundryConfig(
  config: { foundry?: string; forge?: any; element?: any; element_base?: any },
  foundries?: Record<string, any>,
  ready = true,
  visited: Set<string> = new Set(),
  isTopLevel = true
): ResolvedForgeConfig | null {
  const foundryName = config.foundry;

  if (isTopLevel && (!foundries || (Object.keys(foundries).length === 0 && !ready))) {
    return null;
  }

  let result: ResolvedForgeConfig | null = null;

  if (foundryName) {
    // If the coordinator foundries haven't been loaded yet, return null to indicate "pending"
    if (!foundries || (Object.keys(foundries).length === 0 && !ready)) {
      return null;
    }
    const foundryData = foundries[foundryName];
    if (!foundryData) {
      throw new Error(`Foundry '${foundryName}' not found. Check that it is defined in the UIX integration.`);
    }
    _validateFoundryLayeredFields(foundryData, foundryName);
    if (visited.has(foundryName)) {
      throw new Error(`Circular foundry reference detected: '${foundryName}'.`);
    }
    const nextVisited = new Set(visited);
    nextVisited.add(foundryName);

    // Recursively resolve the foundry's own base (if it also references another foundry).
    const baseResolved = foundryData.foundry
      ? _resolveFoundryConfig({ foundry: foundryData.foundry }, foundries, ready, nextVisited, false)
      : { forge: {}, element: {}, elementBase: {}, hasElementBase: false };
    if (baseResolved === null) return null;

    // foundryData overrides base, local config overrides foundry
    const foundryForge = _mergeFoundryConfig(baseResolved.forge, foundryData.forge);
    const foundryElement = _mergeFoundryConfig(baseResolved.element, foundryData.element);
    const foundryElementBase = _mergeFoundryConfig(baseResolved.elementBase, foundryData.element_base);
    result = {
      forge: _mergeFoundryConfig(foundryForge, config.forge),
      element: _mergeFoundryConfig(foundryElement, config.element),
      elementBase: _mergeFoundryConfig(foundryElementBase, config.element_base),
      hasElementBase:
        baseResolved.hasElementBase ||
        Object.prototype.hasOwnProperty.call(foundryData, "element_base") ||
        Object.prototype.hasOwnProperty.call(config, "element_base"),
    };
  } else {
    result = {
      forge: config.forge ?? {},
      element: config.element ?? {},
      elementBase: config.element_base ?? {},
      hasElementBase: Object.prototype.hasOwnProperty.call(config, "element_base"),
    };
  }

  if (isTopLevel && foundries) {
    const moldType = result.forge?.mold;
    const globalFoundry = foundries["global"];
    const globalMoldFoundry = moldType ? foundries[`global_${moldType}`] : undefined;
    const currentVisited = foundryName ? new Set(visited).add(foundryName) : new Set(visited);

    let inheritedForge = {};
    let inheritedElement = {};
    let inheritedElementBase = {};
    let inheritedHasElementBase = false;

    if (globalFoundry && foundryName !== "global") {
      const globalResolved = _resolveFoundryConfig({ foundry: "global" }, foundries, ready, currentVisited, false);
      if (globalResolved === null) return null;
      inheritedForge = _mergeFoundryConfig(inheritedForge, globalResolved.forge);
      inheritedElement = _mergeFoundryConfig(inheritedElement, globalResolved.element);
      inheritedElementBase = _mergeFoundryConfig(inheritedElementBase, globalResolved.elementBase);
      inheritedHasElementBase = inheritedHasElementBase || globalResolved.hasElementBase;
    }

    if (globalMoldFoundry && foundryName !== `global_${moldType}`) {
      const globalMoldResolved = _resolveFoundryConfig({ foundry: `global_${moldType}` }, foundries, ready, currentVisited, false);
      if (globalMoldResolved === null) return null;
      inheritedForge = _mergeFoundryConfig(inheritedForge, globalMoldResolved.forge);
      inheritedElement = _mergeFoundryConfig(inheritedElement, globalMoldResolved.element);
      inheritedElementBase = _mergeFoundryConfig(inheritedElementBase, globalMoldResolved.elementBase);
      inheritedHasElementBase = inheritedHasElementBase || globalMoldResolved.hasElementBase;
    }

    result = {
      forge: _mergeFoundryConfig(inheritedForge, result.forge),
      element: _mergeFoundryConfig(inheritedElement, result.element),
      elementBase: _mergeFoundryConfig(inheritedElementBase, result.elementBase),
      hasElementBase: inheritedHasElementBase || result.hasElementBase,
    };
  }

  return result;
}

export class UixForge extends LitElement {
  @property({attribute: false}) hass: any;
  @property({attribute: false}) preview: boolean;
  @property({attribute: false}) layout: boolean;
  @property({attribute: false}) connectedWhileHidden: boolean;
  @property({attribute: false}) lovelace: any;
  // Properties passed through by hui-card-feature for card-feature mold
  @property({attribute: false}) context: any;
  @property({attribute: false}) color: any;
  @property({attribute: false}) position: any;
  @state() config: UixForgeConfig;
  @state() forgedElement: LovelaceElement;
  @state() templatesReady: boolean;
  private _mold: UixForgeMold;
  private _macros: UixMacroConfig;
  private _billets: Record<string, any>;
  private _templateNestingOpen: string;
  private _templateNestingClose: string;
  private _showError: boolean;
  private _forgeConfig: UixForgeConfigBuilder;
  private _forgedElementConfig: UixForgeConfigBuilder;
  private _layeredOverridesConfig: UixForgeConfigBuilder;
  private _layeredMode = false;
  private _layeredElementBaseConfig: any;
  private _layeredElementOverlaySource: any;
  private _layeredForgedElementConfig: any;
  private _layeredOverrideTemplatePaths = new Set<string>();
  private _sparkController: UixForgeSparkController;
  private _disconnectTimeout?: number;
  private _foundryUpdateListener?: EventListener;
  private _uixUpdateListener?: EventListener;
  private _resolvedUix?: any;
  private _delayedHass?: boolean;
  private _view: LovelaceElement;
  private _refreshForgeTemplatesInFlight = false;
  private _refreshForgeTemplatesPending = false;

  constructor() {
      super();
      this.connectedWhileHidden = true;
      this.templatesReady = false;
      this._showError = false;
      this._delayedHass = false;
      this._forgeConfig = new UixForgeConfigBuilder(this.refreshForge.bind(this));
      this._forgedElementConfig = new UixForgeConfigBuilder(this.refreshForgedElement.bind(this));
      this._layeredOverridesConfig = new UixForgeConfigBuilder(this._refreshLayeredForgedElement.bind(this));
      this._sparkController = new UixForgeSparkController(this);
  }

  public static getStubConfig(): UixForgeConfig {
    return {
      type: `custom:${UIX_FORGE_TYPE}`,
    };
  }

  private hasTemplateOrNestedTemplate(value: any): boolean {
    if (hasTemplate(value)) return true;
    if (typeof value === "string" && this._templateNestingPairs().some(({ open }) => value.includes(open))) return true;
    return false;
  }

  /**
   * Builds the active nested-template delimiter pairs for this forge instance.
   * The configured `template_nesting` pair is always included, and when possible
   * an inferred statement pair (for example `<%`/`%>`) is added alongside it.
   */
  private _templateNestingPairs(): Array<{ open: string; close: string }> {
    const pairs: Array<{ open: string; close: string }> = [];
    const addPair = (open: string, close: string) => {
      if (!pairs.some((pair) => pair.open === open && pair.close === close)) {
        pairs.push({ open, close });
      }
    };
    addPair(this._templateNestingOpen, this._templateNestingClose);
    const openChar = this._templateNestingOpen.charAt(0);
    const closeChar = this._templateNestingClose.charAt(this._templateNestingClose.length - 1);
    if (this._templateNestingOpen.length > 1 && this._templateNestingClose.length > 1) {
      addPair(`${openChar}%`, `%${closeChar}`);
    }
    return pairs;
  }

  private _stripPassthroughNesting(value: string): string {
    let output = value;
    for (const { open, close } of this._templateNestingPairs()) {
      const passthroughOpen = open.charAt(0) + open;
      const passthroughClose = close + close.charAt(close.length - 1);
      output = output
        .split(passthroughOpen).join(open)
        .split(passthroughClose).join(close);
    }
    return output;
  }

  private _hasNonPassthroughTemplateOrNestedTemplate(value: string): boolean {
    let masked = value;
    for (const { open, close } of this._templateNestingPairs()) {
      const passthroughOpen = open.charAt(0) + open;
      const passthroughClose = close + close.charAt(close.length - 1);
      masked = masked
        .split(passthroughOpen).join("")
        .split(passthroughClose).join("");
    }
    return this.hasTemplateOrNestedTemplate(masked);
  }

  private _replaceNestedTemplateDelimiters(value: string): string {
    type PassthroughDelimiterMapping = {
      passthroughOpenMarker: string;
      passthroughCloseMarker: string;
      open: string;
      close: string;
    };
    let output = value;
    const passthroughDelimiters: PassthroughDelimiterMapping[] = [];
    for (let pairIndex = 0; pairIndex < this._templateNestingPairs().length; pairIndex++) {
      const { open, close } = this._templateNestingPairs()[pairIndex];
      const passthroughOpen = open.charAt(0) + open;
      const passthroughClose = close + close.charAt(close.length - 1);
      const passthroughOpenMarker = `##UIX_FORGE_NESTED_PASSTHROUGH_OPEN_${pairIndex}##`;
      const passthroughCloseMarker = `##UIX_FORGE_NESTED_PASSTHROUGH_CLOSE_${pairIndex}##`;
      passthroughDelimiters.push({ passthroughOpenMarker, passthroughCloseMarker, open, close });
      output = output
        .split(passthroughOpen).join(passthroughOpenMarker)
        .split(passthroughClose).join(passthroughCloseMarker);
    }
    for (const { open, close } of this._templateNestingPairs()) {
      const { openRaw, closeRaw } = getNestedTemplateRawDelimiters(open);
      output = output
        .split(open).join(openRaw)
        .split(close).join(closeRaw);
    }
    for (const { passthroughOpenMarker, passthroughCloseMarker, open, close } of passthroughDelimiters) {
      output = output
        .split(passthroughOpenMarker).join(open)
        .split(passthroughCloseMarker).join(close);
    }
    return output;
  }

  private _validateLayeredConfig(resolvedElementBase: any, hasElementBase: boolean): boolean {
    if (this.config.element_disabled_paths !== undefined && !hasElementBase) {
      throw new Error("uix-forge: element_disabled_paths requires element_base");
    }
    if (!hasElementBase) return false;
    if (!_isPlainObject(resolvedElementBase) || !resolvedElementBase.type) {
      throw new Error("uix-forge: layered configuration requires element_base.type");
    }
    if (Object.prototype.hasOwnProperty.call(this._layeredElementOverlaySource, "type")) {
      throw new Error("uix-forge: layered element cannot override type; set it in element_base");
    }
    if (this.config.element_disabled_paths !== undefined && !Array.isArray(this.config.element_disabled_paths)) {
      throw new Error("uix-forge: element_disabled_paths must be a list of key paths");
    }

    const values = this._layeredElementOverlaySource ?? {};
    const seenPaths = new Set<string>();
    for (const path of this.config.element_disabled_paths ?? []) {
      if (!Array.isArray(path) || path.length === 0 || path.some((segment) => typeof segment !== "string" || segment.length === 0)) {
        throw new Error("uix-forge: each disabled override path must be a non-empty list of keys");
      }
      const pathKey = _layeredPathKey(path);
      if (seenPaths.has(pathKey)) {
        throw new Error(`uix-forge: duplicate disabled override path ${path.join(".")}`);
      }
      seenPaths.add(pathKey);

      let current: any = values;
      for (let index = 0; index < path.length; index++) {
        if (!_isPlainObject(current) || !Object.prototype.hasOwnProperty.call(current, path[index])) {
          throw new Error(`uix-forge: disabled element path ${path.join(".")} does not exist in the resolved element overlay`);
        }
        current = current[path[index]];
        if (index < path.length - 1 && Array.isArray(current)) {
          throw new Error("uix-forge: disabled override paths cannot address array entries");
        }
      }
    }
    return true;
  }

  private _collectLayeredTemplatePaths(value: any, path: string[] = [], paths = new Set<string>()): Set<string> {
    if (typeof value === "string" && this.hasTemplateOrNestedTemplate(value)) {
      paths.add(_layeredPathKey(path));
      return paths;
    }
    if (value !== null && typeof value === "object") {
      for (const [key, child] of Object.entries(value)) {
        this._collectLayeredTemplatePaths(child, [...path, key], paths);
      }
    }
    return paths;
  }

  private _clearTemplateBindings(config: UixForgeConfigBuilder): void {
    config.bindings().forEach((binding) => unbind_template(binding.callback));
    config.bindings().clear();
  }

  private _refreshLayeredForgedElement(path: UixForgeConfigPath = []): void {
    this._layeredForgedElementConfig = composeLayeredElementConfig(
      this._layeredElementBaseConfig,
      this._layeredOverridesConfig.config,
      this.config.element_disabled_paths ?? [],
      this._layeredOverrideTemplatePaths
    );
    if (this.templatesReady) this.refreshForgedElement(path);
  }

  private _setLayeredOverrides(values: any): void {
    this._clearTemplateBindings(this._layeredOverridesConfig);
    this._layeredOverrideTemplatePaths = this._collectLayeredTemplatePaths(values);
    this._layeredOverridesConfig.nestedTemplateOpen = this._templateNestingPairs().map(({ open }) => open);
    const activeValues = _activeLayeredOverrideValues(values, this.config.element_disabled_paths ?? []);
    this._layeredOverridesConfig.config = activeValues === LAYERED_OVERRIDE_INACTIVE ? {} : activeValues;
    this._refreshLayeredForgedElement();
  }

  private _templateConfig(): UixForgeConfig {
    if (!this._layeredMode) return this.config;
    return {
      ...this.config,
      element_base: this._layeredElementBaseConfig,
      element: this._layeredElementOverlaySource,
    };
  }

  private _resolveFoundry(
    config: { foundry?: string; forge?: any; element?: any; element_base?: any },
    visited: Set<string> = new Set()
  ): ResolvedForgeConfig | null {
    const coordinator = (window as any).uixCoordinator;
    return _resolveFoundryConfig(config, coordinator?.foundries, coordinator?.ready, visited);
  }

  public setConfig(config: UixForgeConfig) {
    if (!config) throw new Error("No config");
    if (!config.foundry && !config.forge) {
      throw new Error("uix-forge: forge config or foundry is required");
    }
    if ((config as any).visibility) {
      throw new Error("uix-forge: 'visibility' config key is not supported, use 'forge.hidden' with a template instead");
    }
    Object.keys(config).forEach((k) => {
      if (!UIX_FORGE_ALLOWED_CONFIG_KEYS.includes(k)) {
        throw new Error(`uix-forge: unexpected config key ${k}`);
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

    this._resolvedUix = resolved.forge?.uix;

    this._applyResolvedConfig(resolved.forge, resolved.element, resolved.elementBase, resolved.hasElementBase);
  }

  private _applyResolvedConfig(
    resolvedForge: any,
    resolvedElement: any,
    resolvedElementBase: any,
    hasElementBase: boolean
  ) {
    if (!resolvedForge || Object.keys(resolvedForge).length === 0) {
      throw new Error("uix-forge: forge config is required (not provided locally or via foundry)");
    }
    // Only support card, badge, row, section, and picture-element molds at this time
    if (!resolvedForge.mold || !UIX_FORGE_FORGE_MOLDS.includes(resolvedForge.mold)) {
      throw new Error(`uix-forge: only forge molds of ${UIX_FORGE_FORGE_MOLDS.join(", ")} are supported at this time`);
    }
    this._layeredElementOverlaySource = _cloneConfigValue(resolvedElement);
    this._layeredMode = this._validateLayeredConfig(resolvedElementBase, hasElementBase);
    if (!this._layeredMode && (!resolvedElement || Object.keys(resolvedElement).length === 0) && !UIX_FORGE_MOLDS_WITH_BLANKS.includes(resolvedForge.mold)) {
      throw new Error("uix-forge: element config is required (not provided locally or via foundry)");
    }
    if (resolvedForge.macros && typeof resolvedForge.macros !== "object") {
      throw new Error("uix-forge: forge macros must be an object");
    }
    if (resolvedForge.billets && typeof resolvedForge.billets !== "object") {
      throw new Error("uix-forge: forge billets must be an object");
    }
    if (resolvedForge.billets) {
      // Validate billets eagerly and synchronously — throws from setConfig so HA shows the error card
      buildBillets(resolvedForge.billets, undefined, true);
    }
    if (resolvedForge.template_nesting && typeof resolvedForge.template_nesting !== "string") {
      throw new Error("uix-forge: forge template_nesting must be a string");
    }
    if (resolvedForge.template_nesting && resolvedForge.template_nesting.length !== 4) {
      throw new Error("uix-forge: forge template_nesting must be four characters");
    }
    this._mold = new UIX_FORGE_MOLD_CLASSES[resolvedForge.mold](this);
    this._macros = resolvedForge.macros;
    this._billets = resolvedForge.billets;
    this._showError = resolvedForge.show_error || false;
    this._delayedHass = resolvedForge.delayed_hass || false;

    this._templateNestingOpen = resolvedForge.template_nesting ? resolvedForge.template_nesting.slice(0, 2) : UIX_FORGE_NESTED_TEMPLATE_OPEN;
    this._templateNestingClose = resolvedForge.template_nesting ? resolvedForge.template_nesting.slice(2) : UIX_FORGE_NESTED_TEMPLATE_CLOSE;
    const nestedTemplateOpen = this._templateNestingPairs().map(({ open }) => open);
    this._forgeConfig.nestedTemplateOpen = nestedTemplateOpen;
    this._forgedElementConfig.nestedTemplateOpen = nestedTemplateOpen;
    this._layeredOverridesConfig.nestedTemplateOpen = nestedTemplateOpen;
    const forgeConfig = { ...resolvedForge };
    delete forgeConfig.type;
    delete forgeConfig.mold;
    delete forgeConfig.macros;
    delete forgeConfig.billets;
    delete forgeConfig.show_error;
    delete forgeConfig.delayed_hass;
    delete forgeConfig.template_nesting;
    delete forgeConfig.uix;
    this.forgeConfig = forgeConfig;
    const elementConfig = { ...resolvedElement };
    if (!this._layeredMode) {
      if (elementConfig.state_color !== undefined && elementConfig.color === undefined) {
        elementConfig.color = elementConfig.state_color === true ? "state" : elementConfig.state_color === false ? "none" : undefined;
        delete elementConfig.state_color;
      }
      if ((this.config.color !== undefined || this.config.state_color !== undefined) && !elementConfig.color) {
        const configStateColorMigrated: string = this.config.state_color === true ? "state" : this.config.state_color === false ? "none" : undefined;
        elementConfig.color = this.config.color ?? configStateColorMigrated;
      }
      if (this.config?.entities !== undefined) {
        elementConfig.entities = [...this.config.entities, ...(elementConfig.entities ?? [])];
      }
      if (this._mold.isCard() && !elementConfig.type) {
        elementConfig.type = "custom:uix-forge-blank-card";
        if (this._mold.isCardBlankClear()) {
          elementConfig.clear = true;
        }
      }
    }

    if (this._layeredMode) {
      this._layeredElementBaseConfig = _cloneConfigValue(resolvedElementBase);
      this._setLayeredOverrides(this._layeredElementOverlaySource);
    } else {
      this._layeredElementBaseConfig = undefined;
      this._layeredForgedElementConfig = undefined;
      this._clearTemplateBindings(this._layeredOverridesConfig);
      this.forgedElementConfig = elementConfig;
    }
    this._refreshForgeTemplatesInFlight = true;
    this._refreshForgeTemplatesPending = false;
    const completeRefresh = () => {
      this._refreshForgeTemplatesInFlight = false;
      if (this._refreshForgeTemplatesPending) {
        this._refreshForgeTemplatesPending = false;
        void Promise.resolve()
          .then(() => this.refreshForgeTemplates())
          .catch((err) => console.error("UIX Forge: Error running deferred forge template refresh:", err));
      }
    };
    void Promise.all([
      this.bindTemplates(this._forgeConfig),
      this.bindTemplates(this._layeredMode ? this._layeredOverridesConfig : this._forgedElementConfig, undefined, [], this._layeredMode),
      this._forgeConfig.configIsReady(),
      (this._layeredMode ? this._layeredOverridesConfig : this._forgedElementConfig).configIsReady()
    ]).then(() => {
      if (!this.forgedElement) {
        this.forgeElement();
      }
      this.templatesReady = true;
      this.refreshForge([]);
      this._sparkController.setConfig(this.forgeConfig.sparks);
    }, (err) => {
      console.error("UIX Forge: Error applying forge config:", err);
    }).then(completeRefresh);
  }

  private _mergeForgeMacros(uixConfig?: UixConfig): UixConfig | undefined {
    if (!this._macros || Object.keys(this._macros).length === 0) return uixConfig;
    if (!uixConfig) return uixConfig;
    return {
      ...uixConfig,
      macros: { ...this._macros, ...(uixConfig.macros ?? {}) },
    };
  }

  private _mergeForgeBillets(uixConfig?: UixConfig): UixConfig | undefined {
    if (!this._billets || Object.keys(this._billets).length === 0) return uixConfig;
    if (!uixConfig) return uixConfig;
    return {
      ...uixConfig,
      billets: { ...this._billets, ...(uixConfig.billets ?? {}) },
    };
  }

  private _mergeForgeUix(uixConfig?: UixConfig): UixConfig | undefined {
    return this._mergeForgeBillets(this._mergeForgeMacros(uixConfig));
  }

  get forgedElementConfig() {
    const config = this._layeredMode ? this._layeredForgedElementConfig : this._forgedElementConfig.config;
    if (!config?.uix) return config;
    const mergedUix = this._mergeForgeUix(config.uix);
    if (mergedUix === config.uix) return config;
    return { ...config, uix: mergedUix };
  }

  set forgedElementConfig(config: any) {
    if (this._layeredMode) {
      this._layeredForgedElementConfig = config;
    } else {
      this._forgedElementConfig.config = config;
    }
  }

  get forgeConfig() {
    return this._forgeConfig.config;
  }

  set forgeConfig(config: any) {
    this._forgeConfig.config = config;
  }

  get hidden() {
    if (!this._mold) return true;
    if (this._mold.isPreview()) return false;
    if (!this.templatesReady) return true;
    if (this.forgedElement?.hidden) return true;
    let error = false;
    error = this._mold.isError();
    if (error) return !this._showError;
    return this.hiddenByConfig() || this._mold.hidden();
  }

  get mold() {
    return this._mold;
  }

  public getGridOptions() {
    return this._mold ? this._mold.getGridOptions() : {};
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

    if (!this._uixUpdateListener) {
      this._uixUpdateListener = (ev: Event) => this._onUixUpdate(ev);
      document.addEventListener("uix-update", this._uixUpdateListener);
    }

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
      this._resolvedUix = resolved.forge?.uix;
      this._layeredElementOverlaySource = _cloneConfigValue(resolved.element);
      this._layeredMode = this._validateLayeredConfig(resolved.elementBase, resolved.hasElementBase);
      const forgeConfig = { ...resolved.forge };
      delete forgeConfig.type;
      delete forgeConfig.mold;
      delete forgeConfig.macros;
      delete forgeConfig.billets;
      delete forgeConfig.show_error;
      delete forgeConfig.delayed_hass;
      delete forgeConfig.template_nesting;
      delete forgeConfig.uix;
      const elementConfig = { ...resolved.element };
      if (!this._layeredMode) {
        if (elementConfig.state_color !== undefined && elementConfig.color === undefined) {
          elementConfig.color = elementConfig.state_color === true ? "state" : elementConfig.state_color === false ? "none" : undefined;
          delete elementConfig.state_color;
        }
        if ((this.config.color !== undefined || this.config.state_color !== undefined) && !elementConfig.color) {
          const configStateColorMigrated: string = this.config.state_color === true ? "state" : this.config.state_color === false ? "none" : undefined;
          elementConfig.color = this.config.color ?? configStateColorMigrated;
        }
        if (this.config?.entities !== undefined) {
          elementConfig.entities = [...this.config.entities, ...(elementConfig.entities ?? [])];
        }
        if (this._mold.isCard() && !elementConfig.type) {
          elementConfig.type = "custom:uix-forge-blank-card";
          if (this._mold.isCardBlankClear()) {
            elementConfig.clear = true;
          }
        }
      }
      this.forgeConfig = forgeConfig;
      if (this._layeredMode) {
        this._layeredElementBaseConfig = _cloneConfigValue(resolved.elementBase);
        this._setLayeredOverrides(this._layeredElementOverlaySource);
      } else {
        this.forgedElementConfig = { ...elementConfig };
      }
      Promise.all([
        this.bindTemplates(this._forgeConfig),
        this.bindTemplates(this._layeredMode ? this._layeredOverridesConfig : this._forgedElementConfig, undefined, [], this._layeredMode),
        this._forgeConfig.configIsReady(),
        (this._layeredMode ? this._layeredOverridesConfig : this._forgedElementConfig).configIsReady()
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

    if (this._uixUpdateListener) {
      document.removeEventListener("uix-update", this._uixUpdateListener);
      this._uixUpdateListener = undefined;
    }

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
      this._clearTemplateBindings(this._layeredOverridesConfig);
      this.templatesReady = false;
      this._disconnectTimeout = undefined;
    }, 1000); // 1000ms timeout, adjust as needed
  }

  private _onFoundryUpdate() {
    if (!this.config) return;
    // If the forge was waiting for foundry to load initially, complete setup now
    if (!this._mold) {
      const resolved = this._resolveFoundry({ ...this.config });
      if (!resolved) return;
      this._resolvedUix = resolved.forge?.uix;
      try {
        this._applyResolvedConfig(resolved.forge, resolved.element, resolved.elementBase, resolved.hasElementBase);
      } catch (err) {
        console.error("UIX Forge: Error applying foundry config:", err);
      }
      return;
    }
    // Otherwise refresh templates with updated foundry data
    this.refreshForgeTemplates();
  }

  private _onUixUpdate(ev: Event) {
    if (!(ev as CustomEvent).detail?.variablesChanged) return;
    if (!this.config) return;
    this.refreshForgeTemplates();
  }

  private _parseLayeredTemplateValue(value: any): any {
    if (typeof value !== "string") return value;
    const trimmed = value.trim();
    if (!trimmed.startsWith("{") && !trimmed.startsWith("[")) return value;
    try {
      return JSON.parse(trimmed);
    } catch (_err) {
      // A template can legitimately produce a string that resembles JSON. Only
      // valid JSON is structural output; all other output stays a string.
      return value;
    }
  }

  private async bindTemplates(base: any, current: any = undefined, path: string[] = [], parseLayeredResults = false) {
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
        await this.bindTemplates(base, current[k], currentPath, parseLayeredResults);
      } else if (
        typeof current[k] === "string" &&
        this._stripPassthroughNesting(current[k]) !== current[k] &&
        !this._hasNonPassthroughTemplateOrNestedTemplate(current[k])
      ) {
        // Passthrough template: strip one nesting level and pass through to the inner forge
        const passthrough = this._stripPassthroughNesting(current[k]);
        base.nested = { keys: currentPath, value: UIX_FORGE_PASSTHROUGH_MARKER + passthrough };
      } else if (this.hasTemplateOrNestedTemplate(current[k])) {
        // If already bound, unbind first
        const bindingPath = currentPath.join("|");
        if (base.hasBinding(bindingPath)) {
          const binding = base.getBinding(bindingPath);
          base.deleteBinding(bindingPath);
          if (binding) {
            unbind_template(binding.callback);
          }
        }
        if (ignoreTemplate(current[k])) {
          base.nested = { keys: currentPath, value: current[k] };
          continue;
        }
        const template = this._replaceNestedTemplateDelimiters(current[k]);
        const macroStr = buildMacros(this._macros, template);
        const billetStr = buildBillets(this._billets, macroStr + template);
        const callback = (res: any) => {
          if (typeof res === "string") {
            res = translate(hs, res);
          }
          if (parseLayeredResults) {
            res = this._parseLayeredTemplateValue(res);
          }
          base.nested = { keys: currentPath, value: res };
          // A layered overlay is composed separately from its template builder.
          // Recompose as soon as an overlay value arrives, including during the
          // initial binding pass before templatesReady becomes true.
          if (parseLayeredResults || this.templatesReady) {
            base.refreshCallback?.(currentPath);
          }
        };
        bind_template(
          callback,
          `${macroStr}${billetStr}${template}`,
          { config: this._templateConfig(), uixForge: this._sparkController.templateVariables(), ...this._mold.templateVariables() },
          UIX_FORGE_DEFAULT_TEMPLATE_VALUE
        );
        base.setBinding(bindingPath, callback);
      } else if (typeof current[k] === "string") {
        base.nested = { keys: currentPath, value: translate(hs, current[k]) };
      }
    }
  }

  refreshForgeTemplates() {
    if (this._refreshForgeTemplatesInFlight) {
      this._refreshForgeTemplatesPending = true;
      return;
    }
    this._refreshForgeTemplatesInFlight = true;
    this._refreshForgeTemplatesPending = false;
    this.templatesReady = false;
    const resolved = this._resolveFoundry({ ...this.config });
    if (!resolved) {
      this._refreshForgeTemplatesInFlight = false;
      return;
    }
    this._resolvedUix = resolved.forge?.uix;
    this._layeredElementOverlaySource = _cloneConfigValue(resolved.element);
    this._layeredMode = this._validateLayeredConfig(resolved.elementBase, resolved.hasElementBase);
    const forgeConfig = { ...resolved.forge };
    this._macros = forgeConfig.macros;
    this._billets = forgeConfig.billets;
    this._templateNestingOpen = forgeConfig.template_nesting ? forgeConfig.template_nesting.slice(0, 2) : UIX_FORGE_NESTED_TEMPLATE_OPEN;
    this._templateNestingClose = forgeConfig.template_nesting ? forgeConfig.template_nesting.slice(2) : UIX_FORGE_NESTED_TEMPLATE_CLOSE;
    const nestedTemplateOpen = this._templateNestingPairs().map(({ open }) => open);
    this._forgeConfig.nestedTemplateOpen = nestedTemplateOpen;
    this._forgedElementConfig.nestedTemplateOpen = nestedTemplateOpen;
    this._layeredOverridesConfig.nestedTemplateOpen = nestedTemplateOpen;
    delete forgeConfig.type;
    delete forgeConfig.mold;
    delete forgeConfig.macros;
    delete forgeConfig.billets;
    delete forgeConfig.show_error;
    delete forgeConfig.delayed_hass;
    delete forgeConfig.template_nesting;
    delete forgeConfig.uix;
    this.forgeConfig = forgeConfig;
    const elementConfig = { ...resolved.element };
    if (!this._layeredMode) {
      if (elementConfig.state_color !== undefined && elementConfig.color === undefined) {
        elementConfig.color = elementConfig.state_color === true ? "state" : elementConfig.state_color === false ? "none" : undefined;
        delete elementConfig.state_color;
      }
      if ((this.config.color !== undefined || this.config.state_color !== undefined) && !elementConfig.color) {
        const configStateColorMigrated: string = this.config.state_color === true ? "state" : this.config.state_color === false ? "none" : undefined;
        elementConfig.color = this.config.color ?? configStateColorMigrated;
      }
      if (this.config?.entities !== undefined) {
        elementConfig.entities = [...this.config.entities, ...(elementConfig.entities ?? [])];
      }
      if (this._mold.isCard() && !elementConfig.type) {
        elementConfig.type = "custom:uix-forge-blank-card";
        if (this._mold.isCardBlankClear()) {
          elementConfig.clear = true;
        }
      }
    }
    if (this._layeredMode) {
      this._layeredElementBaseConfig = _cloneConfigValue(resolved.elementBase);
      this._setLayeredOverrides(this._layeredElementOverlaySource);
    } else {
      this.forgedElementConfig = elementConfig;
    }
    const completeRefresh = () => {
      this._refreshForgeTemplatesInFlight = false;
      if (this._refreshForgeTemplatesPending) {
        this._refreshForgeTemplatesPending = false;
        void Promise.resolve()
          .then(() => this.refreshForgeTemplates())
          .catch((err) => console.error("UIX Forge: Error running deferred forge template refresh:", err));
      }
    };
    void Promise.all([
      this.bindTemplates(this._forgeConfig),
      this.bindTemplates(this._layeredMode ? this._layeredOverridesConfig : this._forgedElementConfig, undefined, [], this._layeredMode),
      this._forgeConfig.configIsReady(),
      (this._layeredMode ? this._layeredOverridesConfig : this._forgedElementConfig).configIsReady()
    ]).then(() => {
      this.templatesReady = true;
      this.refreshForge([]);
    }, (err) => {
      console.error("UIX Forge: Error refreshing forge templates:", err);
    }).then(completeRefresh);
  }

  refreshForge(path: UixForgeConfigPath) {
    if (path.includes("sparks")) {
      this._sparkController.setConfig(this.forgeConfig.sparks);
    } else {
      this._mold.refresh(path);
      this._sparkController.setConfig(this.forgeConfig.sparks);
    }
    const stylingConfig = this._layeredMode
      ? this._templateConfig()
      : { ...this._templateConfig(), element: this.forgedElementConfig };
    apply_uix(
      (this as any),
      this._mold.type.split("_").join("-"),
      this._mergeForgeUix(this._resolvedUix),
      { config: 
        { 
          ...stylingConfig,
          entity: this.config?.entity,
          forge: this.forgeConfig, 
        }, 
        uixForge: this._sparkController.templateVariables(),
        ...this._mold.templateVariables() 
      },
      true,
      "type-custom-uix-forge"
    );
  }

  refreshForgedElement(path?: UixForgeConfigPath) {
    if (!this.forgedElement) return;
    if (!this.templatesReady) return;
    this._sparkController.beforeForgedElementRefresh();
    if (this._mold.isCard()) {
      this.forgedElement.config = this.forgedElementConfig;
      this._delayedHass && (this.forgedElement.hass = undefined);
      (this.forgedElement as HuiCard).load();
      this._delayedHass && (this.forgedElement.hass = this.hass);
      this.refreshForge(["hidden"]);
      this.refreshForge(["grid_options"]);
    }
    if (this._mold.isBadge()) {
      this.forgedElement.config = this.forgedElementConfig;
      !this._delayedHass && (this.forgedElement.hass = this.hass);
      (this.forgedElement as HuiBadge).load();
      this._delayedHass && (this.forgedElement.hass = this.hass);
      this.refreshForge(["hidden"]);
    }
    if (this._mold.isRow()) {
      this._mold.cardHelpers().then((helpers) => {
        const newElement = helpers.createRowElement(this.forgedElementConfig);
        newElement.hass = this.hass;
        newElement.preview = this._mold.isPreview();
        this.forgedElement.updateComplete.then(() => {
          this.forgedElement.replaceWith(newElement);
          this.forgedElement = newElement;
          this.refreshForge(["hidden"]);
        });
      });

    }
    if (this._mold.isSection()) {
      this.forgedElement.config = this.forgedElementConfig;
      this.refreshForge(["hidden"]);
    }
    if (this._mold.isPictureElement()) {
      const config = {
        type: "conditional",
        conditions: [
          {
            condition: "screen",
            media_query: `(max-width: ${this.hidden ? 0 : 99999}px)`
          }
        ],
        elements: [
          {
            ...this.forgedElementConfig,
          }
        ]
      };
      this._mold.cardHelpers().then((helpers) => {
        this.forgedElement = helpers.createHuiElement(config);
        this.forgedElement.hass = this.hass;
        this.forgedElement.preview = this._mold.isPreview();
        this.style.setProperty("position", "static");
        this.style.setProperty("transform", "none");
        void this._mold.callAuxiliaryFunction("setupNearestRoutedTypeDelegation");
      });
    }
    if (this._mold.isFooter()) {
      (this.forgedElement.config as any) = { card: this.forgedElementConfig, max_width: this.forgeConfig.max_width ?? "600" };
      this.forgedElement.hass = this.hass;
      this.refreshForge(["hidden"]);
    }
    if (this._mold.isCardFeature()) {
      const cardFeature = this.forgedElement as HuiCardFeature;
      cardFeature._element = undefined;
      cardFeature.feature = this.forgedElementConfig;
      cardFeature.hass = this.hass;
      cardFeature.color = this.color;
      cardFeature.position = this.position;
      cardFeature.context = this.context;
      this.refreshForge(["hidden"]);
    }
  }

  private forgeElement() {
    if (this.forgedElement) return;
    if (!this.templatesReady) return;
    if (this._mold.isCard()) {
      this.forgedElement = document.createElement("hui-card") as LovelaceElement;
      this.forgedElement.config = this.forgedElementConfig;
      !this._delayedHass && (this.forgedElement.hass = this.hass);
      this.forgedElement.preview = this._mold.isPreview();
      this.forgedElement.layout = this.layout;
      (this.forgedElement as HuiCard).load();
      this._delayedHass && (this.forgedElement.hass = this.hass);
      return;
    }
    if (this._mold.isBadge()) {
      this.forgedElement = document.createElement("hui-badge") as LovelaceElement;
      this.forgedElement.config = this.forgedElementConfig;
      !this._delayedHass && (this.forgedElement.hass = this.hass);
      this.forgedElement.preview = this._mold.isPreview();
      (this.forgedElement as HuiBadge).load();
      this._delayedHass && (this.forgedElement.hass = this.hass);
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
    if (this._mold.isSection()) {
      (this.parentElement as any)._updateVisibility = () => {}
      getLovelaceRoot(document).then((root) => {
        if (!root) {
          return;
        }
        const view = root._viewRoot?.querySelector("hui-view");
        if (view && view._sections) {
          this.forgedElement = view.createSectionElement?.(this.forgedElementConfig);
        }
        this.refreshForge(["hidden"]);
      });
      return;
    }
    if (this._mold.isPictureElement()) {
      const config = {
        type: "conditional",
        conditions: [
          {
            condition: "screen",
            media_query: `(max-width: ${this.hidden ? 0 : 99999}px)`
          }
        ],
        elements: [
          {
            ...this.forgedElementConfig,
          }
        ]
      };
      this._mold.cardHelpers().then((helpers) => {
        this.forgedElement = helpers.createHuiElement(config);
        this.forgedElement.hass = this.hass;
        this.forgedElement.preview = this._mold.isPreview();
        this.style.setProperty("position", "static");
        this.style.setProperty("transform", "none");
        this._mold.callAuxiliaryFunction("setupNearestRoutedTypeDelegation");
      });
      return;
    }
    if (this._mold.isFooter()) {
      // Create a dummy hui-view to load sections view which loads hui-view-footer, 
      // which is needed to forge the footer element even if not used in a view with a footer. 
      // The dummy view is hidden and not added to the DOM if hui-view-footer is already defined, 
      // otherwise it is added to the DOM until hui-view-footer is defined and then removed.
      if (!window.customElements.get("hui-view-footer") && !this._view) {
        this._view = document.createElement("hui-view") as LovelaceElement;
        (this._view as any).index = 0;
        this._view.lovelace = { config: { views: [{ type: "sections", sections: [] }] } };
        this._view.hass = this.hass;
        this._view.style.setProperty("display", "none");
        document.body.appendChild(this._view);
      }
      window.customElements.whenDefined("hui-view-footer").then(() => {
        this.forgedElement = document.createElement("hui-view-footer") as LovelaceElement;
        (this.forgedElement.config as any) = { card: this.forgedElementConfig, max_width: this.forgeConfig.max_width ?? "600" };
        this.forgedElement.hass = this.hass;
        this.forgedElement.lovelace = { editMode: false };
        document.body.contains(this._view) && document.body.removeChild(this._view);
        this._view = undefined;
        this.refreshForge(["hidden"]);
      });
      return;
    }
    if (this._mold.isCardFeature()) {
      this.forgedElement = document.createElement("hui-card-feature") as LovelaceElement;
      (this.forgedElement as HuiCardFeature).feature = this.forgedElementConfig;
      (this.forgedElement as HuiCardFeature).hass = this.hass;
      (this.forgedElement as HuiCardFeature).color = this.color;
      (this.forgedElement as HuiCardFeature).position = this.position;
      (this.forgedElement as HuiCardFeature).context = this.context;
      this.refreshForge(["hidden"]);
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
      if (!this.preview || this._mold?.isPictureElement()) {
        this.refreshForge(["hidden"]);
      }
      if (this.preview && this._mold?.isFooter()) {
        this.refreshForge(["hidden"]);
      }
      if (this.preview && this._mold?.isSection()) {
        this.refreshForge(["hidden"]);
      }
    }
    if (_changedProperties.has("lovelace") && this._mold?.isSection()) {
      if (this.forgedElement) {
        // Force lovelace of forged section to be in non-editable mode
        // A section in non-editable mode does not need anything else in lovelace
        const lovelace = { editMode: false };
        this.forgedElement.lovelace = lovelace;
        this.forgedElement.updateComplete?.then(() => {
          if (this.lovelace?.editMode) {
            this.forgedElement._layoutElement?.style.setProperty("border", "2px dashed #CE3226");
            this.forgedElement._layoutElement?.style.setProperty("border-radius", "var(--ha-card-border-radius, var(--ha-border-radius-lg))");
            this.forgedElement._layoutElement?.style.setProperty("padding", "2px");
          } else {
            this.forgedElement._layoutElement?.style.removeProperty("border");
            this.forgedElement._layoutElement?.style.removeProperty("border-radius");
            this.forgedElement._layoutElement?.style.removeProperty("padding");
          }
        });
      }
    }
    if (_changedProperties.has("layout")) {
      this.forgedElement && (this.forgedElement.layout = this.layout);
    }
    if (_changedProperties.has("templatesReady")) {
      this.refreshForgedElement([]);
    }
    if (this._mold?.isCardFeature()) {
      if (
        _changedProperties.has("context") ||
        _changedProperties.has("color") ||
        _changedProperties.has("position")
      ) {
        this.refreshForgeTemplates();
      }
      if (this._mold?.isPreview()) {
        this.refreshForgedElement(["hidden"]);
      }
    }
    this._sparkController.updated(_changedProperties);
  }

  protected render() {
    return this.forgedElement ? 
      html`
      ${this.forgedElement}
      ${this._mold.hasStyle() ? html`<style>${this._mold.style()}</style>` : nothing}
      ` 
      : nothing;
  }
}

window.addEventListener("uix-bootstrap", async (ev: Event) => {
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
