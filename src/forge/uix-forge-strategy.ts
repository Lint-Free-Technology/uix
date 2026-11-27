import { buildBillets, buildMacros } from "../helpers/apply_uix";
import { ensureBuiltinDashboardStrategy, ensureBuiltinSectionStrategy } from "../helpers/dom/ensure-element";
import { hasTemplate, render_template } from "../helpers/templates";
import { applyConfigSparks, cloneConfig, setConfigValue } from "./config-transform";
import { applyEntitiesSparks, entitiesSparkSets, entitiesSparkSignature, hasEntitiesSparks, queryOnlyEntitiesSparkSets } from "./entities-transform";
import { entitySelectionHass, loadSelectionRegistries, selectionRegistries, selectionRegistryKinds } from "./entity-selection-registries";
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

const DEFAULT_REGISTRY_DEPENDENCIES = ["entities", "devices", "areas", "floors"];

function strategyTags(scope: StrategyScope, type: string): string[] {
  if (BUILTIN_STRATEGIES[scope].has(type)) return [`${type}-${scope}-strategy`];
  if (type.startsWith("custom:")) {
    const name = type.slice("custom:".length);
    return [`ll-strategy-${scope}-${name}`, `ll-strategy-${name}`];
  }
  throw new Error(`uix-forge: unknown ${scope} strategy '${type}'`);
}

async function resolveStrategy(scope: StrategyScope, type: string, hass: any): Promise<any> {
  const tags = strategyTags(scope, type);
  const defined = tags.map((tag) => customElements.get(tag)).find(Boolean);
  if (defined) return defined;
  if (!type.startsWith("custom:")) {
    if (scope === "section") return ensureBuiltinSectionStrategy(type, hass);
    if (scope === "dashboard") return ensureBuiltinDashboardStrategy(type, hass);
    throw new Error(`uix-forge: Home Assistant has not loaded the ${scope} strategy '${type}'`);
  }
  throw new Error(`uix-forge: Home Assistant has not loaded the ${scope} strategy '${type}'`);
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
  const strategy = await resolveStrategy(scope, config.type, hass);
  onStrategy?.(strategy);
  if (typeof strategy.generate === "function") return strategy.generate(cloneConfig(config), hass);
  if (scope === "dashboard" && typeof strategy.generateDashboard === "function") {
    return strategy.generateDashboard({ config: { strategy: cloneConfig(config), views: [] }, hass });
  }
  throw new Error(`uix-forge: strategy '${config.type}' does not implement generate()`);
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
      const resolved = key === "uix"
        ? cloneConfig(child)
        : (await resolveTemplates(child, context, macros, billets, pairs, [...path, key], opaquePaths)).value;
      // Configuration must retain an own `__proto__` data property rather
      // than invoking Object.prototype's legacy prototype setter.
      setConfigValue(result, key, resolved);
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
  // Strategy generation must not wait for an initial view render merely to
  // obtain panel variables. `render_template` supplies the latest known
  // standard UIX context and falls back to a safe empty panel context.
  const parsed = parseStructuralTemplateResult(await render_template(`${macroStr}${billetStr}${template}`, context, true));
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
  // Resolve Spark sources first. Named query-only results then become a
  // read-only template variable for the strategy element.
  const resolvedSparks = (await resolveTemplates(forge.sparks ?? [], templateContext, forge.macros, forge.billets, templatePairs(forge.template_nesting))).value;
  await loadSelectionRegistries(hass, selectionRegistryKinds(resolvedSparks));
  // HA can deliver a registry or state update while templates and metadata load.
  const currentHass = refresh?.hass ?? hass;
  const registries = selectionRegistries(currentHass);
  const selectionHass = entitySelectionHass(currentHass, registries);
  const elementTemplateContext = { ...templateContext, uixForge: { entities: queryOnlyEntitiesSparkSets(resolvedSparks, selectionHass) } };
  const resolvedOverlay = await resolveTemplates(activeOverlay, elementTemplateContext, forge.macros, forge.billets, templatePairs(forge.template_nesting));
  const resolvedElement = elementBase
    ? composeLayeredElementConfig(elementBase, resolvedOverlay.value, disabledPaths, resolvedOverlay.opaquePaths)
    : resolvedOverlay.value;
  if (refresh) {
    refresh.entitiesSparks = cloneConfig(resolvedSparks.filter((spark: any) => spark?.type === "entities"));
    refresh.selectionRegistries = registries;
    refresh.selectionTime = Date.now();
  }
  const entitySets = entitiesSparkSets(resolvedSparks, selectionHass);
  const sourceElement = applyEntitiesSparks(resolvedElement, resolvedSparks, selectionHass);
  if (refresh) {
    refresh.sourceElement = undefined;
    refresh.delegateStrategy = undefined;
  }
  const isBuiltinBase = typeof sourceElement.type === "string" && BUILTIN_STRATEGIES[scope].has(sourceElement.type);
  const isCustomBase = hasRegisteredCustomStrategy(scope, sourceElement.type);
  if (!isBuiltinBase && !isCustomBase) return applyConfigSparks(sourceElement, resolvedSparks, entitySets);
  if (typeof sourceElement.type !== "string" || !sourceElement.type || sourceElement.type === "custom:uix-forge") {
    throw new Error("uix-forge: a base strategy requires a concrete non-recursive element.type");
  }
  refresh && (refresh.sourceElement = cloneConfig(sourceElement));
  return applyConfigSparks(await generateBaseStrategy(scope, sourceElement, currentHass, (strategy) => {
    if (refresh) refresh.delegateStrategy = strategy;
  }), resolvedSparks, entitySets);
}

