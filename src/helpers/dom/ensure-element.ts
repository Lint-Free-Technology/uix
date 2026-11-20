import { Unpromise } from "@watchable/unpromise";
import { hass_base_el } from "../hass";

const DEFAULT_TIMEOUT_MS = 2000;
const STRATEGY_LOAD_TIMEOUT_MS = 5000;

function waitForCustomElement(tag: string, description: string, timeoutMs = STRATEGY_LOAD_TIMEOUT_MS): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const timeout = window.setTimeout(() => reject(new Error(`Timeout while waiting for ${description}.`)), timeoutMs);
    customElements.whenDefined(tag).then(() => {
      window.clearTimeout(timeout);
      resolve();
    }, (error) => {
      window.clearTimeout(timeout);
      reject(error);
    });
  });
}

export async function ensureCustomElement(selector: string, timeoutMs = DEFAULT_TIMEOUT_MS): Promise<CustomElementConstructor> {
  if (customElements.get(selector)) {
    return customElements.get(selector)!;
  }
  let resolver: Promise<CustomElementConstructor>;
  switch (selector) {
    case "ha-form":
      resolver = ensureHaForm();
      break;
    case "ha-adaptive-popover":
      resolver = ensureHaAdaptivePopover();
      break;
    case "hui-card-picker":
      resolver = ensureHuiCardPicker();
      break;
    case "hui-badge-picker":
      resolver = ensureHuiBadgePicker();
      break;
    default:
      resolver = Promise.reject(new Error(`No UIX load sequence defined for selector: ${selector}.`));
  }
  const timeout = new Promise<CustomElementConstructor>((_, reject) => setTimeout(() => reject(new Error(`Timeout while waiting for selector: ${selector}.`)), timeoutMs));
  return Unpromise.race([resolver, timeout]);
}

async function ensureHaAdaptivePopover(): Promise<CustomElementConstructor> {
  const haEl: any = await hass_base_el();
  if (!haEl) {
    return Promise.reject(new Error(`Failed to get hass base element.`));
  }
  const haShadow = haEl.shadowRoot!;
  const haFullCalendar = customElements.get("ha-full-calendar");
  if (!haFullCalendar) {
    const helpers = await (window as any).loadCardHelpers();
    await helpers.createCardElement({ type: "calendar" });
  }
  return customElements.whenDefined("ha-full-calendar").then(() => {
    let haFullCalendar: any = haShadow.getElementById("uix-full-calendar");
    if (!haFullCalendar) {
      haFullCalendar = document.createElement("ha-full-calendar");
      haFullCalendar.id = "uix-full-calendar";
      haFullCalendar.style.display = "none";
      haShadow.appendChild(haFullCalendar);
    }
    if (haFullCalendar) {
      const handler = (ev: Event) => {
        const customEvent = ev as CustomEvent;
        if (customEvent.detail.dialogTag === "dialog-calendar-event-editor") {
          ev.stopPropagation();
          customEvent.detail.dialogImport?.().then(() => {
            haFullCalendar.remove();
            haFullCalendar = undefined;
          });
        }
        window.removeEventListener("show-dialog", handler, { capture: true });
      };
      window.addEventListener("show-dialog", handler, { capture: true });

      haFullCalendar.hass = haEl.hass;
      // unset _activeView so _createEvent will work correctly
      haFullCalendar._activeView = undefined;
      haFullCalendar._createEvent();
      return customElements.whenDefined("ha-date-input").then(() => {
        let haDateInput: any = haShadow.getElementById("uix-date-input");
        if (!haDateInput) {
          haDateInput = document.createElement("ha-date-input");
          haDateInput.id = "uix-date-input";
          haDateInput.style.display = "none";
          haShadow.appendChild(haDateInput);
        }
        if (haDateInput) {
          const handler = (ev: Event) => {
            const customEvent = ev as CustomEvent;
            if (customEvent.detail.dialogTag === "ha-dialog-date-picker") {
              ev.stopPropagation();
              customEvent.detail.dialogImport?.().then(() => {
                haDateInput.remove();
                haDateInput = undefined;
              });
            }
            window.removeEventListener("show-dialog", handler, { capture: true });
          };
          window.addEventListener("show-dialog", handler, { capture: true });
          haDateInput.locale = haEl.hass.locale;
          haDateInput._openDialog();
          return customElements.whenDefined("ha-adaptive-popover");
        } else {
          return Promise.reject(new Error(`Failed to create date input element.`));
        }
      });
    } else {
      return Promise.reject(new Error(`Failed to create full calendar element.`));
    }
  }).catch((err) => {
    return Promise.reject(new Error(`${err.message}`));
  });
}

export async function ensureHaForm(): Promise<CustomElementConstructor> {
  const helpers = await (window as any).loadCardHelpers();
  if (!helpers) {
    return Promise.reject(new Error(`Failed to load card helpers.`));
  }
  const card = await helpers.createCardElement({ type: "button" });
  if (!card) {
    return Promise.reject(new Error(`Failed to create card element.`));
  }
  await card.constructor.getConfigElement();
  return customElements.whenDefined("ha-form");
}

