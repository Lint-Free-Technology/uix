import { LitElement } from "lit";
import { ModdedElement } from "../helpers/apply_uix";
import { patch_element } from "../helpers/patch_function";
import { nextAnimationFrame, UIX_PATCH_DEBOUNCE_MS } from "../helpers/raf";
import { Uix } from "../uix";

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

const subscribeIconVars = (el, iconVars: { iconVar: string; iconColorVar: string }) => {
  // Subscription happens when updating so clear any debounced updates
  if (el._uixIconForEntityDebounce) {
    clearTimeout(el._uixIconForEntityDebounce);
    el._uixIconForEntityDebounce = undefined;
  }
  if (el._uixIconVars?.iconVar === iconVars.iconVar && el._uixIconVars?.iconColorVar === iconVars.iconColorVar) return;
  const uixCoordinator = (window as any)?.uixCoordinator;
  if (!uixCoordinator) return;
  if (!uixCoordinator._registerIconForEntityCallback || !uixCoordinator._unregisterIconForEntityCallback) return;
  if (el._uixIconVars?.iconVar) {
    uixCoordinator._unregisterIconForEntityCallback(el, el._uixIconVars.iconVar);
  }
  if (el._uixIconVars?.iconColorVar) {
    uixCoordinator._unregisterIconForEntityCallback(el, el._uixIconVars.iconColorVar);
  }
  el._uixIconVars = iconVars;
  uixCoordinator._registerIconForEntityCallback(el, iconVars.iconVar, () => updateIconDebounced(el));
  uixCoordinator._registerIconForEntityCallback(el, iconVars.iconColorVar, () => updateIconDebounced(el));
};

const updateIconDebounced = (el) => {
  if ((window as any).uixCoordinator?.disableIconStyling) return;
  if (!el.isConnected) return;
  if (el._uixIconForEntityDebounce) return;
  el._uixIconForEntityDebounce = setTimeout(() => {
    el._uixIconForEntityDebounce = undefined;
    el._uixIconPending = true;
    try {
      updateIcon(el);
    } finally {
      el._uixIconPending = false;
    }
  }, UIX_PATCH_DEBOUNCE_MS);
};

const updateIcon = (el) => {
  if ((window as any).uixCoordinator?.disableIconStyling) return;
  if (!el.isConnected) return;
  const styles = window.getComputedStyle(el);

  let icon = styles.getPropertyValue("--uix-icon").trim() || styles.getPropertyValue("--card-mod-icon").trim();
  let color = styles.getPropertyValue("--uix-icon-color").trim() || styles.getPropertyValue("--card-mod-icon-color").trim();
  if (!icon || !color) {
    const entityId = getEntityId(el);
    if (entityId) {
      const slug = entityId.replace(/\./g, "_");
      const iconVar = `--uix-icon-for-${slug}`;
      const iconColorVar = `--uix-icon-color-for-${slug}`;
      if (!icon) {
        icon = styles.getPropertyValue(iconVar).trim();
      }
      if (!color) {
        color = styles.getPropertyValue(iconColorVar).trim();
      }
      if (icon || color) {
        subscribeIconVars(el, { iconVar, iconColorVar });
      }
    }
  }
  if (icon && "icon" in el) {
    el.icon = icon;
  } else if (icon && el.tagName.toLowerCase() === "ha-svg-icon" && haIconAvailable) {
    const iconEl: LitElement = el.querySelector("ha-icon") || document.createElement("ha-icon") as LitElement;
    if (!el.contains(iconEl)) {
      iconEl.style.display = "none";
      el.appendChild(iconEl);
    }
    (iconEl as any).icon = icon;
    iconEl.updateComplete.then(() => {
      el.path = (iconEl as any)._path;
      el.secondaryPath = (iconEl as any)._secondaryPath;
    });
  }

  if (color) el.style.color = color;

  const filter = styles.getPropertyValue("--uix-icon-dim") || styles.getPropertyValue("--card-mod-icon-dim");
  if (filter === "none") el.style.filter = "none";
};

