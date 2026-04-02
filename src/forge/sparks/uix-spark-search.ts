import { PropertyValues } from "lit";
import { UixForgeSparkBase } from "./uix-spark-base";

interface SearchAction {
  add_class?: string[];
  remove_class?: string[];
  add_attribute?: Array<{ attribute: string; value: string }>;
  remove_attribute?: string[];
  replace_text?: string | { find: string; replace: string };
  prepend_text?: string;
  append_text?: string;
}

interface AppliedElementChange {
  element: HTMLElement;
  addedClasses: string[];
  removedClasses: string[];
  addedAttributes: Array<{ attribute: string; previousValue: string | null }>;
  removedAttributes: Array<{ attribute: string; previousValue: string | null }>;
  textNodeChanges: Array<{ node: Text; originalText: string }>;
}

/**
 * Search spark — finds elements within a shadow-DOM path, optionally filters
 * them by a text regex, and applies class / attribute / text mutations.
 *
 * Config keys:
 *   for           – selectTree path (supports `$` shadow-root crossings) to
 *                   the container element to search within.
 *   query         – CSS selector passed to querySelectorAll on the container.
 *   text          – regex string; only elements whose text content (including
 *                   child elements) matches are processed (optional).
 *   actions       – object describing what to do with matching elements:
 *     add_class       – string[] of classes to add
 *     remove_class    – string[] of classes to remove
 *     add_attribute   – Array<{attribute, value}> to set
 *     remove_attribute– string[] of attribute names to remove
 *     replace_text    – regex string (removes matches) or {find, replace}
 *     prepend_text    – text to prepend to each text node
 *     append_text     – text to append to each text node
 */
export class UixForgeSparkSearch extends UixForgeSparkBase {
  type = "search";

  private _for: string = "element";
  private _query: string = "";
  private _text: string = "";
  private _actions: SearchAction = {};
  private _cancel: (() => void)[] = [];
  private _appliedChanges: AppliedElementChange[] = [];
  private _observer: MutationObserver | null = null;

  constructor(controller: any, config: Record<string, any>) {
    super(controller, config);
    this._applyConfig(config);
  }

  configUpdated(config: Record<string, any>): void {
    super.configUpdated(config);
    this._applyConfig(config);
  }

  private _applyConfig(config: Record<string, any>): void {
    this._for = config.for || "element";
    this._query = config.query || "";
    this._text = config.text || "";
    this._actions = config.actions || {};
  }

  updated(_changedProperties: PropertyValues): void {
    this._cancelPending();
    this._restore();
    this._apply();
  }

  connectedCallback(): void {
    this._cancelPending();
    this._restore();
    this._apply();
  }

  disconnectedCallback(): void {
    this._cancelPending();
    this._restore();
  }

  private _cancelPending(): void {
    this._cancel.forEach((c) => c());
    this._cancel = [];
  }

  /** Undo all DOM mutations made by this spark. */
  private _undoAppliedChanges(): void {
    for (const change of this._appliedChanges) {
      for (const cls of change.addedClasses) {
        change.element.classList.remove(cls);
      }
      for (const cls of change.removedClasses) {
        change.element.classList.add(cls);
      }
      for (const { attribute, previousValue } of change.addedAttributes) {
        if (previousValue === null) {
          change.element.removeAttribute(attribute);
        } else {
          change.element.setAttribute(attribute, previousValue);
        }
      }
      for (const { attribute, previousValue } of change.removedAttributes) {
        if (previousValue !== null) {
          change.element.setAttribute(attribute, previousValue);
        }
      }
      for (const { node, originalText } of change.textNodeChanges) {
        node.textContent = originalText;
      }
    }
    this._appliedChanges = [];
  }

  /** Disconnect observer and undo all DOM mutations. */
  private _restore(): void {
    if (this._observer) {
      this._observer.disconnect();
      this._observer = null;
    }
    this._undoAppliedChanges();
  }

  private async _apply(): Promise<void> {
    if (!this._query) {
      console.warn("UIX Forge: search spark: no 'query' configured, nothing to search.");
      return;
    }

    const containers = await this.controller.target(this._for, this._cancel);
    const container = containers?.[0] as Element | ShadowRoot | undefined;
    if (!container) return;

    this._search(container);
    this._startObserving(container);
  }

  private _search(container: Element | ShadowRoot): void {
    let textRegex: RegExp | null = null;
    if (this._text) {
      try {
        textRegex = new RegExp(this._text);
      } catch (e) {
        console.warn(`UIX Forge: search spark: invalid text regex "${this._text}":`, e);
        return;
      }
    }

    const elements = Array.from(container.querySelectorAll(this._query)) as HTMLElement[];
    for (const element of elements) {
      if (textRegex && !textRegex.test(this._getTextNodeContent(element))) {
        continue;
      }
      this._applyActions(element);
    }
  }

