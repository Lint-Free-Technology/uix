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

let haIconAvailable = false;

const updateIcon = (el) => {
  const styles = window.getComputedStyle(el);

  const icon = styles.getPropertyValue("--uix-icon") || styles.getPropertyValue("--card-mod-icon");
  if (icon && el.icon !== undefined) {
    el.icon = icon.trim();
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

  const color = styles.getPropertyValue("--uix-icon-color") || styles.getPropertyValue("--card-mod-icon-color");
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
        if (el._updateIconPending) return;
        el._updateIconPending = true;
        try {
          await uix.updateComplete;
          await nextAnimationFrame();
          updateIcon(el);
        } finally {
          el._updateIconPending = false;
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
  uix_retries = 0;
  _bindUixDebounce: ReturnType<typeof setTimeout> | undefined = undefined;
  updated(_orig, ...args) {
    _orig?.(...args);
    this.uix_retries = 0;
    clearTimeout(this._bindUixDebounce);
    this._bindUixDebounce = setTimeout(() => bindUix(this), UIX_PATCH_DEBOUNCE_MS);
  }
}

@patch_element("ha-icon")
class HaIconPatch extends ModdedElement {
  uix_retries = 0;
  _bindUixDebounce: ReturnType<typeof setTimeout> | undefined = undefined;
  updated(_orig, ...args) {
    _orig?.(...args);
    this.uix_retries = 0;
    clearTimeout(this._bindUixDebounce);
    this._bindUixDebounce = setTimeout(() => bindUix(this), UIX_PATCH_DEBOUNCE_MS);
  }
}

@patch_element("ha-svg-icon")
class HaSvgIconPatch extends ModdedElement {
  uix_retries = 0;
  _bindUixDebounce: ReturnType<typeof setTimeout> | undefined = undefined;
  updated(_orig, ...args) {
    _orig?.(...args);
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