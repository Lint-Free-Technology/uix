import { hass } from "./hass";

type ApplyThemesOnElement = (
  element: HTMLElement,
  themes: any,
  selectedTheme?: string,
  themeSettings?: any,
  main?: boolean
) => void;

let _cachedApplyThemesOnElement: ApplyThemesOnElement | null | undefined;
let _warnedApplyThemesLookupFailure = false;

function warnApplyThemesLookupFailureOnce() {
  if (_warnedApplyThemesLookupFailure) return;
  _warnedApplyThemesLookupFailure = true;
  console.warn(
    "UIX: Unable to resolve Home Assistant applyThemesOnElement() from frontend runtime. " +
    "uix.theme local theme application is disabled for this session."
  );
}

function normalizeTheme(theme?: string): string | undefined {
  if (typeof theme !== "string") return undefined;
  const trimmed = theme.trim();
  return trimmed.length ? trimmed : undefined;
}

function looksLikeApplyThemesOnElement(fn: Function): boolean {
  const src = Function.prototype.toString.call(fn);
  return (
    src.includes("__themes") &&
    src.includes("themes") &&
    src.includes("style.setProperty")
  );
}

function scanExportTreeForApplyThemes(
  value: any,
  seen = new Set<any>(),
  depth = 0
): ApplyThemesOnElement | undefined {
  if (!value || seen.has(value) || depth > 4) return undefined;
  seen.add(value);

  if (typeof value === "function") {
    if (value.name === "applyThemesOnElement" || looksLikeApplyThemesOnElement(value)) {
      return value as ApplyThemesOnElement;
    }
    return undefined;
  }

  if (typeof value !== "object") return undefined;

  if (typeof value.applyThemesOnElement === "function") {
    return value.applyThemesOnElement as ApplyThemesOnElement;
  }

  for (const key of Object.keys(value)) {
    const found = scanExportTreeForApplyThemes(value[key], seen, depth + 1);
    if (found) return found;
  }
  return undefined;
}

function getWebpackRequireFromRuntime() {
  const win = window as any;
  if (win.__uixWebpackRequire) return win.__uixWebpackRequire;

  const chunkKey = Object.keys(win).find((k) => k.startsWith("webpackChunk"));
  if (!chunkKey || !Array.isArray(win[chunkKey])) return undefined;

  let webpackRequire: any;
  try {
    win[chunkKey].push([
      [`uix-theme-bridge-${Date.now()}`],
      {},
      (req: any) => {
        webpackRequire = req;
      },
    ]);
  } catch (_e) {
    return undefined;
  }

  if (webpackRequire) {
    win.__uixWebpackRequire = webpackRequire;
  }
  return webpackRequire;
}

function resolveApplyThemesOnElementFromWebpack(): ApplyThemesOnElement | undefined {
  const webpackRequire = getWebpackRequireFromRuntime();
  if (!webpackRequire) return undefined;

  const entitiesUpdatedSource = customElements
    .get("hui-entities-card")
    ?.prototype?.updated?.toString?.() ?? "";
  const preferEntitiesPath =
    entitiesUpdatedSource.includes("_config.theme") &&
    entitiesUpdatedSource.includes("_hass.themes");

  const cacheModules = Object.values(webpackRequire.c ?? {});
  for (const mod of cacheModules) {
    const found = scanExportTreeForApplyThemes((mod as any)?.exports);
    if (found) return found;
  }

  const factories = webpackRequire.m ?? {};
  const moduleIds = Object.keys(factories);
  const prioritized = preferEntitiesPath
    ? moduleIds.sort((a, b) => {
      const sa = String(factories[a]);
      const sb = String(factories[b]);
      const score = (s: string) =>
        Number(s.includes("hui-entities-card")) +
        Number(s.includes("_config.theme")) +
        Number(s.includes("_hass.themes"));
      return score(sb) - score(sa);
    })
    : moduleIds;

  for (const id of prioritized) {
    try {
      webpackRequire(id);
    } catch (_e) {
      continue;
    }
    const found = scanExportTreeForApplyThemes(webpackRequire.c?.[id]?.exports);
    if (found) return found;
  }

  return undefined;
}

function resolveApplyThemesOnElement(): ApplyThemesOnElement | null {
  if (_cachedApplyThemesOnElement !== undefined) return _cachedApplyThemesOnElement;

  const win = window as any;
  if (typeof win.applyThemesOnElement === "function") {
    _cachedApplyThemesOnElement = win.applyThemesOnElement;
    return _cachedApplyThemesOnElement;
  }

  _cachedApplyThemesOnElement = resolveApplyThemesOnElementFromWebpack() ?? null;
  if (!_cachedApplyThemesOnElement) {
    warnApplyThemesLookupFailureOnce();
  }
  return _cachedApplyThemesOnElement;
}

export async function applyFrontendThemeOnElement(
  element: HTMLElement,
  selectedTheme?: string
): Promise<boolean> {
  if (!element) return false;
  const applyThemesOnElement = resolveApplyThemesOnElement();
  if (!applyThemesOnElement) return false;

  const hs = await hass();
  if (!hs?.themes) return false;

  try {
    applyThemesOnElement(element, hs.themes, normalizeTheme(selectedTheme));
    return true;
  } catch (e) {
    console.error("UIX: Error applying local theme on element:", element, e);
    return false;
  }
}
