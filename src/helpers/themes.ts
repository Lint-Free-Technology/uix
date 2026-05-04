import { hass } from "./hass";
import { yaml2json } from "./yaml2json";
import type { Uix } from "../uix";
import { MacroConfig, UixStyle } from "./apply_uix";
import { themesReady } from "../theme-watcher";
import { nextAnimationFrame } from "./raf";

function cssValueIsTrue(v: string): boolean {
  if (!v) return false;
  const t = v.trim().toLowerCase();
  return t === "true" || t === "1" || t === "yes" || t === "on";
}

// Per-root in-flight promise maps: coalesces concurrent calls so multiple
// uix-nodes don't each schedule their own rAF-based style read.
const _themeInFlight = new WeakMap<Uix, Promise<UixStyle>>();
const _themeMacrosInFlight = new WeakMap<Uix, Promise<Record<string, MacroConfig | string>>>();

export async function get_theme(root: Uix): Promise<UixStyle> {
  if (!root.type) return null;

  if (_themeInFlight.has(root)) return _themeInFlight.get(root)!;

  const promise = (async (): Promise<UixStyle> => {
    try {
      await themesReady();

      // Wait for next animation frame before computing styles: batches reflow reads
      await nextAnimationFrame();

      const el = root.parentElement ? root.parentElement : root;
      const cs = window.getComputedStyle(el);
      const theme = cs.getPropertyValue("--uix-theme") || cs.getPropertyValue("--card-mod-theme");

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

      const el = root.parentElement ? root.parentElement : root;
      const cs = window.getComputedStyle(el);
      const theme = cs.getPropertyValue("--uix-theme") || cs.getPropertyValue("--card-mod-theme");

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

/**
 * Read the `uix-<type>-foundry` theme variable for the given uix-node.
 *
 * When a theme sets e.g. `uix-persistent-notification-item-foundry: my_foundry`,
 * UIX will apply the sparks defined in that foundry to every themed element of
 * that type — without needing a uix-forge custom card.
 *
 * Returns the foundry name string, or `null` if no foundry is configured.
 */
export async function get_theme_foundry(root: Uix): Promise<string | null> {
  if (!root.type) return null;

  await themesReady().catch(() => {});

  // Wait for next animation frame before computing styles: batches reflow reads
  await nextAnimationFrame();

  const el = root.parentElement ? root.parentElement : root;
  const cs = window.getComputedStyle(el);
  const theme = cs.getPropertyValue("--uix-theme") || cs.getPropertyValue("--card-mod-theme");

  const hs = await hass();
  if (!hs) return null;
  const themes = hs?.themes.themes ?? {};
  if (!themes[theme]) return null;

  const foundryName = themes[theme][`uix-${root.type}-foundry`];
  if (!foundryName || typeof foundryName !== "string") return null;

  return foundryName.trim() || null;
}
