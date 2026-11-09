import { ContextProvider, createContext } from "@lit/context";
import type { Uix } from "../uix";
import { get_theme_context } from "../helpers/themes";
import { matchesHostElementPath } from "../helpers/selecttree";

type EntityNameItem = {
  type: "floor" | "area" | "parent_device" | "device" | "entity" | "text";
  text?: string;
};

type EntityNameOptions = {
  separator?: string;
};

type EntityNameRequest = "default" | EntityNameItem[];

type EntityNameUse = {
  items: EntityNameItem[];
  options?: EntityNameOptions;
};

type EntityNameRule = {
  request: EntityNameRequest;
  use: EntityNameUse;
};

type CompiledContext = {
  debug?: boolean;
  hasEntityName: boolean;
  entityNameRules: EntityNameRule[];
};

type UixContextScope = {
  direct?: CompiledContext;
  theme?: CompiledContext;
  themeAnchor?: string;
  themeBindingIndex?: number;
  facadeInstalled?: boolean;
  debugMatches?: Set<string>;
  formattersProvider?: ContextProvider<any>;
  formattersCache?: {
    functions: unknown[];
    scopes: UixContextScope[];
    value: Record<string, unknown>;
  };
};

const ENTITY_NAME_TYPES = new Set(["floor", "area", "parent_device", "device", "entity"]);
// Home Assistant creates this context with the same stable string key.
const FORMATTERS_CONTEXT = createContext<Record<string, unknown>>("hassFormatters");
const contextScopes = new WeakMap<HTMLElement, UixContextScope>();
const facadeInfo = new WeakMap<object, { base: any; scopes: UixContextScope[] }>();
const facadeCache = new WeakMap<object, WeakMap<UixContextScope, any>>();

function contextError(message: string, value?: unknown): void {
  console.error(`UIX context: ${message}`, value);
}

function isRecord(value: unknown): value is Record<string, any> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function normalizeEntityNameItems(value: unknown, label: string): EntityNameItem[] | undefined {
  if (!Array.isArray(value)) {
    contextError(`${label} must be a list.`, value);
    return undefined;
  }

  const items: EntityNameItem[] = [];
  for (const item of value) {
    if (typeof item === "string") {
      if (!ENTITY_NAME_TYPES.has(item)) {
        contextError(`${label} contains unknown entity-name type "${item}".`, value);
        return undefined;
      }
      items.push({ type: item as EntityNameItem["type"] });
      continue;
    }

    if (!isRecord(item) || typeof item.type !== "string") {
      contextError(`${label} items must be name types or { type: ... } objects.`, value);
      return undefined;
    }

    if (item.type === "text") {
      if (typeof item.text !== "string") {
        contextError(`${label} text items require a string text value.`, value);
        return undefined;
      }
      items.push({ type: "text", text: item.text });
      continue;
    }

    if (!ENTITY_NAME_TYPES.has(item.type)) {
      contextError(`${label} contains unknown entity-name type "${item.type}".`, value);
      return undefined;
    }
    items.push({ type: item.type as EntityNameItem["type"] });
  }
  return items;
}

function normalizeEntityNameUse(value: unknown, label: string): EntityNameUse | undefined {
  if (Array.isArray(value)) {
    const items = normalizeEntityNameItems(value, label);
    return items ? { items } : undefined;
  }
  if (!isRecord(value)) {
    contextError(`${label} must be a list or an object with items.`, value);
    return undefined;
  }

  const items = normalizeEntityNameItems(value.items, `${label}.items`);
  if (!items) return undefined;
  if (value.options !== undefined && (!isRecord(value.options) || (value.options.separator !== undefined && typeof value.options.separator !== "string"))) {
    contextError(`${label}.options only supports a string separator.`, value);
    return undefined;
  }
  return {
    items,
    options: value.options ? { separator: value.options.separator } : undefined,
  };
}

