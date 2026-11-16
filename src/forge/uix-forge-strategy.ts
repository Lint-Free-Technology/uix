import { buildBillets, buildMacros } from "../helpers/apply_uix";
import { hasTemplate, render_template } from "../helpers/templates";
import { applyConfigSparks, cloneConfig } from "./config-transform";
import { applyEntitiesSparks, entitiesSparkSignature, hasEntitiesSparks } from "./entities-transform";
import { activeLayeredOverrideValues, composeLayeredElementConfig, _resolveFoundryConfig } from "./uix-forge";
import {
  getNestedTemplateRawDelimiters,
  ignoreTemplate,
  UIX_FORGE_IGNORE_TEMPLATE_STRING,
  UIX_FORGE_NESTED_TEMPLATE_CLOSE,
  UIX_FORGE_NESTED_TEMPLATE_OPEN,
} from "./uix-forge-types";

type StrategyScope = "dashboard" | "view" | "section";

const BUILTIN_STRATEGIES: Record<StrategyScope, Set<string>> = {
  dashboard: new Set(["original-states", "map", "iframe", "areas", "home", "energy"]),
  view: new Set(["original-states", "energy-overview", "energy", "water", "gas", "power", "map", "iframe", "area", "areas-overview", "home-overview", "home-media-players", "home-area", "home-other-devices", "light", "security", "climate", "maintenance"]),
  section: new Set(["common-controls", "device", "entities"]),
};

function strategyTags(scope: StrategyScope, type: string): string[] {
  if (BUILTIN_STRATEGIES[scope].has(type)) return [`${type}-${scope}-strategy`];
  if (type.startsWith("custom:")) {
    const name = type.slice("custom:".length);
    return [`ll-strategy-${scope}-${name}`, `ll-strategy-${name}`];
  }
  throw new Error(`uix-forge: unknown ${scope} strategy '${type}'`);
}

async function resolveStrategy(scope: StrategyScope, type: string): Promise<any> {
  const tags = strategyTags(scope, type);
  const defined = tags.map((tag) => customElements.get(tag)).find(Boolean);
  if (defined) return defined;
  if (!type.startsWith("custom:")) {
    throw new Error(`uix-forge: Home Assistant has not loaded the ${scope} strategy '${type}'`);
  }
  const timeout = new Promise<undefined>((resolve) => window.setTimeout(resolve, 5000));
  await Promise.race([...tags.map((tag) => customElements.whenDefined(tag)), timeout]);
  const strategy = tags.map((tag) => customElements.get(tag)).find(Boolean);
  if (!strategy) throw new Error(`uix-forge: timeout loading ${scope} strategy '${type}'`);
  return strategy;
}

function registeredStrategy(scope: StrategyScope, type: string): any | undefined {
  try {
    return strategyTags(scope, type).map((tag) => customElements.get(tag)).find(Boolean);
  } catch (_error) {
    return undefined;
  }
}

function hasRegisteredCustomStrategy(scope: StrategyScope, type: any): boolean {
  if (typeof type !== "string" || !type.startsWith("custom:")) return false;
  return strategyTags(scope, type).some((tag) => customElements.get(tag) !== undefined);
}

function resolvedEntitySparks(config: any): Record<string, any>[] {
  const coordinator = (window as any).uixCoordinator;
  try {
    const resolved = _resolveFoundryConfig(config, coordinator?.foundries, coordinator?.ready);
    return resolved?.forge?.sparks ?? [];
  } catch (_error) {
    // shouldRegenerate is synchronous. Until the asynchronous readiness phase
    // below has completed, use the conservative normal strategy dependencies.
    return [];
  }
}

export async function generateBaseStrategy(
  scope: StrategyScope,
  config: Record<string, any>,
  hass: any,
  onStrategy?: (strategy: any) => void
): Promise<any> {
  if (scope === "view") {
    const view = document.createElement("hui-view") as any;
    view.hass = hass;
    const generated = await view._generateConfig({ strategy: config });
    onStrategy?.(registeredStrategy(scope, config.type));
    return generated;
  }
  const strategy = await resolveStrategy(scope, config.type);
  onStrategy?.(strategy);
  if (typeof strategy.generate !== "function") throw new Error(`uix-forge: strategy '${config.type}' does not implement generate()`);
  const baseConfig = cloneConfig(config);
  delete baseConfig.type;
  return strategy.generate(baseConfig, hass);
}

function isMapping(value: any): value is Record<string, any> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

type TemplatePair = { open: string; close: string };
type ResolvedTemplateValue = { value: any; opaquePaths: Set<string> };

