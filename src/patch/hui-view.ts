import { ModdedElement, apply_uix } from "../helpers/apply_uix";
import { patch_element } from "../helpers/patch_function";
import {
  BACKGROUND_REFRESH_DELAY_MS,
  cleanupViewBackground,
  manageViewBackground,
} from "../view-background";

/*
Patch hui-view for theme styling

There is no style passed to apply_uix here, everything comes only from themes.

Two optional CSS variables can be set in the theme's uix-view style to attach
a background to the view:

  --uix-view-background-camera-entity
      A camera entity ID.  UIX will create a muted ha-camera-stream element
      positioned as a full-screen background behind the view.

  --uix-view-background-image-entity
      Any entity with an entity_picture attribute.  UIX will sign the picture
      URL and render it as a cover-sized background image behind the view.

Both variables support Jinja2 templates so users can choose a different entity
per view without needing multiple themes:

  uix-view: |
    hui-view {
      --uix-view-background-camera-entity:
        {% if panel.viewUrlPath == 'garage' %}camera.garage
        {% elif panel.viewUrlPath == 'driveway' %}camera.driveway
        {% endif %};
    }
*/

@patch_element("hui-view")
class HuiViewPatch extends ModdedElement {
  _uixBgController?: AbortController;

  updated(_orig, ...args) {
    _orig?.(...args);
    apply_uix(this, "view", undefined, {}, false);

    // Set up the background-entity lifecycle once per view element instance.
    if (this._uixBgController) return;

    this._uixBgController = new AbortController();
    const { signal } = this._uixBgController;

    // Primary trigger: listen on the view's uix-node for style re-renders.
    // This fires on every template evaluation, so it covers:
    //   - Initial style render when the view first loads.
    //   - Template re-renders driven by HA state changes (e.g. is_state(...)).
    //   - Re-renders after a uix_update (theme reload).
    //
    // `uix-styles-update` fires synchronously when `_rendered_styles` is set
    // (before Lit has re-rendered the <style> element), so we must wait for
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

  private _setupStylesUpdateListener(signal: AbortSignal) {
    if (signal.aborted) return;
    const viewUixNode = this._uix?.find((u) => u.type === "view");
    if (!viewUixNode) return;
    viewUixNode.addEventListener(
      "uix-styles-update",
      () => viewUixNode.updateComplete.then(() => manageViewBackground(this)),
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
