import { ModdedElement, apply_uix } from "../helpers/apply_uix";
import { patch_element } from "../helpers/patch_function";
import {
  BACKGROUND_REFRESH_DELAY_MS,
  cleanupViewBackground,
  manageViewBackground,
} from "../view-background";
import { themesReady } from "../theme-watcher";

/*
Patch ha-drawer for theme styling

There is no style passed to apply_uix here, everything comes only from themes.

ha-drawer wraps the entire HA content area (Lovelace views AND config panels),
so backgrounds defined here are available everywhere, not just in Lovelace.

Two optional CSS variables can be set in the theme's uix-drawer style to
attach a background behind the content area:

  --uix-view-background-camera-entity
      A camera entity ID.  UIX will create a muted ha-camera-stream element
      positioned as a full-screen background.

  --uix-view-background-image-entity
      Any entity with an entity_picture attribute.  UIX will sign the picture
      URL and render it as a cover-sized background image.

Because ha-drawer persists across navigation, templates using the `panel`
variable can select a different entity per panel/view without any teardown
overhead:

  uix-drawer: |
    :host {
      --uix-view-background-camera-entity:
        {% if panel.viewUrlPath == 'garage' %}camera.garage
        {% elif panel.viewUrlPath == 'driveway' %}camera.driveway
        {% endif %};
    }

Note: variables must be set on :host so they are readable via
getComputedStyle(ha-drawer).

*/

@patch_element("ha-drawer")
class HaDrawerPatch extends ModdedElement {
  _uixBgController?: AbortController;

  updated(_orig, ...args) {
    _orig?.(...args);
    apply_uix(this, "drawer", undefined, {}, true);

    // Set up the background-entity lifecycle once per ha-drawer element instance.
    if (this._uixBgController) return;

    this._uixBgController = new AbortController();
    const { signal } = this._uixBgController;

    // Primary trigger: listen on the drawer's uix-node for style re-renders.
    // This fires on every template evaluation, so it covers:
    //   - Initial style render on load.
    //   - Template re-renders driven by HA state changes (e.g. is_state(...)).
    //   - Template re-renders on navigation (panel variable changes).
    //   - Re-renders after a uix_update (theme reload).
    //
    // `uix-styles-update` fires synchronously when `_rendered_styles` is set
    // (before Lit has re-rendered the <style> element), so we wait for
    // `updateComplete` before reading CSS variables via getComputedStyle().
    window.setTimeout(
      () => this._setupStylesUpdateListener(signal),
      BACKGROUND_REFRESH_DELAY_MS
    );

    // Fallback trigger: theme-wide updates may not always produce a different
    // style string (so _style_rendered may be skipped and uix-styles-update
    // may not fire). The uix_update listener ensures we still re-evaluate
    // after a theme reload even when the CSS text is unchanged.
    document.addEventListener(
      "uix_update",
      () =>
        window.setTimeout(
          () => manageViewBackground(this),
          BACKGROUND_REFRESH_DELAY_MS
        ),
      { signal }
    );

    // Initial check after styles have had time to render.
    window.setTimeout(
      () => manageViewBackground(this),
      BACKGROUND_REFRESH_DELAY_MS
    );
  }

  private async _setupStylesUpdateListener(signal: AbortSignal) {
    if (signal.aborted) return;
    // Wait for themes to be ready before looking up the uix-node; without
    // this the drawer uix-node may not yet exist and the listener would be
    // silently dropped.
    await themesReady().catch(() => {});
    if (signal.aborted) return;
    const drawerUixNode = this._uix?.find((u) => u.type === "drawer");
    if (!drawerUixNode) return;
    drawerUixNode.addEventListener(
      "uix-styles-update",
      () =>
        drawerUixNode.updateComplete.then(() => manageViewBackground(this)),
      { signal }
    );
  }

  disconnectedCallback(_orig?: () => void) {
    _orig?.();
    this._uixBgController?.abort();
    this._uixBgController = undefined;
    cleanupViewBackground(this);
  }
}