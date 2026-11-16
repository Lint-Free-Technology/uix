import { buildBillets, buildMacros } from "../helpers/apply_uix";
import { hasTemplate, render_template } from "../helpers/templates";
import { applyConfigSparks, cloneConfig } from "./config-transform";
import { applyEntitiesSparks, entitiesSparkSignature, hasEntitiesSparks } from "./entities-transform";
import { composeLayeredElementConfig, _resolveFoundryConfig } from "./uix-forge";
import { UIX_FORGE_IGNORE_TEMPLATE_STRING } from "./uix-forge-types";

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

function hasRegisteredCustomStrategy(scope: StrategyScope, type: any): boolean {
  if (typeof type !== "string" || !type.startsWith("custom:")) return false;
  return strategyTags(scope, type).some((tag) => customElements.get(tag) !== undefined);
}

function resolvedEntitySparks(config: any): Record<string, any>[] {
  const coordinator = (window as any).uixCoordinator;
  const resolved = _resolveFoundryConfig(config, coordinator?.foundries, coordinator?.ready);
  return resolved?.forge?.sparks ?? config?.forge?.sparks ?? [];
}

export async function generateBaseStrategy(scope: StrategyScope, config: Record<string, any>, hass: any): Promise<any> {
  if (scope === "view") {
    const view = document.createElement("hui-view") as any;
    view.hass = hass;
    return view._generateConfig({ strategy: config });
  }
  const strategy = await resolveStrategy(scope, config.type);
  if (typeof strategy.generate !== "function") throw new Error(`uix-forge: strategy '${config.type}' does not implement generate()`);
  const baseConfig = cloneConfig(config);
  delete baseConfig.type;
  return strategy.generate(baseConfig, hass);
}

function isMapping(value: any): value is Record<string, any> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

async function resolveTemplates(value: any, context: Record<string, any>, macros?: any, billets?: any): Promise<any> {
  if (Array.isArray(value)) return Promise.all(value.map((item) => resolveTemplates(item, context, macros, billets)));
  if (isMapping(value)) {
    const result: Record<string, any> = {};
    for (const [key, child] of Object.entries(value)) result[key] = key === "uix" ? cloneConfig(child) : await resolveTemplates(child, context, macros, billets);
    return result;
  }
  if (typeof value !== "string" || value.includes(UIX_FORGE_IGNORE_TEMPLATE_STRING) || !hasTemplate(value)) return value;
  const macroStr = buildMacros(macros, value);
  const billetStr = buildBillets(billets, `${macroStr}${value}`);
  return render_template(`${macroStr}${billetStr}${value}`, context);
}

function resolveElement(config: any): { forge: Record<string, any>; element: Record<string, any>; elementBase?: Record<string, any> } {
  const coordinator = (window as any).uixCoordinator;
  const resolved = _resolveFoundryConfig(config, coordinator?.foundries, coordinator?.ready);
  if (!resolved) throw new Error("uix-forge: Foundries are not ready");
  if (resolved.forge?.mold !== "strategy") throw new Error("uix-forge: strategy entry point requires forge.mold: strategy");
  const forge = resolved.forge ?? {};
  for (const key of ["hidden", "grid_options", "show_error", "delayed_hass", "uix"]) {
    if (forge[key] !== undefined) throw new Error(`uix-forge: forge.${key} is not supported by mold: strategy`);
  }
  const sparks = forge.sparks ?? [];
  if (!Array.isArray(sparks) || sparks.some((spark: any) => spark?.type !== "config" && spark?.type !== "entities")) {
    throw new Error("uix-forge: mold: strategy only supports entities and config Sparks");
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
  const { forge, element, elementBase } = resolveElement(config);
  const templateContext = { config: { ...config, forge, element, element_base: elementBase }, uixForge: {} };
  return resolveTemplates(forge.sparks ?? [], templateContext, forge.macros, forge.billets);
}

/** Resolve the exact scope configuration that a strategy Forge returns to Home Assistant. */
export async function resolveStrategyConfig(config: any, scope: StrategyScope, hass?: any): Promise<any> {
  const { forge, element, elementBase } = resolveElement(config);
  const templateContext = { config: { ...config, forge, element, element_base: elementBase }, uixForge: {} };
  const resolvedOverlay = await resolveTemplates(element, templateContext, forge.macros, forge.billets);
  const resolvedElement = elementBase
    ? composeLayeredElementConfig(elementBase, resolvedOverlay, config.element_disabled_paths ?? [])
    : resolvedOverlay;
  const resolvedSparks = await resolveTemplates(forge.sparks ?? [], templateContext, forge.macros, forge.billets);
  const sourceElement = applyEntitiesSparks(resolvedElement, resolvedSparks, hass);
  const isBuiltinBase = typeof sourceElement.type === "string" && BUILTIN_STRATEGIES[scope].has(sourceElement.type);
  const isCustomBase = hasRegisteredCustomStrategy(scope, sourceElement.type);
  if (!isBuiltinBase && !isCustomBase) return applyConfigSparks(sourceElement, resolvedSparks);
  if (typeof sourceElement.type !== "string" || !sourceElement.type || sourceElement.type === "custom:uix-forge") {
    throw new Error("uix-forge: a base strategy requires a concrete non-recursive element.type");
  }
  return applyConfigSparks(await generateBaseStrategy(scope, sourceElement, hass), resolvedSparks);
}

type StrategyDebounce = { initialized: boolean; timer?: number; hass?: any; pending: Array<{ resolve: (config: any) => void; reject: (error: any) => void }>; };
const strategyDebounces = new WeakMap<object, StrategyDebounce>();

function debouncedStrategyConfig(config: any, scope: StrategyScope, hass: any): Promise<any> {
  if (!config || typeof config !== "object") return resolveStrategyConfig(config, scope, hass);
  let state = strategyDebounces.get(config);
  if (!state) {
    state = { initialized: false, pending: [] };
    strategyDebounces.set(config, state);
  }
  if (!state.initialized) {
    state.initialized = true;
    return resolveStrategyConfig(config, scope, hass);
  }
  state.hass = hass;
  if (state.timer !== undefined) clearTimeout(state.timer);
  return new Promise((resolve, reject) => {
    state!.pending.push({ resolve, reject });
    state!.timer = window.setTimeout(async () => {
      const pending = state!.pending.splice(0);
      state!.timer = undefined;
      try {
        const result = await resolveStrategyConfig(config, scope, state!.hass);
        pending.forEach((request) => request.resolve(result));
      } catch (error) {
        pending.forEach((request) => request.reject(error));
      }
    }, 500);
  });
}

export class UixForgeStrategy extends HTMLElement {
  static scope: StrategyScope;

  static shouldRegenerate(config: any, oldHass: any, newHass: any): boolean {
    const sparks = resolvedEntitySparks(config);
    if (hasEntitiesSparks(sparks)) {
      try {
        return entitiesSparkSignature(sparks, oldHass) !== entitiesSparkSignature(sparks, newHass);
      } catch (_error) {
        return true;
      }
    }
    return oldHass.states !== newHass.states
      || oldHass.entities !== newHass.entities
      || oldHass.devices !== newHass.devices
      || oldHass.areas !== newHass.areas
      || oldHass.floors !== newHass.floors;
  }

  static async generate(config: any, hass: any): Promise<any> {
    return hasEntitiesSparks(resolvedEntitySparks(config))
      ? debouncedStrategyConfig(config, this.scope, hass)
      : resolveStrategyConfig(config, this.scope, hass);
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
