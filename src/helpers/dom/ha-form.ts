export type UixHaFormSchema = Record<string, any>;
export const UIX_HA_FORM_DENSITIES = ["spacious", "reduced", "dense"] as const;
export type UixHaFormDensity = typeof UIX_HA_FORM_DENSITIES[number];

export interface UixHaFormElement extends HTMLElement {
  hass?: any;
  schema: readonly UixHaFormSchema[];
  data: Record<string, any>;
  computeLabel?: (schema: UixHaFormSchema) => string;
  reportValidity?: () => boolean;
}

export type UixHaFormButtonConfig = {
  text?: string;
  icon?: string;
  icon_position?: "start" | "end";
  variant?: "brand" | "neutral" | "danger" | "warning" | "success";
  appearance?: "accent" | "filled" | "outlined" | "plain";
};

/**
 * Create an ha-form using the schema shape Home Assistant uses in its editors.
 * Keeping the setup here makes embedded forms reusable outside Forge sparks.
 */
export function createHaForm(
  hass: any,
  schema: readonly UixHaFormSchema[],
  data: Record<string, any>,
  density: UixHaFormDensity = "spacious",
): UixHaFormElement {
  const form = document.createElement("ha-form") as UixHaFormElement;
  updateHaForm(form, hass, schema, data, density);
  return form;
}

export function updateHaForm(
  form: UixHaFormElement,
  hass: any,
  schema: readonly UixHaFormSchema[],
  data?: Record<string, any>,
  density: UixHaFormDensity = "spacious",
): void {
  form.hass = hass;
  form.schema = schema;
  if (data !== undefined) form.data = data;
  form.computeLabel = (field) => field.label ?? field.name;
  setHaFormDensity(form, density);
}

/** Adjust the ha-form root's field gaps and supported control spacing. */
export function setHaFormDensity(form: UixHaFormElement, density: UixHaFormDensity): void {
  form.setAttribute("data-uix-form-density", density);
  const install = () => {
    const root = form.shadowRoot;
    if (!root || root.querySelector("style[data-uix-form-density]")) return;

    const style = document.createElement("style");
    style.setAttribute("data-uix-form-density", "");
    style.textContent = `
      :host([data-uix-form-density="spacious"]) .root > *:not([own-margin]):not(:last-child) {
        margin-bottom: var(--uix-form-field-gap, 24px);
      }
      :host([data-uix-form-density="reduced"]) .root > *:not([own-margin]):not(:last-child) {
        margin-bottom: var(--uix-form-field-gap, 16px);
      }
      :host([data-uix-form-density="reduced"]) .root {
        --ha-radio-option-control-margin: var(
          --uix-form-radio-option-control-margin,
          var(--ha-space-2) var(--ha-space-2) var(--ha-space-2) var(--ha-space-3)
        );
      }
      :host([data-uix-form-density="dense"]) .root > *:not([own-margin]):not(:last-child) {
        margin-bottom: var(--uix-form-field-gap, 8px);
      }
      :host([data-uix-form-density="dense"]) .root {
        --ha-radio-option-control-margin: var(
          --uix-form-radio-option-control-margin,
          var(--ha-space-1) var(--ha-space-2) var(--ha-space-1) var(--ha-space-3)
        );
      }
    `;
    root.appendChild(style);
  };

  // ha-form renders its own shadow DOM. Install after its first update so this
  // style follows Home Assistant's built-in 24px field-gap rule.
  const updateComplete = (form as any).updateComplete;
  if (updateComplete?.then) void updateComplete.then(install);
  else install();
}

/** Return the configured schema defaults as the initial ha-form data. */
export function haFormDefaultData(schema: readonly UixHaFormSchema[]): Record<string, any> {
  return schema.reduce((data, field) => {
    if (Array.isArray(field.schema)) {
      const nested = haFormDefaultData(field.schema);
      if (field.flatten || !field.name) {
        Object.assign(data, nested);
      } else if (Object.keys(nested).length > 0) {
        data[field.name] = nested;
      }
    } else if (field.name && field.default !== undefined) {
      data[field.name] = field.default;
    }
    return data;
  }, {} as Record<string, any>);
}

