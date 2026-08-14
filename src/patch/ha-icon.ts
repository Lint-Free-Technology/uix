import { LitElement } from "lit";
import { ModdedElement } from "../helpers/apply_uix";
import { patch_element } from "../helpers/patch_function";
import { nextAnimationFrame, UIX_PATCH_DEBOUNCE_MS } from "../helpers/raf";
import { StyleWatcher } from "../helpers/style_watcher";

/*
Patch various icon elements to consider the following variables:
--uix-icon
--uix-icon-color
--uix-icon-dim
*/

/*
Patch icon elements to consider the following variable:
--uix-icon-for-<entity_id_with_dots_as_underscores>

e.g. to override the icon for light.bed_light:
  --uix-icon-for-light_bed_light: mdi:globe-light-outline

If the element is for that entity, the replacement will take place.
If not, it is ignored.

Supported elements:
- ha-tile-icon
- ha-state-icon
- ha-icon
- state-badge
*/

const getEntityId = (el: any): string | null => {
  const tag = el.tagName.toLowerCase();
  switch (tag) {
    case "ha-tile-icon":
      // Entity ID is on ha-tile-card
      const parentCard = el.closest("ha-card")?.parentNode?.host;
      return parentCard?._config?.entity || null;
    case "ha-state-icon":
      return el.stateObj?.entity_id || null;
    case "state-badge":
      return el.stateObj?.entity_id || null;
    case "ha-icon":
      // Entity ID may be on stateObj of host
      const host = el.parentNode?.host;
      return host?.stateObj?.entity_id || null;
    default:
      return null;
  }
};

let haIconAvailable = false;

const updateIcon = (el) => {
  const styles = window.getComputedStyle(el);

  let icon = styles.getPropertyValue("--uix-icon").trim() || styles.getPropertyValue("--card-mod-icon").trim();
  let color = styles.getPropertyValue("--uix-icon-color").trim() || styles.getPropertyValue("--card-mod-icon-color").trim();
  if (!icon || !color) {
    const entityId = getEntityId(el);
    if (!icon && entityId) {
      const slug = entityId.replace(/\./g, "_");
      icon = styles.getPropertyValue(`--uix-icon-for-${slug}`).trim();
    }
    if (!color && entityId) {
      const slug = entityId.replace(/\./g, "_");
      color = styles.getPropertyValue(`--uix-icon-color-for-${slug}`).trim();
    }
  }

  if ("icon" in el) {
    if (icon) {
      if (el.icon !== el._uixIconLastOverriddenIcon) {
        el._uixIconOriginalIcon = el.icon;
      }
      el.icon = icon;
      el._uixIconLastOverriddenIcon = icon;
    } else {
      if (el._uixIconOriginalIcon !== undefined) {
        el.icon = el._uixIconOriginalIcon;
        delete el._uixIconOriginalIcon;
      }
      delete el._uixIconLastOverriddenIcon;
    }
  } else if (el.tagName.toLowerCase() === "ha-svg-icon") {
    if (icon && haIconAvailable) {
      const iconEl: LitElement = el.querySelector("ha-icon") || document.createElement("ha-icon") as LitElement;
      if (!el.contains(iconEl)) {
        iconEl.style.display = "none";
        el.appendChild(iconEl);
      }
      (iconEl as any).icon = icon;
      const token = (el._uixIconSvgToken = (el._uixIconSvgToken ?? 0) + 1);
      if (el.path !== el._uixIconLastOverriddenPath || el.secondaryPath !== el._uixIconLastOverriddenSecondaryPath) {
        el._uixIconOriginalPath = el.path;
        el._uixIconOriginalSecondaryPath = el.secondaryPath;
      }
      iconEl.updateComplete.then(() => {
        if (el._uixIconSvgToken !== token) return;
        const newPath = (iconEl as any)._path;
        const newSecPath = (iconEl as any)._secondaryPath;
        el.path = newPath;
        el.secondaryPath = newSecPath;
        el._uixIconLastOverriddenPath = newPath;
        el._uixIconLastOverriddenSecondaryPath = newSecPath;
      });
    } else {
      // Invalidate any pending updateComplete handler from a previous override.
      el._uixIconSvgToken = (el._uixIconSvgToken ?? 0) + 1;
      if (el._uixIconOriginalPath !== undefined) {
        el.path = el._uixIconOriginalPath;
        el.secondaryPath = el._uixIconOriginalSecondaryPath;
        delete el._uixIconOriginalPath;
        delete el._uixIconOriginalSecondaryPath;
      }
      delete el._uixIconLastOverriddenPath;
      delete el._uixIconLastOverriddenSecondaryPath;
    }
  }

  if (color) el.style.color = color;

  const filter = styles.getPropertyValue("--uix-icon-dim") || styles.getPropertyValue("--card-mod-icon-dim");
  if (filter === "none") el.style.filter = "none";
};

