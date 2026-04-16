import { LitElement } from "lit";
import { Uix } from "../uix";

export class ModdedElement extends LitElement {
  _uix: Uix[] = [];
  modElement?: ModdedElement;

  setConfig(_orig, config, ...args) {
    _orig?.(config, ...args);
    this._uix.forEach((uix) => {
      uix.variables = { config };
      uix.macros = config.uix?.macros || config.card_mod?.macros || {};
      uix.styles = config.uix?.style || config.card_mod?.style || {};
    });
  }

  updated(_orig, ...args) {
    _orig?.(...args);
    Promise.all([this.updateComplete]).then(() =>
      this._uix.forEach((uix) => uix.refresh?.())
    );
  }
}

export type UixStyle = string | { [key: string]: UixStyle };

export interface MacroParamConfig {
  name: string;
  default: string;
}

export type MacroParam = string | MacroParamConfig;

export interface MacroConfig {
  params?: MacroParam[];
  returns?: boolean;
  template: string;
}

export interface UixConfig {
  style?: UixStyle;
  class?: string | string[];
  debug?: boolean;
  prepend?: boolean;
  macros?: Record<string, MacroConfig | string>;
}

export type BilletConfig = Record<string, any>;

function _toJinja2Repr(value: any): string {
  if (value === null || value === undefined) return "none";
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "number") return String(value);
  if (typeof value === "string") {
    return `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\n").replace(/\r/g, "\\r")}"`;
  }
  if (Array.isArray(value)) {
    return `[${value.map(_toJinja2Repr).join(", ")}]`;
  }
  if (typeof value === "object") {
    const items = Object.entries(value).map(([k, v]) => `${_toJinja2Repr(k)}: ${_toJinja2Repr(v)}`);
    return `{${items.join(", ")}}`;
  }
  return `"${String(value)}"`;
}

export function buildBillets(billets: BilletConfig, usedIn?: string): string {
  if (!billets || Object.keys(billets).length === 0) return "";
  let entries: [string, any][];
  if (!usedIn) {
    entries = Object.entries(billets);
  } else {
    const billetNames = Object.keys(billets);
    const billetRegexes = billetNames.map((name) => ({ name, re: new RegExp(`\\b${name}\\b`) }));
    const usedNames = new Set<string>(
      billetRegexes.filter(({ re }) => re.test(usedIn)).map(({ name }) => name)
    );
    entries = Object.entries(billets).filter(([name]) => usedNames.has(name));
  }
  if (entries.length === 0) return "";
  return (
    entries
      .map(([name, value]) => {
        if (value === null || value === undefined || typeof value === "string") {
          // None and strings: simple set variable, used as {{ billet_name }}
          return `{%- set ${name} = ${_toJinja2Repr(value)} -%}`;
        }
        // Numbers, booleans, lists and dicts: use do returns for proper typing,
        // then store in a set variable so the billet is used as {{ billet_name }}
        const helperName = `_uix_billet_fn_${name}`;
        const repr = _toJinja2Repr(value);
        return (
          `{%- macro ${helperName}(returns) %}{%- do returns(${repr}) -%}{%- endmacro %}\n` +
          `{%- set ${name} = (${helperName} | as_function)() -%}`
        );
      })
      .join("\n") + "\n"
  );
}

export function buildMacros(macros: Record<string, MacroConfig | string>, usedIn?: string): string {
  if (!macros || Object.keys(macros).length === 0) return "";
  const renderParam = (p: MacroParam): string =>
    typeof p === "string" ? p : `${p.name} = ${p.default}`;
  let entries: [string, MacroConfig | string][];
  if (!usedIn) {
    entries = Object.entries(macros);
  } else {
    // Transitively collect all macro names needed: start with those referenced
    // in usedIn, then recursively add any macros referenced within those macro
    // templates, until no new dependencies are found.
    const usedNames = new Set<string>();
    const queue: string[] = [];
    const macroNames = Object.keys(macros);
    for (const name of macroNames) {
      if (new RegExp(`\\b${name}\\b`).test(usedIn)) {
        usedNames.add(name);
        queue.push(name);
      }
    }
    let queueIndex = 0;
    while (queueIndex < queue.length) {
      const current = queue[queueIndex++];
      const config = macros[current];
      if (typeof config !== "string") {
        for (const name of macroNames) {
          if (!usedNames.has(name) && new RegExp(`\\b${name}\\b`).test(config.template)) {
            usedNames.add(name);
            queue.push(name);
          }
        }
      }
    }
    entries = Object.entries(macros).filter(([name]) => usedNames.has(name));
  }
  if (entries.length === 0) return "";
  return (
    entries
      .map(([name, config]) => {
        // String value: import the named macro from a custom_templates file.
        if (typeof config === "string") {
          return `{% from '${config}' import ${name} %}`;
        }
        const params = (config.params ?? []).map(renderParam).join(", ");
        if (config.returns) {
          // Follow HA's as_function convention: define the macro as macro_<name>
          // with `returns` as the last parameter (injected by as_function), then
          // expose it as <name> via the as_function filter so it can be called
          // as a regular function.
          const returnsParams = [
            ...(config.params ?? []).map(renderParam),
            "returns",
          ].join(", ");
          return (
            `{% macro macro_${name}(${returnsParams}) %}${config.template}{% endmacro %}\n` +
            `{% set ${name} = macro_${name} | as_function %}`
          );
        }
        return `{% macro ${name}(${params}) %}${config.template}{% endmacro %}`;
      })
      .join("\n") + "\n"
  );
}

