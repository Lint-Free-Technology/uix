import { load, YAML11_SCHEMA } from "js-yaml";
import { normalizeThemeName } from "./theme_utils";

const descriptorNames = [
  "ascentOverride", "descentOverride", "display", "featureSettings",
  "lineGapOverride", "stretch", "style", "unicodeRange", "variationSettings",
  "weight",
] as const;

type FontConfig = {
  family: string;
  source: string;
  descriptors: FontFaceDescriptors;
};

function parseFont(name: string, entry: unknown): FontConfig {
  if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
    throw new Error("Each font must be a mapping with a source");
  }
  const font = entry as Record<string, unknown>;
  if (Object.keys(font).some((key) => !["family", "source", "descriptors"].includes(key))) {
    throw new Error("Supported font keys are family, source, and descriptors");
  }
  const family = font.family ?? name;
  if (typeof family !== "string" || !family.trim() ||
      typeof font.source !== "string" || !font.source.trim()) {
    throw new Error("Font family and source must be non-empty strings");
  }
  const input = font.descriptors ?? {};
  if (typeof input !== "object" || Array.isArray(input) ||
      Object.keys(input).some((key) => !descriptorNames.includes(key as any))) {
    throw new Error("Font descriptors must be a mapping of FontFace descriptor names");
  }
  const descriptors: FontFaceDescriptors = {};
  // A fixed order also deduplicates entries whose descriptor keys are reordered.
  for (const name of descriptorNames) {
    const value = input[name];
    if (value === undefined) continue;
    if (typeof value !== "string" && !(name === "weight" && typeof value === "number")) {
      throw new Error(`Font descriptor ${name} must be a string (weight also accepts a number)`);
    }
    descriptors[name] = String(value) as any;
  }
  return { family: family.trim(), source: font.source.trim(), descriptors };
}

/** Owns only UIX's font faces in this document, never fonts registered elsewhere. */
export class ThemeFonts {
  private fonts = new Map<string, FontFace>();
  private config: unknown;

  update(themes: any, retry = false): void {
    const mode = themes?.darkMode ? "dark" : "light";
    const selected = themes?.theme === "default"
      ? themes?.default_theme
      : themes?.theme;
    const definition = (name: string) => {
      const theme = themes?.themes?.[name];
      return { ...theme, ...theme?.modes?.[mode] };
    };
    const selectedTheme = definition(selected);
    const themeName = normalizeThemeName(selectedTheme["uix-theme"]) ||
      normalizeThemeName(selectedTheme["card-mod-theme"]) || selected;
    const config = definition(themeName)["uix-fonts"];
    if (!retry && config === this.config) return;
    this.config = config;

    const desired = new Map<string, FontConfig>();
    if (config !== undefined && config !== "") {
      try {
        if (typeof config !== "string") {
          throw new Error("Use uix-fonts: | followed by a YAML mapping of fonts");
        }
        const entries = load(config, { schema: YAML11_SCHEMA });
        if (!entries || typeof entries !== "object" || Array.isArray(entries)) {
          throw new Error("uix-fonts must contain a YAML mapping");
        }
        Object.entries(entries).forEach(([name, entry]) => {
          try {
            const font = parseFont(name, entry);
            desired.set(JSON.stringify(font), font);
          } catch (error) {
            console.warn(`UIX: Invalid uix-fonts entry ${name} in theme ${themeName}:`, error);
          }
        });
      } catch (error) {
        console.warn(`UIX: Error parsing uix-fonts in theme ${themeName}:`, error);
      }
    }

    for (const [key, face] of this.fonts) {
      if (!desired.has(key)) {
        document.fonts.delete(face);
        this.fonts.delete(key);
      }
    }
    if (!desired.size) return;
    if (typeof FontFace === "undefined" || !document.fonts) {
      console.warn("UIX: uix-fonts requires the CSS Font Loading API");
      return;
    }
    for (const [key, font] of desired) {
      if (this.fonts.has(key)) continue;
      try {
        const face = new FontFace(font.family, font.source, font.descriptors);
        this.fonts.set(key, face);
        document.fonts.add(face);
        void face.load().catch((error) => {
          // A theme switch may already have removed or replaced this face.
          if (this.fonts.get(key) !== face) return;
          document.fonts.delete(face);
          this.fonts.delete(key);
          console.warn(`UIX: Failed to load uix-fonts family ${font.family} in theme ${themeName}:`, error);
        });
      } catch (error) {
        const face = this.fonts.get(key);
        if (face) document.fonts.delete(face);
        this.fonts.delete(key);
        console.warn(`UIX: Invalid uix-fonts family ${font.family} in theme ${themeName}:`, error);
      }
    }
  }
}
