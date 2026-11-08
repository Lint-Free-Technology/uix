export const ELEMENT_CONFIG_UIX_TYPES = [
  "card",
  "badge",
  "heading-badge",
  "row",
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
const isSafeConfigKey = (key: string): boolean => (
  /^[A-Za-z_][A-Za-z0-9_-]*$/.test(key) && !["__proto__", "constructor", "prototype"].includes(key)
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
    isSafeConfigKey(value.config_key)
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
  cachedRules = rules.filter(isRule);
  return cachedRules;
}

/**
 * Add static global defaults to a native Lovelace config without ever changing
 * the dashboard-owned source object. An explicit key, including null or false,
 * always wins over a global default.
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
    if (rule.uix_type !== uixType || rule.element_type !== elementType || hasOwn(result, rule.config_key)) continue;
    if (result === config) result = { ...config };
    result[rule.config_key] = cloneStaticValue(rule.value);
  }
  return result;
}

/**
 * Entity rows may be represented as a compact entity-id string. Only expand
 * that shorthand when a matching row/entity default exists.
 */
export function applyEntityRowConfigDefaults(config: any): any {
  if (!hasElementConfigDefaults()) return config;
  if (typeof config === "string") {
    const expanded = { entity: config };
    const result = applyElementConfigDefaults("row", expanded, "entity");
    return result === expanded ? config : result;
  }
  const implicitType = config && typeof config === "object" && "entity" in config && typeof config.type !== "string"
    ? "entity"
    : undefined;
  return applyElementConfigDefaults("row", config, implicitType);
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
