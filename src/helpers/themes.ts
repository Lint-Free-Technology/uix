import { hass } from "./hass";
import { yaml2json } from "./yaml2json";
import { Uix } from "../uix";
import { MacroConfig, UixStyle } from "./apply_uix";
import { themesReady } from "../theme-watcher";
import { nextAnimationFrame } from "./raf";
import { normalizeThemeName } from "./theme_utils";

function cssValueIsTrue(v: string): boolean {
  if (!v) return false;
  const t = v.trim().toLowerCase();
  return t === "true" || t === "1" || t === "yes" || t === "on";
}

// Per-root in-flight promise maps: coalesces concurrent calls so multiple
// uix-nodes don't each schedule their own rAF-based style read.
const _themeInFlight = new WeakMap<Uix, Promise<UixStyle>>();
const _themeMacrosInFlight = new WeakMap<Uix, Promise<Record<string, MacroConfig | string>>>();

export function getThemeTargetElement(root: Uix): HTMLElement {
  if (root.parentElement) return root.parentElement;
  const shadowHost = (root.parentNode as any)?.host;
  if (shadowHost instanceof HTMLElement) return shadowHost;
  return root;
}

function getCssThemeName(root: Uix): string {
  const cs = window.getComputedStyle(getThemeTargetElement(root));
  return normalizeThemeName(
    cs.getPropertyValue("--uix-theme") || cs.getPropertyValue("--card-mod-theme")
  ) ?? "";
}

export function getEffectiveThemeName(root: Uix): string {
  // Precedence order:
  // 1) Explicit local `uix.theme` on this node
  // 2) Current CSS theme variables from the styled element context
  // Parent UIX nodes do not pass down their local `uix.theme`.
  // normalizeThemeName() returns undefined for empty/whitespace inputs, so
  // blank values never block fallback to the next precedence level.
  return (
    normalizeThemeName(root.theme) ||
    getCssThemeName(root)
  );
}

export async function get_theme(root: Uix): Promise<UixStyle> {
  if (!root.type) return null;

  if (_themeInFlight.has(root)) return _themeInFlight.get(root)!;

  const promise = (async (): Promise<UixStyle> => {
    try {
      await themesReady();

      // Wait for next animation frame before computing styles: batches reflow reads
      await nextAnimationFrame();

      const el = getThemeTargetElement(root);
      const cs = window.getComputedStyle(el);
      const theme = getEffectiveThemeName(root);

      // Determine debug flag from CSS variables.
      // Checked patterns:
      //  - --uix-<type>-debug
      //  - --uix-<type>-<class>-debug
      let debug = false;

      const typeDebug = cs.getPropertyValue(`--uix-${root.type}-debug`) || cs.getPropertyValue(`--card-mod-${root.type}-debug`);
      if (cssValueIsTrue(typeDebug)) debug = true;

      for (const cls of root.classes) {
        const debugVar = cs.getPropertyValue(`--uix-${root.type}-${cls}-debug`) || cs.getPropertyValue(`--card-mod-${root.type}-${cls}-debug`);
        if (cssValueIsTrue(debugVar)) {
          debug = true;
          break;
        }
      }

      root.debug ||= !!debug;

      root.debug && console.log("UIX Debug: Theme:", theme);

      const hs = await hass();
      if (!hs) return {};
      const themes = hs?.themes.themes ?? {};
      if (!themes[theme]) return {};

      if (themes[theme][`uix-${root.type}-yaml`]) {
        return yaml2json(themes[theme][`uix-${root.type}-yaml`]);
      } else if (themes[theme][`card-mod-${root.type}-yaml`]) {
        return yaml2json(themes[theme][`card-mod-${root.type}-yaml`]);
      } else if (themes[theme][`uix-${root.type}`]) {
        return { ".": themes[theme][`uix-${root.type}`] };
      } else if (themes[theme][`card-mod-${root.type}`]) {
        return { ".": themes[theme][`card-mod-${root.type}`] };
      } else {
        return {};
      }
    } finally {
      _themeInFlight.delete(root);
    }
  })();

  _themeInFlight.set(root, promise);
  return promise;
}

export async function get_theme_macros(root: Uix): Promise<Record<string, MacroConfig | string>> {

  if (_themeMacrosInFlight.has(root)) return _themeMacrosInFlight.get(root)!;

  const promise = (async (): Promise<Record<string, MacroConfig | string>> => {
    try {
      await themesReady().catch(() => {});

      // Wait for next animation frame before computing styles: batches reflow reads
      await nextAnimationFrame();

      const theme = getEffectiveThemeName(root);

      const hs = await hass();
      if (!hs) return {};
      const themes = hs?.themes.themes ?? {};
      if (!themes[theme]) return {};

      if (themes[theme]["uix-macros-yaml"]) {
        try {
          return await yaml2json(themes[theme]["uix-macros-yaml"]) ?? {};
        } catch (e) {
          console.error("UIX: Error parsing uix-macros-yaml from theme:", theme, e);
          return {};
        }
      }
      return {};
    } finally {
      _themeMacrosInFlight.delete(root);
    }
  })();

  _themeMacrosInFlight.set(root, promise);
  return promise;
}
