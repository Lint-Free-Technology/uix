import { hass } from "./helpers/hass";

/**
 * How long (ms) to wait after a style-render event or `uix_update` before
 * reading CSS variables.  Gives the UIX async rendering pipeline time to
 * flush before we call `getComputedStyle`.
 */
export const BACKGROUND_REFRESH_DELAY_MS = 500;

/**
 * How long (ms) to wait for `ha-camera-stream` to be registered before giving
 * up and skipping the camera background.
 */
const CAMERA_ELEMENT_LOAD_TIMEOUT_MS = 15_000;

/** CSS variable that selects the camera entity for a view background stream. */
const VAR_CAMERA = "--uix-view-background-camera-entity";

/** CSS variable that selects any entity whose entity_picture is the background. */
const VAR_IMAGE = "--uix-view-background-image-entity";

const CAMERA_DOMAIN = "camera";

// ---------------------------------------------------------------------------
// Per-view state
// ---------------------------------------------------------------------------

interface BgEntry {
  entityId: string;
  /** The fixed-position container prepended to <body>. */
  container: HTMLElement;
}

interface ViewBg {
  camera: BgEntry | null;
  image: BgEntry | null;
}

const _state = new WeakMap<HTMLElement, ViewBg>();

function _get(view: HTMLElement): ViewBg {
  if (!_state.has(view)) {
    _state.set(view, { camera: null, image: null });
  }
  return _state.get(view)!;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function _readVar(view: HTMLElement, name: string): string {
  return window
    .getComputedStyle(view)
    .getPropertyValue(name)
    .trim()
    .replace(/^['"]|['"]$/g, "");
}

function _createContainer(): HTMLDivElement {
  const el = document.createElement("div");
  el.setAttribute("uix-view-background", "");
  // Prepend to <body> so it sits behind all HA shadow-root content.
  // `pointer-events: none` prevents the element blocking UI interactions.
  el.style.cssText =
    "position:fixed;top:0;left:0;width:100%;height:100%;overflow:hidden;pointer-events:none;";
  return el;
}

async function _signPath(hs: any, path: string): Promise<string> {
  try {
    const result = await hs.callWS({
      type: "auth/sign_path",
      path,
      expires: 3600,
    });
    return result.path;
  } catch (e) {
    console.warn(`UIX: Failed to sign path '${path}'; falling back to unsigned URL.`, e);
    return path;
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Remove all background containers associated with `view`.
 * Called from the `hui-view` patch `disconnectedCallback`.
 */
export function cleanupViewBackground(view: HTMLElement): void {
  const bg = _state.get(view);
  if (bg) {
    bg.camera?.container.remove();
    bg.image?.container.remove();
    _state.delete(view);
  }
}

/**
 * Read the two background CSS variables from the view's computed styles and
 * create / update / remove the corresponding background elements.
 *
 * Safe to call repeatedly — it reuses existing containers when the entity has
 * not changed, and tears down stale containers when it has.
 */
export async function manageViewBackground(view: HTMLElement): Promise<void> {
  const hs = await hass();
  if (!hs) return;

  const cameraId = _readVar(view, VAR_CAMERA);
  const imageId = _readVar(view, VAR_IMAGE);
  const bg = _get(view);

  // --- Camera background ---
  if (cameraId !== (bg.camera?.entityId ?? "")) {
    bg.camera?.container.remove();
    bg.camera = null;

    if (cameraId) {
      if (cameraId.split(".")[0] !== CAMERA_DOMAIN) {
        console.warn(
          `UIX: ${VAR_CAMERA} must be a camera entity (got '${cameraId}')`
        );
      } else {
        await _setupCameraBackground(hs, bg, cameraId);
      }
    }
  } else if (bg.camera) {
    // Entity unchanged — keep hass up to date for token refresh / reconnection.
    const streamEl = bg.camera.container.querySelector(
      "ha-camera-stream"
    ) as any;
    if (streamEl) streamEl.hass = hs;
  }

  // --- Image background ---
  if (imageId !== (bg.image?.entityId ?? "")) {
    bg.image?.container.remove();
    bg.image = null;

    if (imageId) {
      await _setupImageBackground(hs, bg, imageId);
    }
  }
}

// ---------------------------------------------------------------------------
// Camera background
// ---------------------------------------------------------------------------

async function _setupCameraBackground(
  hs: any,
  bg: ViewBg,
  entityId: string
): Promise<void> {
  // Wait for ha-camera-stream to be registered (it is loaded lazily by HA).
  const defined = await Promise.race([
    customElements.whenDefined("ha-camera-stream").then(() => true),
    new Promise<boolean>((resolve) =>
      setTimeout(() => resolve(false), CAMERA_ELEMENT_LOAD_TIMEOUT_MS)
    ),
  ]);

  if (!defined) {
    console.warn(
      "UIX: ha-camera-stream is not available; camera background skipped."
    );
    return;
  }

  const container = _createContainer();

  const streamEl = document.createElement("ha-camera-stream") as any;
  streamEl.style.cssText = "display:block;width:100%;height:100%;";
  streamEl.muted = true;
  streamEl.setAttribute("muted", "");
  streamEl.controls = false;
  streamEl.entityId = entityId;
  container.appendChild(streamEl);

  document.body.prepend(container);
  bg.camera = { entityId, container };

  // Providing hass triggers stream negotiation inside ha-camera-stream.
  streamEl.hass = hs;
}

// ---------------------------------------------------------------------------
// Image background
// ---------------------------------------------------------------------------

async function _setupImageBackground(
  hs: any,
  bg: ViewBg,
  entityId: string
): Promise<void> {
  const entity = hs.states[entityId];
  const picturePath = entity?.attributes?.entity_picture as string | undefined;

  if (!picturePath) {
    console.warn(
      `UIX: entity '${entityId}' has no entity_picture; image background skipped.`
    );
    return;
  }

  const signedUrl = await _signPath(hs, picturePath);

  const container = _createContainer();
  container.style.backgroundImage = `url('${signedUrl}')`;
  container.style.backgroundSize = "cover";
  container.style.backgroundPosition = "center";
  container.style.backgroundRepeat = "no-repeat";

  document.body.prepend(container);
  bg.image = { entityId, container };
}
