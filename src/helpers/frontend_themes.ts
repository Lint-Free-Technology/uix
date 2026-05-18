import { hass } from "./hass";
import { normalizeThemeName } from "./theme_utils";

type ApplyThemesOnElement = (
  element: HTMLElement,
  themes: any,
  selectedTheme?: string,
  themeSettings?: any,
  main?: boolean
) => void;

let _cachedApplyThemesOnElement: ApplyThemesOnElement | null | undefined;
let _warnedApplyThemesLookupFailure = false;
const MAX_SCAN_DEPTH = 4;
const WEBPACK_CHUNK_BRIDGE_PREFIX = "uix-theme-bridge";
let _webpackBridgeChunkCounter = 0;

function debugThemeBridge(...args: any[]) {
  if ((window as any)?.uixThemeDebug) {
    console.debug("UIX Theme Bridge:", ...args);
  }
}

function warnApplyThemesLookupFailureOnce() {
  if (_warnedApplyThemesLookupFailure) return;
  _warnedApplyThemesLookupFailure = true;
  console.warn(
    "UIX: Unable to resolve Home Assistant applyThemesOnElement() from frontend runtime. " +
    "uix.theme local theme application is disabled for this session."
  );
}

function looksLikeApplyThemesOnElement(fn: Function): boolean {
  // Heuristic fallback for minified webpack exports where the original symbol
  // name may not survive. If this stops matching on a future HA version,
  // resolution still fails safely and UIX falls back without crashing.
  const src = Function.prototype.toString.call(fn);
  return (
    fn.length >= 2 &&
    fn.length <= 5 &&
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
  if (!value || seen.has(value) || depth > MAX_SCAN_DEPTH) return undefined;
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
    // Inject a unique runtime chunk to access webpack's require function.
    win[chunkKey].push([
      [
        `${WEBPACK_CHUNK_BRIDGE_PREFIX}-${++_webpackBridgeChunkCounter}`,
      ],
      {},
      (req: any) => {
        webpackRequire = req;
      },
    ]);
  } catch (e) {
    debugThemeBridge("Failed to extract webpack require from runtime chunk push", e);
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
  if (!entitiesUpdatedSource) {
    debugThemeBridge("hui-entities-card.updated source unavailable; using generic module scan");
  }
  // This is a best-effort optimization path based on current HA internals.
  // Matching failure only affects scan order; resolver still uses the general
  // module/export scan and then falls back safely if nothing is found.
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
  const moduleScore = new Map<string, number>();
  const prioritized = preferEntitiesPath
    ? moduleIds.sort((a, b) => {
      if (!moduleScore.has(a)) {
        const sa = String(factories[a]);
        moduleScore.set(
          a,
          Number(sa.includes("hui-entities-card")) +
          Number(sa.includes("_config.theme")) +
          Number(sa.includes("_hass.themes"))
        );
      }
      if (!moduleScore.has(b)) {
        const sb = String(factories[b]);
        moduleScore.set(
          b,
          Number(sb.includes("hui-entities-card")) +
          Number(sb.includes("_config.theme")) +
          Number(sb.includes("_hass.themes"))
        );
      }
      return (moduleScore.get(b) ?? 0) - (moduleScore.get(a) ?? 0);
    })
    : moduleIds;

  for (const id of prioritized) {
    try {
      webpackRequire(id);
    } catch (e) {
      debugThemeBridge(`Error requiring webpack module ${id} during applyThemes resolver`, e);
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
    applyThemesOnElement(element, hs.themes, normalizeThemeName(selectedTheme));
    return true;
  } catch (e) {
    console.error("UIX: Error applying local theme on element:", element, e);
    return false;
  }
}
