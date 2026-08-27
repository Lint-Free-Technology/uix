import { tinykeys } from "tinykeys";
import { BrowserID } from "../helpers/browser_id";
import { hass } from "../helpers/hass";
import { matchesHostElementPath, selectTree } from "../helpers/selecttree";
import {
  UixBrokerAnchor,
  UixBrokerConfig,
  UixBrokerDirective,
  UixBrokerHostElementRule,
  UixBrokerInteraction,
  UixBrokerRule,
  UixBrokerTypedRule,
} from "./uix-broker-types";

type BrokerContext = {
  source: Event | Record<string, any>;
  captured: Record<string, any>;
  realm: "browser" | "shortcut" | "server";
};

export type UixBrokerAnchorHistoryEntry = {
  anchor: Element;
  realm: "browser" | "shortcut" | "server";
  listen: string;
  anchorConfig: UixBrokerAnchor;
  resolvedAt: number;
};

const UNSAFE_PROPERTY_KEYS = new Set(["__proto__", "constructor", "prototype"]);
const BROKER_SELECT_TREE_TIMEOUT_MS = 2_000;
const BROKER_SELECT_TREE_RETRY_MS = 50;

function isElement(value: unknown): value is Element {
  return value instanceof Element;
}

function asInteractions(config: UixBrokerConfig | UixBrokerInteraction[]): UixBrokerInteraction[] {
  const interactions = Array.isArray(config) ? config : config?.uix_broker;
  return Array.isArray(interactions) ? interactions : [];
}

function isEnabled(interaction: UixBrokerInteraction): boolean {
  return interaction.enabled !== false;
}

function selectTreeAnchorPath(anchor: UixBrokerAnchor): string | null {
  if (typeof anchor === "string" && anchor.startsWith("&")) return anchor.slice(1).trim() || null;
  return typeof anchor === "object" ? anchor.select_tree : null;
}

function parseOverrideAnchor(
  anchor: unknown,
  description: string,
): { path: string; absolute: boolean } {
  if (typeof anchor === "string") {
    const path = anchor.trim();
    if (!path) throw new Error(`${description} must be a non-empty select_tree path`);
    if (!path.startsWith("&")) return { path, absolute: false };
    const absolutePath = path.slice(1).trim();
    if (!absolutePath) throw new Error(`${description} absolute anchor must include a select_tree path`);
    return { path: absolutePath, absolute: true };
  }
  if (anchor && typeof anchor === "object" && typeof (anchor as { select_tree?: unknown }).select_tree === "string") {
    const path = (anchor as { select_tree: string }).select_tree.trim();
    if (!path) throw new Error(`${description} select_tree must be a non-empty path`);
    return { path, absolute: true };
  }
  throw new Error(`${description} must be a select_tree path string or { select_tree: path }`);
}

type ComposedPathOperator = "target" | "<" | "<$" | "<$$";

function parseComposedPathAnchor(anchor: string): { selector?: string; operator: ComposedPathOperator } | null {
  const value = anchor.trim();
  if (value === "target") return { operator: "target" };
  const match = /^(?:(.+?)\s+)?(<\$\$|<\$|<)(?:\s+target)?$/.exec(value);
  if (!match) return null;
  if (match[2] === "<$$" && !match[1]?.trim()) return null;
  return { selector: match[1]?.trim() || undefined, operator: match[2] as ComposedPathOperator };
}

function findLightDomMatch(root: Element, selector: string): Element | null {
  const path = selector.replace(/^&/, "");
  return Array.from(root.querySelectorAll("*")).find((element) => matchesHostElementPath(element, path)) ?? null;
}

function isHostElementRule(rule: UixBrokerRule): rule is string | UixBrokerHostElementRule {
  return typeof rule === "string" || (
    typeof rule === "object"
    && rule !== null
    && !("type" in rule)
    && typeof rule.match === "string"
  );
}

function getCapturedPathValue(value: unknown, path: string): { exists: boolean; value: unknown } {
  let current = value;
  for (const key of path.split(".")) {
    if (current == null || UNSAFE_PROPERTY_KEYS.has(key)) return { exists: false, value: undefined };
    const target = Object(current) as Record<string, unknown>;
    if (!Object.prototype.hasOwnProperty.call(target, key)) return { exists: false, value: undefined };
    current = target[key];
  }
  return { exists: true, value: current };
}

