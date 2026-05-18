import { hass } from "./hass";
import { hex2rgb } from "./common/color/convert_color";
import { normalizeThemeName } from "./theme_utils";

interface ProcessedTheme {
  keys: Record<string, "">;
  styles: Record<string, string>;
}

type ThemeVars = Record<string, any>;
type ThemeDefinition = ThemeVars & {
  modes?: {
    light?: ThemeVars;
    dark?: ThemeVars;
  };
};

type HassThemes = {
  darkMode?: boolean;
  theme?: string;
  themes?: Record<string, ThemeDefinition>;
};

type ThemedElement = HTMLElement & {
  __themes?: {
    cacheKey?: string;
    keys?: Record<string, "">;
  };
};

let processedThemesCache: Record<string, ProcessedTheme> = {};

export function invalidateFrontendThemeCache(): void {
  processedThemesCache = {};
}

const processTheme = (
  themeCacheKey: string,
  theme: ThemeVars
): ProcessedTheme | undefined => {
  if (!theme || !Object.keys(theme).length) return undefined;

  const styles: Record<string, string> = {};
  const keys: Record<string, ""> = {};

  for (const key of Object.keys(theme)) {
    const prefixedKey = `--${key}`;
    const value = String(theme[key]);
    styles[prefixedKey] = value;
    keys[prefixedKey] = "";

    if (!value.startsWith("#")) continue;

    const rgbKey = `rgb-${key}`;
    if (theme[rgbKey] !== undefined) continue;

    let rgb: [number, number, number];
    try {
      rgb = hex2rgb(value);
    } catch {
      continue;
    }

    const prefixedRgbKey = `--${rgbKey}`;
    styles[prefixedRgbKey] = `${rgb.join(",")}`;
    keys[prefixedRgbKey] = "";
  }

  processedThemesCache[themeCacheKey] = { styles, keys };
  return { styles, keys };
};

// Vendored/adapted from Home Assistant frontend:
// src/common/dom/apply_themes_on_element.ts (60c5bea6e007b1e6e7ce9e9a86be4659b9565ab3),
// synced in UIX on 2026-05-18.
export const applyThemesOnElement = (
  element: HTMLElement,
  themes: HassThemes,
  selectedTheme?: string,
  themeSettings?: { dark?: boolean },
  main?: boolean
): void => {
  const target = element as ThemedElement;
  const themeToApply = selectedTheme || (main ? themes?.theme : undefined);
  const darkMode =
    themeSettings?.dark !== undefined
      ? themeSettings.dark
      : themes?.darkMode || false;

  // Cache key for processed CSS variable maps of the selected theme/mode.
  const themeCacheKey = themeToApply
    ? `${themeToApply}__${darkMode ? "dark" : "light"}`
    : undefined;
  let themeRules: ThemeVars = {};

  if (
    themeToApply &&
    themeToApply !== "default" &&
    themes?.themes?.[themeToApply]
  ) {
    const { modes, ...baseThemeRules } = themes.themes[themeToApply];
    themeRules = { ...themeRules, ...baseThemeRules };

    if (modes) {
      themeRules = {
        ...themeRules,
        ...(darkMode ? modes.dark : modes.light),
      };
    }
  }

  if (!target.__themes?.keys && !Object.keys(themeRules).length) {
    return;
  }

  const newTheme =
    Object.keys(themeRules).length && themeCacheKey
      ? processedThemesCache[themeCacheKey] || processTheme(themeCacheKey, themeRules)
      : undefined;

  const styles: Record<string, string> = {
    ...(target.__themes?.keys || {}),
    ...(newTheme?.styles || {}),
  };

  target.__themes = { cacheKey: themeCacheKey, keys: newTheme?.keys };

  for (const styleName of Object.keys(styles)) {
    element.style.setProperty(styleName, styles[styleName]);
  }
};

export async function applyFrontendThemeOnElement(
  element: HTMLElement,
  selectedTheme?: string
): Promise<boolean> {
  if (!element) return false;

  const hs = await hass();
  if (!hs?.themes) return false;

  try {
    applyThemesOnElement(element, hs.themes, normalizeThemeName(selectedTheme));
    return true;
  } catch (e) {
    console.error("UIX: Error applying local theme on element:", element, e);
    return false;
  }
}
