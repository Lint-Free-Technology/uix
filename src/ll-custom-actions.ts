import { hass, hass_base_el, provideHass } from "./helpers/hass";
import { apply_uix, ModdedElement, UixConfig } from "./helpers/apply_uix";
import { ensureCustomElement } from "./helpers/dom/ensure-element";
import { actionHandlerBind } from "./helpers/dom/action-handler";
import { createHaButton, dispatchHaButtonAction, UixButtonConfig } from "./helpers/dom/ha-button";
import {
  createLockRetryState,
  LockRetryState,
  requestLockAccess,
} from "./helpers/lock-access";

const lockedActionRetryStates = new Map<string, LockRetryState>();
const fallbackLockedActionRetryStates = new WeakMap<EventTarget, Map<string, LockRetryState>>();
const hassActionAnchors = new WeakMap<object, HTMLElement>();

function captureHassActionAnchor(event: Event) {
  const detail = (event as CustomEvent).detail;
  if (!detail || typeof detail !== "object") return;

  const config = (detail as any).config;
  const action = (detail as any).action;
  if (!config || typeof config !== "object" || typeof action !== "string") return;

  const actionConfig = config[`${action}_action`] ?? (config.action ? config : undefined);
  if (!actionConfig || typeof actionConfig !== "object" || actionConfig.action !== "fire-dom-event") {
    return;
  }

  const uix = actionConfig.uix ?? actionConfig.card_mod;
  if (!uix || typeof uix !== "object") return;

  const anchor = event.composedPath().find((target) => target instanceof HTMLElement);
  if (anchor instanceof HTMLElement) {
    // Home Assistant will subsequently dispatch `ll-custom`, sometimes from
    // window. Preserve the originating element without mutating the card
    // configuration, which Home Assistant may freeze.
    hassActionAnchors.set(uix, anchor);
  }
}

function createPopoverButton(
  config: Record<string, any>,
  defaults: Pick<UixButtonConfig, "variant" | "appearance">,
  slot: "primaryAction" | "secondaryAction",
  closePopover?: () => void,
) {
  const buttonConfig: UixButtonConfig = {
    ...config,
    variant: config.variant ?? defaults.variant,
    appearance: config.appearance ?? defaults.appearance,
  };
  let button: HTMLElement;
  button = createHaButton(buttonConfig, (event) => {
    dispatchHaButtonAction(button, buttonConfig, event);
  });
  button.slot = slot;

  isolatePopoverButton(button, closePopover);
  return button;
}

function createPopoverIconButton(config: Record<string, any>) {
  const buttonConfig: UixButtonConfig = { ...config };
  const button = document.createElement("ha-icon-button") as HTMLElement & { label?: string };
  const label = config.label || config.icon;
  button.slot = "headerActionItems";
  button.label = label;
  button.setAttribute("aria-label", label);
  if (config.color) button.style.color = config.color;

  const icon = document.createElement("ha-icon") as HTMLElement & { icon?: string };
  icon.icon = config.icon;
  button.append(icon);

  const hasTap = !!(buttonConfig.tap_action && buttonConfig.tap_action.action !== "none");
  const hasHold = !!(buttonConfig.hold_action && buttonConfig.hold_action.action !== "none");
  const hasDoubleClick = !!(
    buttonConfig.double_tap_action && buttonConfig.double_tap_action.action !== "none"
  );
  if (hasTap || hasHold || hasDoubleClick) {
    actionHandlerBind(button, { hasHold, hasDoubleClick });
  }
  button.addEventListener("action", (event) => {
    dispatchHaButtonAction(button, buttonConfig, event as CustomEvent);
  });

  isolatePopoverButton(button);
  return button;
}

function isolatePopoverButton(button: HTMLElement, closePopover?: () => void) {
  // A footer button must not also trigger the action configured on its source card.
  const stopPropagation = (event: Event) => event.stopPropagation();
  button.addEventListener("pointerdown", stopPropagation, { passive: true });
  button.addEventListener("click", (event) => {
    event.stopPropagation();
    closePopover?.();
  });
}