/**
 * `hui-card-picker` is lazy-loaded by Home Assistant. Loading the Lovelace
 * route and asking a vertical-stack card for its editor follows Home
 * Assistant's own import path for the picker.
 */
export async function ensureHuiCardPicker(): Promise<CustomElementConstructor> {
  await customElements.whenDefined("partial-panel-resolver");
  const resolver: any = document.createElement("partial-panel-resolver");
  const routes = resolver._getRoutes?.([
    { component_name: "lovelace", url_path: "uix-forge-picker" },
  ]);
  await routes?.routes?.["uix-forge-picker"]?.load?.();

  const helpers = await (window as any).loadCardHelpers?.();
  if (!helpers) {
    throw new Error("Failed to load card helpers.");
  }

  // Home Assistant's vertical-stack editor imports hui-card-picker.
  const stack = await helpers.createCardElement?.({
    type: "vertical-stack",
    cards: [],
  });
  if (!stack) {
    throw new Error("Failed to create vertical stack card.");
  }

  await customElements.whenDefined("hui-vertical-stack-card");
  await stack.constructor.getConfigElement?.();
  return customElements.whenDefined("hui-card-picker");
}

/**
 * Home Assistant loads the badge picker only with its create-badge dialog.
 * Ask the active view to prepare that dialog, intercept the dialog event, and
 * run its own lazy import without ever opening a second dialog for the user.
 */
export async function ensureHuiBadgePicker(): Promise<CustomElementConstructor> {
  await customElements.whenDefined("partial-panel-resolver");
  const resolver: any = document.createElement("partial-panel-resolver");
  const routes = resolver._getRoutes?.([
    { component_name: "lovelace", url_path: "uix-forge-picker" },
  ]);
  await routes?.routes?.["uix-forge-picker"]?.load?.();

  const view = findShadowDescendant(document, "hui-view") as any;
  const layout = view?._layoutElement;
  if (!view || !layout) {
    throw new Error("Failed to find the active Lovelace view for the badge picker.");
  }

  await new Promise<void>((resolve, reject) => {
    const timeout = window.setTimeout(() => {
      cleanup();
      reject(new Error("Timed out loading the Home Assistant badge picker."));
    }, DEFAULT_TIMEOUT_MS);

    const cleanup = () => {
      window.clearTimeout(timeout);
      view.removeEventListener("show-dialog", handleShowDialog);
    };

    const handleShowDialog = (event: Event) => {
      const dialog = event as CustomEvent<{ dialogTag?: string; dialogImport?: () => Promise<unknown> }>;
      if (dialog.detail?.dialogTag !== "hui-dialog-create-badge") return;
      event.stopImmediatePropagation();
      cleanup();
      Promise.resolve(dialog.detail.dialogImport?.()).then(() => resolve(), reject);
    };

    view.addEventListener("show-dialog", handleShowDialog);
    layout.dispatchEvent(new CustomEvent("ll-create-badge", { bubbles: true, composed: true }));
  });

  return customElements.whenDefined("hui-badge-picker");
}

/**
 * Built-in Section strategies are lazy-loaded only from Home Assistant's
 * native Section renderer. Mounting an inert renderer takes that supported
 * path without placing content in the user's dashboard.
 */
export async function ensureBuiltinSectionStrategy(type: string, hass: any): Promise<CustomElementConstructor> {
  const tag = `${type}-section-strategy`;
  const existing = customElements.get(tag);
  if (existing) return existing;
  await waitForCustomElement("hui-section", "Home Assistant section renderer");
  const loader = document.createElement("hui-section") as any;
  const loaded = waitForCustomElement(tag, `section strategy '${type}'`);
  loader.hass = hass;
  loader.config = { strategy: { type } };
  loader.style.display = "none";
  loader.setAttribute("aria-hidden", "true");
  (document.querySelector("home-assistant")?.shadowRoot ?? document.body).append(loader);
  try {
    await loaded;
  } finally {
    loader.remove();
  }
  const strategy = customElements.get(tag);
  if (!strategy) throw new Error(`Home Assistant did not register section strategy '${type}'.`);
  return strategy;
}

/**
 * Home Assistant's Dashboard strategy registry is lazy-loaded by its strategy
 * editor. Bootstrap that editor through its native hidden dialog import, then
 * ask the editor to resolve the requested strategy. The dialog event is
 * intercepted before Home Assistant's dialog manager can render anything.
 */