const bindUix = async (el) => {
  // Coalesce: if a bindUix run is already in progress for this element, skip
  if (el._uixIconBindPending) return;
  el._uixIconBindPending = true;
  try {
    // Wait for next animation frame before computing styles: batches reflow reads
    await nextAnimationFrame();

    const entityId = getEntityId(el);
    const properties = [
      "--uix-icon",
      "--card-mod-icon",
      "--uix-icon-color",
      "--card-mod-icon-color",
      "--uix-icon-dim",
      "--card-mod-icon-dim"
    ];
    if (entityId) {
      const slug = entityId.replace(/\./g, "_");
      properties.push(`--uix-icon-for-${slug}`);
      properties.push(`--uix-icon-color-for-${slug}`);
    }

    if (el._uixIconStyleWatcher && JSON.stringify(el._uixIconStyleWatcher.properties) !== JSON.stringify(properties)) {
      el._uixIconStyleWatcher.destroy();
      el._uixIconStyleWatcher = undefined;
    }

    if (!el._uixIconStyleWatcher) {
      el._uixIconStyleWatcher = new StyleWatcher(el, properties, () => {
        if (el._uixIconUpdatePending) return;
        el._uixIconUpdatePending = true;
        nextAnimationFrame().then(() => {
          updateIcon(el);
          el._uixIconUpdatePending = false;
        });
      });
    }
  } finally {
    el._uixIconBindPending = false;
  }
};

@patch_element("ha-state-icon")
class HaStateIconPatch extends ModdedElement {
  _uixIconBindDebounce: ReturnType<typeof setTimeout> | undefined = undefined;
  updated(_orig, ...args) {
    _orig?.(...args);
    clearTimeout(this._uixIconBindDebounce);
    this._uixIconBindDebounce = setTimeout(() => bindUix(this), UIX_PATCH_DEBOUNCE_MS);
  }
}

@patch_element("ha-icon")
class HaIconPatch extends ModdedElement {
  _uixIconBindDebounce: ReturnType<typeof setTimeout> | undefined = undefined;
  updated(_orig, ...args) {
    _orig?.(...args);
    if ((this.parentNode as any)?.host?.localName === "ha-state-icon") return;
    clearTimeout(this._uixIconBindDebounce);
    this._uixIconBindDebounce = setTimeout(() => bindUix(this), UIX_PATCH_DEBOUNCE_MS);
  }
}

@patch_element("ha-svg-icon")
class HaSvgIconPatch extends ModdedElement {
  _uixIconBindDebounce: ReturnType<typeof setTimeout> | undefined = undefined;
  updated(_orig, ...args) {
    _orig?.(...args);
    if ((this.parentNode as any)?.host?.localName === "ha-icon") return;
    clearTimeout(this._uixIconBindDebounce);
    this._uixIconBindDebounce = setTimeout(() => bindUix(this), UIX_PATCH_DEBOUNCE_MS);
  }
}

window.addEventListener("uix-bootstrap", () => {
  window.customElements.whenDefined("ha-icon").then(() => {
    haIconAvailable = true;
  });
});