const lockedActionState = (source: EventTarget, data: Record<string, any>): LockRetryState => {
  const hasId = data.id != null && data.id !== "";
  const id = hasId
    ? String(data.id)
    : JSON.stringify({
      locks: data.locks,
      permissive: data.permissive,
      code_dialog: data.code_dialog,
      locked_action: data.locked_action,
    });
  if (hasId) {
    let state = lockedActionRetryStates.get(id);
    if (!state) {
      state = createLockRetryState();
      lockedActionRetryStates.set(id, state);
    }
    return state;
  }

  let states = fallbackLockedActionRetryStates.get(source);
  if (!states) {
    states = new Map();
    fallbackLockedActionRetryStates.set(source, states);
  }
  // The fallback keeps ordinary static actions stable for as long as their
  // source control is retained. An explicit id survives control recreation.
  let state = states.get(id);
  if (!state) {
    state = createLockRetryState();
    states.set(id, state);
  }
  return state;
};

// Add a listener to execute UIX custom actions via the Home Assistant `fire-dom-event` / `ll-custom` action
window.addEventListener("uix-bootstrap", async (ev: Event) => {
  ev.stopPropagation();
  document.addEventListener("hass-action", captureHassActionAnchor, { capture: true });
  document.addEventListener("ll-custom", (event: Event) => {
    const detail = (event as CustomEvent).detail;
    if (!detail || typeof detail !== "object") {
      return;
    }
    const uix = (detail as any).uix ?? (detail as any).card_mod;
    if (!uix || typeof uix !== "object") {
      return;
    }
    const actionName = (uix as any).action;
    if (actionName && typeof actionName === "string" && typeof actionList[actionName] === "function") {
      try {
        const data = (uix as any).data ?? {};
        const capturedAnchor = hassActionAnchors.get(uix);
        hassActionAnchors.delete(uix);
        const source = (capturedAnchor
          ?? event.composedPath().find((target) => target instanceof HTMLElement)
          ?? event.target) as EventTarget;
        const result = (actionList as any)[actionName](data, uix, source);
        if (result && typeof (result as Promise<unknown>).catch === "function") {
          (result as Promise<unknown>).catch((error: unknown) => {
            console.error(`UIX: Error while executing action "${actionName}":`, error);
          });
        }
      } catch (error) {
        console.error(`UIX: Error while executing action "${actionName}":`, error);
      }
    }
  });
});

