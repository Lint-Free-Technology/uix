import re

with open('src/patch/ha-icon.ts', 'r') as f:
    content = f.read()

watcher_code = """
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
(window as any).__globalStyleWatcher = (window as any).__globalStyleWatcher || new GlobalStyleWatcher();

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
      (window as any).__globalStyleWatcher.register(this);
    }
  }

  setupNativeTransitions() {
    try {
      this.properties.forEach(prop => {
        try {
          (window as any).CSS.registerProperty({
            name: prop,
            syntax: '*',
            inherits: true,
            initialValue: prop.includes('color') ? '' : ''
          });
        } catch (e) {
          // Absorb exceptions if another application module already declared these names
        }
      });
    } catch (e) {}

    // Apply native micro-transitions to local component styles
    const prevProp = this.el.style.transitionProperty;
    const prevDur = this.el.style.transitionDuration;
    const prevBeh = this.el.style.transitionBehavior;
    
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
    if ((window as any).__globalStyleWatcher) {
      (window as any).__globalStyleWatcher.unregister(this);
    }
  }
}
"""

content = content.replace("let haIconAvailable = false;", watcher_code + "\nlet haIconAvailable = false;")


bind_uix_replacement = """const bindUix = async (el) => {
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
};"""

content = re.sub(r'const bindUix = async \(el\) => \{.*?(?=@patch_element)', bind_uix_replacement + '\n\n', content, flags=re.DOTALL)

with open('src/patch/ha-icon.ts', 'w') as f:
    f.write(content)