function templatePairs(templateNesting?: string): TemplatePair[] {
  const open = templateNesting ? templateNesting.slice(0, 2) : UIX_FORGE_NESTED_TEMPLATE_OPEN;
  const close = templateNesting ? templateNesting.slice(2) : UIX_FORGE_NESTED_TEMPLATE_CLOSE;
  const pairs: TemplatePair[] = [{ open, close }];
  const statementOpen = `${open.charAt(0)}%`;
  const statementClose = `%${close.charAt(close.length - 1)}`;
  if (open.length > 1 && close.length > 1 && (statementOpen !== open || statementClose !== close)) {
    pairs.push({ open: statementOpen, close: statementClose });
  }
  return pairs;
}

function hasTemplateOrNestedTemplate(value: string, pairs: TemplatePair[]): boolean {
  return hasTemplate(value) || pairs.some(({ open }) => value.includes(open));
}

function stripPassthroughNesting(value: string, pairs: TemplatePair[]): string {
  return pairs.reduce((output, { open, close }) => output
    .split(open.charAt(0) + open).join(open)
    .split(close + close.charAt(close.length - 1)).join(close), value);
}

function hasNonPassthroughTemplate(value: string, pairs: TemplatePair[]): boolean {
  const masked = pairs.reduce((output, { open, close }) => output
    .split(open.charAt(0) + open).join("")
    .split(close + close.charAt(close.length - 1)).join(""), value);
  return hasTemplateOrNestedTemplate(masked, pairs);
}

function replaceNestedTemplateDelimiters(value: string, pairs: TemplatePair[]): string {
  const passthrough: Array<{ openMarker: string; closeMarker: string; open: string; close: string }> = [];
  let output = value;
  pairs.forEach(({ open, close }, index) => {
    const openMarker = `##UIX_FORGE_STRATEGY_PASSTHROUGH_OPEN_${index}##`;
    const closeMarker = `##UIX_FORGE_STRATEGY_PASSTHROUGH_CLOSE_${index}##`;
    passthrough.push({ openMarker, closeMarker, open, close });
    output = output
      .split(open.charAt(0) + open).join(openMarker)
      .split(close + close.charAt(close.length - 1)).join(closeMarker);
  });
  for (const { open, close } of pairs) {
    const raw = getNestedTemplateRawDelimiters(open);
    output = output.split(open).join(raw.openRaw).split(close).join(raw.closeRaw);
  }
  for (const { openMarker, closeMarker, open, close } of passthrough) {
    output = output.split(openMarker).join(open).split(closeMarker).join(close);
  }
  return output;
}

function parseStructuralTemplateResult(value: string): { value: any; opaque: boolean } {
  const trimmed = value.trim();
  if (!trimmed.startsWith("{") && !trimmed.startsWith("[")) return { value, opaque: false };
  try {
    return { value: JSON.parse(trimmed), opaque: true };
  } catch (_error) {
    return { value, opaque: false };
  }
}

async function resolveTemplates(
  value: any,
  context: Record<string, any>,
  macros?: any,
  billets?: any,
  pairs: TemplatePair[] = templatePairs(),
  path: string[] = [],
  opaquePaths = new Set<string>()
): Promise<ResolvedTemplateValue> {
  if (Array.isArray(value)) {
    const values = await Promise.all(value.map(async (item, index) => (await resolveTemplates(item, context, macros, billets, pairs, [...path, String(index)], opaquePaths)).value));
    return { value: values, opaquePaths };
  }
  if (isMapping(value)) {
    const result: Record<string, any> = {};
    for (const [key, child] of Object.entries(value)) {
      result[key] = key === "uix"
        ? cloneConfig(child)
        : (await resolveTemplates(child, context, macros, billets, pairs, [...path, key], opaquePaths)).value;
    }
    return { value: result, opaquePaths };
  }
  if (typeof value !== "string" || value.includes(UIX_FORGE_IGNORE_TEMPLATE_STRING) || ignoreTemplate(value)) return { value, opaquePaths };
  const passthrough = stripPassthroughNesting(value, pairs);
  if (passthrough !== value && !hasNonPassthroughTemplate(value, pairs)) return { value: passthrough, opaquePaths };
  if (!hasTemplateOrNestedTemplate(value, pairs)) return { value, opaquePaths };
  const template = replaceNestedTemplateDelimiters(value, pairs);
  const macroStr = buildMacros(macros, template);
  const billetStr = buildBillets(billets, `${macroStr}${template}`);
  const parsed = parseStructuralTemplateResult(await render_template(`${macroStr}${billetStr}${template}`, context));
  if (parsed.opaque) opaquePaths.add(JSON.stringify(path));
  return { value: parsed.value, opaquePaths };
}

