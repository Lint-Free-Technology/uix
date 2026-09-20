import { patch_element } from "../helpers/patch_function";
import { ModdedElement, apply_uix } from "../helpers/apply_uix";
import { setupFrameRuntime } from "../frame/frame-api";
import { selectTree } from "../helpers/selecttree";

export function appThemeTypes(slug: string): string[] {
  if (!slug) return [];
  const independent = slug.replace(/^(?:core|local|[0-9a-f]{8})_/, "");
  return independent === slug ? [slug] : [slug, independent];
}

/*
Patch ha-panel-app for theme styling.

The `app` target styles the Home Assistant host. A separate, internal frame
runtime styles same-origin iframe content by add-on slug; it does not expose
the host target to the frame or conflate the two user-facing concepts.
*/

function applyAppPanelUix(panel: any) {
  apply_uix(panel, "app", { prepend: true });

  const coordinator = (window as any).uixCoordinator;
  if (!coordinator?.styleFramePanels) {
    if (!(panel as any)._uixFrameConfigListener && coordinator?.addEventListener) {
      const onConfigUpdate = () => {
        if (!coordinator.styleFramePanels) return;
        coordinator.removeEventListener?.("uix-config-update", onConfigUpdate);
        delete (panel as any)._uixFrameConfigListener;
        applyAppPanelUix(panel);
      };
      (panel as any)._uixFrameConfigListener = onConfigUpdate;
      coordinator.addEventListener("uix-config-update", onConfigUpdate);
    }
    return;
  }
  const iframe = panel.shadowRoot?.querySelector("iframe") as HTMLIFrameElement | null;
  const slug = panel.panel?.config?.addon || panel.panel?.config?.slug ||
    panel.route?.path?.split("/").filter(Boolean).pop();
  if (iframe && slug && !(iframe as any)._uixFrameSetup) {
    (iframe as any)._uixFrameSetup = true;
    setupFrameRuntime(iframe, {
      roots: ["home-assistant", "hc-main", "body"],
      themeTypes: appThemeTypes(slug),
      hass: panel.hass,
    });
  }
}

async function applyActiveAppPanelUix() {
  const panelPaths = [
    "home-assistant $ home-assistant-main $ partial-panel-resolver>*",
    "hc-main $ ha-panel-app",
  ];
  for (let retry = 0; retry < 100; retry++) {
    for (const path of panelPaths) {
      const panel = await selectTree(document, path);
      if (panel?.localName === "ha-panel-app") {
        applyAppPanelUix(panel);
        return;
      }
    }
    await new Promise((resolve) => window.setTimeout(resolve, 100));
  }
}

@patch_element("ha-panel-app", () => void applyActiveAppPanelUix())
class HaPanelAppPatch extends ModdedElement {
  updated(_orig, ...args) {
    _orig?.(...args);
    applyAppPanelUix(this);
  }
}
