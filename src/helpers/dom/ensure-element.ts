import { Unpromise } from "@watchable/unpromise";
import { hass_base_el } from "../hass";

const DEFAULT_TIMEOUT_MS = 2000;

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