function compileContext(value: unknown): CompiledContext | undefined {
  if (!isRecord(value)) {
    contextError("A context definition must be a mapping.", value);
    return undefined;
  }

  if (value.debug !== undefined && typeof value.debug !== "boolean") {
    contextError("context.debug must be true or false.", value.debug);
    return undefined;
  }

  const debug = value.debug;
  const entityName = value.entity_name;
  if (entityName === undefined) return { debug, hasEntityName: false, entityNameRules: [] };
  if (!isRecord(entityName) || !Array.isArray(entityName.rules)) {
    contextError("entity_name requires a rules list.", entityName);
    return undefined;
  }

  const rules: EntityNameRule[] = [];
  for (const rule of entityName.rules) {
    if (!isRecord(rule) || rule.when === undefined) {
      contextError("Each entity_name rule requires a when mapping or list of mappings.", rule);
      continue;
    }
    const use = normalizeEntityNameUse(rule.use, "entity_name.rules[].use");
    if (!use) continue;

    const conditions = Array.isArray(rule.when) ? rule.when : [rule.when];
    if (!conditions.length) {
      contextError("Each entity_name rule requires at least one when mapping.", rule);
      continue;
    }
    for (const when of conditions) {
      if (!isRecord(when)) {
        contextError("Each entity_name when entry must be a mapping.", when);
        continue;
      }
      const rawRequest = when.request;
      const request = rawRequest === "default"
        ? "default"
        : normalizeEntityNameItems(rawRequest, "entity_name.rules[].when.request");
      if (!request) continue;
      rules.push({ request, use });
    }
  }
  return { debug, hasEntityName: true, entityNameRules: rules };
}

function getScope(host: HTMLElement): UixContextScope {
  let scope = contextScopes.get(host);
  if (!scope) {
    scope = {};
    contextScopes.set(host, scope);
  }
  return scope;
}

function effectiveEntityNameRules(scope: UixContextScope): EntityNameRule[] {
  if (scope.direct?.hasEntityName) return scope.direct.entityNameRules;
  if (scope.theme?.hasEntityName) return scope.theme.entityNameRules;
  return [];
}

function scopeHasRules(scope: UixContextScope): boolean {
  return effectiveEntityNameRules(scope).length > 0;
}

function contextDebugEnabled(scope: UixContextScope): boolean {
  return scope.direct?.debug ?? scope.theme?.debug ?? false;
}

function sameEntityNameItems(a: EntityNameItem[], b: EntityNameItem[]): boolean {
  return a.length === b.length && a.every((item, index) => item.type === b[index].type && item.text === b[index].text);
}

function matchesEntityNameRequest(request: EntityNameRequest, name: unknown): boolean {
  if (request === "default") return name === undefined || name === null;
  if (typeof name === "string" || name === undefined || name === null) return false;
  const current = Array.isArray(name) ? name : [name];
  const items = normalizeEntityNameItems(current, "formatEntityName request");
  return !!items && sameEntityNameItems(request, items);
}

function formatItems(items: EntityNameItem[]): string {
  return `[${items.map((item) => item.type === "text" ? `text:${JSON.stringify(item.text)}` : item.type).join(", ")}]`;
}

function traceContextMatch(scope: UixContextScope, stateObj: unknown, request: unknown, rule: EntityNameRule, ruleIndex: number, result: unknown): void {
  if (!contextDebugEnabled(scope)) return;
  const entityId = isRecord(stateObj) && typeof stateObj.entity_id === "string" ? stateObj.entity_id : "unknown entity";
  const requestText = request == null ? "default" : Array.isArray(request) ? formatItems(request as EntityNameItem[]) : String(request);
  const key = `${entityId}|${requestText}|${ruleIndex}`;
  scope.debugMatches ??= new Set();
  if (scope.debugMatches.has(key)) return;
  scope.debugMatches.add(key);
  console.groupCollapsed(`UIX context: entity-name rule matched for ${entityId}`);
  console.log("Request:", requestText);
  console.log("Use:", formatItems(rule.use.items));
  console.log("Result:", result);
  console.log("Scope:", scope);
  console.groupEnd();
}

type EntityNameTransform = {
  name: unknown;
  options: unknown;
  matched?: { scope: UixContextScope; rule: EntityNameRule; ruleIndex: number };
};