export class Actions {
  static event(name: unknown, data: unknown = {}, anchor?: unknown) {
    if (typeof name !== "string" || !name.trim()) {
      console.error("UIX: event action requires a non-empty name:", name);
      return;
    }
    const target = anchor instanceof EventTarget ? anchor : window;
    target.dispatchEvent(new CustomEvent(name, {
      bubbles: true,
      composed: true,
      detail: data,
    }));
  }
  static async clear_cache() {
    if (window.caches) {
      try {
        const cacheNames = await window.caches.keys();
        const deletePromises: Promise<boolean>[] = [];
        cacheNames.forEach((cacheName) => {
          deletePromises.push(window.caches.delete(cacheName));
        });
        await Promise.all(deletePromises);
        window.location.reload();
      } catch (error) {
        console.error("UIX: Failed to clear caches:", error);
        // Fallback: force a full reload even if cache clearing fails
        window.location.reload();
      }
    } else {
      window.location.reload();
    }
  }
  static async more_info(data: Record<string, any>) {
    const base = await hass_base_el();
    const eventName = "hass-more-info";
    const eventDetail = { ...data };
    eventDetail.entityId =  eventDetail.entity ?? eventDetail.entity_id ?? eventDetail.entityId ?? undefined;
    delete eventDetail.entity;
    delete eventDetail.entity_id;
    const event = new CustomEvent(eventName, {
      detail: eventDetail,
      bubbles: true,
      composed: true,
    });
    base.dispatchEvent(event);
  }
  static async toast(data: Record<string, any>) {
    const dataExtensible = { ...data };
    const base = await hass_base_el();
    const eventName = "hass-notification";
    const _triggerHassAction = (action: Record<string, any>, source: HTMLElement) => {
      const config: Record<string, any> = {};
      config.tap_action = { ...action };
      source.dispatchEvent(
        new CustomEvent("hass-action", {
          bubbles: true,
          composed: true,
          detail: { config, action: "tap" },
        })
      );
    };
    if (dataExtensible.action && typeof dataExtensible.action === "object") {
      const tapAction = dataExtensible.action.tap_action ? { ...dataExtensible.action.tap_action } : {};
      dataExtensible.action = {
        ...dataExtensible.action,
        action: () => {
          _triggerHassAction(tapAction, base as HTMLElement);
        },
      };
      delete dataExtensible.action.tap_action;
    }
    if (dataExtensible.secondary_action && typeof dataExtensible.secondary_action === "object") {
      dataExtensible.secondaryAction = { ...dataExtensible.secondary_action };
      delete dataExtensible.secondary_action;
      const secondaryAction = dataExtensible.secondaryAction.tap_action ? { ...dataExtensible.secondaryAction.tap_action } : {};
      dataExtensible.secondaryAction = {
        ...dataExtensible.secondaryAction,
        action: () => {
          _triggerHassAction(secondaryAction, base as HTMLElement);
        },
      };
      delete dataExtensible.secondaryAction.tap_action;
    }
    const event = new CustomEvent(eventName, {
      detail: dataExtensible,
      bubbles: true,
      composed: true,
    });
    base.dispatchEvent(event);
  }
  static async popover(data: Record<string, any>, _uix: Record<string, any>, source: EventTarget) {
    const hasContent = Object.prototype.hasOwnProperty.call(data, "content");
    const hasCard = Object.prototype.hasOwnProperty.call(data, "card");
    const dismissible = data.dismissible ?? data.dismissable ?? true;
    const target = data.target === undefined ? source : data.target;
    if (hasContent && hasCard) {
      console.error("UIX: popover accepts either content or card, not both:", data);
      return;
    }
    if (target !== null && target !== "none" && !(target instanceof Element)) {
      console.error("UIX: popover target must be an Element or none:", target);
      return;
    }
    if (data.width != null && !["small", "large", "full"].includes(data.width)) {
      console.error("UIX: popover width must be small, large, or full:", data.width);
      return;
    }
    if (data.subtitle_position != null && !["above", "below"].includes(data.subtitle_position)) {
      console.error("UIX: popover subtitle_position must be above or below:", data.subtitle_position);
      return;
    }
    if (typeof dismissible !== "boolean") {
      console.error("UIX: popover dismissible must be a boolean:", dismissible);
      return;
    }
    if (!dismissible && data.buttons == null) {
      console.error("UIX: a non-dismissible popover requires footer buttons:", data);
      return;
    }
    if (
      data.style !== undefined &&
      (!data.style || typeof data.style !== "object" || Array.isArray(data.style))
    ) {
      console.error("UIX: popover style must be an object of CSS property names and values:", data.style);
      return;
    }
    if (
      data.uix !== undefined &&
      (!data.uix || typeof data.uix !== "object" || Array.isArray(data.uix))
    ) {
      console.error("UIX: popover uix must be an object:", data.uix);
      return;
    }

    await ensureCustomElement("ha-adaptive-popover");
    const popover: any = document.createElement("ha-adaptive-popover");
    popover.dialogAnchor = target instanceof Element ? target : undefined;
    popover.headerTitle = data.title;
    popover.headerSubtitle = data.subtitle;
    popover.width = data.width ?? "small";
    popover.withoutHeader = data.without_header === true;
    if (data.style) {
      for (const [property, value] of Object.entries(data.style)) {
        if (!property.trim() || (typeof value !== "string" && typeof value !== "number")) {
          console.error("UIX: popover style values must be strings or numbers:", data.style);
          return;
        }
        popover.style.setProperty(property, String(value));
      }
    }
    if (data.subtitle_position != null) {
      popover.setAttribute("header-subtitle-position", data.subtitle_position);
    }
    popover.addEventListener("closed", () => popover.remove(), { once: true });

    if (hasContent) {
      popover.innerHTML = String(data.content ?? "");
    } else if (hasCard) {
      if (!data.card || typeof data.card !== "object" || Array.isArray(data.card)) {
        console.error("UIX: popover card must be a Home Assistant card config object:", data.card);
        return;
      }
      const helpers = await (window as any).loadCardHelpers();
      const card = await helpers.createCardElement(data.card);
      card.classList.add("uix-popover-card");
      await provideHass(card);
      popover.append(card);
    }

    if (data.icons != null) {
      if (!Array.isArray(data.icons)) {
        console.error("UIX: popover icons must be a list:", data.icons);
        return;
      }
      for (const iconConfig of data.icons) {
        if (
          !iconConfig ||
          typeof iconConfig !== "object" ||
          Array.isArray(iconConfig) ||
          typeof iconConfig.icon !== "string" ||
          !iconConfig.icon
        ) {
          console.error("UIX: each popover icon must be a button object with an icon:", iconConfig);
          return;
        }
        popover.append(createPopoverIconButton(iconConfig));
      }
    }

    if (data.buttons != null) {
      if (typeof data.buttons !== "object" || Array.isArray(data.buttons)) {
        console.error("UIX: popover buttons must be an object:", data.buttons);
        return;
      }
      const footer = document.createElement("ha-dialog-footer");
      footer.slot = "footer";
      if (data.buttons.secondary != null) {
        if (typeof data.buttons.secondary !== "object" || Array.isArray(data.buttons.secondary)) {
          console.error("UIX: popover secondary button must be an object:", data.buttons.secondary);
          return;
        }
        footer.append(createPopoverButton(
          data.buttons.secondary,
          { variant: "neutral", appearance: "filled" },
          "secondaryAction",
          () => { popover.open = false; },
        ));
      }
      if (data.buttons.primary != null) {
        if (typeof data.buttons.primary !== "object" || Array.isArray(data.buttons.primary)) {
          console.error("UIX: popover primary button must be an object:", data.buttons.primary);
          return;
        }
        footer.append(createPopoverButton(
          data.buttons.primary,
          { variant: "brand", appearance: "accent" },
          "primaryAction",
          () => { popover.open = false; },
        ));
      }
      if (footer.childElementCount) {
        popover.hideCloseButton = !dismissible;
        popover.preventScrimClose = !dismissible;
        popover.append(footer);
      } else {
        console.error("UIX: popover buttons must include a primary or secondary button:", data.buttons);
        return;
      }
    }

    if (target instanceof Element) {
      target.after(popover);
    } else {
      const base = await hass_base_el();
      if (!base?.shadowRoot) {
        console.error("UIX: popover could not find the Home Assistant shadow root:", data);
        return;
      }
      base.shadowRoot.append(popover);
    }
    if (data.uix) {
      await apply_uix(
        popover as ModdedElement,
        "dialog",
        data.uix as UixConfig,
        { config: data },
        false,
        "type-uix-popover",
      );
    }
    popover.open = true;
  }
  static async javascript(data: Record<string, any>) {
    if (!data || typeof data.code !== "string" || !data.code.trim()) {
      console.error("UIX: Invalid or empty code for javascript action:", data);
      return;
    }
    if (
      data.variables != null &&
      (typeof data.variables !== "object" || Array.isArray(data.variables))
    ) {
      console.error("UIX: Variables must be an object for javascript action:", data.variables);
      return;
    }
    const hs = await hass();
    const code = `
      "use strict";
      ${data.code}
    `;

    let fn: Function;
    try {
      fn = new Function("hass", "variables", code);
    } catch (error) {
      console.error(
        "UIX: Failed to compile javascript action code (CSP may block unsafe-eval):",
        error
      );
      return;
    }

    try {
      fn(hs, data.variables ?? {});
    } catch (error) {
      console.error("UIX: Error while executing javascript action code:", error);
    }
  }
  static async locked_action(data: Record<string, any>, _uix: Record<string, any>, source: EventTarget) {
    if (!data || typeof data !== "object" || !data.locked_action || typeof data.locked_action !== "object") {
      console.error("UIX: locked_action requires a locked_action object:", data);
      return;
    }
    if (!(source instanceof HTMLElement)) {
      console.error("UIX: locked_action could not determine an element to show its dialog:", data);
      return;
    }

    const hs = await hass();
    const allowed = await requestLockAccess({
      config: {
        locks: Array.isArray(data.locks) ? data.locks : [],
        permissive: data.permissive === true,
        code_dialog: data.code_dialog && typeof data.code_dialog === "object" ? data.code_dialog : {},
      },
      user: hs?.user,
      anchor: source,
      retryState: lockedActionState(source, data),
    });
    if (!allowed) return;

    const config: Record<string, any> = {
      tap_action: { ...data.locked_action },
    };
    if (data.entity) config.entity = data.entity;
    source.dispatchEvent(new CustomEvent("hass-action", {
      bubbles: true,
      composed: true,
      detail: { config, action: "tap" },
    }));
  }
}

const actionList: Record<string, Function> = {
  event: (data: unknown, uix: Record<string, any>) => Actions.event(uix.name, data, uix.anchor),
  clear_cache: Actions.clear_cache,
  more_info: Actions.more_info,
  toast: Actions.toast,
  popover: Actions.popover,
  "clear-cache": Actions.clear_cache,
  "more-info": Actions.more_info,
  javascript: Actions.javascript,
  locked_action: Actions.locked_action,
};
