import { LitElement, html } from "lit";
import { property } from "lit/decorators.js";
import {
  hasTemplate,
  bind_template,
  unbind_template,
} from "./helpers/templates";
import pjson from "../package.json";
import { get_theme, get_theme_macros, get_theme_foundry } from "./helpers/themes";
import { selectTree } from "./helpers/selecttree";
import {
  apply_uix,
  apply_uix_compatible,
  buildMacros,
  buildBillets,
  BilletConfig,
  MacroConfig,
  UixStyle,
} from "./helpers/apply_uix";
import { compare_deep, merge_deep } from "./helpers/dict_functions";
import { UixForgeSparkController } from "./forge/sparks/uix-spark-controller";
import { UixElementSparkHost } from "./forge/sparks/uix-element-spark-host";

declare global {
  interface HTMLElementTagNameMap {
    "uix-node": Uix;
  }
}

export class Uix extends LitElement {
  @property({ attribute: "uix-type", reflect: true }) type: string;
  variables: any;
  dynamicVariablesHaveChanged: boolean = false;
  uix_children: Record<string, Array<Promise<Uix>>> = {};
  uix_parent?: Uix = undefined;
  uix_class?: string = undefined;
  classes: string[] = [];
  macros: Record<string, MacroConfig | string> = {};
  billets: BilletConfig = {};

  debug: boolean = false;

  uix_input: UixStyle;
  _fixed_styles: Record<string, UixStyle> = {};
  _fixed_macros: Record<string, MacroConfig | string> = {};
  _macro_string: string = "";
  _billet_string: string = "";
  _styles: string = "";
  _processStylesOnConnect: boolean = false;
  @property() _rendered_styles: string = "";
  _renderer: (_: string) => void;

  _cancel_style_child = [];

  /** Spark controller for foundry-based sparks applied via theme. */
  private _sparkController?: UixForgeSparkController;
  /** The foundry name currently active for this node (null = no foundry). */
  private _sparkFoundryName?: string | null;
  /** Listener for uix-foundries-updated to reconfigure sparks when foundries reload. */
  private _foundryUpdateListener?: EventListener;

  _observer: MutationObserver = new MutationObserver((mutations) => {
    // MutationObserver to keep track of any changes to the parent element
    // e.g. when elements are changed after creation.
    // The observer is activated in _connect() only if there are any styles
    //  which should be applied to children
    if (this.debug) {
      this._debug("Mutations observed:", mutations);
    }
    let stop = true;
    for (const m of mutations) {
      if ((m.target as any).localName === "uix-node") return;
      if (m.addedNodes.length)
        m.addedNodes.forEach((n) => {
          if ((n as any).localName !== "uix-node") stop = false;
        });
      if (m.removedNodes.length)
        m.removedNodes.forEach((n) => {
          if ((n as any).localName !== "uix-node") stop = false;
        });
    }

    if (stop) return;
    this.refresh();
  });

  static get applyToElement() {
    // This gets the compatibility wrapper for backwards compatibility with uix 3.3.
    // The wrapper should be removed at earliest June 2024, or if uix 4.0 is released
    return apply_uix_compatible;
  }

  constructor() {
    super();

    // uix_update is issued when themes are reloaded
    document.addEventListener("uix_update", (ev: Event) => {
      // Don't process disconnected elements
      this.dynamicVariablesHaveChanged = (ev as CustomEvent).detail?.variablesChanged || false;
      if (!this.isConnected) {
        this._processStylesOnConnect = true;
        return;
      }
      this._process_styles(this.uix_input);
    });
  }


  connectedCallback() {
    super.connectedCallback();
    if (this._processStylesOnConnect) {
      this._processStylesOnConnect = false;
      this._debug("Processing styles on (Re)connect:", 
        "type:",
        this.type,
        "for:",
        ...((this as any)?.parentNode?.host
        ? ["#shadow-root of:", (this as any)?.parentNode?.host]
        : [this.parentElement ?? this.parentNode]),
      );
      this._process_styles(this.uix_input);
    } else {
      this.refresh();
    }

    // Make sure the uix element is invisible
    this.setAttribute("slot", "none");
    this.style.display = "none";

    // Re-activate any existing spark controller (e.g. after a quick disconnect/reconnect).
    this._sparkController?.connectedCallback();
    // Re-register the foundry update listener if a foundry was previously active.
    if (this._sparkFoundryName) {
      this._addFoundryUpdateListener();
    }
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this._disconnect();
    // Deactivate sparks and remove the foundry update listener.
    this._sparkController?.disconnectedCallback();
    this._removeFoundryUpdateListener();
  }

  set styles(stl: UixStyle) {
    // Parsing styles is expensive, so only do it if things have actually changed
    if (compare_deep(stl, this.uix_input)) return;

    this.uix_input = stl;
    if (!this.isConnected) {
      this._processStylesOnConnect = true;
      return;
    }
    this._process_styles(stl);
  }

  get styles(): UixStyle {
    // Return only styles that apply to this element
    return this._styles;
  }

  refresh() {
    this._connect();
    // Notify any foundry-based spark controller that the host element has updated.
    this._sparkController?.updated(undefined);
  }

