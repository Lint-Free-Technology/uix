import { LitElement } from "lit";
import { UixConfig, MacroConfig } from "../helpers/apply_uix";
import { hasTemplate } from "../helpers/templates";

export const UIX_FORGE_TYPE = "uix-forge";

export type UixMacroConfig = Record<string, MacroConfig | string>;

export type UixForgeConfigPath = string[];

export const UIX_FORGE_DEFAULT_GRID_OPTIONS = {
  rows: 2,
  columns: 6,
};

export const UIX_FORGE_ALLOWED_CONFIG_KEYS = [
  "type", 
  "foundry", 
  "forge", 
  "element", 
  "disabled",
  "row_span",
  "column_span",
  "background",
  "state_color",
  "entities",
];

export const UIX_FORGE_FORGE_MOLDS = [
  "card",
  "badge",
  "row",
  "section",
  "picture-element"
];

export const UIX_FORGE_DEFAULT_TEMPLATE_VALUE = "##UIX_FORGE_DEFAULT_VALUE##";

export const UIX_FORGE_NESTED_TEMPLATE_OPEN = "<<";
export const UIX_FORGE_NESTED_TEMPLATE_CLOSE = ">>";
export const UIX_FORGE_NESTED_TEMPLATE_MARKER = "{#uix#}";
export const UIX_FORGE_NESTED_TEMPLATE_OPEN_RAW = `{% raw %}${UIX_FORGE_NESTED_TEMPLATE_MARKER}{{{% endraw %}`;
export const UIX_FORGE_NESTED_TEMPLATE_CLOSE_RAW = `{% raw %}}}${UIX_FORGE_NESTED_TEMPLATE_MARKER}{% endraw %}`;

export interface UixForgeForge {
    type?: string;
    mold?: string;
    show_error?: boolean;
    hidden?: string | boolean;
    grid_options?: Record<string, any>;
    macros?: UixMacroConfig;
    template_nesting?: string;
    sparks?: Record<string, any>[];
    uix?: UixConfig;
    delayed_hass?: boolean;
}

export interface UixForgeElement {
  [key: string]: any;
  uix?: UixConfig;
}

export interface UixForgeConfig {
  type: string;
  foundry?: string;
  forge?: UixForgeForge;
  element?: UixForgeElement;
  disabled?: boolean;
  state_color?: boolean;
  entities?: string[];
}

export class UixForgeConfigBuilder {
  _config: {};
  _templateBindings: Map<string, { callback: (res: string) => void }>;
  _resolveReady: (value?: void | PromiseLike<void>) => void;
  _readyPromise: Promise<void>;
  refreshCallback?: (path: UixForgeConfigPath) => void;
  _nestedTemplateOpen: string;

  constructor(refreshCallback: (path: UixForgeConfigPath) => void, nestedTemplateOpen?: string) {
    this._config = {};
    this._templateBindings = new Map();
    this.ready = false;
    this.refreshCallback = refreshCallback;
    this._nestedTemplateOpen = nestedTemplateOpen ?? UIX_FORGE_NESTED_TEMPLATE_OPEN;
  }

  get config() {
    return this._config;
  }

  set config(config: any) {
    this._config = config;
    this.ready = false;
    this.checkReady();
  };

  public configIsReady(config: any = this._config): Promise<boolean> {
    return this.ready;
  }

  public set nestedTemplateOpen(value: string) {
    this._nestedTemplateOpen = value;
  }

  private set ready(value: boolean) {
    if (value) {
      this._resolveReady();
    } else {
      this._readyPromise = new Promise((resolve) => {
        this._resolveReady = resolve;
      });
    }
  }

  private get ready(): Promise<boolean> {
    return this._readyPromise ? this._readyPromise.then(() => true) : Promise.reject("Ready promise not initialized");
  }

  private checkReady() {
    const _checkReady = (value, nestingOpen) => {
      for (const key of Object.keys(value)) {
        if (key === "uix") return true;
        const val = value[key];
        // If we have nested template marker but not the raw open marker, this means the template is ready.
        if (typeof val === "string" && val.includes(UIX_FORGE_NESTED_TEMPLATE_MARKER) && !val.includes(UIX_FORGE_NESTED_TEMPLATE_OPEN_RAW)) continue;
        if (hasTemplate(val) || (typeof val === "string" && val.includes(nestingOpen))) return false;
        if (val === undefined || val === null) continue;
        if (typeof val === "object") {
          if (!_checkReady(val, nestingOpen)) return false;
        }
        if (val === UIX_FORGE_DEFAULT_TEMPLATE_VALUE) return false;
      }
      return true;
    }
    if (_checkReady(this._config, this._nestedTemplateOpen)) {
      this.ready = true;
    }
  }

  set nested(update: { keys: string[]; value: any }) {
    const { keys, value } = update;
    let current = { ...this._config };
    let updated = current;
    
    keys.forEach((key, index) => {
        if (index === keys.length - 1) {
            current[key] = value;
        } else {
            current[key] = Array.isArray(current[key]) ? [...current[key]] : { ...current[key] };
            current = current[key];
        }
    });
    this._config = updated;
    this.checkReady();
  };

  public hasBinding(path: string) {
    return this._templateBindings.has(path);
  }

  public setBinding(path: string, callback: (res: string) => void) {
    this._templateBindings.set(path, { callback });
  }

  public getBinding(path: string) {
    return this._templateBindings.get(path);
  }

  public deleteBinding(path: string) {
    this._templateBindings.delete(path);
  }

  public bindings(): Map<string, { callback: (res: string) => void }> {
    return this._templateBindings;
  }
}

export interface HomeAssistantUser {
    id: string;
    name: string;
    is_admin: boolean;
    is_owner: boolean;
    system_generated: boolean;
}
export interface HomeAssistant {
    user?: HomeAssistantUser;
    [key: string]: unknown;
    localize(key: string, ...args: unknown[]): string;
}

export interface LovelaceCardConfig {
    index?: number;
    view_index?: number;
    type: string;
    disabled?: boolean;
    [key: string]: unknown;
}

export interface LovelaceElement extends LitElement {
    hass?: HomeAssistant;
    layout?: boolean;
    isPanel?: boolean;
    preview?: boolean;
    lovelace?: any;
    _layoutElement?: LovelaceElement;
    getCardSize?(): number | Promise<number>;
    getGridOptions?(): Record<string, any>;
    config?: LovelaceCardConfig;
}

export interface HuiCard extends LovelaceElement {
    load(): void;
    _element?: LovelaceElement;
}

export interface HuiBadge extends LovelaceElement {
    load(): void;
    _element?: LovelaceElement;
}