async function loadDashboardStrategyEditor(): Promise<boolean> {
  await waitForCustomElement("hui-root", "Home Assistant Lovelace root");
  const Root = customElements.get("hui-root") as any;
  const openStrategyEditor = Root?.prototype?._enableEditMode;
  if (typeof openStrategyEditor !== "function") return false;

  await new Promise<void>((resolve, reject) => {
    const timeout = window.setTimeout(() => reject(new Error("Timed out loading the Home Assistant Dashboard strategy editor.")), STRATEGY_LOAD_TIMEOUT_MS);
    const finish = () => window.clearTimeout(timeout);
    const loader: any = {
      _yamlMode: false,
      lovelace: {
        // Bootstrap the editor with a known built-in strategy. The requested
        // type is resolved by hui-dashboard-strategy-element-editor below.
        rawConfig: { strategy: { type: "original-states" } },
        saveConfig: async () => {},
      },
      hass: {
        loadFragmentTranslation: async () => {},
        callWS: async () => [],
        localize: () => "",
      },
      route: { prefix: "/uix-forge-loader" },
      narrow: false,
      dispatchEvent: (event: CustomEvent<{ dialogTag?: string; dialogImport?: () => Promise<unknown> }>) => {
        if (event.type !== "show-dialog" || event.detail?.dialogTag !== "dialog-dashboard-strategy-editor") return true;
        event.stopImmediatePropagation?.();
        Promise.resolve(event.detail.dialogImport?.()).then(() => {
          finish();
          resolve();
        }, (error) => {
          finish();
          reject(error);
        });
        return true;
      },
    };
    Promise.resolve(openStrategyEditor.call(loader)).catch((error) => {
      finish();
      reject(error);
    });
  });

  await waitForCustomElement("hui-dashboard-strategy-element-editor", "Home Assistant Dashboard strategy editor");
  return true;
}

/**
 * Older Home Assistant Frontends do not expose the strategy-editor action on
 * Hui root. Their native new-dashboard dialog still resolves a selected
 * Dashboard strategy through the same Home Assistant registry. Load just the
 * two config-panel route components, then intercept that dialog and select
 * the requested strategy without mounting a dialog.
 */
async function loadDashboardStrategyThroughConfigPanel(type: string, hass: any): Promise<void> {
  await customElements.whenDefined("partial-panel-resolver");
  const resolver: any = document.createElement("partial-panel-resolver");
  const routes = resolver._getRoutes?.([
    { component_name: "config", url_path: "uix-forge-dashboard-loader" },
  ]);
  await routes?.routes?.["uix-forge-dashboard-loader"]?.load?.();
  await waitForCustomElement("ha-panel-config", "Home Assistant configuration panel");
  const configPanel = document.createElement("ha-panel-config") as any;
  await configPanel.routerOptions?.routes?.lovelace?.load?.();
  await waitForCustomElement("ha-config-lovelace", "Home Assistant Lovelace configuration panel");
  const lovelaceConfig = document.createElement("ha-config-lovelace") as any;
  await lovelaceConfig.routerOptions?.routes?.dashboards?.load?.();
  await waitForCustomElement("ha-config-lovelace-dashboards", "Home Assistant Dashboard configuration panel");

  const Dashboards = customElements.get("ha-config-lovelace-dashboards") as any;
  const addDashboard = Dashboards?.prototype?._addDashboard;
  if (typeof addDashboard !== "function") {
    throw new Error("Home Assistant does not expose the Dashboard strategy chooser.");
  }
  await new Promise<void>((resolve, reject) => {
    const timeout = window.setTimeout(() => reject(new Error("Timed out loading the Home Assistant Dashboard strategy.")), STRATEGY_LOAD_TIMEOUT_MS);
    const finish = () => window.clearTimeout(timeout);
    const loader: any = {
      hass,
      _openDetailDialog: () => {},
      dispatchEvent: (event: CustomEvent<{ dialogTag?: string; dialogImport?: () => Promise<unknown>; dialogParams?: { selectConfig?: (selection: any) => Promise<unknown> } }>) => {
        if (event.type !== "show-dialog" || event.detail?.dialogTag !== "ha-dialog-new-dashboard") return true;
        event.stopImmediatePropagation?.();
        Promise.resolve(event.detail.dialogImport?.()).then(
          () => event.detail.dialogParams?.selectConfig?.({ config: { strategy: { type } } }),
        ).then(() => {
          finish();
          resolve();
        }, (error) => {
          finish();
          reject(error);
        });
        return true;
      },
    };
    Promise.resolve(addDashboard.call(loader)).catch((error) => {
      finish();
      reject(error);
    });
  });
}

export async function ensureBuiltinDashboardStrategy(type: string, hass: any): Promise<CustomElementConstructor> {
  const tag = `${type}-dashboard-strategy`;
  const existing = customElements.get(tag);
  if (existing) return existing;
  if (await loadDashboardStrategyEditor()) {
    const editor = document.createElement("hui-dashboard-strategy-element-editor") as any;
    editor.hass = hass;
    editor.value = { type };
    await editor.getConfigElement?.();
  } else {
    await loadDashboardStrategyThroughConfigPanel(type, hass);
  }

  const strategy = customElements.get(tag);
  if (!strategy) throw new Error(`Home Assistant did not register dashboard strategy '${type}'.`);
  return strategy;
}

function findShadowDescendant(root: ParentNode, selector: string): Element | null {
  const direct = root.querySelector(selector);
  if (direct) return direct;
  for (const element of Array.from(root.querySelectorAll("*"))) {
    if (!element.shadowRoot) continue;
    const found = findShadowDescendant(element.shadowRoot, selector);
    if (found) return found;
  }
  return null;
}
