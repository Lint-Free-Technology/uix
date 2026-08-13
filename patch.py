import re

with open('src/patch/ha-icon.ts', 'r') as f:
    content = f.read()

# Fix __globalStyleWatcher
content = content.replace('__globalStyleWatcher', '__uixGlobalStyleWatcher')

# Fix registerProperty
old_register = """          (window as any).CSS.registerProperty({
            name: prop,
            syntax: '*',
            inherits: true,
            initialValue: prop.includes('color') ? '' : ''
          });"""

new_register = """          const currentVal = window.getComputedStyle(this.el).getPropertyValue(prop).trim();
          (window as any).CSS.registerProperty({
            name: prop,
            syntax: prop.includes('color') ? '<color>' : '*',
            inherits: true,
            initialValue: currentVal || (prop.includes('color') ? 'transparent' : 'initial')
          });"""

content = content.replace(old_register, new_register)

# Fix setupNativeTransitions properties
old_setup = """    // Apply native micro-transitions to local component styles
    const prevProp = this.el.style.transitionProperty;
    const prevDur = this.el.style.transitionDuration;
    const prevBeh = this.el.style.transitionBehavior;"""

new_setup = """    // Apply native micro-transitions to local component styles
    const computed = window.getComputedStyle(this.el);
    const prevProp = computed.transitionProperty !== 'all' ? computed.transitionProperty : '';
    const prevDur = computed.transitionDuration;
    const prevBeh = (computed as any).transitionBehavior || '';"""

content = content.replace(old_setup, new_setup)

# Remove uix-styles-update listener and findParentUix completely from bindUix
old_bindUix_part = """    // Find the most relevant uix-nodes in order to listen to change events so we can react quickly
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
    }"""

new_bindUix_part = """    updateIcon(el);"""

content = content.replace(old_bindUix_part, new_bindUix_part)

with open('src/patch/ha-icon.ts', 'w') as f:
    f.write(content)