type StrategyRefreshState = {
  entityTimer?: number;
  entityRefresh?: Promise<void>;
  resolveEntityRefresh?: () => void;
  hass?: any;
  entitiesSparks?: Record<string, any>[];
  selectionRegistries?: ReturnType<typeof selectionRegistries>;
  selectionTime?: number;
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

export class UixForgeStrategy extends HTMLElement {
  static scope: StrategyScope;

  static shouldRegenerate(config: any, oldHass: any, newHass: any): boolean {
    const state = refreshState(config);
    // `generate()` may follow a later HA update whose entity selection does
    // not change. Always retain that current Hass object, not just the one
    // that started a debounced Entities Spark refresh.
    if (state) state.hass = newHass;
    // This synchronous lifecycle hook cannot safely resolve Foundries or
    // templates. Use the fully evaluated Spark config from the last
    // generation instead of reading raw authored values.
    const sparks = state?.entitiesSparks ?? [];
    let entitiesChanged = false;
    if (hasEntitiesSparks(sparks)) {
      const registries = selectionRegistries(newHass);
      const now = Date.now();
      try {
        const previous = entitySelectionHass(oldHass, state?.selectionRegistries);
        const current = entitySelectionHass(newHass, registries);
        entitiesChanged = entitiesSparkSignature(sparks, previous, state?.selectionTime ?? now) !== entitiesSparkSignature(sparks, current, now);
      } catch (_error) {
        entitiesChanged = true;
      }
      if (state) {
        state.selectionRegistries = registries;
        state.selectionTime = now;
      }
    }
    if (entitiesChanged) scheduleEntityRefresh(config, newHass);

    let delegateChanged = false;
    try {
      if (state?.delegateStrategy?.shouldRegenerate) {
        delegateChanged = state.delegateStrategy.shouldRegenerate(state.sourceElement, oldHass, newHass) === true;
      } else if (state?.delegateStrategy) {
        // Match Home Assistant's fallback for strategies that do not provide
        // shouldRegenerate(): registry identity changes are their dependencies.
        const dependencies = state.delegateStrategy.registryDependencies ?? DEFAULT_REGISTRY_DEPENDENCIES;
        delegateChanged = dependencies.some((dependency: string) => oldHass?.[dependency] !== newHass?.[dependency]);
      }
    } catch (_error) {
      delegateChanged = true;
    }

    // Forge-owned templates are re-evaluated during Home Assistant's normal
    // strategy lifecycle. Entity Spark selection is an additional dependency,
    // never a replacement for the delegate's normal data dependencies.
    return entitiesChanged || delegateChanged;
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
