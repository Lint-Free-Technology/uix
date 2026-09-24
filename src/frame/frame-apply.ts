import { apply_uix } from "../helpers/apply_uix";
import { hass } from "../helpers/hass";
import { themesReady } from "../theme-watcher";
import { applyFrameStyles } from "./frame-style-renderer";

function isLitRoot(root: any): boolean {
  return (
    typeof root?.render === "function" &&
    typeof root?.requestUpdate === "function" &&
    typeof root?.updateComplete?.then === "function"
  );
}

async function resolveThemeType(types: string[], frameHass?: any): Promise<string | undefined> {
  if (!types.length) return undefined;

  if (!frameHass) await themesReady().catch(() => {});
  const hs: any = frameHass || await hass();
  const selected = hs?.themes?.theme === "default" ? hs?.themes?.default_theme : hs?.themes?.theme;
  const selectedTheme = hs?.themes?.themes?.[selected] ?? {};
  const uixThemeName = selectedTheme["uix-theme"] || selectedTheme["card-mod-theme"] || selected;
  const theme = hs?.themes?.themes?.[uixThemeName] ?? {};

  return types.find((type) =>
    theme[`uix-${type}-yaml`] !== undefined ||
    theme[`card-mod-${type}-yaml`] !== undefined ||
    theme[`uix-${type}`] !== undefined ||
    theme[`card-mod-${type}`] !== undefined
  );
}

window.addEventListener("uix-bootstrap", async (event: Event) => {
  event.stopPropagation();
  await applyFrameStylesForBootstrap();
});

async function applyFrameStylesForBootstrap() {
  const options = window.uixFrameOptions;
  if (!options?.roots?.length || !options.themeTypes?.length) return;

  let root: any;
  while (!root) {
    root = options.roots.map((name) => document.querySelector(name)).find(Boolean);
    if (!root) await new Promise((resolve) => window.setTimeout(resolve, 100));
  }

  if (root.localName?.includes("-")) await customElements.whenDefined(root.localName);
  const frameHass = options.hass;
  if (frameHass && !root.hass) root.hass = frameHass;
  if (!frameHass) {
    while (!root.hass) await new Promise((resolve) => window.setTimeout(resolve, 100));
  }
  const hs = frameHass || root.hass;
  if (root.updateComplete) await root.updateComplete;

  const primaryBackground = window.getComputedStyle(root).getPropertyValue("--primary-background-color");
  let theme: string | undefined;
  if (!primaryBackground) {
    theme = hs?.themes?.theme;
    theme = theme === "default" ? hs?.themes?.default_theme : theme;
  }

  const type = await resolveThemeType(options.themeTypes, hs);
  if (type) {
    if (isLitRoot(root)) {
      apply_uix(root, type, theme === undefined ? undefined : { theme });
    } else {
      applyFrameStyles(root, type, theme);
    }
  }
}

// uix.ts can dispatch before this module is evaluated because apply_uix
// imports it. frame-bootstrap records that early event for us.
if ((window as any).uixFrameBootstrapRequested) {
  void applyFrameStylesForBootstrap();
}