async function waitForFoundries(): Promise<void> {
  const coordinator = (window as any).uixCoordinator;
  if (coordinator?.ready) {
    await coordinator.connectionPromise;
    return;
  }
  await new Promise<void>((resolve) => {
    const ready = () => {
      if (!(window as any).uixCoordinator?.ready) return;
      window.removeEventListener("uix-ready", ready);
      window.removeEventListener("uix-foundries-updated", ready);
      Promise.resolve((window as any).uixCoordinator?.connectionPromise).then(resolve, resolve);
    };
    window.addEventListener("uix-ready", ready);
    window.addEventListener("uix-foundries-updated", ready);
    ready();
  });
}

async function resolveElement(config: any): Promise<{ forge: Record<string, any>; element: Record<string, any>; elementBase?: Record<string, any> }> {
  await waitForFoundries();
  const coordinator = (window as any).uixCoordinator;
  const resolved = _resolveFoundryConfig(config, coordinator?.foundries, coordinator?.ready);
  if (!resolved) throw new Error("uix-forge: Foundries are not ready");
  if (resolved.forge?.mold !== "strategy") throw new Error("uix-forge: strategy entry point requires forge.mold: strategy");
  const forge = resolved.forge ?? {};
  if (forge.template_nesting !== undefined && (typeof forge.template_nesting !== "string" || forge.template_nesting.length !== 4)) {
    throw new Error("uix-forge: forge template_nesting must be four characters");
  }
  for (const key of ["hidden", "grid_options", "show_error", "delayed_hass", "uix"]) {
    if (forge[key] !== undefined) throw new Error(`uix-forge: forge.${key} is not supported by mold: strategy`);
  }
  const sparks = forge.sparks ?? [];
  if (!Array.isArray(sparks) || sparks.some((spark: any) => spark?.type !== "config" && spark?.type !== "entities")) {
    throw new Error("uix-forge: mold: strategy only supports entities and config Sparks");
  }
  if (config.element_disabled_paths !== undefined && !resolved.hasElementBase) {
    throw new Error("uix-forge: element_disabled_paths requires element_base");
  }
  if (config.element_disabled_paths !== undefined && (!Array.isArray(config.element_disabled_paths)
    || config.element_disabled_paths.some((path: any) => !Array.isArray(path) || path.some((segment) => typeof segment !== "string")))) {
    throw new Error("uix-forge: element_disabled_paths must be a list of key paths");
  }
  let element = cloneConfig(resolved.element ?? {});
  let elementBase: Record<string, any> | undefined;
  if (resolved.hasElementBase) {
    if (!isMapping(resolved.elementBase) || !isMapping(element)) {
      throw new Error("uix-forge: layered strategy configuration requires mapping element_base and element values");
    }
    elementBase = cloneConfig(resolved.elementBase);
  }
  if (!isMapping(element)) throw new Error("uix-forge: strategy element must be a mapping");
  return { forge, element, elementBase };
}

/** Resolve Forge-owned Entities Spark values for strategy inspection without generating the strategy. */
export async function resolveStrategyEntitiesSparks(config: any): Promise<Record<string, any>[]> {
  const { forge, element, elementBase } = await resolveElement(config);
  const templateContext = { config: { ...config, forge, element, element_base: elementBase }, uixForge: {} };
  return (await resolveTemplates(forge.sparks ?? [], templateContext, forge.macros, forge.billets, templatePairs(forge.template_nesting))).value;
}

/** Resolve the exact scope configuration that a strategy Forge returns to Home Assistant. */
export async function resolveStrategyConfig(config: any, scope: StrategyScope, hass?: any, refresh?: StrategyRefreshState): Promise<any> {
  const { forge, element, elementBase } = await resolveElement(config);
  const templateContext = { config: { ...config, forge, element, element_base: elementBase }, uixForge: {} };
  const disabledPaths = config.element_disabled_paths ?? [];
  const activeOverlay = elementBase ? activeLayeredOverrideValues(element, disabledPaths) : element;
  const resolvedOverlay = await resolveTemplates(activeOverlay, templateContext, forge.macros, forge.billets, templatePairs(forge.template_nesting));
  const resolvedElement = elementBase
    ? composeLayeredElementConfig(elementBase, resolvedOverlay.value, disabledPaths, resolvedOverlay.opaquePaths)
    : resolvedOverlay.value;
  const resolvedSparks = (await resolveTemplates(forge.sparks ?? [], templateContext, forge.macros, forge.billets, templatePairs(forge.template_nesting))).value;
  const sourceElement = applyEntitiesSparks(resolvedElement, resolvedSparks, hass);
  if (refresh) {
    refresh.sourceElement = undefined;
    refresh.delegateStrategy = undefined;
  }
  const isBuiltinBase = typeof sourceElement.type === "string" && BUILTIN_STRATEGIES[scope].has(sourceElement.type);
  const isCustomBase = hasRegisteredCustomStrategy(scope, sourceElement.type);
  if (!isBuiltinBase && !isCustomBase) return applyConfigSparks(sourceElement, resolvedSparks);
  if (typeof sourceElement.type !== "string" || !sourceElement.type || sourceElement.type === "custom:uix-forge") {
    throw new Error("uix-forge: a base strategy requires a concrete non-recursive element.type");
  }
  refresh && (refresh.sourceElement = cloneConfig(sourceElement));
  return applyConfigSparks(await generateBaseStrategy(scope, sourceElement, hass, (strategy) => {
    if (refresh) refresh.delegateStrategy = strategy;
  }), resolvedSparks);
}

