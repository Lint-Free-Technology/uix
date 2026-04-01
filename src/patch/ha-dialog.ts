import { apply_uix, ModdedElement } from "../helpers/apply_uix";
import { compare_deep } from "../helpers/dict_functions";
import {
  is_patched,
  patch_prototype,
  set_patched,
} from "../helpers/patch_function";


const dialogParams = [];
const toastParams = [];

export function stripHtmlAndFunctions(value: any, seen = new WeakSet()): any {
  if (value == null) return value;
  const t = typeof value;

  // Strip functions
  if (t === "function") return undefined;

  // Strip HTMLElements / Elements (handles different environments)
  if (
    (typeof HTMLElement !== "undefined" && value instanceof HTMLElement) ||
    (typeof Element !== "undefined" && value instanceof Element)
  ) {
    return undefined;
  }

  // Primitives remain
  if (t !== "object") return value;

  // Prevent infinite recursion on circular refs
  if (seen.has(value)) return value;
  seen.add(value);

  // Arrays: sanitize elements and remove stripped ones
  if (Array.isArray(value)) {
    const arr = value
      .map((v) => stripHtmlAndFunctions(v, seen))
      .filter((v) => v !== undefined);
    return arr;
  }

  // Objects: sanitize each property
  const out: Record<string, any> = {};
  for (const [k, v] of Object.entries(value)) {
    const cleaned = stripHtmlAndFunctions(v, seen);
    if (cleaned !== undefined) out[k] = cleaned;
  }
  return out;
}

class HaDialogPatch extends ModdedElement {
  async updated(_orig, args) {
    await _orig?.(args);

    this.updateComplete.then(async () => {
      let haDialog: HTMLElement | null =
        this.shadowRoot.querySelector("ha-dialog");
      if (!haDialog) {
        haDialog = this.shadowRoot.querySelector("ha-adaptive-dialog");
      }
      if (!haDialog) {
        haDialog = this.shadowRoot.querySelector("ha-toast");
      }
      if (!haDialog) {
        haDialog = this.shadowRoot.querySelector("ha-wa-dialog");
      }
      if (!haDialog) {
        haDialog = this.shadowRoot.querySelector("ha-md-dialog");
      }
      if (!haDialog) {
        // Notification 'dialog' is ha-drawer
        haDialog = this.shadowRoot.querySelector("ha-drawer");
      }
      if (!haDialog) return;

      const cls = `type-${this.localName.replace?.("ha-", "")}`;
      apply_uix(
        haDialog as ModdedElement,
        "dialog",
        undefined,
        { params: dialogParams[this.localName] ?? {} },
        false,
        cls
      );
    });
  }
}

function patchDialog(ev: Event) {
  const dialogTag = (ev as CustomEvent).detail?.dialogTag;

  // Home Assistant dialog manager reuses the same dialog element for dialogs of same tag
  // so we can store params to use when patching
  const params = (ev as CustomEvent).detail?.dialogParams;
  if (params) {
    dialogParams[dialogTag] = stripHtmlAndFunctions(params);
  }

  if (dialogTag && !is_patched(dialogTag)) {
    set_patched(dialogTag);
    patch_prototype(dialogTag, HaDialogPatch);
  }
}

class HaNotificationPatch extends ModdedElement {
  async updated(_orig, args) {
    await _orig?.(args);

    this.updateComplete.then(async () => {
      const haToast: HTMLElement | null =
        this.shadowRoot.querySelector("ha-toast");
      if (!haToast) return;

      const toastUix = (haToast as ModdedElement)._uix?.[0];

      if (toastUix && !compare_deep(toastUix.variables, { params: toastParams[this.localName] ?? {} })) {
        // If the toast already has a uix instance, it means it's being reused for a new notification
        // so we need to update self and child instance variables
        for (const key in toastUix.uix_children) {
          (await toastUix.uix_children[key])?.forEach(
            async (ch) => await ch.then((uix) => {
              uix.variables = { params: toastParams[this.localName] ?? {} };
              uix.styles = uix._fixed_styles;
            }).catch(() => {})
          );
        }
        toastUix.variables = { params: toastParams[this.localName] ?? {} };
        toastUix.styles = toastUix._fixed_styles;
        return;
      }

      const cls = `type-${this.localName.replace?.("ha-", "")}`;
      apply_uix(
        haToast as ModdedElement,
        "toast",
        undefined,
        { params: toastParams[this.localName] ?? {} },
        false,
        cls
      );
    });
  }
}

function patchNotification(ev: Event) {
  const notificationTag = "notification-manager";
  const params = (ev as CustomEvent).detail;
  if (params) {
    toastParams[notificationTag] = stripHtmlAndFunctions(params);
  }

  if (notificationTag && !is_patched(notificationTag)) {
    set_patched(notificationTag);
    patch_prototype(notificationTag, HaNotificationPatch);
  }
}

window.addEventListener("show-dialog", patchDialog, { capture: true });
window.addEventListener("hass-notification", patchNotification, { capture: true });
