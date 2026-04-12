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

const applyImage = (el: any, imageUrl: string | null): void => {
  const tag = el.tagName.toLowerCase();
  switch (tag) {
    case "ha-tile-icon": {
      const haStateIcon = el.querySelector("ha-state-icon");
      if (imageUrl) {
        el._uix_replaced_image = el._uix_replaced_image ?? el.imageUrl ?? false;
        el.imageUrl = imageUrl;
        if (haStateIcon) {
          haStateIcon.style.display = "none";
          haStateIcon.style.visibility = "hidden";
          haStateIcon.setAttribute("slot", "none");
        }
      } else if (el._uix_replaced_image !== undefined) {
        el.imageUrl = el._uix_replaced_image ? el._uix_replaced_image : undefined;
        delete el._uix_replaced_image;
        if (haStateIcon) {
          haStateIcon.style.display = "";
          haStateIcon.style.visibility = "";
          haStateIcon.setAttribute("slot", "icon");
        }
      }
      break;
    }
    case "state-badge":
      if (imageUrl) {
        el._uix_replaced_image = el._uix_replaced_image ?? el.overrideImage ?? false;
        el.overrideImage = imageUrl;
      } else if (el._uix_replaced_image !== undefined) {
        el.overrideImage = el._uix_replaced_image ? el._uix_replaced_image : undefined;
        delete el._uix_replaced_image;
      }
      break;
    case "ha-entity-marker":
      if (imageUrl) {
        el._uix_replaced_image = el._uix_replaced_image ?? el.entityPicture ?? false;
        el.entityPicture = imageUrl;
      } else if (el._uix_replaced_image !== undefined) {
        el.entityPicture = el._uix_replaced_image ? el._uix_replaced_image : undefined;
        delete el._uix_replaced_image;
      }
      break;
    case "ha-user-badge":
      if (imageUrl) {
        el._uix_replaced_image = el._uix_replaced_image ?? el._personPicture ?? false;
        el._personPicture = imageUrl;
      } else if (el._uix_replaced_image !== undefined) {
        el._personPicture = el._uix_replaced_image ? el._uix_replaced_image : undefined;
        delete el._uix_replaced_image;
      }
      break;
    case "ha-person-badge": {
      const pictureEl = el.shadowRoot?.querySelector(".picture");
      if (pictureEl) {
        if (imageUrl) {
          el._uix_replaced_image = el._uix_replaced_image ?? pictureEl.style.backgroundImage ?? false;
          pictureEl.style.backgroundImage = `url(${imageUrl})`;
        } else if (el._uix_replaced_image !== undefined) {
          pictureEl.style.backgroundImage = el._uix_replaced_image ? el._uix_replaced_image : "";
          delete el._uix_replaced_image;
        }
      }
      break;
    }
  }
};

const updateImage = (el: any): void => {
  const styles = window.getComputedStyle(el);
  let imagePath = styles.getPropertyValue(`--uix-image`).trim();
  if (!imagePath) {
    const entityId = getEntityId(el);
    if (entityId) {
      const slug = entityId.replace(/\./g, "_");
      imagePath = styles.getPropertyValue(`--uix-image-for-${slug}`).trim();
    }
  }
  const imageUrl = imagePath ? (document.querySelector("home-assistant") as any)?.hass?.hassUrl(imagePath) : null;
  applyImage(el, imageUrl);
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

// Shadow-root crossings count as steps, so 20 is needed to reliably traverse
// deeply nested shadow trees (e.g. map markers inside dialogs inside cards).
const MAX_PARENT_STEPS = 20;

async function findParentUix(node: any, step = 0): Promise<Set<Uix>> {
  let uixElements: Set<Uix> = new Set();
  if (step === MAX_PARENT_STEPS) return uixElements;
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
