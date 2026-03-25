import { ModdedElement } from "../helpers/apply_uix";
import { patch_element } from "../helpers/patch_function";
import { Uix } from "../uix";

/*
Patch badge/marker elements to consider the following variable:
--uix-image-for-<entity_id_with_dots_as_underscores>

e.g. to override the background image for person.jim:
  --uix-image-for-person_jim: url('/local/photo.jpg')

If the element is for that entity, the replacement will take place.
If not, it is ignored.

Supported elements:
- ha-entity-marker
- ha-tile-icon
- ha-state-badge
- ha-user-badge
- ha-person-badge
*/

const getEntityId = (el: any): string | null => {
  const tag = el.tagName.toLowerCase();
  switch (tag) {
    case "ha-tile-icon":
      // Entity ID is on ha-tile-card
      const parentCard = el.closest("ha-card")?.parentNode?.host;
      return parentCard?._config?.entity || null;
    case "state-badge":
      return el.stateObj?.entity_id || null;
    case "ha-entity-marker":
      return el.entityId || null;
    case "ha-user-badge":
      return el._personEntityId || null;
    case "ha-person-badge":
      return el.person?.id ? `person.${el.person.id}` : null;
  }
};

const applyImage = (el: any, imageUrl: string): void => {
  const tag = el.tagName.toLowerCase();
  switch (tag) {
    case "ha-tile-icon":
      el.imageUrl = imageUrl;
      break;
    case "state-badge":
      el.overrideImage = imageUrl;
      break;
    case "ha-entity-marker":
      el.entityPicture = imageUrl;
      break;
    case "ha-user-badge":
      el._personPicture = imageUrl;
      break;
    case "ha-person-badge":
      const pictureEl = el.shadowRoot?.querySelector(".picture");
      if (pictureEl) {
        pictureEl.style.backgroundImage = `url(${imageUrl})`;
      }
      break;
  }
};

const updateImage = (el: any): void => {
  const entityId = getEntityId(el);
  if (!entityId) return;

  const slug = entityId.replace(/\./g, "_");
  const styles = window.getComputedStyle(el);
  const imagePath = styles.getPropertyValue(`--uix-image-for-${slug}`).trim();
  const imageUrl = imagePath ? (document.querySelector("home-assistant") as any)?.hass?.hassUrl(imagePath) : null;

  if (imageUrl) {
    applyImage(el, imageUrl);
  }
};

const bindUix = async (el: any) => {
  updateImage(el);
  el._boundUixImage = el._boundUixImage ?? new Set();
  const newUix = await findParentUix(el);

  for (const uix of newUix) {
    if (el._boundUixImage.has(uix)) continue;

    uix.addEventListener("uix-styles-update", async () => {
      await uix.updateComplete;
      updateImage(el);
    });
    el._boundUixImage.add(uix);
  }

  // Find uix elements created later, increased interval
  if (el.uix_image_retries < 5) {
    el.uix_image_retries++;
    return window.setTimeout(() => bindUix(el), 250 * el.uix_image_retries);
  }
};

@patch_element("ha-entity-marker")
class HaEntityMarkerPatch extends ModdedElement {
  uix_image_retries = 0;
  updated(_orig, ...args) {
    _orig?.(...args);
    this.uix_image_retries = 0;
    bindUix(this);
  }
}

@patch_element("ha-tile-icon")
class HaTileIconPatch extends ModdedElement {
  uix_image_retries = 0;
  updated(_orig, ...args) {
    _orig?.(...args);
    this.uix_image_retries = 0;
    bindUix(this);
  }
}

@patch_element("state-badge")
class HaStateBadgePatch extends ModdedElement {
  uix_image_retries = 0;
  updated(_orig, ...args) {
    _orig?.(...args);
    this.uix_image_retries = 0;
    bindUix(this);
  }
}

@patch_element("ha-user-badge")
class HaUserBadgePatch extends ModdedElement {
  uix_image_retries = 0;
  updated(_orig, ...args) {
    _orig?.(...args);
    this.uix_image_retries = 0;
    bindUix(this);
  }
}

@patch_element("ha-person-badge")
class HaPersonBadgePatch extends ModdedElement {
  uix_image_retries = 0;
  updated(_orig, ...args) {
    _orig?.(...args);
    this.uix_image_retries = 0;
    bindUix(this);
  }
}

function joinSet(dst: Set<any>, src: Set<any>) {
  for (const s of src) dst.add(s);
}

async function findParentUix(node: any, step = 0): Promise<Set<Uix>> {
  let uixElements: Set<Uix> = new Set();
  if (step === 10) return uixElements;
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