function transformEntityName(scopes: UixContextScope[], stateObj: unknown, name: unknown, options: unknown): EntityNameTransform {
  for (let scopeIndex = scopes.length - 1; scopeIndex >= 0; scopeIndex--) {
    for (const [ruleIndex, rule] of effectiveEntityNameRules(scopes[scopeIndex]).entries()) {
      if (!matchesEntityNameRequest(rule.request, name)) continue;
      return {
        name: rule.use.items,
        options: rule.use.options ? { ...(isRecord(options) ? options : {}), ...rule.use.options } : options,
        matched: { scope: scopes[scopeIndex], rule, ruleIndex },
      };
    }
  }
  return { name, options };
}

function formatContextEntityName(base: any, scopes: UixContextScope[], stateObj: unknown, name: unknown, options: unknown): string {
  const transformed = transformEntityName(scopes, stateObj, name, options);
  const result = base.formatEntityName(stateObj, transformed.name, transformed.options);
  if (transformed.matched) {
    traceContextMatch(
      transformed.matched.scope,
      stateObj,
      name,
      transformed.matched.rule,
      transformed.matched.ruleIndex,
      result
    );
  }
  return result;
}

function facadeFor(hass: any, scope: UixContextScope): any {
  if (!hass || typeof hass !== "object" || !scopeHasRules(scope)) return hass;

  const prior = facadeInfo.get(hass);
  if (prior?.scopes.includes(scope)) return hass;

  let cached = facadeCache.get(hass)?.get(scope);
  if (cached) return cached;

  const base = prior?.base ?? hass;
  const scopes = [...(prior?.scopes ?? []), scope];
  const facade = Object.create(hass);
  facade.formatEntityName = (stateObj: unknown, name?: unknown, options?: unknown) => {
    return formatContextEntityName(base, scopes, stateObj, name, options);
  };

  facadeInfo.set(facade, { base, scopes });
  let byScope = facadeCache.get(hass);
  if (!byScope) {
    byScope = new WeakMap<UixContextScope, any>();
    facadeCache.set(hass, byScope);
  }
  byScope.set(scope, facade);
  return facade;
}

function sameScopes(a: UixContextScope[], b: UixContextScope[]): boolean {
  return a.length === b.length && a.every((scope, index) => scope === b[index]);
}

function formattersFor(hass: any, scope: UixContextScope): Record<string, unknown> | undefined {
  if (!hass || typeof hass !== "object") return undefined;

  const prior = facadeInfo.get(hass);
  const base = prior?.base ?? hass;
  const scopes = prior?.scopes.includes(scope)
    ? prior.scopes
    : [...(prior?.scopes ?? []), scope];
  const functions = [
    base.formatEntityState,
    base.formatEntityStateToParts,
    base.formatEntityAttributeValue,
    base.formatEntityAttributeValueToParts,
    base.formatEntityAttributeName,
    base.formatEntityName,
  ];
  const cached = scope.formattersCache;
  if (cached && sameScopes(cached.scopes, scopes) && cached.functions.every((value, index) => value === functions[index])) {
    return cached.value;
  }

  const value = {
    formatEntityState: base.formatEntityState,
    formatEntityStateToParts: base.formatEntityStateToParts,
    formatEntityAttributeValue: base.formatEntityAttributeValue,
    formatEntityAttributeValueToParts: base.formatEntityAttributeValueToParts,
    formatEntityAttributeName: base.formatEntityAttributeName,
    formatEntityName: (stateObj: unknown, name?: unknown, options?: unknown) => {
      return formatContextEntityName(base, scopes, stateObj, name, options);
    },
  };
  scope.formattersCache = { functions, scopes, value };
  return value;
}

function updateFormattersContext(host: HTMLElement, scope: UixContextScope, hass: unknown, force = false): void {
  const value = formattersFor(hass, scope);
  if (!value) return;
  if (!scope.formattersProvider) {
    scope.formattersProvider = new ContextProvider(host as any, {
      context: FORMATTERS_CONTEXT,
      initialValue: value,
    });
    return;
  }
  scope.formattersProvider.setValue(value, force);
}

function findPropertyDescriptor(object: object, property: string): PropertyDescriptor | undefined {
  let prototype: any = object;
  while (prototype) {
    const descriptor = Object.getOwnPropertyDescriptor(prototype, property);
    if (descriptor) return descriptor;
    prototype = Object.getPrototypeOf(prototype);
  }
  return undefined;
}

function hasHassSetter(host: HTMLElement): boolean {
  return !!findPropertyDescriptor(host, "hass")?.set;
}