  /** Returns the full text content of an element, including text inside child elements. */
  private _getTextNodeContent(element: HTMLElement): string {
    return element.textContent || "";
  }

  private _applyActions(element: HTMLElement): void {
    const change: AppliedElementChange = {
      element,
      addedClasses: [],
      removedClasses: [],
      addedAttributes: [],
      removedAttributes: [],
      textNodeChanges: [],
    };

    if (Array.isArray(this._actions.add_class)) {
      for (const cls of this._actions.add_class) {
        if (!cls || typeof cls !== "string") continue;
        if (!element.classList.contains(cls)) {
          element.classList.add(cls);
          change.addedClasses.push(cls);
        }
      }
    }

    if (Array.isArray(this._actions.remove_class)) {
      for (const cls of this._actions.remove_class) {
        if (!cls || typeof cls !== "string") continue;
        if (element.classList.contains(cls)) {
          element.classList.remove(cls);
          change.removedClasses.push(cls);
        }
      }
    }

    if (Array.isArray(this._actions.add_attribute)) {
      for (const entry of this._actions.add_attribute) {
        if (!entry || typeof entry !== "object" || !entry.attribute) continue;
        const prev = element.hasAttribute(entry.attribute)
          ? element.getAttribute(entry.attribute)
          : null;
        element.setAttribute(entry.attribute, entry.value ?? "");
        change.addedAttributes.push({ attribute: entry.attribute, previousValue: prev });
      }
    }

    if (Array.isArray(this._actions.remove_attribute)) {
      for (const attr of this._actions.remove_attribute) {
        if (!attr || typeof attr !== "string") continue;
        const prev = element.hasAttribute(attr) ? element.getAttribute(attr) : null;
        element.removeAttribute(attr);
        change.removedAttributes.push({ attribute: attr, previousValue: prev });
      }
    }

    if (
      this._actions.replace_text !== undefined ||
      this._actions.prepend_text !== undefined ||
      this._actions.append_text !== undefined
    ) {
      this._applyTextActions(element, change);
    }

    this._appliedChanges.push(change);
  }

  private _applyTextActions(element: HTMLElement, change: AppliedElementChange): void {
    for (const node of Array.from(element.childNodes)) {
      if (node.nodeType !== Node.TEXT_NODE) continue;
      const textNode = node as Text;
      const originalText = textNode.textContent || "";
      let newText = originalText;

      if (this._actions.replace_text !== undefined) {
        const cfg = this._actions.replace_text;
        try {
          if (typeof cfg === "string") {
            newText = newText.replace(new RegExp(cfg, "g"), "");
          } else {
            newText = newText.replace(new RegExp(cfg.find, "g"), cfg.replace ?? "");
          }
        } catch (e) {
          console.warn(`UIX Forge: search spark: invalid replace_text regex:`, e);
        }
      }

      if (this._actions.prepend_text !== undefined) {
        newText = this._actions.prepend_text + newText;
      }

      if (this._actions.append_text !== undefined) {
        newText = newText + this._actions.append_text;
      }

      if (newText !== originalText) {
        change.textNodeChanges.push({ node: textNode, originalText });
        textNode.textContent = newText;
      }
    }
  }

  /**
   * Watch for DOM mutations in the container so that newly rendered elements
   * (e.g. calendar events after month navigation) are processed automatically.
   * Only childList/subtree changes are observed to avoid feedback loops from
   * the class/attribute mutations this spark makes itself.
   * Mutations that only involve <uix-node> elements are ignored to prevent
   * loops when UIX styling is applied to the forged element.
   */
  private _startObserving(container: Element | ShadowRoot): void {
    const observer = new MutationObserver((mutations) => {
      // Bail out if the spark has been disconnected/restored since the callback was queued
      if (!this._observer) return;

      // Skip if all added/removed nodes are <uix-node> elements (UIX internals)
      const hasRelevantMutation = mutations.some((record) =>
        Array.from(record.addedNodes).some(
          (node) => !(node instanceof Element) || node.localName !== "uix-node"
        ) ||
        Array.from(record.removedNodes).some(
          (node) => !(node instanceof Element) || node.localName !== "uix-node"
        )
      );
      if (!hasRelevantMutation) return;

      // Disconnect while making changes to prevent re-entry
      observer.disconnect();
      this._undoAppliedChanges();
      this._search(container);
      // Reconnect after changes are applied (only if still active)
      if (this._observer) {
        observer.observe(container, { childList: true, subtree: true });
      }
    });
    this._observer = observer;
    this._observer.observe(container, { childList: true, subtree: true });
  }
}
