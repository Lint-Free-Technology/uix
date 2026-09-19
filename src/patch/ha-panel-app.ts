import { patch_element } from "../helpers/patch_function";
import { ModdedElement, apply_uix } from "../helpers/apply_uix";
import { setupFrameRuntime } from "../frame/frame-api";

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

@patch_element("ha-panel-app")
class HaPanelAppPatch extends ModdedElement {
  updated(_orig, ...args) {
    _orig?.(...args);
    apply_uix(this, "app", { prepend: true });

    if (!(window as any).uixCoordinator?.styleFramePanels) return;
    const iframe = this.shadowRoot?.querySelector("iframe") as HTMLIFrameElement | null;
    const slug = this.panel?.config?.addon || this.panel?.config?.slug ||
      this.route?.path?.split("/").filter(Boolean).pop();
    if (iframe && slug && !(iframe as any)._uixFrameSetup) {
      (iframe as any)._uixFrameSetup = true;
      setupFrameRuntime(iframe, {
        roots: ["home-assistant", "hc-main", "body"],
        themeTypes: appThemeTypes(slug),
        hass: this.hass,
      });
    }
  }
}