function installHassFacade(host: HTMLElement, scope: UixContextScope): void {
  if (scope.facadeInstalled || !scopeHasRules(scope)) return;
  const descriptor = findPropertyDescriptor(host, "hass");
  if (!descriptor?.set) {
    contextError("Could not install a scoped hass facade; the provider has no hass setter.", host);
    return;
  }

  // Several HA elements, including hui-entities-card, intentionally expose
  // hass as a setter only and retain its value in _hass. Preserve that shape
  // while supplying a getter for UIX's own context refreshes.
  let currentHass = descriptor.get
    ? descriptor.get.call(host)
    : (host as any)._hass;
  const get = () => currentHass;
  const set = descriptor.set.bind(host);
  Object.defineProperty(host, "hass", {
    configurable: true,
    enumerable: descriptor.enumerable ?? true,
    get,
    set(value) {
      const scopedHass = facadeFor(value, scope);
      currentHass = scopedHass;
      set(scopedHass);
      updateFormattersContext(host, scope, scopedHass);
    },
  });
  scope.facadeInstalled = true;
  (host as any).hass = get();
}

function composedParent(element: Element): Element | null {
  if (element.parentElement) return element.parentElement;
  const parent = element.parentNode;
  if (parent instanceof ShadowRoot) return parent.host;
  return null;
}

function matchesContextAnchor(host: HTMLElement, anchor: unknown): boolean {
  if (anchor === undefined) return true;
  if (typeof anchor !== "string" || !anchor.startsWith("&")) {
    contextError("A context anchor must be an & host/element selector.", anchor);
    return false;
  }

  const selector = anchor.slice(1).trim();
  if (!selector) {
    contextError("A context anchor must include a host/element selector.", anchor);
    return false;
  }

  const visited = new Set<Element>();
  let candidate: Element | null = host;
  while (candidate && !visited.has(candidate)) {
    visited.add(candidate);
    if (matchesHostElementPath(candidate, selector)) return true;
    candidate = composedParent(candidate);
  }
  return false;
}

type SelectedThemeContext = {
  context: CompiledContext;
  anchor?: string;
  bindingIndex: number;
};

function selectThemeContext(host: HTMLElement, value: unknown): SelectedThemeContext | undefined {
  if (!Array.isArray(value)) {
    contextError("Theme context YAML must contain a list of anchor bindings.", value);
    return undefined;
  }
  for (const [bindingIndex, binding] of value.entries()) {
    if (!isRecord(binding)) {
      contextError("Each theme context binding must be a mapping.", binding);
      continue;
    }
    if (!matchesContextAnchor(host, binding.anchor)) continue;
    const context = compileContext(binding);
    if (!context) return undefined;
    return {
      context,
      anchor: typeof binding.anchor === "string" ? binding.anchor : undefined,
      bindingIndex,
    };
  }
  return undefined;
}

function describeContext(context: CompiledContext | undefined): Record<string, unknown> | undefined {
  if (!context) return undefined;
  return {
    debug: context.debug ?? false,
    entity_name: context.hasEntityName
      ? {
          rules: context.entityNameRules.map((rule) => ({
            when: { request: rule.request === "default" ? "default" : formatItems(rule.request) },
            use: formatItems(rule.use.items),
            options: rule.use.options,
          })),
        }
      : undefined,
  };
}

function traceContextScope(host: HTMLElement, scope: UixContextScope, source: "direct" | "theme"): void {
  if (!contextDebugEnabled(scope)) return;
  console.groupCollapsed(`UIX context: ${source} scope applied to <${host.localName}>`);
  if (source === "theme") {
    console.log("Theme binding:", scope.themeBindingIndex);
    console.log("Anchor:", scope.themeAnchor ?? "(none)");
  }
  console.log("Effective entity-name rules:", effectiveEntityNameRules(scope));
  console.log("Scope host:", host);
  console.groupEnd();
}

type ContextScopeEntry = { host: HTMLElement; scope: UixContextScope };

function contextScopeEntries(element: Element): ContextScopeEntry[] {
  const entries: ContextScopeEntry[] = [];
  const visited = new Set<Element>();
  let candidate: Element | null = element;
  while (candidate && !visited.has(candidate)) {
    visited.add(candidate);
    const scope = contextScopes.get(candidate as HTMLElement);
    if (scope) entries.unshift({ host: candidate as HTMLElement, scope });
    candidate = composedParent(candidate);
  }
  return entries;
}