type StrategyRefreshState = {
  entityTimer?: number;
  entityRefresh?: Promise<void>;
  resolveEntityRefresh?: () => void;
  hass?: any;
  sourceElement?: any;
  delegateStrategy?: any;
};
const strategyRefreshes = new WeakMap<object, StrategyRefreshState>();

function refreshState(config: any): StrategyRefreshState | undefined {
  if (!config || typeof config !== "object") return undefined;
  let state = strategyRefreshes.get(config);
  if (!state) {
    state = {};
    strategyRefreshes.set(config, state);
  }
  return state;
}

function scheduleEntityRefresh(config: any, hass: any): void {
  const state = refreshState(config);
  if (!state) return;
  state.hass = hass;
  if (!state.entityRefresh) {
    state.entityRefresh = new Promise<void>((resolve) => { state!.resolveEntityRefresh = resolve; });
  }
  if (state.entityTimer !== undefined) clearTimeout(state.entityTimer);
  state.entityTimer = window.setTimeout(() => {
    state!.entityTimer = undefined;
    const resolve = state!.resolveEntityRefresh;
    state!.resolveEntityRefresh = undefined;
    state!.entityRefresh = undefined;
    resolve?.();
  }, 500);
}

function normalForgeDependenciesChanged(oldHass: any, newHass: any): boolean {
  return oldHass.states !== newHass.states
    || oldHass.entities !== newHass.entities
    || oldHass.devices !== newHass.devices
    || oldHass.areas !== newHass.areas
    || oldHass.floors !== newHass.floors;
}

export class UixForgeStrategy extends HTMLElement {
  static scope: StrategyScope;

  static shouldRegenerate(config: any, oldHass: any, newHass: any): boolean {
    const sparks = resolvedEntitySparks(config);
    let entitiesChanged = false;
    if (hasEntitiesSparks(sparks)) {
      try {
        entitiesChanged = entitiesSparkSignature(sparks, oldHass) !== entitiesSparkSignature(sparks, newHass);
      } catch (_error) {
        entitiesChanged = true;
      }
    }
    if (entitiesChanged) scheduleEntityRefresh(config, newHass);

    const state = refreshState(config);
    let delegateChanged = false;
    try {
      if (state?.delegateStrategy?.shouldRegenerate) {
        delegateChanged = state.delegateStrategy.shouldRegenerate(state.sourceElement, oldHass, newHass) === true;
      }
    } catch (_error) {
      delegateChanged = true;
    }

    // Forge-owned templates are re-evaluated by the ordinary Home Assistant
    // strategy lifecycle. Entity Spark selection is an additional dependency,
    // never a replacement for the delegate's normal data dependencies.
    return entitiesChanged || delegateChanged || normalForgeDependenciesChanged(oldHass, newHass);
  }

  static async generate(config: any, hass: any): Promise<any> {
    const state = refreshState(config);
    const pending = state?.entityRefresh;
    if (pending) await pending;
    return resolveStrategyConfig(config, this.scope, state?.hass ?? hass, state);
  }
}

export class UixForgeDashboardStrategy extends UixForgeStrategy { static scope: StrategyScope = "dashboard"; }
export class UixForgeViewStrategy extends UixForgeStrategy { static scope: StrategyScope = "view"; }
export class UixForgeSectionStrategy extends UixForgeStrategy { static scope: StrategyScope = "section"; }

export function registerUixForgeStrategies(): void {
  const strategies: Record<string, CustomElementConstructor> = {
    "ll-strategy-dashboard-uix-forge": UixForgeDashboardStrategy as unknown as CustomElementConstructor,
    "ll-strategy-view-uix-forge": UixForgeViewStrategy as unknown as CustomElementConstructor,
    "ll-strategy-section-uix-forge": UixForgeSectionStrategy as unknown as CustomElementConstructor,
  };
  for (const [tag, strategy] of Object.entries(strategies)) {
    if (!customElements.get(tag)) customElements.define(tag, strategy);
  }
}

window.addEventListener("uix-bootstrap", (ev: Event) => {
  ev.stopPropagation();
  registerUixForgeStrategies();
});
