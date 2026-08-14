class GlobalLegacyStyleWatcher {
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

    const elementId = componentInstance?.uniqueId;
    if (elementId && Array.isArray(componentInstance?.properties)) {
      componentInstance.properties.forEach((prop: string) => {
        this.cache.delete(`${elementId}_${prop}`);
      });
    }

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
(window as any).__uixGlobalLegacyStyleWatcher = (window as any).__uixGlobalLegacyStyleWatcher || new GlobalLegacyStyleWatcher();

const PROXY_STYLES = [
  ["position", "absolute"],
  ["width", "1px"],
  ["height", "1px"],
  ["padding", "0"],
  ["margin", "-1px"],
  ["border", "none"],
  ["overflow", "hidden"],
  ["clip-path", "inset(50%)"],
  ["pointer-events", "none"],
  ["white-space", "nowrap"]
] as const;

export class StyleWatcher {
  nativeTransitions: boolean = false;
  el: any;
  proxyEl: any;
  uniqueId: string;
  properties: string[];
  callback: () => void;
  _transitionEndHandler: (e: TransitionEvent) => void;

  proxyElStyles: Map<string, string>;

  constructor(element: any, properties: string[], callback: () => void) {
    if (!element) throw new Error('Target element is required.');
    this.el = element;
    this.properties = properties;
    this.callback = callback;
    
    // Fallback registration tracker ID
    this.uniqueId = 'comp_' + Math.random().toString(36).substring(2, 9);
    
    this._transitionEndHandler = (e: TransitionEvent) => {
      if (e.target === this.proxyEl && this.properties.includes(e.propertyName)) {
        this.handlePropertyChange(e.propertyName);
      }
    };

    this.init();
  }

  init() {
    const supportsHoudini = (window as any).CSS && typeof (window as any).CSS.registerProperty === 'function';
    const supportsDiscrete = typeof (window as any).CSS?.supports === 'function' && (window as any).CSS.supports('transition-behavior', 'allow-discrete');
    // 2. Select execution path based on device capability
    if (supportsHoudini && supportsDiscrete) {
      this.nativeTransitions = true;
    }

    if (this.nativeTransitions) {
      this.setupNativeTransitions();
    } else {
      (window as any).__uixGlobalLegacyStyleWatcher.register(this);
    }
  }

  setupNativeTransitions() {
    try {
      this.properties.forEach(prop => {
        try {
          const currentVal = window.getComputedStyle(this.el).getPropertyValue(prop).trim();
          (window as any).CSS.registerProperty({
            name: prop,
            syntax: '*',
            inherits: true,
            initialValue: currentVal || ''
          });
        } catch (e) {
          // Absorb exceptions if another application module already declared these names
        }
      });
    } catch (e) {}

    this.proxyEl = document.createElement('div');
    this.proxyEl.setAttribute('uix-icon-style-watcher-proxy', '');
    this.proxyElStyles = new Map<string, string>(PROXY_STYLES);

    // Apply native micro-transitions to local component styles
    const props = this.properties.join(', ');
    const durations = this.properties.map(() => '0.001s').join(', ');
    const behaviors = this.properties.map(() => 'allow-discrete').join(', ');

    this.proxyElStyles.set('transition-property', props);
    this.proxyElStyles.set('transition-duration', durations);
    this.proxyElStyles.set('transition-behavior', behaviors);

    const styles = document.createElement('style');
    styles.textContent = `
      [uix-icon-style-watcher-proxy] {
          ${[...this.proxyElStyles.entries()].map(([k, v]) => `${k}: ${v};`).join('\n')}
      }
    `;
    this.proxyEl.appendChild(styles);
    this.el.updateComplete.then(() => {
      const parent = this.el.shadowRoot || this.el.parentElement || this.el;
      parent.prepend(this.proxyEl);

      // Hook native event listener directly to the layout layer
      this.proxyEl.addEventListener('transitionend', this._transitionEndHandler);

      // Initial trigger
      this.handlePropertyChange();
    });
  }

  handlePropertyChange(propertyName?: string) {
    if (!propertyName || this.properties.includes(propertyName)) {
      this.callback();
    }
  }

  destroy() {
    if (this.proxyEl) {
      this.proxyEl.removeEventListener('transitionend', this._transitionEndHandler);
      this.proxyEl.remove();
      this.proxyElStyles.clear();
      this.proxyEl = undefined;
    }
    if (!this.nativeTransitions && (window as any).__uixGlobalLegacyStyleWatcher) {
      (window as any).__uixGlobalLegacyStyleWatcher.unregister(this);
    }
  }
}