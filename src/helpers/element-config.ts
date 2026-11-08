export const ELEMENT_CONFIG_UIX_TYPES = [
  "card",
  "badge",
  "heading-badge",
  "row",
  "glance",
  "element",
] as const;

export type ElementConfigUixType = (typeof ELEMENT_CONFIG_UIX_TYPES)[number];

export interface ElementConfigRule {
  uix_type: ElementConfigUixType;
  element_type: string;
  config_key: string;
  value: unknown;
}

const hasOwn = (value: object, key: string): boolean => Object.prototype.hasOwnProperty.call(value, key);
const CONFIG_PATH_SEGMENT_RE = /^[A-Za-z_][A-Za-z0-9_-]*$/;
const UNSAFE_CONFIG_PATH_SEGMENTS = new Set(["__proto__", "constructor", "prototype"]);

function configPath(configKey: string): string[] | undefined {
  const path = configKey.split(".");
  return path.every((segment) => (
    CONFIG_PATH_SEGMENT_RE.test(segment) && !UNSAFE_CONFIG_PATH_SEGMENTS.has(segment)
  )) ? path : undefined;
}

const isConfigMap = (value: any): value is Record<string, any> => (
  Boolean(value) && typeof value === "object" && !Array.isArray(value)
);

function cloneStaticValue(value: any): any {
  if (Array.isArray(value)) return value.map(cloneStaticValue);
  if (value && typeof value === "object") {
    const clone: Record<string, any> = {};
    for (const [key, child] of Object.entries(value)) clone[key] = cloneStaticValue(child);
    return clone;
  }
  return value;
}

function isRule(value: any): value is ElementConfigRule {
  return (
    value &&
    typeof value === "object" &&
    ELEMENT_CONFIG_UIX_TYPES.includes(value.uix_type) &&
    typeof value.element_type === "string" &&
    typeof value.config_key === "string" &&
    Boolean(configPath(value.config_key))
  );
}

let cachedRulesSource: unknown;
let cachedRules: ElementConfigRule[] = [];

export function hasElementConfigDefaults(): boolean {
  const coordinator = (window as any).uixCoordinator;
  if (typeof coordinator?.hasElementConfig === "boolean") return coordinator.hasElementConfig;
  return Array.isArray(coordinator?.elementConfig) && coordinator.elementConfig.length > 0;
}

export function elementConfigRules(): ElementConfigRule[] {
  const rules = (window as any).uixCoordinator?.elementConfig;
  if (!Array.isArray(rules) || !rules.length) return [];
  if (rules === cachedRulesSource) return cachedRules;
  cachedRulesSource = rules;
  const pathsByTarget = new Map<string, string[]>();
  cachedRules = rules.filter((rule): rule is ElementConfigRule => {
    if (!isRule(rule)) return false;
    const target = `${rule.uix_type}\u0000${rule.element_type}`;
    const paths = pathsByTarget.get(target) ?? [];
    if (paths.some((path) => (
      rule.config_key === path
      || rule.config_key.startsWith(`${path}.`)
      || path.startsWith(`${rule.config_key}.`)
    ))) return false;
    paths.push(rule.config_key);
    pathsByTarget.set(target, paths);
    return true;
  });
  return cachedRules;
}

function buildDefaultConfigPath(path: string[], value: unknown): Record<string, any> {
  const [segment, ...remaining] = path;
  return {
    [segment]: remaining.length ? buildDefaultConfigPath(remaining, value) : cloneStaticValue(value),
  };
}

/**
 * Add one missing default at a safe object path. Existing leaf values and
 * non-object intermediate values are explicit configuration and always win.
 */
function addDefaultAtConfigPath(config: Record<string, any>, path: string[], value: unknown): Record<string, any> {
  const [segment, ...remaining] = path;
  if (!remaining.length) {
    return hasOwn(config, segment) ? config : { ...config, [segment]: cloneStaticValue(value) };
  }

  if (!hasOwn(config, segment)) {
    return { ...config, ...buildDefaultConfigPath(path, value) };
  }

  const child = config[segment];
  if (!isConfigMap(child)) return config;
  const updatedChild = addDefaultAtConfigPath(child, remaining, value);
  return updatedChild === child ? config : { ...config, [segment]: updatedChild };
}

/**
 * Add static global defaults to a native Lovelace config without ever changing
 * the dashboard-owned source object. An explicit key or path value, including
 * null or false, always wins over a global default.
 */
