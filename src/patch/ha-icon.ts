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


class GlobalStyleWatcher {
  components = new Set<any>();
  isPolling = false;
  cache = new Map<string, string>();

  register(componentInstance: any) {
    this.components.add(componentInstance);
    if (!this.isPolling && this.components.size === 1) {
      this.startLoop();
    }
  }

  unregister(componentInstance: any) {
    this.components.delete(componentInstance);
    if (this.components.size === 0) {
      this.isPolling = false;
    }
  }

  startLoop() {
    this.isPolling = true;

    const poll = () => {
      if (!this.isPolling) return;

      this.components.forEach((comp) => {
        if (!comp.el.isConnected) {
          comp.destroy();
          return;
        }
        const computed = window.getComputedStyle(comp.el);
        const elementId = comp.uniqueId;
        
        let changed = false;
        comp.properties.forEach((prop: string) => {
          const val = computed.getPropertyValue(prop).trim();
          const cacheKey = `${elementId}_${prop}`;

          if (this.cache.get(cacheKey) !== val) {
            this.cache.set(cacheKey, val);
            changed = true;
          }
        });

        if (changed) {
          comp.handlePropertyChange();
        }
      });

      requestAnimationFrame(poll);
    };

    requestAnimationFrame(poll);
  }
}

// Bind single runtime instance to window context
(window as any).__uixGlobalStyleWatcher = (window as any).__uixGlobalStyleWatcher || new GlobalStyleWatcher();

class StyleReactiveComponent {
  el: any;
  uniqueId: string;
  properties: string[];
  callback: () => void;
  _transitionEndHandler: (e: TransitionEvent) => void;

  constructor(element: any, properties: string[], callback: () => void) {
    if (!element) throw new Error('Target element is required.');
    this.el = element;
    this.properties = properties;
    this.callback = callback;
    
    // Fallback registration tracker ID
    this.uniqueId = 'comp_' + Math.random().toString(36).substring(2, 9);
    
    this._transitionEndHandler = (e: TransitionEvent) => {
      if (this.properties.includes(e.propertyName)) {
        this.handlePropertyChange();
      }
    };

    this.init();
  }

  init() {
    // 1. Structural runtime feature detection
    const supportsHoudini = (window as any).CSS && typeof (window as any).CSS.registerProperty === 'function';
    const supportsDiscrete = CSS.supports('transition-behavior', 'allow-discrete');

    // 2. Select execution path based on device capability
    if (supportsHoudini && supportsDiscrete) {
      this.setupNativeTransitions();
    } else {
      (window as any).__uixGlobalStyleWatcher.register(this);
    }
  }

  setupNativeTransitions() {
    try {
      this.properties.forEach(prop => {
        try {
          const currentVal = window.getComputedStyle(this.el).getPropertyValue(prop).trim();
          (window as any).CSS.registerProperty({
            name: prop,
            syntax: prop.includes('color') ? '<color>' : '*',
            inherits: true,
            initialValue: currentVal || (prop.includes('color') ? 'transparent' : 'initial')
          });
        } catch (e) {
          // Absorb exceptions if another application module already declared these names
        }
      });
    } catch (e) {}

    // Apply native micro-transitions to local component styles
    const computed = window.getComputedStyle(this.el);
    const prevProp = computed.transitionProperty !== 'all' ? computed.transitionProperty : '';
    const prevDur = computed.transitionDuration;
    const prevBeh = (computed as any).transitionBehavior || '';
    
    const props = this.properties.join(', ');
    const durs = this.properties.map(() => '0.001s').join(', ');
    const behs = this.properties.map(() => 'allow-discrete').join(', ');

    this.el.style.transitionProperty = prevProp ? `${prevProp}, ${props}` : props;
    this.el.style.transitionDuration = prevDur ? `${prevDur}, ${durs}` : durs;
    this.el.style.transitionBehavior = prevBeh ? `${prevBeh}, ${behs}` : behs;

    // Hook native event listener directly to the layout layer
    this.el.addEventListener('transitionend', this._transitionEndHandler);

    // Initial trigger
    this.handlePropertyChange();
  }

  handlePropertyChange() {
    this.callback();
  }

  destroy() {
    this.el.removeEventListener('transitionend', this._transitionEndHandler);
    if ((window as any).__uixGlobalStyleWatcher) {
      (window as any).__uixGlobalStyleWatcher.unregister(this);
    }
  }
}

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

    if (el._styleWatcher && JSON.stringify(el._styleWatcher.properties) !== JSON.stringify(properties)) {
      el._styleWatcher.destroy();
      el._styleWatcher = undefined;
    }

    if (!el._styleWatcher) {
      el._styleWatcher = new StyleReactiveComponent(el, properties, () => {
        if (el._updateIconPending) return;
        el._updateIconPending = true;
        nextAnimationFrame().then(() => {
          updateIcon(el);
          el._updateIconPending = false;
        });
      });
    }

    updateIcon(el);
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
    if ((this.parentNode as any)?.host?.localName === "ha-state-icon") return;
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



window.addEventListener("uix-bootstrap", () => {
  window.customElements.whenDefined("ha-icon").then(() => {
    haIconAvailable = true;
  });
});