  cancelStyleChild() {
    this._cancel_style_child.forEach((cancel) => cancel());
    this._cancel_style_child = [];
  }

  _debug(...msg) {
    if (this.debug) console.log("UIX Debug:", ...msg);
  }

  private async _process_styles(stl) {
    let styles =
      typeof stl === "string" || stl === undefined ? { ".": stl ?? "" } : JSON.parse(JSON.stringify(stl));

    // Merge uix styles with theme styles
    const theme_styles = await get_theme(this);
    merge_deep(styles, theme_styles);

    // Merge theme macros (base) with card-level macros (override)
    const theme_macros = await get_theme_macros(this);
    this._fixed_macros = { ...theme_macros, ...this.macros };

    // Save processed styles
    this._fixed_styles = styles;

    // Set up (or update) foundry-based sparks specified via theme.
    await this._updateSparkFoundry();

    this.refresh();
  }

  private async _style_child(
    path: string,
    style,
    retries = 0
  ): Promise<Array<Promise<Uix>>> {
    const parent = this.parentElement || this.parentNode;
    const elements = await selectTree(parent, path, true);
    if (!elements || !elements.length) {
      if (retries > 5) throw new Error("NoElements");
      let timeout = new Promise((resolve, reject) => {
        setTimeout(resolve, retries * 100);
        this._cancel_style_child.push(reject);
      });
      await timeout.catch((e) => {
        throw new Error("Cancelled");
      });
      return this._style_child(path, style, retries + 1);
    }

    return [...elements].map(async (ch) => {
      const uix = await apply_uix(
        ch,
        `${this.type}-child`,
        { style, debug: this.debug, macros: this._fixed_macros, billets: this.billets },
        this.variables,
        false
      );
      if (uix) uix.uix_parent = this;
      return uix;
    });
  }

  private async _connect() {
    const styles = this._fixed_styles ?? {};

    const styleChildren = {};
    let thisStyle = "";
    let hasChildren = false;

    this._debug("(Re)connecting:",
      "type:",
      this.type,
      "to:",
      ...((this as any)?.parentNode?.host
      ? ["#shadow-root of:", (this as any)?.parentNode?.host]
      : [this.parentElement ?? this.parentNode]),
      );

    this.cancelStyleChild();

    // Go through each path in the styles
    for (const [key, value] of Object.entries(styles)) {
      if (key === ".") {
        if (typeof value === "string") thisStyle = value;
        else this._debug("Style of '.' must be a string: ", value);
      } else {
        hasChildren = true;
        styleChildren[key] = this._style_child(key, value).catch((e) => {
          if (e.message == "NoElements") {
            if (this.debug) {
              console.groupCollapsed("UIX found no elements");
              console.info(`Looked for ${key}`);
              console.info(this);
              console.groupEnd();
            }
            return;
          }
          if (e.message == "Cancelled") {
            if (this.debug) {
              console.groupCollapsed(
                "UIX style_child cancelled while looking for elements"
              );
              console.info(`Looked for ${key}`);
              console.info(this);
              console.groupEnd();
            }
            return;
          }
          throw e;
        });
      }
    }

    // Prune old child elements
    for (const key in this.uix_children) {
      if (!styleChildren[key]) {
        (await this.uix_children[key])?.forEach(
          async (ch) => await ch.then((uix) => (uix.styles = "")).catch(() => {})
        );
      }
    }
    this.uix_children = styleChildren;
    if (hasChildren) {
      this._observer.disconnect();
      const parentEl = this.parentElement ?? this.parentNode;
      if (parentEl) {
        // Observe changes to the parent element to catch any changes
        if (this.debug) {
          this._debug("Observing for changes on:", parentEl);
        }
        this._observer.observe(parentEl, {
          childList: true,
        });
        if ((parentEl as any).host) {
          // If parent is a shadow root, also observe changes to the host
          if (this.debug) {
            this._debug("Observing for changes on:", (parentEl as any).host);
          }
          this._observer.observe((parentEl as any).host, {
            childList: true,
          });
        }
      }
    }

    // Process styles applicable to this card-mod element
    const macroStr = buildMacros(this._fixed_macros, thisStyle);
    const billetStr = buildBillets(this.billets, macroStr + thisStyle);
    if (this._styles === thisStyle && !this.dynamicVariablesHaveChanged && this._macro_string === macroStr && this._billet_string === billetStr) return;
    this._styles = thisStyle;
    this._macro_string = macroStr;
    this._billet_string = billetStr;
    this.dynamicVariablesHaveChanged = false;

    if (hasTemplate(this._styles)) {
      this._renderer = this._renderer || this._style_rendered.bind(this);
      bind_template(this._renderer, `${macroStr}${billetStr}${this._styles}`, this.variables);
    } else {
      this._style_rendered(this._styles || "");
    }

  }

  private async _disconnect() {
    this._observer.disconnect();
    this._styles = "";
    this.cancelStyleChild();
    await unbind_template(this._renderer);
    this.uix_parent?.refresh?.();
  }