export function applyElementConfigDefaults(
  uixType: ElementConfigUixType,
  config: any,
  implicitType?: string,
): any {
  if (!hasElementConfigDefaults()) return config;
  if (!config || typeof config !== "object" || Array.isArray(config)) return config;

  const elementType = typeof config.type === "string" ? config.type : implicitType;
  if (!elementType) return config;

  let result = config;
  for (const rule of elementConfigRules()) {
    if (rule.uix_type !== uixType || rule.element_type !== elementType) continue;
    const path = configPath(rule.config_key);
    if (!path) continue;
    result = addDefaultAtConfigPath(result, path, rule.value);
  }
  return result;
}

/** Expand entity shorthand only when a matching boundary default exists. */
function applyEntityConfigDefaults(
  uixType: "row" | "glance",
  config: any,
): any {
  if (!hasElementConfigDefaults()) return config;
  if (typeof config === "string") {
    const expanded = { entity: config };
    const result = applyElementConfigDefaults(uixType, expanded, "entity");
    return result === expanded ? config : result;
  }
  const implicitType = config && typeof config === "object" && "entity" in config && typeof config.type !== "string"
    ? "entity"
    : undefined;
  return applyElementConfigDefaults(uixType, config, implicitType);
}

/**
 * Entity rows may be represented as a compact entity-id string. Only expand
 * that shorthand when a matching row/entity default exists.
 */
export function applyEntityRowConfigDefaults(config: any): any {
  return applyEntityConfigDefaults("row", config);
}

/** Apply defaults to one Glance entity before Home Assistant renders it. */
export function applyGlanceEntityConfigDefaults(config: any): any {
  return applyEntityConfigDefaults("glance", config);
}

/**
 * Add defaults to Glance's nested entity configs while retaining the original
 * card config and entity array whenever no matching default applies.
 */
export function applyGlanceCardConfigDefaults(config: any): any {
  if (!hasElementConfigDefaults()) return config;
  if (!config || !Array.isArray(config.entities)) return config;

  let entities = config.entities;
  for (let i = 0; i < config.entities.length; i++) {
    const entity = applyGlanceEntityConfigDefaults(config.entities[i]);
    if (entity !== config.entities[i]) {
      if (entities === config.entities) entities = [...config.entities];
      entities[i] = entity;
    }
  }
  return entities === config.entities ? config : { ...config, entities };
}

interface ElementConfigRebuildRegistration {
  hostRef: { deref: () => HTMLElement | undefined };
  rebuild: (host: HTMLElement) => void;
  pending: boolean;
}

const rebuildRegistrations = new WeakMap<HTMLElement, ElementConfigRebuildRegistration>();
const activeRebuildRegistrations = new Set<ElementConfigRebuildRegistration>();
let listeningForElementConfigUpdates = false;

function removeRebuildRegistration(
  registration: ElementConfigRebuildRegistration,
  host?: HTMLElement,
): void {
  activeRebuildRegistrations.delete(registration);
  if (host) rebuildRegistrations.delete(host);
  if (!activeRebuildRegistrations.size && listeningForElementConfigUpdates) {
    window.removeEventListener("uix-element-config-update", rebuildElementConfigRegistrations);
    listeningForElementConfigUpdates = false;
  }
}

function rebuildElementConfigRegistrations(): void {
  for (const registration of activeRebuildRegistrations) {
    const host = registration.hostRef.deref();
    if (!host || !host.isConnected) {
      removeRebuildRegistration(registration, host);
      continue;
    }
    if (registration.pending) continue;
    registration.pending = true;
    Promise.resolve().then(() => {
      registration.pending = false;
      const host = registration.hostRef.deref();
      if (!host || !host.isConnected) {
        removeRebuildRegistration(registration, host);
        return;
      }
      registration.rebuild(host);
    });
  }
}

/**
 * Register a refresh callback without retaining a disconnected dashboard
 * element. A shared window listener rebuilds each live boundary on updates.
 */
export function registerElementConfigRebuild(host: HTMLElement, rebuild: (host: HTMLElement) => void): void {
  if (rebuildRegistrations.has(host)) return;
  const WeakRefConstructor = (globalThis as any).WeakRef;
  const registration: ElementConfigRebuildRegistration = {
    hostRef: WeakRefConstructor ? new WeakRefConstructor(host) : { deref: () => host },
    rebuild,
    pending: false,
  };
  rebuildRegistrations.set(host, registration);
  activeRebuildRegistrations.add(registration);
  if (!listeningForElementConfigUpdates) {
    window.addEventListener("uix-element-config-update", rebuildElementConfigRegistrations);
    listeningForElementConfigUpdates = true;
  }
}