function getPathValue(value: unknown, path: string): unknown {
  return getCapturedPathValue(value, path).value;
}

function resolveCaptured(value: any, captured: Record<string, any>): any {
  if (typeof value === "string" && (value === "@captured" || value.startsWith("@captured."))) {
    return value === "@captured" ? captured : getPathValue(captured, value.slice("@captured.".length));
  }
  if (Array.isArray(value)) return value.map((item) => resolveCaptured(item, captured));
  if (value && typeof value === "object") {
    return Object.entries(value).reduce<Record<string, any>>((result, [key, item]) => {
      if (UNSAFE_PROPERTY_KEYS.has(key)) return result;
      result[key] = resolveCaptured(item, captured);
      return result;
    }, {});
  }
  return value;
}

/**
 * Captured-rule paths are relative to the captured object. Keep accepting the
 * former @captured prefix so existing configurations continue to work.
 */
function capturedRulePath(path: string): string {
  return path.replace(/^@captured(?:\.)?/, "");
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function escapedWildcardPattern(value: string): string {
  return value
    .split("*")
    .map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    .join(".*");
}

/**
 * Match a captured value with wildcard and regular-expression strings, numeric
 * comparison expressions, explicit operators, and boolean composition.
 */
export function matchesCapturedValue(actual: unknown, matcher: any, ignoreCase = false, exists = true): boolean {
  if (Array.isArray(matcher)) {
    return matcher.every((item) => matchesCapturedValue(actual, item, ignoreCase, exists));
  }

  if (matcher && typeof matcher === "object") {
    if (matcher.exists !== undefined && (typeof matcher.exists !== "boolean" || matcher.exists !== exists)) {
      return false;
    }
    if (matcher.and !== undefined) {
      const items = Array.isArray(matcher.and) ? matcher.and : [matcher.and];
      return items.every((item) => matchesCapturedValue(actual, item, ignoreCase, exists));
    }
    if (matcher.or !== undefined) {
      const items = Array.isArray(matcher.or) ? matcher.or : [matcher.or];
      return items.some((item) => matchesCapturedValue(actual, item, ignoreCase, exists));
    }
    if (matcher.not !== undefined) return !matchesCapturedValue(actual, matcher.not, ignoreCase, exists);

    const expected = matcher.value ?? matcher.match;
    const caseInsensitive = matcher.ignore_case ?? ignoreCase;
    if (matcher.operator !== undefined) {
      return matchesCapturedOperator(actual, expected, matcher.operator, caseInsensitive, exists);
    }
    if (Object.prototype.hasOwnProperty.call(matcher, "value") || Object.prototype.hasOwnProperty.call(matcher, "match")) {
      return matchesCapturedValue(actual, expected, caseInsensitive, exists);
    }
    if (matcher.exists !== undefined) return true;
  }

  if (matcher === null || matcher === undefined) return actual === matcher;

  let expected = String(matcher);
  let received: string;
  if (expected.startsWith("$$")) {
    expected = expected.slice(2);
    try {
      received = JSON.stringify(actual) ?? "";
    } catch {
      received = "";
    }
  } else {
    received = String(actual ?? "");
  }
  if (ignoreCase) {
    expected = expected.toLocaleLowerCase();
    received = received.toLocaleLowerCase();
  }

  const numeric = expected.match(/^\s*(<=|>=|!=|==|=|<|>)\s*(.+?)\s*$/);
  if (numeric) return matchesCapturedOperator(actual, numeric[2], numeric[1], ignoreCase, exists);

  const regex = expected.match(/^\/(.*)\/([a-z]*)$/i);
  if (regex) {
    try {
      return new RegExp(regex[1], regex[2].replace(/[gy]/g, "")).test(received);
    } catch {
      return false;
    }
  }
  if (expected.includes("*")) return new RegExp(`^${escapedWildcardPattern(expected)}$`).test(received);
  return received === expected;
}

function matchesCapturedOperator(
  actual: unknown,
  expected: unknown,
  operator: string,
  ignoreCase: boolean,
  exists = true,
): boolean {
  const normalized = operator === "=" ? "==" : operator.toLocaleLowerCase();
  if (normalized === "is_undefined") return exists && actual === undefined;
  if ([">", "<", ">=", "<="].includes(normalized)) {
    const left = Number(actual);
    const right = Number(expected);
    if (!Number.isFinite(left) || !Number.isFinite(right)) return false;
    if (normalized === ">") return left > right;
    if (normalized === "<") return left < right;
    if (normalized === ">=") return left >= right;
    return left <= right;
  }

  if (normalized === "==" || normalized === "!=") {
    const left = Number(actual);
    const right = Number(expected);
    const equal = isFiniteNumber(left) && isFiniteNumber(right)
      ? left === right
      : matchesCapturedValue(actual, expected, ignoreCase, exists);
    return normalized === "==" ? equal : !equal;
  }
  const received = String(actual ?? "");
  const wanted = String(expected ?? "");
  const left = ignoreCase ? received.toLocaleLowerCase() : received;
  const right = ignoreCase ? wanted.toLocaleLowerCase() : wanted;
  if (normalized === "contains") return left.includes(right);
  if (normalized === "starts_with") return left.startsWith(right);
  if (normalized === "ends_with") return left.endsWith(right);
  return false;
}

/**
 * Synchronous tree selection used only by `block`. It deliberately never waits
 * for a custom element to render: browser propagation cannot wait for it.
 */
function selectTreeSync(root: ParentNode, path: string): Element | null {
  const tokens = path.trim().split(/\s*(\$\$|\$)\s*|\s+/).filter(Boolean);
  let current: Array<Element | ShadowRoot> = [root as Element];
  let deepSearch = false;

  const deepQuery = (roots: Array<Element | ShadowRoot>, selector: string) => {
    const matches: Element[] = [];
    const visited = new Set<Node>();
    const visit = (node: Element | ShadowRoot) => {
      if (visited.has(node)) return;
      visited.add(node);
      if (node instanceof Element && node.matches(selector)) matches.push(node);
      for (const child of Array.from(node.querySelectorAll(selector))) matches.push(child);
      for (const child of Array.from(node.querySelectorAll("*"))) {
        if (child.shadowRoot) visit(child.shadowRoot);
      }
    };
    roots.forEach(visit);
    return matches;
  };

  for (const token of tokens) {
    if (token === "$") {
      current = current
        .map((node) => node instanceof Element ? node.shadowRoot : null)
        .filter((node): node is ShadowRoot => node !== null);
      continue;
    }
    if (token === "$$") {
      deepSearch = true;
      continue;
    }
    if (deepSearch) {
      current = deepQuery(current, token);
      deepSearch = false;
    } else {
      const parent = current[0];
      current = parent ? Array.from(parent.querySelectorAll(token)) : [];
    }
    if (!current.length) return null;
  }
  const first = current[0];
  return first instanceof ShadowRoot ? first.host : first ?? null;
}

export class UixBroker {
  private interactions: UixBrokerInteraction[] = [];
  private browserListeners = new Map<string, EventListener>();
  private shortcutUnsubscribers: Array<() => void> = [];
  private serverUnsubscribers: Array<() => void> = [];
  private configurationVersion = 0;
  private anchorHistory: UixBrokerAnchorHistoryEntry[] = [];
  private activeInteractions = new Set<UixBrokerInteraction>();

  configure(config: UixBrokerConfig | UixBrokerInteraction[]) {
    this.interactions = asInteractions(config);
    this.configurationVersion += 1;
    this.interactions.filter(isEnabled).forEach((interaction) => {
      this.debug(interaction, "listen", {
        configured: true,
        anchor: interaction.anchor,
      });
    });
    this.rebuildBrowserListeners();
    this.rebuildShortcutListeners();
    void this.rebuildServerListeners(this.configurationVersion);
  }

  get config(): UixBrokerInteraction[] {
    return [...this.interactions];
  }

  get recentAnchors(): UixBrokerAnchorHistoryEntry[] {
    return [...this.anchorHistory];
  }

  private rebuildBrowserListeners() {
    this.browserListeners.forEach((listener, name) => window.removeEventListener(name, listener, true));
    this.browserListeners.clear();

    const eventNames = new Set(
      this.interactions.filter((interaction) => isEnabled(interaction) && interaction.realm === "browser").map((interaction) => interaction.listen),
    );
    eventNames.forEach((name) => {
      const listener: EventListener = (event) => this.handleBrowserEvent(name, event);
      window.addEventListener(name, listener, true);
      this.browserListeners.set(name, listener);
    });
  }

  private rebuildShortcutListeners() {
    this.shortcutUnsubscribers.splice(0).forEach((unsubscribe) => unsubscribe());

    const bindings = [...new Set(
      this.interactions
        .filter((interaction) => isEnabled(interaction) && interaction.realm === "shortcut")
        .map((interaction) => interaction.listen),
    )];
    if (!bindings.length) return;

    const keybindings = bindings.reduce<Record<string, (event: KeyboardEvent) => void>>((result, binding) => {
      result[binding] = (event) => this.handleShortcutEvent(binding, event);
      return result;
    }, {});
    this.shortcutUnsubscribers.push(tinykeys(window, keybindings));
  }

  private async rebuildServerListeners(version: number) {
    this.serverUnsubscribers.splice(0).forEach((unsubscribe) => unsubscribe());
    const eventNames = [...new Set(
      this.interactions.filter((interaction) => isEnabled(interaction) && interaction.realm === "server").map((interaction) => interaction.listen),
    )];
    if (!eventNames.length) return;

    try {
      const connection = (await hass()).connection;
      if (version !== this.configurationVersion) return;
      for (const name of eventNames) {
        const unsubscribe = await connection.subscribeEvents((event) => {
          void this.handleServerEvent(name, event);
        }, name);
        if (version !== this.configurationVersion) {
          unsubscribe();
          return;
        }
        this.serverUnsubscribers.push(unsubscribe);
      }
    } catch (error) {
      console.error("UIX Broker: unable to subscribe to Home Assistant events:", error);
    }
  }

  private handleBrowserEvent(name: string, event: Event) {
    this.handleClientEvent("browser", name, event);
  }

  private handleShortcutEvent(name: string, event: KeyboardEvent) {
    this.handleClientEvent("shortcut", name, event);
  }

  private handleClientEvent(realm: "browser" | "shortcut", name: string, event: Event) {
    const interactions = this.interactions.filter(
      (interaction) => isEnabled(interaction) && interaction.realm === realm && interaction.listen === name,
    );
    for (const interaction of interactions) {
      if (interaction.reentrant === false && this.activeInteractions.has(interaction)) {
        this.debug(interaction, "interaction skipped", { reason: "already running" });
        continue;
      }
      this.debug(interaction, "listen", { event });
      const context: BrokerContext = {
        source: event,
        captured: this.eventData(event),
        realm,
      };
      if (!this.preAnchorRulesMatch(interaction, context)) continue;
      if (interaction.reentrant === false) this.activeInteractions.add(interaction);
      // Blocking must be determined in this call stack; later directives may await.
      let blockAnchor: Element | null = null;
      if (interaction.directives?.some((directive) => directive.type === "block")) {
        blockAnchor = this.runSynchronousBlock(interaction, context);
        if (!blockAnchor) {
          this.activeInteractions.delete(interaction);
          continue;
        }
      }
      const run = this.runInteraction(interaction, context, Boolean(blockAnchor), blockAnchor ?? undefined, true);
      if (interaction.reentrant === false) {
        void run.then(
          () => this.activeInteractions.delete(interaction),
          () => this.activeInteractions.delete(interaction),
        );
      }
    }
  }

  private async handleServerEvent(name: string, event: Record<string, any>) {
    const interactions = this.interactions.filter(
      (interaction) => isEnabled(interaction) && interaction.realm === "server" && interaction.listen === name,
    );
    for (const interaction of interactions) {
      if (interaction.reentrant === false && this.activeInteractions.has(interaction)) {
        this.debug(interaction, "interaction skipped", { reason: "already running" });
        continue;
      }
      this.debug(interaction, "listen", { event });
      if (interaction.reentrant === false) this.activeInteractions.add(interaction);
      try {
        await this.runInteraction(interaction, {
          source: event,
          captured: { data: { ...(event.data ?? {}) } },
          realm: "server",
        });
      } finally {
        this.activeInteractions.delete(interaction);
      }
    }
  }

  private eventData(event: Event): Record<string, any> {
    const detail = (event as CustomEvent).detail;
    return detail && typeof detail === "object" ? { ...detail } : {};
  }

  private runSynchronousBlock(interaction: UixBrokerInteraction, context: BrokerContext): Element | null {
    const anchor = this.resolveAnchorSync(interaction.anchor, context);
    if (anchor) this.rememberAnchor(interaction, anchor);
    this.debug(interaction, "anchor resolution", { anchor: interaction.anchor, resolved: anchor });
    if (!anchor || !this.anchorRulesMatchSync(interaction, anchor, context)) return null;
    const browserEvent = context.source as Event;
    this.debug(interaction, "directive application", { directive: { type: "block" }, synchronous: true });
    browserEvent.preventDefault();
    browserEvent.stopImmediatePropagation();
    this.debug(interaction, "directive applied", { directive: { type: "block" }, synchronous: true });
    return anchor;
  }

  private async runInteraction(
    interaction: UixBrokerInteraction,
    context: BrokerContext,
    blockHandled = false,
    prevalidatedAnchor?: Element,
    preAnchorRulesValidated = false,
  ) {
    try {
      if (!preAnchorRulesValidated && !this.preAnchorRulesMatch(interaction, context)) return;
      const anchor = prevalidatedAnchor ?? await this.resolveAnchor(interaction.anchor, context);
      if (anchor) this.rememberAnchor(interaction, anchor);
      if (!prevalidatedAnchor) {
        this.debug(interaction, "anchor resolution", { anchor: interaction.anchor, resolved: anchor });
        if (!anchor || !await this.anchorRulesMatch(interaction, anchor, context)) return;
      }
      for (const [index, directive] of (interaction.directives ?? []).entries()) {
        if (directive.type === "block") {
          if (!blockHandled) {
            this.debug(interaction, "directive application", { index, directive });
            this.executeBlock(context);
            this.debug(interaction, "directive applied", { index, directive });
          }
          await this.waitAfterDirective(interaction, directive, index);
          continue;
        }
        const directiveAnchor = await this.resolveDirectiveAnchor(directive, anchor);
        if (!directiveAnchor) {
          this.debug(interaction, "directive anchor resolution", {
            index,
            anchor: directive.anchor,
            resolved: null,
          });
          continue;
        }
        if (directive.anchor !== undefined) {
          this.debug(interaction, "directive anchor resolution", {
            index,
            anchor: directive.anchor,
            resolved: directiveAnchor,
          });
        }
        this.debug(interaction, "directive application", { index, directive, anchor: directiveAnchor });
        await this.executeDirective(directive, directiveAnchor, context);
        this.debug(interaction, "directive applied", { index, directive, anchor: directiveAnchor });
        await this.waitAfterDirective(interaction, directive, index);
      }
    } catch (error) {
      console.error("UIX Broker: interaction failed:", error, interaction);
    }
  }

  private resolveAnchorSync(anchorConfig: UixBrokerAnchor, context: BrokerContext): Element | null {
    const selectPath = selectTreeAnchorPath(anchorConfig);
    if (selectPath) return selectTreeSync(document, selectPath);
    if (context.realm === "server") {
      return null;
    }
    const event = context.source as Event;
    const path = event.composedPath();
    const parsed = typeof anchorConfig === "string" ? parseComposedPathAnchor(anchorConfig) : null;
    if (!parsed) {
      console.warn(`UIX Broker: unknown client-event anchor "${anchorConfig}".`);
      return null;
    }
    const targetIndex = path.findIndex(isElement);
    const target = path[targetIndex] as Element | undefined;
    if (!target) return null;
    if (parsed.operator === "target") return target;
    const ancestors = path.slice(targetIndex + 1);
    if (parsed.operator === "<$$") {
      const elements = ancestors.filter(isElement);
      return elements.find((element) => matchesHostElementPath(element, parsed.selector!.replace(/^&/, ""))) ?? null;
    }
    let base: Element | null;
    if (parsed.operator === "<") {
      base = ancestors.find(isElement) ?? null;
    } else {
      const boundaryIndex = path.findIndex((node, index) => index > targetIndex && node instanceof ShadowRoot);
      base = boundaryIndex === -1 ? null : path.slice(boundaryIndex + 1).find(isElement) ?? null;
    }
    if (!base || !parsed.selector) return base;
    return findLightDomMatch(base, parsed.selector);
  }

  private async resolveAnchor(anchorConfig: UixBrokerAnchor, context: BrokerContext): Promise<Element | null> {
    const selectPath = selectTreeAnchorPath(anchorConfig);
    if (selectPath) return this.waitForSelectTreeAnchor(selectPath);
    if (context.realm === "server") return null;
    return this.resolveAnchorSync(anchorConfig, context);
  }

  private rememberAnchor(interaction: UixBrokerInteraction, anchor: Element) {
    this.anchorHistory = [
      {
        anchor,
        realm: interaction.realm,
        listen: interaction.listen,
        anchorConfig: interaction.anchor,
        resolvedAt: Date.now(),
      },
      ...this.anchorHistory.filter((entry) => entry.anchor !== anchor),
    ].slice(0, 50);
  }

  private async resolveDirectiveAnchor(
    directive: UixBrokerDirective,
    interactionAnchor: Element,
  ): Promise<Element | null> {
    if (directive.type !== "property" && directive.type !== "event" && directive.type !== "call") return interactionAnchor;
    if (directive.anchor === undefined) return interactionAnchor;
    const { path, absolute } = parseOverrideAnchor(directive.anchor, `${directive.type} directive anchor`);
    return absolute ? this.waitForSelectTreeAnchor(path) : this.waitForSelectTreeAnchor(path, interactionAnchor);
  }

  private async resolveRuleAnchor(
    rule: string | UixBrokerHostElementRule,
    interactionAnchor: Element,
  ): Promise<Element | null> {
    if (typeof rule === "string" || rule.anchor === undefined) return interactionAnchor;
    const { path, absolute } = parseOverrideAnchor(rule.anchor, "host-element rule anchor");
    return absolute ? this.waitForSelectTreeAnchor(path) : this.waitForSelectTreeAnchor(path, interactionAnchor);
  }

  private resolveRuleAnchorSync(
    rule: string | UixBrokerHostElementRule,
    interactionAnchor: Element,
  ): Element | null {
    if (typeof rule === "string" || rule.anchor === undefined) return interactionAnchor;
    const { path, absolute } = parseOverrideAnchor(rule.anchor, "host-element rule anchor");
    return selectTreeSync(absolute ? document : interactionAnchor, path);
  }

  private async waitForSelectTreeAnchor(path: string, root: ParentNode = document): Promise<Element | null> {
    const deadline = Date.now() + BROKER_SELECT_TREE_TIMEOUT_MS;
    do {
      const remaining = deadline - Date.now();
      const anchor = await selectTree(root, path, false, Math.max(1, remaining));
      if (anchor) return anchor;
      if (remaining <= 0) return null;
      await new Promise((resolve) => window.setTimeout(resolve, Math.min(BROKER_SELECT_TREE_RETRY_MS, remaining)));
    } while (Date.now() < deadline);
    return null;
  }

  private preAnchorRulesMatch(interaction: UixBrokerInteraction, context: BrokerContext): boolean {
    return this.rulesMatch(
      interaction,
      (interaction.rules ?? []).filter((rule) => !isHostElementRule(rule)),
      undefined,
      context,
      "pre-anchor",
    );
  }

  private async anchorRulesMatch(interaction: UixBrokerInteraction, anchor: Element, context: BrokerContext): Promise<boolean> {
    const rules = (interaction.rules ?? []).filter(isHostElementRule);
    if (!rules.length) {
      this.debug(interaction, "rule validation", { phase: "anchor", result: true, reason: "no rules" });
      return true;
    }
    for (const [index, rule] of rules.entries()) {
      const ruleAnchor = await this.resolveRuleAnchor(rule, anchor);
      if (typeof rule !== "string" && rule.anchor !== undefined) {
        this.debug(interaction, "rule anchor resolution", { index, anchor: rule.anchor, resolved: ruleAnchor });
      }
      const match = typeof rule === "string" ? rule : rule.match;
      const result = ruleAnchor ? matchesHostElementPath(ruleAnchor, match.replace(/^&/, "")) : false;
      this.debug(interaction, "rule validation", { phase: "anchor", index, rule, result });
      if (!result) return false;
    }
    return true;
  }

  private anchorRulesMatchSync(interaction: UixBrokerInteraction, anchor: Element, context: BrokerContext): boolean {
    const rules = (interaction.rules ?? []).filter(isHostElementRule);
    if (!rules.length) {
      this.debug(interaction, "rule validation", { phase: "anchor", result: true, reason: "no rules" });
      return true;
    }
    for (const [index, rule] of rules.entries()) {
      const ruleAnchor = this.resolveRuleAnchorSync(rule, anchor);
      if (typeof rule !== "string" && rule.anchor !== undefined) {
        this.debug(interaction, "rule anchor resolution", { index, anchor: rule.anchor, resolved: ruleAnchor, synchronous: true });
      }
      const match = typeof rule === "string" ? rule : rule.match;
      const result = ruleAnchor ? matchesHostElementPath(ruleAnchor, match.replace(/^&/, "")) : false;
      this.debug(interaction, "rule validation", { phase: "anchor", index, rule, result, synchronous: true });
      if (!result) return false;
    }
    return true;
  }

  private rulesMatch(
    interaction: UixBrokerInteraction,
    rules: UixBrokerRule[],
    anchor: Element | undefined,
    context: BrokerContext,
    phase: "pre-anchor" | "anchor",
  ): boolean {
    if (!rules.length) {
      this.debug(interaction, "rule validation", { phase, result: true, reason: "no rules" });
      return true;
    }
    for (const [index, rule] of rules.entries()) {
      let result: boolean;
      if (typeof rule === "string") {
        result = anchor ? matchesHostElementPath(anchor, rule.replace(/^&/, "")) : false;
      } else if ("match" in rule && !("type" in rule)) {
        result = anchor ? matchesHostElementPath(anchor, rule.match.replace(/^&/, "")) : false;
      } else {
        const typedRule = rule as UixBrokerTypedRule;
        if (typedRule.type === "browserid") {
          const expected = typedRule.browser_id ?? typedRule.id ?? typedRule.value;
          result = expected === undefined || expected === BrowserID();
        } else if (typedRule.type === "captured") {
          const path = typedRule.path ?? typedRule.property;
          if (typeof path !== "string") {
            console.warn("UIX Broker: captured rule requires path.");
            result = false;
          } else {
            const capturedValue = getCapturedPathValue(context.captured, capturedRulePath(path));
            result = matchesCapturedValue(
              capturedValue.value,
              typedRule.match ?? typedRule.value,
              false,
              capturedValue.exists,
            );
          }
        } else {
          const capturedMatchers = Object.entries(typedRule).filter(
            ([key]) => key === "@captured" || key.startsWith("@captured."),
          );
          if (capturedMatchers.length) {
            result = capturedMatchers.every(([path, matcher]) => {
              const capturedValue = getCapturedPathValue(context.captured, capturedRulePath(path));
              return matchesCapturedValue(capturedValue.value, matcher, false, capturedValue.exists);
            });
          } else {
            console.warn(`UIX Broker: unknown rule type "${typedRule.type}".`);
            result = false;
          }
        }
      }
      this.debug(interaction, "rule validation", { phase, index, rule, result });
      if (!result) return false;
    }
    return true;
  }

  private debug(interaction: UixBrokerInteraction, stage: string, detail?: Record<string, unknown>) {
    if (!interaction.debug) return;
    const prefix = `UIX Broker [${interaction.realm}:${interaction.listen}] ${stage}`;
    if (detail) console.debug(prefix, detail);
    else console.debug(prefix);
  }

  private executeBlock(context: BrokerContext) {
    if (context.realm === "server") return;
    const event = context.source as Event;
    event.preventDefault();
    event.stopImmediatePropagation();
  }

  private async executeDirective(directive: UixBrokerDirective, anchor: Element, context: BrokerContext) {
    if (directive.type === "property") {
      this.executeProperty(directive, anchor, context.captured);
    } else if (directive.type === "event") {
      this.executeEvent(directive, anchor, context);
    } else if (directive.type === "call") {
      await this.executeCall(directive, anchor, context.captured);
    } else if (directive.type === "action") {
      await this.executeAction(directive, anchor, context);
    } else {
      console.warn(`UIX Broker: unknown directive type "${directive.type}".`);
    }
  }

  private async waitAfterDirective(interaction: UixBrokerInteraction, directive: UixBrokerDirective, index: number) {
    if (directive.wait === undefined) return;
    if (typeof directive.wait !== "number" || !Number.isFinite(directive.wait) || directive.wait < 0) {
      throw new Error("directive wait must be a non-negative number of milliseconds");
    }
    if (directive.wait === 0) return;
    this.debug(interaction, "directive wait", { index, milliseconds: directive.wait });
    await new Promise((resolve) => window.setTimeout(resolve, directive.wait));
  }

  private executeProperty(directive: UixBrokerDirective, anchor: Element, captured: Record<string, any>) {
    const path = directive.set ?? directive.clear;
    if (typeof path !== "string" || !path) throw new Error("property directive requires set or clear");
    const keys = path.split(".");
    if (keys.some((key) => UNSAFE_PROPERTY_KEYS.has(key))) throw new Error("unsafe property path");
    const last = keys.pop()!;
    let target: Record<string, any> = anchor as any;
    for (const key of keys) target = target[key] ?? (target[key] = {});
    if (directive.clear) delete target[last];
    else target[last] = resolveCaptured(directive.value, captured);
  }

  private executeEvent(directive: UixBrokerDirective, anchor: Element, context: BrokerContext) {
    if (typeof directive.name !== "string" || !directive.name) throw new Error("event directive requires name");
    const data = resolveCaptured(directive.data ?? {}, context.captured);
    const detail = directive.capture_data
      ? { ...context.captured, ...(data && typeof data === "object" && !Array.isArray(data) ? data : {}) }
      : data;
    const event = new CustomEvent(directive.name, {
      bubbles: directive.bubbles ?? false,
      composed: directive.composed ?? false,
      detail,
    });
    anchor.dispatchEvent(event);
  }

  private async executeCall(directive: UixBrokerDirective, anchor: Element, captured: Record<string, any>) {
    if (typeof directive.method !== "string" || !directive.method.trim()) {
      throw new Error("call directive requires method");
    }
    const keys = directive.method.trim().split(".");
    if (keys.some((key) => !key || UNSAFE_PROPERTY_KEYS.has(key))) {
      throw new Error("unsafe call method path");
    }
    const args = resolveCaptured(directive.args ?? [], captured);
    if (!Array.isArray(args)) throw new Error("call directive args must be an array");
    const methodName = keys.pop()!;
    let target: Record<string, any> | null = anchor as any;
    for (const key of keys) {
      target = target?.[key] ?? null;
      if (target === null) throw new Error(`call directive method path not found: ${directive.method}`);
    }
    const method = target?.[methodName];
    if (typeof method !== "function") throw new Error(`call directive method not found: ${directive.method}`);
    await method.apply(target, args);
  }

  private async executeAction(directive: UixBrokerDirective, anchor: Element, context: BrokerContext) {
    const action = directive.action;
    if (action === "fire-dom-event") {
      anchor.dispatchEvent(new CustomEvent("ll-custom", {
        bubbles: true,
        composed: true,
        detail: { uix: resolveCaptured(directive.uix ?? {}, context.captured) },
      }));
      return;
    }
    if (action === "javascript") {
      if (typeof directive.data?.code !== "string") throw new Error("javascript action requires data.code");
      const fn = new Function("hass", "anchor", "event", "captured", `"use strict";\n${directive.data.code}`);
      await fn(await hass(), anchor, context.source, context.captured);
      return;
    }

    const { wait: _wait, anchor: _anchor, ...actionDirective } = directive;
    const config = resolveCaptured(actionDirective, context.captured);
    const service = action === "perform-action" ? config.perform_action : action;
    if (typeof service === "string" && service.includes(".")) {
      const [domain, name] = service.split(".", 2);
      await (await hass()).callService(domain, name, config.data ?? {}, config.target);
      return;
    }
    anchor.dispatchEvent(new CustomEvent("hass-action", {
      bubbles: true,
      composed: true,
      detail: { config, action: "tap" },
    }));
  }
}

window.addEventListener("uix-bootstrap", (event: Event) => {
  event.stopPropagation();
  const broker = new UixBroker();
  (window as any).uixBroker = broker;
  window.addEventListener("uix-broker-updated", (update: Event) => {
    broker.configure((update as CustomEvent).detail?.uix_broker ?? []);
  });
  const configured = (window as any).uixCoordinator?.broker;
  if (configured) broker.configure(configured);
});
