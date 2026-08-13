import re

with open('src/patch/ha-icon.ts', 'r') as f:
    content = f.read()

# Replace the startLoop section to handle isConnected
old_startLoop = """  startLoop() {
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
  }"""

new_startLoop = """  startLoop() {
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
  }"""

content = content.replace(old_startLoop, new_startLoop)

with open('src/patch/ha-icon.ts', 'w') as f:
    f.write(content)
