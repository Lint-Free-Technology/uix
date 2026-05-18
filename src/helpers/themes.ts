import { hass } from "./hass";
import { yaml2json } from "./yaml2json";
import { Uix } from "../uix";
import { MacroConfig, UixStyle } from "./apply_uix";
import { themesReady } from "../theme-watcher";
import { nextAnimationFrame } from "./raf";

type ThemeTarget = {
  type?: string;
  classes?: string[];
  debug?: boolean;
  parentElement?: Element | null;
};

function cssValueIsTrue(v: string): boolean {
  if (!v) return false;
  const t = v.trim().toLowerCase();
  return t === "true" || t === "1" || t === "yes" || t === "on";
}

// Per-root in-flight promise maps: coalesces concurrent calls so multiple
// uix-nodes don't each schedule their own rAF-based style read.
const _themeInFlight = new WeakMap<Uix, Promise<UixStyle>>();
const _themeMacrosInFlight = new WeakMap<Uix, Promise<Record<string, MacroConfig | string>>>();

async function _getThemeData(root: ThemeTarget): Promise<{ cs: CSSStyleDeclaration; themeName: string; themes: Record<string, any> } | null> {
  if (!root.type) return null;

  await themesReady();
  await nextAnimationFrame();

  const el = root.parentElement ? root.parentElement : root;
  const cs = window.getComputedStyle(el as Element);
  const themeName = cs.getPropertyValue("--uix-theme") || cs.getPropertyValue("--card-mod-theme");

  const hs = await hass();
  if (!hs) return null;
  const themes = hs?.themes.themes ?? {};
  if (!themes[themeName]) return null;
  return { cs, themeName, themes };
}

export async function get_theme(root: Uix): Promise<UixStyle> {
  if (!root.type) return null;

  if (_themeInFlight.has(root)) return _themeInFlight.get(root)!;

  const promise = (async (): Promise<UixStyle> => {
    try {
      const themeData = await _getThemeData(root);
      if (!themeData) return {};
      const { cs, themeName: theme, themes } = themeData;

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
      const themeData = await _getThemeData(root).catch(() => null);
      if (!themeData) return {};
      const { themeName: theme, themes } = themeData;

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

export async function get_theme_foundry(root: ThemeTarget): Promise<string | null> {
  const themeData = await _getThemeData(root).catch(() => null);
  if (!themeData || !root.type) return null;

  const { themeName, themes } = themeData;
  const themeConfig = themes[themeName];
  const classes = root.classes ?? [];

  for (const cls of classes) {
    const foundry = themeConfig[`uix-${root.type}-${cls}-foundry`] || themeConfig[`card-mod-${root.type}-${cls}-foundry`];
    if (typeof foundry === "string" && foundry.trim()) return foundry.trim();
  }

  const foundry = themeConfig[`uix-${root.type}-foundry`] || themeConfig[`card-mod-${root.type}-foundry`];
  return typeof foundry === "string" && foundry.trim() ? foundry.trim() : null;
}