/**
 * Retain only values represented by a schema, applying defaults for fields
 * introduced by a schema update. Nested and flattened schema groups mirror
 * Home Assistant's ha-form data shape.
 */
export function haFormDataForSchema(
  schema: readonly UixHaFormSchema[],
  data: Record<string, any>,
): Record<string, any> {
  return schema.reduce((reconciled, field) => {
    if (Array.isArray(field.schema)) {
      const flattened = field.flatten || !field.name;
      const nestedData = flattened
        ? data
        : isRecord(data[field.name])
          ? data[field.name]
          : {};
      const nested = haFormDataForSchema(field.schema, nestedData);
      if (flattened) Object.assign(reconciled, nested);
      else if (Object.keys(nested).length > 0) reconciled[field.name] = nested;
    } else if (field.name) {
      if (Object.prototype.hasOwnProperty.call(data, field.name)) {
        reconciled[field.name] = data[field.name];
      } else if (field.default !== undefined) {
        reconciled[field.name] = field.default;
      }
    }
    return reconciled;
  }, {} as Record<string, any>);
}

/** Create a labelled ha-button with an optional leading or trailing icon. */
export function createHaFormButton(
  config: UixHaFormButtonConfig,
  defaultText: string,
  defaults: Required<Pick<UixHaFormButtonConfig, "variant" | "appearance">>,
): HTMLElement {
  const button = document.createElement("ha-button");
  const text = config.text ?? defaultText;
  const iconPosition = config.icon_position === "end" ? "end" : "start";
  button.setAttribute("variant", config.variant ?? defaults.variant);
  button.setAttribute("appearance", config.appearance ?? defaults.appearance);

  if (config.icon) {
    const icon = document.createElement("ha-icon") as HTMLElement & { icon?: string };
    icon.slot = iconPosition;
    icon.icon = config.icon;
    button.appendChild(icon);
  }

  const label = document.createElement("span");
  label.textContent = text;
  button.appendChild(label);
  return button;
}

/**
 * Dispatch a normal Lovelace tap action, forwarding the current form values
 * into its data. Form values intentionally take precedence over static data.
 */
export function dispatchHaFormAction(
  source: HTMLElement,
  action: Record<string, any> | undefined,
  data: Record<string, any>,
): void {
  if (!action || typeof action !== "object") return;

  source.dispatchEvent(new CustomEvent("hass-action", {
    bubbles: true,
    composed: true,
    detail: {
      config: {
        tap_action: withHaFormActionData(action, data),
      },
      action: "tap",
    },
  }));
}

/**
 * Merge form values into an action without mutating its configured object.
 * UIX fire-dom-event actions receive their values through their nested data:
 * event values become CustomEvent detail, while JavaScript values are exposed
 * through the action's `variables` object.
 */
export function withHaFormActionData(
  action: Record<string, any>,
  data: Record<string, any>,
): Record<string, any> {
  const actionData = isRecord(action.data)
    ? action.data
    : isRecord(action.service_data)
      ? action.service_data
      : {};
  const mergedAction = {
    ...action,
    data: { ...actionData, ...data },
  };
  const uixKey = isRecord(action.uix) ? "uix" : isRecord(action.card_mod) ? "card_mod" : undefined;
  if (action.action !== "fire-dom-event" || !uixKey) return mergedAction;

  const uix = action[uixKey] as Record<string, any>;
  const uixData = isRecord(uix.data) ? uix.data : {};
  if (uix.action === "event") {
    return {
      ...mergedAction,
      [uixKey]: { ...uix, data: { ...uixData, ...data } },
    };
  }
  if (uix.action === "javascript") {
    const variables = isRecord(uixData.variables) ? uixData.variables : {};
    return {
      ...mergedAction,
      [uixKey]: {
        ...uix,
        data: { ...uixData, variables: { ...variables, ...data } },
      },
    };
  }
  return mergedAction;
}

function isRecord(value: unknown): value is Record<string, any> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}