/** Returns the applied context information used by the uix_context() console helper. */
export function inspectUixContext(element: Element) {
  const entries = contextScopeEntries(element);
  return {
    target: element,
    scopes: entries.map(({ host, scope }) => ({
      host,
      direct: describeContext(scope.direct),
      theme: scope.theme
        ? {
            binding: scope.themeBindingIndex,
            anchor: scope.themeAnchor,
            context: describeContext(scope.theme),
          }
        : undefined,
      effective: {
        debug: contextDebugEnabled(scope),
        entity_name: effectiveEntityNameRules(scope).map((rule) => ({
          when: rule.request === "default" ? "default" : formatItems(rule.request),
          use: formatItems(rule.use.items),
        })),
      },
      delivery: {
        hass: scope.facadeInstalled ?? false,
        hassFormatters: !!scope.formattersProvider,
      },
    })),
    format(entityOrState: string | Record<string, unknown>, name?: unknown, options?: unknown) {
      const nearest = entries[entries.length - 1];
      const hass = nearest ? (nearest.host as any).hass : undefined;
      const baseHass = (hass && facadeInfo.get(hass)?.base) ?? hass;
      const stateObj = typeof entityOrState === "string"
        ? hass?.states?.[entityOrState]
        : entityOrState;
      const transformed = transformEntityName(entries.map(({ scope }) => scope), stateObj, name, options);
      return {
        entity: typeof entityOrState === "string" ? entityOrState : (stateObj as any)?.entity_id,
        request: name ?? "default",
        result: transformed.name ?? "default",
        matched: transformed.matched
          ? {
              rule: transformed.matched.ruleIndex + 1,
              use: formatItems(transformed.matched.rule.use.items),
            }
          : undefined,
        formatted: stateObj && baseHass?.formatEntityName
          ? baseHass.formatEntityName(stateObj, transformed.name, transformed.options)
          : undefined,
      };
    },
  };
}

// Kept on window so console_debug remains independently loadable for its
// browser-level helper tests and for troubleshooting partial UIX loads.
(window as any).uix_context_inspect = inspectUixContext;

/** Apply direct element config synchronously, before its UIX node is attached. */
export function applyDirectContext(host: HTMLElement, value: unknown): void {
  const existing = contextScopes.get(host);
  // Several compatibility patches can apply UIX to the same host. An
  // application without a uix config must not erase a direct context that an
  // earlier, config-owning application established.
  if (value === undefined) return;
  const scope = existing ?? getScope(host);
  scope.direct = compileContext(value);
  scope.debugMatches?.clear();
  installHassFacade(host, scope);
  if (scope.facadeInstalled) updateFormattersContext(host, scope, (host as any).hass, true);
  traceContextScope(host, scope, "direct");
}

/**
 * Resolve theme context bindings after the UIX node has an element context.
 * The anchor match itself is synchronous and runs once per binding refresh.
 */
export async function applyThemeContext(host: HTMLElement, uix: Uix): Promise<void> {
  const selected = selectThemeContext(host, await get_theme_context(uix));
  const existing = contextScopes.get(host);
  if (!selected) {
    if (existing) {
      existing.theme = undefined;
      existing.themeAnchor = undefined;
      existing.themeBindingIndex = undefined;
      existing.debugMatches?.clear();
      updateFormattersContext(host, existing, (host as any).hass, true);
    }
    return;
  }
  // A theme binding can match structural descendants of its intended UIX
  // boundary. They inherit the boundary's scoped hass, but cannot publish a
  // scope of their own when they do not accept hass.
  if (!existing && !hasHassSetter(host)) return;
  const scope = existing ?? getScope(host);
  scope.theme = selected.context;
  scope.themeAnchor = selected.anchor;
  scope.themeBindingIndex = selected.bindingIndex;
  scope.debugMatches?.clear();
  installHassFacade(host, scope);
  if (scope.facadeInstalled) updateFormattersContext(host, scope, (host as any).hass, true);
  traceContextScope(host, scope, "theme");
}
