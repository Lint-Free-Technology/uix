export class GlobalStyleWatcher {
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
    // Cleanup cache for this component
    const elementId = componentInstance.uniqueId;
    for (const key of this.cache.keys()) {
      if (key.startsWith(`${elementId}_`)) {
        this.cache.delete(key);
      }
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

export const globalStyleWatcher = new GlobalStyleWatcher();

export class StyleReactiveComponent {
  el: any;
  uniqueId: string;
  properties: string[];
  callback: () => void;
  _transitionEndHandler: (e: TransitionEvent) => void;
  _usingNative: boolean = false;

  constructor(element: any, properties: string[], callback: () => void) {
    if (!element) throw new Error('Target element is required.');
    this.el = element;
    this.properties = properties;
    this.callback = callback;
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
      globalStyleWatcher.register(this);
    }
  }

  setupNativeTransitions() {
    this._usingNative = true;
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
          // Absorb exceptions if already declared
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
    if (this._usingNative) {
      this.el.removeEventListener('transitionend', this._transitionEndHandler);
      // Clean up styles if needed, but usually element is being destroyed
    } else {
      globalStyleWatcher.unregister(this);
    }
  }
}