export async function apply_uix_compatible(
  element: ModdedElement,
  type: string,
  uix_config: UixStyle | UixConfig = undefined, // or styles
  variables = {},
  shadow = true, // or deprecated
  cls = undefined // or shadow
) {
  // TODO: Remove ????
  // This is for backwards compatibility with Card mod version 3.3 and earlier.

  // Wrapper for backwards compatibility (with deprecation warning)
  // Old signature:
  //   el: Node
  //   type: string
  //   styles: CardModStyle = ""
  //   variables: object = {}
  //   _: any = null
  //   shadow: boolean = true
  //
  // New signature
  //   el: Node
  //   type: string
  //   cm_config: CardModConfig
  //   variables: object = {}
  //   shadow: boolean = true
  //   cls: str = undefined

  let oldStyle = false;
  if (cls !== undefined) {
    if (typeof cls !== "string") {
      // Old style call
      oldStyle = true;
      shadow = cls;
      cls = undefined;
    }
  }
  if (typeof shadow !== "boolean") {
    // Old style call
    shadow = true;
    oldStyle = true;
  }
  if (typeof uix_config === "string") {
    // Old style call with string styles
    uix_config = { style: uix_config };
    oldStyle = true;
  }
  if (
    uix_config &&
    Object.keys(uix_config).length !== 0 &&
    (uix_config?.style ?? uix_config?.class ?? uix_config?.debug ?? uix_config?.macros) === undefined
  ) {
    // Old style call with object styles
    uix_config = { style: uix_config as UixStyle };
    oldStyle = true;
  }

  if (oldStyle && !(window as any).uix_compatibility_warning) {
    (window as any).uix_compatibility_warning = true;
    console.groupCollapsed("UIX warning");
    console.info(
      "You are using a custom card which relies on UIX, and uses an outdated signature for applyToElement."
    );
    console.info(
      "The outdated signature will be removed at some point in the future. Hopefully the developer of your card will have updated their card by then."
    );
    console.info("The card used UIX to apply styles here:", element);
    console.groupEnd();
  }

  return apply_uix(element, type, uix_config, variables, shadow, cls);
}

export async function apply_uix(
  element: ModdedElement,
  type: string,
  uix_config: UixConfig = undefined,
  variables = {},
  shadow: boolean = true,
  cls = undefined
) {
  const debug = uix_config?.debug
    ? (...msg) => console.log("UIX Debug:", ...msg)
    : (...msg) => {};

  debug(
    "Applying UIX to:",
    ...((element as any)?.host
      ? ["#shadow-root of:", (element as any)?.host]
      : [element]),
    "type: ",
    type,
    "configuration: ",
    uix_config
  );

  if (!element) return;

  // Wait for target element to exist
  if (element.localName?.includes("-"))
    await customElements.whenDefined(element.localName);

  element._uix = element._uix || [];

  // Await uix-node element definition
  if (!customElements.get("uix-node")) {
    debug("Waiting for uix-node customElement to be defined");
    await customElements.whenDefined("uix-node");
  }

  // Find any existing uix-node elements of the right type
  const uix: Uix =
    element._uix.find((uix) => uix.type === type) ??
    document.createElement("uix-node") as Uix;

  debug("Applying UIX in:", uix);

  uix.type = type;
  uix.uix_class = cls;
  uix.debug = uix_config?.debug ?? false;
  uix.cancelStyleChild();

  if (!element._uix.includes(uix)) element._uix.push(uix);

  window.setTimeout(async () => {
    await Promise.all([element.updateComplete]);

    const target =
      element.modElement ?? shadow ? element.shadowRoot ?? element : element;

    if (!target.contains(uix as any)) {
      // Prepend if set or if Lit is in a buggy state
      const litWorkaround = (element as any)?.renderOptions?.renderBefore === null;
      if (litWorkaround) debug("Lit prepend workaround applied for:", element);
      if (uix_config?.prepend || litWorkaround) {
        target.prepend(uix as any);
      } else {
        target.appendChild(uix as any);
      }
    }

    uix.variables = variables;
    uix.macros = uix_config?.macros ?? {};
    uix.styles = uix_config?.style ?? "";
  }, 1);

  uix.classes =
    typeof uix_config?.class == "string"
      ? uix_config?.class?.split?.(" ")
      : [...(uix_config?.class ?? [])];
  cls && uix.classes.push(cls);
  element.classList?.add(...uix.classes);

  return uix;
}
