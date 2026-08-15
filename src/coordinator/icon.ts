import { TwoKeyMap } from "../helpers/two-key-map";

const ICON_FOR_ENTITY_CLEANUP_INTERVAL = 20000; // 20 seconds

export const IconMixin = (SuperClass) => {
  return class IconMixinClass extends SuperClass {
    _iconForEntityCallbacks = new TwoKeyMap();
    _iconForEntityCleanupIntervalID: number | undefined;

    constructor() {
      super();
      this._iconForEntityCleanupIntervalID = window.setInterval(
        this._iconForEntityCleanup.bind(this),
        ICON_FOR_ENTITY_CLEANUP_INTERVAL
      );
    }

    _iconForEntityCleanup() {
      // Remove all event listeners disconnected elements have registered for
      for (const [iconVar, elCallbacks] of this._iconForEntityCallbacks.get()) {
        for (const [el, callbacks] of elCallbacks) {
          if (!el.isConnected) {
            this._unregisterIconForEntityCallback(el, iconVar);
          }
        }
        if (elCallbacks.size === 0) {
          this._iconForEntityCallbacks.delete(iconVar);
        }
      }
    }

    _iconForEntityDispatcher = (iconVar: string) => {
      // Go through all elements that have registered for this event and call their callbacks
      const elCallbackMaps = this._iconForEntityCallbacks.get(iconVar);
      if (!elCallbackMaps) return;
      elCallbackMaps.forEach((map) => {
        map.forEach(callback => callback());
      });
    };

    _registerIconForEntityCallback = (el, iconVar: string, callback: () => void) => {
      let elCallbacks = this._iconForEntityCallbacks.get(iconVar, el);
      if (!elCallbacks) {
        elCallbacks = new Set();
        this._iconForEntityCallbacks.set(iconVar, el, elCallbacks);
      }
      elCallbacks.add(callback);
    };

    _unregisterIconForEntityCallback = (el, iconVar: string) => {
      const elCallbacks = this._iconForEntityCallbacks.get(iconVar, el);
      if (!elCallbacks) return;
      elCallbacks.clear();
      if (elCallbacks.size === 0) {
        this._iconForEntityCallbacks.delete(iconVar, el);
      }
    };

    _refreshIconStyles(styles: string, debug: boolean) {
      // Look for `--uix-icon-for-<entity_id>` and `--uix-icon-color-for-<entity_id>` in the styles 
      // Compose list of vars and call dispatch function for each to update all icon patches
      // that have registered for that var
      const iconVars = [];
      const matches = styles.match(/--uix-icon-(?:color-)?for-[a-zA-Z0-9_-]+/g);
      if (matches) {
        for (const key of matches) {
          iconVars.push(key);
        }
      }
      if (debug) {
        console.groupCollapsed("UIX: Icon vars updated by template");
        console.log(iconVars);
        console.groupEnd();
      }
      for (const iconVar of iconVars) {
        this._iconForEntityDispatcher(iconVar);
      }
    }
  }
}