const bindUix = async (el) => {
  // Coalesce: if a bindUix run is already in progress for this element, skip
  if (el._bindUixPending) return;
  el._bindUixPending = true;
  try {
    // Wait for next animation frame before computing styles: batches reflow reads
    await nextAnimationFrame();

    // Find the most relevant uix-nodes in order to listen to change events so we can react quickly

    updateIcon(el);
    el._boundUix = el._boundUix ?? new Set();
    const newUix = await findParentUix(el);

    for (const uix of newUix) {
      if (el._boundUix.has(uix)) continue;

      uix.addEventListener("uix-styles-update", async () => {
        // Coalesce rapid style-update events to a single update per frame
        if (el._uixIconPending) return;
        el._uixIconPending = true;
        try {
          await uix.updateComplete;
          await nextAnimationFrame();
          updateIcon(el);
        } finally {
          el._uixIconPending = false;
        }
      });
      el._boundUix.add(uix);
    }
  } finally {
    el._bindUixPending = false;
  }

  // Find uix elements created later, increased interval
  if (el.uix_retries < 5) {
    el.uix_retries++;
    window.setTimeout(() => bindUix(el), 250 * el.uix_retries);
  }
};

@patch_element("ha-state-icon")
class HaStateIconPatch extends ModdedElement {
  uix_retries;
  _bindUixDebounce: ReturnType<typeof setTimeout> | undefined;
  updated(_orig, ...args) {
    _orig?.(...args);
    if ((window as any).uixCoordinator?.disableIconStyling) return;
    this.uix_retries = 0;
    clearTimeout(this._bindUixDebounce);
    this._bindUixDebounce = setTimeout(() => bindUix(this), UIX_PATCH_DEBOUNCE_MS);
  }
}

@patch_element("ha-icon")
class HaIconPatch extends ModdedElement {
  uix_retries;
  _bindUixDebounce: ReturnType<typeof setTimeout> | undefined;
  updated(_orig, ...args) {
    _orig?.(...args);
    if ((window as any).uixCoordinator?.disableIconStyling) return;
    if ((this.parentNode as any)?.host?.localName === "ha-state-icon") return;
    this.uix_retries = 0;
    clearTimeout(this._bindUixDebounce);
    this._bindUixDebounce = setTimeout(() => bindUix(this), UIX_PATCH_DEBOUNCE_MS);
  }
}

@patch_element("ha-svg-icon")
class HaSvgIconPatch extends ModdedElement {
  uix_retries;
  _bindUixDebounce: ReturnType<typeof setTimeout> | undefined;
  updated(_orig, ...args) {
    _orig?.(...args);
    if ((window as any).uixCoordinator?.disableIconStyling) return;
    if ((this.parentNode as any)?.host?.localName === "ha-icon") return;
    this.uix_retries = 0;
    clearTimeout(this._bindUixDebounce);
    this._bindUixDebounce = setTimeout(() => bindUix(this), UIX_PATCH_DEBOUNCE_MS);
  }
}

function joinSet(dst: Set<any>, src: Set<any>) {
  for (const s of src) dst.add(s);
}

async function findParentUix(node: any, step = 0): Promise<Set<Uix>> {
  let uixElements: Set<Uix> = new Set();
  if (step == 10) return uixElements;
  if (!node) return uixElements;

  if (node.updateComplete) await node.updateComplete;

  if (node._uix) {
    for (const uix of node._uix) {
      if (uix.styles) uixElements.add(uix);
    }
  }

  if (node.parentElement)
    joinSet(uixElements, await findParentUix(node.parentElement, step + 1));
  else if (node.parentNode)
    joinSet(uixElements, await findParentUix(node.parentNode, step + 1));
  if ((node as any).host)
    joinSet(uixElements, await findParentUix((node as any).host, step + 1));
  return uixElements;
}

window.addEventListener("uix-bootstrap", () => {
  window.customElements.whenDefined("ha-icon").then(() => {
    haIconAvailable = true;
  });
});