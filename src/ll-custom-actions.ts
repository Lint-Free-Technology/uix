import { hass_base_el } from "./helpers/hass";

// Add a listener to execute UIX custom actions via the Home Assistant `fire-dom-event` / `ll-custom` action
window.addEventListener("uix-bootstrap", async (ev: Event) => {
  ev.stopPropagation();
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
    if (actionName && typeof actionName === "string" && typeof Actions[actionName] === "function") {
      try {
        const data = (uix as any).data ?? {};
        const result = (Actions as any)[actionName](data);
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
    const eventDetail = data ?? {};
    const event = new CustomEvent(eventName, {
      detail: eventDetail,
      bubbles: true,
      composed: true,
    });
    base.dispatchEvent(event);
  }
  static async toast(data: Record<string, any>) {
    const dataExtensible = data ? { ...data } : {};
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
    }
    if (dataExtensible.action) {
      const tapAction = dataExtensible.action.tap_action ? { ...dataExtensible.action.tap_action } : {}; 
      dataExtensible.action = {
        ...dataExtensible.action,
        action: () => {
          _triggerHassAction(
            tapAction, 
            base as HTMLElement
          ) 
        },
      };
      delete dataExtensible.action.tap_action;
    }
    const event = new CustomEvent(eventName, {
      detail: dataExtensible,
      bubbles: true,
      composed: true,
    });
    base.dispatchEvent(event);
  }
}