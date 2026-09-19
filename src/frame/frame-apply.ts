import { apply_uix } from "../helpers/apply_uix";
import { hass } from "../helpers/hass";
import { themesReady } from "../theme-watcher";

async function resolveThemeType(types: string[]): Promise<string | undefined> {
  if (!types.length) return undefined;

  await themesReady().catch(() => {});
  const hs: any = await hass();
  const selected = hs?.themes?.theme === "default" ? hs?.themes?.default_theme : hs?.themes?.theme;
  const selectedTheme = hs?.themes?.themes?.[selected] ?? {};
  const uixThemeName = selectedTheme["uix-theme"] || selectedTheme["card-mod-theme"] || selected;
  const theme = hs?.themes?.themes?.[uixThemeName] ?? {};

  return types.find((type) =>
    theme[`uix-${type}-yaml`] !== undefined ||
    theme[`card-mod-${type}-yaml`] !== undefined ||
    theme[`uix-${type}`] !== undefined ||
    theme[`card-mod-${type}`] !== undefined
  ) ?? types[0];
}

window.addEventListener("uix-bootstrap", async (event: Event) => {
  event.stopPropagation();

  const options = window.uixFrameOptions;
  if (!options?.roots?.length || !options.themeTypes?.length) return;

  let root: any;
  while (!root) {
    root = options.roots.map((name) => document.querySelector(name)).find(Boolean);
    if (!root) await new Promise((resolve) => window.setTimeout(resolve, 100));
  }

  if (root.localName?.includes("-")) await customElements.whenDefined(root.localName);
  if (!root.hass && options.hass) root.hass = options.hass;
  while (!root.hass) await new Promise((resolve) => window.setTimeout(resolve, 100));
  if (root.updateComplete) await root.updateComplete;

  const primaryBackground = window.getComputedStyle(root).getPropertyValue("--primary-background-color");
  let theme: string | undefined;
  if (!primaryBackground) {
    theme = root.hass?.themes?.theme;
    theme = theme === "default" ? root.hass?.themes?.default_theme : theme;
  }

  const type = await resolveThemeType(options.themeTypes);
  if (type) apply_uix(root, type, theme === undefined ? undefined : { theme });
});
