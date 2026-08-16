import { TwoKeyMap } from "../helpers/two-key-map";

const IMAGE_FOR_ENTITY_CLEANUP_INTERVAL = 20000; // 20 seconds

export const ImageMixin = (SuperClass) => {
  return class ImageMixinClass extends SuperClass {
    _imageForEntityCallbacks = new TwoKeyMap();
    _imageForEntityCleanupIntervalID: number | undefined;

    constructor() {
      super();
      this._imageForEntityCleanupIntervalID = window.setInterval(
        this._imageForEntityCleanup.bind(this),
        IMAGE_FOR_ENTITY_CLEANUP_INTERVAL
      );
    }

    _imageForEntityCleanup() {
      // Remove all event listeners disconnected elements have registered for
      for (const [imageVar, elCallbacks] of this._imageForEntityCallbacks.get()) {
        for (const [el, callbacks] of elCallbacks) {
          if (!el.isConnected) {
            this._unregisterImageForEntityCallback(el, imageVar);
          }
        }
        if (elCallbacks.size === 0) {
          this._imageForEntityCallbacks.delete(imageVar);
        }
      }
    }

    _imageForEntityDispatcher = (imageVar: string) => {
      // Go through all elements that have registered for this event and call their callbacks
      const elCallbackMaps = this._imageForEntityCallbacks.get(imageVar);
      if (!elCallbackMaps) return;
      elCallbackMaps.forEach((map) => {
        map.forEach(callback => callback());
      });
    };

    _registerImageForEntityCallback = (el, imageVar: string, callback: () => void) => {
      let elCallbacks = this._imageForEntityCallbacks.get(imageVar, el);
      if (!elCallbacks) {
        elCallbacks = new Set();
        this._imageForEntityCallbacks.set(imageVar, el, elCallbacks);
      }
      elCallbacks.add(callback);
    };

    _unregisterImageForEntityCallback = (el, imageVar: string) => {
      const elCallbacks = this._imageForEntityCallbacks.get(imageVar, el);
      if (!elCallbacks) return;
      elCallbacks.clear();
      if (elCallbacks.size === 0) {
        this._imageForEntityCallbacks.delete(imageVar, el);
      }
    };

    _refreshImageStyles(styles: string, debug: boolean) {
      // Look for `--uix-image-for-<entity_id>` in the styles 
      // Compose list of vars and call dispatch function for each to update all icon patches
      // that have registered for that var
      const imageVars = [];
      const matches = styles.match(/--uix-image-for-[a-zA-Z0-9_-]+/g);
      if (matches) {
        for (const key of matches) {
          imageVars.push(key);
        }
      }
      if (debug) {
        console.groupCollapsed("UIX: Image vars updated by template");
        console.log(imageVars);
        console.groupEnd();
      }
      for (const imageVar of new Set(imageVars)) {
        this._imageForEntityDispatcher(imageVar);
      }
    }
  }
}