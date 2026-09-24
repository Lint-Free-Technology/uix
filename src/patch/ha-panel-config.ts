import { patch_element } from "../helpers/patch_function";
import { ModdedElement, apply_uix } from "../helpers/apply_uix";
import { setupFrameRuntime } from "../frame/frame-api";

/*
Patch ha-panel-config for theme styling
Config panels are routed via removing last Child and adding a new one.
Hence we need to prepend uix element to not interfere with the routing.

There is no style passed to apply_uix here, everything comes only from themes.
*/

@patch_element("ha-panel-config")
class HaConfigPatch extends ModdedElement {
  updated(_orig, ...args) {
    _orig?.(...args);
    if (args[0].has("route")) {
      apply_uix(this, "config", { prepend: true });
    }
  }
}

/*
Patch ha-panel-custom
*/

@patch_element("ha-panel-custom")
class HaPanelCustomPatch extends ModdedElement {
  public panel: any;
  public hass: any;

  updated(_orig, ...args) {
    _orig?.(...args);
    if (args[0].has("route") || args[0].has("panel")) {
      apply_uix(this, "panel-custom", { prepend: true });
    }
  }
  _createPanel(_orig, ...args) {
    _orig?.(...args);
    const coordinator = (window as any).uixCoordinator;

    let hasRun = false;
    let timeout: any;

    const run = () => {
      if (hasRun) return;
      hasRun = true;
      cleanup();

      const setupIframe = (iframe: HTMLIFrameElement) => {
        const name = this.panel?.config?._panel_custom?.name;
        if (name) setupFrameRuntime(iframe, { roots: [name], themeTypes: [name], hass: this.hass });
      };

      const findAndSetup = () => {
        const iframe = this.shadowRoot?.querySelector("iframe") || this.querySelector("iframe");
        if (iframe) {
          setupIframe(iframe as HTMLIFrameElement);
          return true;
        }
        return false;
      };

      if (!findAndSetup()) {
        const observer = new MutationObserver(() => {
          if (findAndSetup()) {
            observer.disconnect();
          }
        });
        observer.observe(this.shadowRoot || this, { childList: true, subtree: true });
        setTimeout(() => observer.disconnect(), 10000);
      }
    };

    const checkAndRun = () => {
      if (coordinator?.styleFramePanels) {
        run();
      }
    };

    const cleanup = () => {
      clearTimeout(timeout);
      coordinator?.removeEventListener?.("uix-config-update", checkAndRun);
    };

    if (coordinator?.styleFramePanels) {
      run();
    } else {
      coordinator?.addEventListener?.("uix-config-update", checkAndRun);
      timeout = setTimeout(cleanup, 30000);
    }
  }
}

/* Patch ha-top-app-bar-fixed for theme styling
This is needed to best style the top app bar in the config panel.
The ultimate background styling for config panels come from this element.
*/

@patch_element("ha-top-app-bar-fixed")
class HaTopAppBarFixedPatch extends ModdedElement {
  updated(_orig, ...args) {
    _orig?.(...args);
    apply_uix(this, "top-app-bar-fixed");
  }
}
