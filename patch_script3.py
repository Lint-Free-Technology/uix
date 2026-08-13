import re

with open('src/patch/ha-icon.ts', 'r') as f:
    content = f.read()

# Replace the part in bindUix
old_bindUix_part = """    if (!el._styleWatcher) {
      el._styleWatcher = new StyleReactiveComponent(el, properties, () => {
        if (el._updateIconPending) return;
        el._updateIconPending = true;
        nextAnimationFrame().then(() => {
          updateIcon(el);
          el._updateIconPending = false;
        });
      });
    }"""

new_bindUix_part = """    if (el._styleWatcher && JSON.stringify(el._styleWatcher.properties) !== JSON.stringify(properties)) {
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
    }"""

content = content.replace(old_bindUix_part, new_bindUix_part)

with open('src/patch/ha-icon.ts', 'w') as f:
    f.write(content)