  /**
   * Returns the host element this uix-node is attached to.
   *
   * When `apply_uix` was called with `shadow = true` (the default), the uix-node
   * lives inside a shadow root, so `parentNode.host` is the actual element.
   * When `shadow = false`, the uix-node is a direct child and `parentElement` is
   * the element.
   */
  private _getSparkHostElement(): HTMLElement | null {
    const parentNode = this.parentNode as any;
    if (parentNode?.host) return parentNode.host as HTMLElement;
    return this.parentElement;
  }

  /**
   * Check the active theme for a `uix-<type>-foundry` variable and set up (or
   * tear down) the foundry-based spark controller accordingly.
   *
   * This is called from `_process_styles()`, which runs whenever the styles
   * setter is triggered (e.g. on initial load and on theme changes).  The
   * foundry name is cached in `_sparkFoundryName` so that re-runs caused by
   * unrelated style updates do not redundantly reconfigure sparks.
   */
  private async _updateSparkFoundry() {
    const foundryName = await get_theme_foundry(this);

    if (foundryName === this._sparkFoundryName) {
      // Foundry hasn't changed — just update the existing controller's config
      // in case the foundry itself was edited (handled by the foundry update listener).
      return;
    }

    this._sparkFoundryName = foundryName;

    if (!foundryName) {
      // No foundry active — clean up any existing spark controller.
      if (this._sparkController) {
        this._sparkController.disconnectedCallback();
        this._sparkController = undefined;
      }
      this._removeFoundryUpdateListener();
      return;
    }

    // Register for future foundry changes so sparks update if the foundry is edited.
    this._addFoundryUpdateListener();

    // Try to apply sparks from the named foundry immediately.
    this._applyFoundrySparks(foundryName);
  }

  /**
   * Resolve the named foundry from the coordinator and configure the spark
   * controller with the foundry's `forge.sparks` list.
   *
   * Safe to call multiple times; the spark controller is created once and
   * reused.  Called both from `_updateSparkFoundry()` and from the
   * `uix-foundries-updated` event listener so that sparks react to live
   * foundry edits.
   */
  private _applyFoundrySparks(foundryName: string) {
    const coordinator = (window as any).uixCoordinator;
    if (
      !coordinator?.foundries ||
      (Object.keys(coordinator.foundries).length === 0 && !coordinator.ready)
    ) {
      // Coordinator not yet ready — the foundry update listener will retry.
      return;
    }

    const foundryData = coordinator.foundries[foundryName];
    if (!foundryData) {
      console.warn(`UIX: Foundry '${foundryName}' not found for '${this.type}' theme sparks.`);
      return;
    }

    const sparks: Record<string, any>[] = foundryData.forge?.sparks ?? [];

    const hostEl = this._getSparkHostElement();
    if (!hostEl) return;

    // uix-forge elements manage their own spark lifecycle — skip them to
    // prevent double-application of sparks from a theme uix-card-foundry.
    if (hostEl.localName === "uix-forge") return;

    if (!this._sparkController) {
      const host = new UixElementSparkHost(hostEl);
      this._sparkController = new UixForgeSparkController(host);
      if (this.isConnected) {
        this._sparkController.connectedCallback();
      }
    }

    this._sparkController.setConfig(sparks);
  }

  private _addFoundryUpdateListener() {
    if (this._foundryUpdateListener) return;
    this._foundryUpdateListener = () => {
      if (this._sparkFoundryName) {
        this._applyFoundrySparks(this._sparkFoundryName);
      }
    };
    window.addEventListener("uix-foundries-updated", this._foundryUpdateListener);
  }

  private _removeFoundryUpdateListener() {
    if (this._foundryUpdateListener) {
      window.removeEventListener("uix-foundries-updated", this._foundryUpdateListener);
      this._foundryUpdateListener = undefined;
    }
  }

  private _style_rendered(result: string) {
    if (this._rendered_styles !== result) this._rendered_styles = result;
    // This event is listened for by icons
    this.dispatchEvent(new Event("uix-styles-update"));
  }

  createRenderRoot() {
    return this;
  }

  render() {
    return html`
      <style>
        ${this._rendered_styles}
      </style>
    `;
  }
}

if (!customElements.get("uix-node")) {
  customElements.define("uix-node", Uix);
  console.groupCollapsed(
    `%c💡 UIX ${pjson.version} IS INSTALLED 💡`,
    'color: white; background-color: #CE3226; padding: 2px 5px; font-weight: bold; border-radius: 5px;',
  );
  console.log('Documentation:', 'https://uix.lf.technology/');
  console.groupEnd();
  window.dispatchEvent(new Event("uix-bootstrap"));
}
(async () => {
  // Wait for scoped customElements registry to be set up
  // and then redefine uix-node if necessary
  // otherwise the customElements registry uix-node is defined in
  // may get overwritten by the polyfill if uix-node is loaded as a module
  while (customElements.get("home-assistant") === undefined)
    await new Promise((resolve) => window.setTimeout(resolve, 100));

  if (!customElements.get("uix-node")) {
    customElements.define("uix-node", Uix);
  }
})();
