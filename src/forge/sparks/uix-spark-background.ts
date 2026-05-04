import { PropertyValues } from "lit";
import { UixForgeSparkBase } from "./uix-spark-base";
import { BackgroundTargetAdapter, getBackgroundTargetAdapter } from "./background-target-adapters";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const BG_ID_ATTR = "data-uix-spark-bg-id";

const CAMERA_DOMAIN = "camera";

/** How long (ms) to wait for `ha-camera-stream` to be registered. */
const CAMERA_ELEMENT_LOAD_TIMEOUT_MS = 15_000;

/** How long (ms) to keep the spinner before forcibly removing it. */
const SPINNER_FALLBACK_MS = 30_000;

const CAMERA_POSITION_MAP: Record<string, readonly [string, string]> = {
  center:         ["center",     "center"],
  top:            ["center",     "flex-start"],
  bottom:         ["center",     "flex-end"],
  left:           ["flex-start", "center"],
  right:          ["flex-end",   "center"],
  "top-left":     ["flex-start", "flex-start"],
  "top-right":    ["flex-end",   "flex-start"],
  "bottom-left":  ["flex-start", "flex-end"],
  "bottom-right": ["flex-end",   "flex-end"],
};

// ---------------------------------------------------------------------------
// Module-level stream element cache with connected-parking
// ---------------------------------------------------------------------------

interface _StreamCacheEntry {
  el: HaCameraStreamElement;
  /** Sized wrapper div that hosts `el` inside the parking holder. */
  wrapper: HTMLDivElement;
  timer: ReturnType<typeof setTimeout>;
}

/**
 * Off-screen holder that keeps cached `ha-camera-stream` elements *connected*
 * to the DOM while they are between uses.  Staying connected ensures the
 * element's internal stream (MPEG/HLS/WebRTC) is not torn down, which
 * prevents "forbidden" token-expiry errors when the element is re-used.
 *
 * Created lazily and re-created if it is ever detached.
 */
let _streamParkingHolder: HTMLDivElement | null = null;

function _getParkingHolder(): HTMLDivElement {
  if (!_streamParkingHolder || !_streamParkingHolder.isConnected) {
    _streamParkingHolder = document.createElement("div");
    _streamParkingHolder.style.cssText =
      "position:fixed;left:-9999px;top:-9999px;width:0;height:0;" +
      "overflow:hidden;opacity:0;pointer-events:none;visibility:hidden;";
    _streamParkingHolder.setAttribute("aria-hidden", "true");
    document.body.appendChild(_streamParkingHolder);
  }
  return _streamParkingHolder;
}

/**
 * Persistent cache of `ha-camera-stream` elements keyed by
 * `"entityId:WxH"`.  Shared across all `UixForgeSparkBackground` instances.
 *
 * While cached, each element is **parked connected** inside a sized off-screen
 * wrapper so its internal stream negotiation stays alive.  On re-use the
 * element is detached from the parking wrapper and re-inserted into the live
 * background container.
 *
 * Entries expire automatically after the per-spark TTL (default 20 s).
 */
const _streamElementCache = new Map<string, _StreamCacheEntry>();

function _cacheStreamEl(
  entityId: string,
  w: number,
  h: number,
  el: HaCameraStreamElement,
  ttlMs: number
): void {
  if (w <= 0 || h <= 0) {
    // Cannot form a valid cache key — discard the element.
    el.remove();
    return;
  }
  const key = `${entityId}:${w}x${h}`;
  const existing = _streamElementCache.get(key);
  if (existing) {
    clearTimeout(existing.timer);
    if (existing.el !== el) {
      // Different element for same key — evict the old one.
      existing.el.remove();
      existing.wrapper.remove();
    }
  }

  // Park the element connected inside a sized wrapper so ha-camera-stream
  // keeps its internal stream alive while waiting for the next reuse.
  // The wrapper is inserted into the parking holder BEFORE el is moved into
  // it so that the transfer is a single connected→connected DOM move.  A
  // direct move fires disconnectedCallback + connectedCallback synchronously
  // in one operation; any async updates scheduled inside disconnectedCallback
  // therefore see the element already in its new parent when they run.
  const wrapper = document.createElement("div") as HTMLDivElement;
  wrapper.style.cssText = `width:${w}px;height:${h}px;overflow:hidden;`;
  _getParkingHolder().appendChild(wrapper);
  wrapper.appendChild(el);

  const timer = setTimeout(() => {
    const entry = _streamElementCache.get(key);
    if (entry?.el === el) {
      entry.el.remove();
      entry.wrapper.remove();
      _streamElementCache.delete(key);
    }
  }, ttlMs);
  _streamElementCache.set(key, { el, timer, wrapper });
}

function _popCachedStreamEl(
  entityId: string,
  w: number,
  h: number
): HaCameraStreamElement | null {
  if (w <= 0 || h <= 0) return null;
  const key = `${entityId}:${w}x${h}`;
  const entry = _streamElementCache.get(key);
  if (!entry) return null;
  clearTimeout(entry.timer);
  _streamElementCache.delete(key);
  // Do NOT call entry.el.remove() — leave el connected in its parking wrapper
  // so the caller can perform a direct DOM move (container.appendChild(el))
  // without an intermediate disconnected state.  A direct move fires
  // disconnectedCallback + connectedCallback synchronously in one operation,
  // so any async updates scheduled by disconnectedCallback already see the
  // element connected to its new parent when they execute.
  // Schedule the now-empty wrapper for removal in the next microtask.
  const wrapper = entry.wrapper;
  Promise.resolve().then(() => wrapper.remove());
  return entry.el;
}

/**
 * Background sub-property shorthand keys to CSS property names.
 * Used when `background` config value is a mapping object.
 */
const BACKGROUND_SUB_PROPS: Record<string, string> = {
  color:      "background-color",
  image:      "background-image",
  position:   "background-position",
  size:       "background-size",
  repeat:     "background-repeat",
  attachment: "background-attachment",
  origin:     "background-origin",
  clip:       "background-clip",
};

/** Prefix that identifies a Home Assistant media-source URI. */
const MEDIA_SOURCE_PREFIX = "media-source://";

/**
 * If `url` starts with `"media-source://"`, resolve it to a playable/displayable
 * URL via the HA WebSocket `media_source/resolve_media` command.
 *
 * Returns the resolved URL on success, or the original `url` string if `hass`
 * is unavailable or the resolution fails (with a console warning).
 */
async function _resolveMediaSourceUrl(hass: any, url: string): Promise<string> {
  if (!url.startsWith(MEDIA_SOURCE_PREFIX)) return url;
  if (!hass) return url;
  try {
    const result = await hass.callWS({
      type: "media_source/resolve_media",
      media_content_id: url,
    });
    return (result as { url: string }).url ?? url;
  } catch (e) {
    console.warn(
      `UIX Forge background spark: failed to resolve media source '${url}'.`,
      e
    );
    return url;
  }
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface HaCameraStreamElement extends HTMLElement {
  hass: unknown;
  stateObj: unknown;
  muted: boolean;
  controls: boolean;
}

// ---------------------------------------------------------------------------
// Spark
// ---------------------------------------------------------------------------


/**
 * Background spark — places a background layer behind a target element
 * inside UIX Forge.
 *
 * The background container is injected as the **first child** of the `for`
 * element with `position: absolute; inset: 0; z-index: -1` so it sits behind
 * all naturally-stacked siblings.  The `for` element has
 * `position: relative; isolation: isolate` applied (and restored on
 * disconnect) to contain the z-index stack.
 *
 * Supported background types (first non-empty value wins):
 *   - `camera_entity`  — live `ha-camera-stream` stream
 *   - `image_entity`   — `entity_picture` attribute of any entity
 *   - `video_url`      — `<video>` element (autoplay, muted, loop)
 *   - `image_url`      — image URL applied as `background-image`
 *   - `background`     — full CSS `background` shorthand string **or** a
 *                        mapping of background sub-properties
 *
 * Camera zoom / pan:
 *   `camera_zoom`, `camera_pan_x`, `camera_pan_y` accept any CSS value
 *   (number, percentage, length, `var(…)` reference).  They are applied as
 *   a CSS `transform` on the `ha-camera-stream` element.
 *
 * Dissolving the target:
 *   `dissolve_target` modifies the `for` element so the background shows
 *   through.  Two forms are accepted:
 *   - String `opacity_<0-100>` — sets `opacity` on the `for` element.
 *   - List of CSS property objects — each key/value pair is applied as an
 *     inline style on the `for` element.
 *
 * Class:
 *   `class` assigns additional CSS class(es) to the background container so
 *   users can target it with UIX styling.
 *
 * Opacity:
 *   `opacity` sets the CSS `opacity` on the background container (0–1).
 *   Useful for dimming the background without touching the foreground element.
 */
export class UixForgeSparkBackground extends UixForgeSparkBase {
  type = "background";

  // ── Configuration ──────────────────────────────────────────────────────────
  private _for: string = "element";
  private _cameraEntity: string = "";
  private _imageEntity: string = "";
  private _videoUrl: string = "";
  private _imageUrl: string = "";
  private _background: string | Record<string, string> | null = null;
  private _cameraZoom: string = "";
  private _cameraPanX: string = "";
  private _cameraPanY: string = "";
  private _cameraPosition: string = "";
  private _dissolveTarget: string | Record<string, string>[] | null = null;
  private _class: string = "";
  /** CSS opacity (0–1) applied to the background container. Empty string = no override. */
  private _opacity: string = "";
  /** How long (ms) to keep a cached `ha-camera-stream` element after removal. */
  private _cameraCacheMs: number = 20_000;

  // ── Runtime state ──────────────────────────────────────────────────────────
  private readonly _id: string;
  /** The injected background container `<div>`. */
  private _containerEl: HTMLElement | null = null;
  /** The `for` element we are currently attached to. */
  private _forEl: HTMLElement | null = null;
  /** Target-element-type adapter (e.g. ha-card), or null for generic targets. */
  private _targetAdapter: BackgroundTargetAdapter | null = null;
  /** Live camera stream element (updated on hass changes). */
  private _streamEl: HaCameraStreamElement | null = null;
  /** Fill element inside the background container for `background` type. */
  private _bgFillEl: HTMLElement | null = null;
  /**
   * Last known non-zero container dimensions.  Stored immediately after a
   * successful camera container build so the cache key remains valid even if
   * `_containerEl` has been detached (offsetWidth/Height → 0) by the time
   * `_removeContainer()` is called.
   */
  private _lastKnownW: number = 0;
  private _lastKnownH: number = 0;
  /**
   * Active background key — entity ID, URL, or `"bg"` for the `background`
   * shorthand. Used to detect when the background source changes and the
   * container must be rebuilt.
   */
  private _activeBgKey: string = "";
  /**
   * Inline style values saved from the `for` element before `dissolve_target`
   * is applied, keyed by CSS property name.  Restored when the dissolve
   * config changes or the spark disconnects.
   */
  private _savedDissolveStyles: Map<string, string> = new Map();
  /**
   * Inline style values saved from the `for` element before layout helpers
   * (`position`, `isolation`) are applied.  Restored on disconnect.
   */
  private _savedLayoutStyles: Map<string, string> = new Map();

  constructor(controller: any, config: Record<string, any>) {
    super(controller, config);
    this._id = `uix-spark-bg-${Math.random().toString(36).slice(2, 11)}`;
    this._applyConfig(config);
  }

  configUpdated(config: Record<string, any>): void {
    super.configUpdated(config);
    this._applyConfig(config);
    // Apply the camera transform immediately so zoom/pan/position config
    // changes are visible without waiting for the async _attach() below.
    this._updateCameraTransform();
    // Start a fresh attach cycle, treating this as a config-only update:
    //   • _beginUpdate() cancels any in-flight _attach() from a prior
    //     updated() call.  Without this, a stale _attach() that already
    //     resolved forEl against the old _for selector would use the wrong
    //     element.
    //   • Passing an empty PropertyValues map keeps hassChanged = false, so
    //     _attach() will NOT re-assign hass/stateObj to ha-camera-stream.
    //     Re-assigning hass triggers stream re-negotiation; skipping it here
    //     is safe because the normal updated() → _attach() path handles hass
    //     updates via changedProperties.has("hass").
    const gen = this._beginUpdate();
    this._attach(gen, new Map() as PropertyValues);
  }

  private _applyConfig(config: Record<string, any>): void {
    this._for = config.for ?? "element";
    this._cameraEntity = config.camera_entity || "";
    this._imageEntity = config.image_entity || "";
    this._videoUrl = config.video_url || "";
    this._imageUrl = config.image_url || "";
    this._background = config.background ?? null;
    this._cameraZoom = config.camera_zoom != null ? String(config.camera_zoom) : "";
    this._cameraPanX = config.camera_pan_x != null ? String(config.camera_pan_x) : "";
    this._cameraPanY = config.camera_pan_y != null ? String(config.camera_pan_y) : "";
    this._cameraPosition = config.camera_position || "";
    this._dissolveTarget = config.dissolve_target ?? null;
    this._class = config.class || "";
    this._opacity = config.opacity != null ? String(config.opacity) : "";
    this._cameraCacheMs = config.camera_stream_cache_ms ?? 20_000;
  }

  // ── Lifecycle ──────────────────────────────────────────────────────────────

  updated(changedProperties: PropertyValues): void {
    const gen = this._beginUpdate();
    this._attach(gen, changedProperties);
  }

  connectedCallback(): void {
    const gen = this._beginUpdate();
    this._attach(gen);
  }

  disconnectedCallback(): void {
    this._cancelPending();
    this._cleanup();
  }

  // ── Private helpers ────────────────────────────────────────────────────────

  private _cleanup(): void {
    // Full teardown — stream is parked connected in the module-level cache so
    // it can be reused if the spark is reconnected within the TTL window.
    this._removeContainer();
    this._restoreDissolve();
    this._restoreLayout();
    this._forEl = null;
    this._targetAdapter = null;
  }

  /**
   * Remove the background container from the DOM and clear active state.
   *
   * The `ha-camera-stream` element (if any) is detached from the container
   * before removal and **parked connected** inside the module-level off-screen
   * holder (keyed by `"entityId:WxH"` in `_streamElementCache`).  Keeping the
   * element connected ensures the internal stream stays alive while waiting for
   * a rapid rebuild.  `_buildCameraContent` can then pop the element from the
   * cache and reuse it — avoiding a full re-negotiation — provided the entity
   * and rendered dimensions are unchanged and the TTL has not expired.
   */
  private _removeContainer(): void {
    if (this._containerEl) {
      if (this._streamEl) {
        // Use the last-known dimensions (stored at build time) in case the
        // container has already been detached (offsetWidth/Height would be 0).
        const w = this._containerEl.offsetWidth || this._lastKnownW;
        const h = this._containerEl.offsetHeight || this._lastKnownH;
        // Move directly from container to parking wrapper — do NOT call
        // this._streamEl.remove() first.  _cacheStreamEl inserts the wrapper
        // into the parking holder before moving el into it, so the transfer is
        // a single connected→connected DOM move with no mid-air disconnect.
        _cacheStreamEl(this._activeBgKey, w, h, this._streamEl, this._cameraCacheMs);
        this._streamEl = null;
      }
      this._containerEl.remove();
      this._containerEl = null;
    }
    this._bgFillEl = null;
    this._activeBgKey = "";
  }

  private _restoreDissolve(): void {
    if (!this._forEl) return;
    for (const [prop, origVal] of this._savedDissolveStyles) {
      if (origVal) {
        this._forEl.style.setProperty(prop, origVal);
      } else {
        this._forEl.style.removeProperty(prop);
      }
    }
    this._savedDissolveStyles.clear();
  }

  private _restoreLayout(): void {
    if (!this._forEl) return;
    // Let the adapter restore any descendant element mutations it applied.
    this._targetAdapter?.cleanup?.(this._forEl);
    for (const [prop, origVal] of this._savedLayoutStyles) {
      if (origVal) {
        this._forEl.style.setProperty(prop, origVal);
      } else {
        this._forEl.style.removeProperty(prop);
      }
    }
    this._savedLayoutStyles.clear();
  }

  private async _attach(generation: number, changedProperties?: PropertyValues): Promise<void> {
    // uix-forge hides itself (display:none via hui-card) while templates are
    // being evaluated, meaning all clientWidth/clientHeight values are 0.
    // Building the camera background now would cause ha-camera-stream to call
    // _getPosterUrl() with 0×0 dimensions, caching a bad thumbnail URL that
    // later renders the <img> at 0 height.  updated() fires again once
    // templatesReady flips to true (forge becomes visible), so we simply defer.
    if (this.controller.forge.hidden) return;
    const elements = await this.controller.target(this._for, this._cancel);
    const forEl = elements?.[0];
    if (!forEl) return;
    if (generation !== this._callGeneration) return;

    const { bgType, bgKey } = this._getActiveBg();
    const targetChanged = forEl !== this._forEl;

    // Tear down the background container when the source entity/URL changed or
    // the target element changed.  Stream is placed in the module-level cache
    // by _removeContainer() so it can be reused if rebuilt within the TTL.
    if (bgKey !== this._activeBgKey || targetChanged) {
      this._removeContainer();
    }

    // If the target element changed, update layout refs.
    if (targetChanged) {
      this._restoreDissolve();
      this._restoreLayout();
      this._forEl = forEl;
      this._targetAdapter = getBackgroundTargetAdapter(forEl);
      this._setupLayout(forEl);
    }

    // Apply / re-apply dissolve styles (always restore then reapply so config
    // changes take effect immediately).
    this._applyDissolveTarget(forEl);

    if (!this._containerEl) {
      if (bgType === "none") return;
      await this._buildContainer(forEl, bgType, bgKey, generation);
      if (generation !== this._callGeneration) return;
      // After initial build, refresh adapter child styles (e.g. hui-grid-section
      // padding for the section adapter — needed when the element was created
      // asynchronously and applyForElStyles ran before it was available).
      this._targetAdapter?.refreshChildStyles?.(forEl);
    } else {
      // Container already exists — update camera state, transform, and opacity.
      this._containerEl.style.opacity = this._opacity !== "" ? this._opacity : "";
      if (bgType === "camera" && this._streamEl) {
        // Only re-assign hass/stateObj when the hass object itself changed
        // (i.e. a genuine HA state update).  Setting hass on ha-camera-stream
        // triggers stream re-negotiation; doing it on every config change
        // (e.g. camera_zoom edit) causes unnecessary disconnects.
        // When changedProperties is absent (connectedCallback) we always set.
        const hassChanged = !changedProperties || changedProperties.has("hass");
        if (hassChanged) {
          const hass = this.controller.forge.hass;
          if (hass) {
            this._streamEl.hass = hass;
            this._streamEl.stateObj = hass.states[this._cameraEntity];
          }
        }
        this._updateCameraTransform();
      } else if (bgType === "background" && this._bgFillEl) {
        // Re-apply background CSS so template-driven values (e.g. colour
        // expressions) update immediately when resolved config changes.
        this._applyBackgroundStyles(this._bgFillEl);
      } else if ((bgType === "image_entity" || bgType === "image_url") && this._bgFillEl) {
        // Re-apply any background sub-property overrides (position, size, etc.)
        // so template-driven values update immediately on state change.
        this._applyBackgroundOverrides(this._bgFillEl);
      }
      // Re-apply adapter child styles so descendant elements replaced by a
      // section/config edit (e.g. hui-grid-section) get their styles restored.
      this._targetAdapter?.refreshChildStyles?.(forEl);
    }
  }

  private _getActiveBg(): { bgType: string; bgKey: string } {
    if (this._cameraEntity) return { bgType: "camera", bgKey: this._cameraEntity };
    if (this._imageEntity) return { bgType: "image_entity", bgKey: this._imageEntity };
    if (this._videoUrl)    return { bgType: "video",       bgKey: this._videoUrl };
    if (this._imageUrl)    return { bgType: "image_url",   bgKey: this._imageUrl };
    if (this._background != null) return { bgType: "background", bgKey: "bg" };
    return { bgType: "none", bgKey: "" };
  }

  /**
   * Ensure the `for` element creates a stacking context so that a child with
   * `z-index: -1` is painted behind other children but is still contained
   * within the element's box (and not lost behind an ancestor background).
   */
  private _setupLayout(forEl: HTMLElement): void {
    const cs = window.getComputedStyle(forEl);

    if (cs.position === "static") {
      const prev = forEl.style.getPropertyValue("position");
      this._savedLayoutStyles.set("position", prev);
      forEl.style.setProperty("position", "relative");
    }

    if (cs.isolation !== "isolate") {
      const prev = forEl.style.getPropertyValue("isolation");
      this._savedLayoutStyles.set("isolation", prev);
      forEl.style.setProperty("isolation", "isolate");
    }

    // Let the adapter apply any target-element-specific CSS properties
    // (e.g. --ha-card-background: none for hui-section targets).
    this._targetAdapter?.applyForElStyles?.(forEl, this._savedLayoutStyles);
  }

  private _applyDissolveTarget(forEl: HTMLElement): void {
    // Restore any previously-saved dissolve styles before re-applying, so that
    // config changes are picked up correctly.
    this._restoreDissolve();

    if (!this._dissolveTarget) return;

    if (typeof this._dissolveTarget === "string") {
      const match = /^opacity_(\d+(?:\.\d+)?)$/.exec(this._dissolveTarget);
      if (match) {
        const opacity = parseFloat(match[1]) / 100;
        const prev = forEl.style.getPropertyValue("opacity");
        this._savedDissolveStyles.set("opacity", prev);
        forEl.style.setProperty("opacity", String(opacity));
      } else {
        console.warn(
          `UIX Forge background spark: unrecognised dissolve_target string '${this._dissolveTarget}'.` +
          " Use 'opacity_<0-100>' or a list of CSS property objects."
        );
      }
    } else if (Array.isArray(this._dissolveTarget)) {
      for (const item of this._dissolveTarget) {
        if (item && typeof item === "object") {
          for (const [rawProp, value] of Object.entries(item as Record<string, string>)) {
            const cssProp = rawProp.replace(/_/g, "-");
            const prev = forEl.style.getPropertyValue(cssProp);
            this._savedDissolveStyles.set(cssProp, prev);
            forEl.style.setProperty(cssProp, value);
          }
        }
      }
    }
  }

  private async _buildContainer(
    forEl: HTMLElement,
    bgType: string,
    bgKey: string,
    generation: number
  ): Promise<void> {
    const container = document.createElement("div");
    container.setAttribute(BG_ID_ATTR, this._id);
    container.style.cssText =
      "position:absolute;inset:0;z-index:-1;overflow:hidden;pointer-events:none;";

    if (this._class) {
      for (const cls of this._class.trim().split(/\s+/)) {
        if (cls) container.classList.add(cls);
      }
    }

    if (this._opacity !== "") {
      container.style.opacity = this._opacity;
    }

    // Let the target-element adapter apply element-type-specific styles before
    // inserting (e.g. border-radius and margin for ha-card targets).
    this._targetAdapter?.applyStyles(container);

    // Insert the container into the DOM BEFORE building content.  This is
    // required for the camera case: _buildCameraContent calls
    // container.appendChild(streamEl) to move the cached stream element from
    // its off-screen parking wrapper into the container.  If the container is
    // not yet in the DOM at that point, streamEl leaves a connected parent and
    // enters a disconnected one — triggering ha-camera-stream.disconnectedCallback
    // which invalidates the auth token and produces a 403 on the next poster
    // fetch.  By inserting first we guarantee the transfer is always
    // connected → connected.
    // When an adapter is present, it may redirect insertion into the element's
    // shadow root (e.g. for ha-card) so the container participates in the
    // correct stacking context.
    const insertionParent = this._targetAdapter?.getInsertionParent(forEl) ?? forEl;
    if (insertionParent.firstChild) {
      insertionParent.insertBefore(container, insertionParent.firstChild);
    } else {
      insertionParent.appendChild(container);
    }

    switch (bgType) {
      case "camera":
        await this._buildCameraContent(container, generation, forEl);
        break;
      case "image_entity":
        await this._buildImageEntityContent(container, generation);
        break;
      case "video":
        await this._buildVideoContent(container, generation);
        break;
      case "image_url":
        await this._buildImageUrlContent(container, generation);
        break;
      case "background":
        this._buildBackgroundContent(container);
        break;
    }

    if (generation !== this._callGeneration) {
      // A newer build was started while we were doing async work.  Remove the
      // container we already inserted so the newer build can take its place.
      container.remove();
      return;
    }

    this._containerEl = container;
    this._activeBgKey = bgKey;

    if (bgType === "camera" && this._streamEl) {
      // Set hass and stateObj AFTER the container is in the DOM.  This matches
      // the pattern in view-background.ts and ensures ha-camera-stream is
      // connected when stream negotiation begins, which prevents the loading
      // spinner from getting stuck.
      const hass = this.controller.forge.hass;
      if (hass) {
        this._streamEl.hass = hass;
        this._streamEl.stateObj = hass.states[this._cameraEntity];
      }
      const spinner = this._addSpinner(container);
      this._removeSpinnerWhenCameraPlays(this._streamEl, spinner);
      this._updateCameraTransform();
      // Store dimensions now that the container is live in the DOM so that
      // _removeContainer() can form a valid cache key even if the element is
      // later detached before offsetWidth/Height can be read.
      // Only update when non-zero to avoid overwriting valid prior values if
      // the browser has not yet completed layout for this frame.
      const liveW = container.offsetWidth;
      const liveH = container.offsetHeight;
      if (liveW > 0) this._lastKnownW = liveW;
      if (liveH > 0) this._lastKnownH = liveH;
    }
  }

  // ── Background type builders ───────────────────────────────────────────────

  /**
   * Build the camera stream content and append it to `container`.
   *
   * Attempts to pop a matching element from the module-level
   * `_streamElementCache` (keyed by entity + dimensions).  If found, the
   * cached element is detached from its off-screen parking wrapper and
   * re-inserted here; its internal stream (auth tokens, negotiated URL, etc.)
   * has remained alive while parked connected.  If not found, a fresh
   * `ha-camera-stream` element is created.
   *
   * Hass assignment and the loading spinner are handled by the caller
   * (`_buildContainer`) AFTER the container has been inserted into the DOM,
   * ensuring `ha-camera-stream` is connected when stream negotiation starts.
   */
  private async _buildCameraContent(
    container: HTMLElement,
    generation: number,
    forEl: HTMLElement
  ): Promise<void> {
    // Wait for ha-camera-stream to be registered (loaded lazily by HA).
    const defined = await Promise.race([
      customElements.whenDefined("ha-camera-stream").then(() => true),
      new Promise<boolean>((resolve) =>
        setTimeout(() => resolve(false), CAMERA_ELEMENT_LOAD_TIMEOUT_MS)
      ),
    ]);

    if (generation !== this._callGeneration) return;

    if (!defined) {
      console.warn(
        "UIX Forge background spark: ha-camera-stream is not available; camera background skipped."
      );
      return;
    }

    if (this._cameraEntity.split(".")[0] !== CAMERA_DOMAIN) {
      console.warn(
        `UIX Forge background spark: camera_entity must be a camera domain entity (got '${this._cameraEntity}').`
      );
      return;
    }

    // Attempt to reuse a recently-cached stream element (same entity + same
    // rendered dimensions).  Reusing the element avoids re-authentication and
    // speeds up reconnection compared to starting fresh.  If no cached entry
    // is found, a new element is created.
    //
    // Prefer the last-known container dimensions (stored after the previous
    // build when the container was live in the DOM) over forEl dimensions;
    // forEl measurements are a reliable fallback when the spark is being
    // built for the first time or after a card-size change.
    const w = this._lastKnownW || forEl.offsetWidth;
    const h = this._lastKnownH || forEl.offsetHeight;
    const cachedEl = _popCachedStreamEl(this._cameraEntity, w, h);
    let streamEl: HaCameraStreamElement;
    if (cachedEl) {
      streamEl = cachedEl;
    } else {
      streamEl = document.createElement("ha-camera-stream") as HaCameraStreamElement;
      streamEl.style.cssText =
        "display:block;width:100%;flex-shrink:0;transform-origin:center;";
      streamEl.muted = true;
      streamEl.setAttribute("muted", "");
      streamEl.controls = false;
    }

    // Apply flex layout on container for camera positioning.
    const [alignItems, justifyContent] =
      CAMERA_POSITION_MAP[this._cameraPosition] ?? ["center", "center"];
    container.style.setProperty("display", "flex");
    container.style.setProperty("flex-direction", "column");
    container.style.setProperty("align-items", alignItems);
    container.style.setProperty("justify-content", justifyContent);

    // hass and stateObj are set by _buildContainer AFTER the container is
    // inserted into the DOM — setting stateObj before hass triggers
    // ha-camera-stream.willUpdate → _getCapabilities which reads this.hass
    // and throws if it is not yet assigned.
    container.appendChild(streamEl);
    this._streamEl = streamEl;
  }

  private async _buildImageEntityContent(
    container: HTMLElement,
    generation: number
  ): Promise<void> {
    const hass = this.controller.forge.hass;
    if (!hass) {
      console.warn("UIX Forge background spark: hass not available; image entity background skipped.");
      return;
    }

    const entity = hass.states[this._imageEntity];
    const picturePath = entity?.attributes?.entity_picture as string | undefined;

    if (!picturePath) {
      console.warn(
        `UIX Forge background spark: entity '${this._imageEntity}' has no entity_picture; image background skipped.`
      );
      return;
    }

    let signedUrl = picturePath;
    try {
      const result = await hass.callWS({
        type: "auth/sign_path",
        path: picturePath,
        expires: 3600,
      });
      signedUrl = result.path;
    } catch (e) {
      console.warn(
        `UIX Forge background spark: failed to sign path '${picturePath}'; using unsigned URL.`,
        e
      );
    }

    if (generation !== this._callGeneration) return;

    const imgEl = document.createElement("div");
    imgEl.style.cssText = [
      "width:100%",
      "height:100%",
      `background-image:url('${signedUrl}')`,
      "background-size:cover",
      "background-position:center",
      "background-repeat:no-repeat",
    ].join(";");
    this._bgFillEl = imgEl;
    this._applyBackgroundOverrides(imgEl);
    container.appendChild(imgEl);

    const spinner = this._addSpinner(container);
    const preload = new window.Image();
    const done = () => this._removeSpinner(spinner);
    preload.onload = done;
    preload.onerror = done;
    preload.src = signedUrl;
  }

  private async _buildVideoContent(container: HTMLElement, generation: number): Promise<void> {
    const hass = this.controller.forge.hass;
    const resolvedUrl = await _resolveMediaSourceUrl(hass, this._videoUrl);
    if (generation !== this._callGeneration) return;

    const videoEl = document.createElement("video");
    videoEl.style.cssText =
      "display:block;width:100%;height:100%;object-fit:cover;";
    videoEl.autoplay = true;
    videoEl.muted = true;
    videoEl.loop = true;
    videoEl.setAttribute("playsinline", "");

    const spinner = this._addSpinner(container);
    const fallback = setTimeout(
      () => this._removeSpinner(spinner),
      SPINNER_FALLBACK_MS
    );
    const onCanPlay = () => {
      clearTimeout(fallback);
      this._removeSpinner(spinner);
    };
    videoEl.addEventListener("canplay", onCanPlay, { once: true });

    videoEl.src = resolvedUrl;
    container.appendChild(videoEl);

    // If the browser already has enough data, dismiss the spinner immediately.
    if (videoEl.readyState >= HTMLMediaElement.HAVE_FUTURE_DATA) {
      videoEl.removeEventListener("canplay", onCanPlay);
      clearTimeout(fallback);
      this._removeSpinner(spinner);
    }
  }

  private async _buildImageUrlContent(container: HTMLElement, generation: number): Promise<void> {
    const hass = this.controller.forge.hass;
    const resolvedUrl = await _resolveMediaSourceUrl(hass, this._imageUrl);
    if (generation !== this._callGeneration) return;

    const imgEl = document.createElement("div");
    imgEl.style.cssText = [
      "width:100%",
      "height:100%",
      `background-image:url('${resolvedUrl}')`,
      "background-size:cover",
      "background-position:center",
      "background-repeat:no-repeat",
    ].join(";");
    this._bgFillEl = imgEl;
    this._applyBackgroundOverrides(imgEl);
    container.appendChild(imgEl);

    const spinner = this._addSpinner(container);
    const preload = new window.Image();
    const done = () => this._removeSpinner(spinner);
    preload.onload = done;
    preload.onerror = done;
    preload.src = resolvedUrl;
  }

  private _buildBackgroundContent(container: HTMLElement): void {
    const fillEl = document.createElement("div");
    fillEl.style.cssText = "width:100%;height:100%;";
    this._bgFillEl = fillEl;
    this._applyBackgroundStyles(fillEl);
    container.appendChild(fillEl);
  }

  /** Apply the current `_background` config to `fillEl`. */
  private _applyBackgroundStyles(fillEl: HTMLElement): void {
    fillEl.style.cssText = "width:100%;height:100%;";
    if (typeof this._background === "string") {
      fillEl.style.background = this._background;
    } else if (this._background && typeof this._background === "object") {
      for (const [key, value] of Object.entries(this._background)) {
        const cssProp = BACKGROUND_SUB_PROPS[key] ?? `background-${key.replace(/_/g, "-")}`;
        fillEl.style.setProperty(cssProp, value);
      }
    }
  }

  /**
   * Apply `_background` object sub-properties (e.g. position, size, repeat)
   * as CSS overrides on top of an existing element style, without resetting
   * the element's `cssText`.  Used for `image_entity` and `image_url` sources
   * so the `background-image` URL is preserved while the user can still
   * control positioning/sizing via the `background:` config key.
   *
   * When `_background` is a plain string it is set as the `background`
   * shorthand (which replaces `background-image`), matching the same
   * semantics as the fill-div case.
   */
  private _applyBackgroundOverrides(el: HTMLElement): void {
    if (!this._background) return;
    if (typeof this._background === "string") {
      el.style.background = this._background;
    } else {
      for (const [key, value] of Object.entries(this._background)) {
        const cssProp = BACKGROUND_SUB_PROPS[key] ?? `background-${key.replace(/_/g, "-")}`;
        el.style.setProperty(cssProp, value);
      }
    }
  }

  // ── Camera transform ───────────────────────────────────────────────────────

  /**
   * Apply the current zoom / pan / position values to the camera stream
   * element using inline CSS transforms.  Called after the container is built
   * and on every subsequent hass update.
   */
  private _updateCameraTransform(): void {
    if (!this._streamEl) return;

    const zoom = this._cameraZoom || "1";
    const panX = this._cameraPanX || "0%";
    const panY = this._cameraPanY || "0%";

    this._streamEl.style.setProperty(
      "transform",
      `translateX(${panX}) translateY(${panY}) scale(${zoom})`
    );

    // Update camera container flex alignment when camera_position changes.
    if (this._containerEl) {
      const [alignItems, justifyContent] =
        CAMERA_POSITION_MAP[this._cameraPosition] ?? ["center", "center"];
      this._containerEl.style.setProperty("align-items", alignItems);
      this._containerEl.style.setProperty("justify-content", justifyContent);
    }
  }

  // ── Spinner helpers ────────────────────────────────────────────────────────

  private _addSpinner(container: HTMLElement): HTMLElement {
    const style = document.createElement("style");
    style.textContent =
      "@keyframes uix-spark-bg-spin{to{transform:rotate(360deg)}}" +
      ".uix-spark-bg-spinner{position:absolute;inset:0;display:flex;align-items:center;" +
      "justify-content:center;transition:opacity .4s}" +
      ".uix-spark-bg-spinner::after{content:'';width:48px;height:48px;" +
      "border-radius:50%;border:3px solid rgba(255,255,255,.15);" +
      "border-top-color:rgba(255,255,255,.7);" +
      "animation:uix-spark-bg-spin .8s linear infinite}";
    container.appendChild(style);

    const spinner = document.createElement("div");
    spinner.className = "uix-spark-bg-spinner";
    container.appendChild(spinner);
    return spinner;
  }

  private _removeSpinner(spinner: HTMLElement): void {
    requestAnimationFrame(() => {
      spinner.style.opacity = "0";
      const remove = () => spinner.remove();
      const fallback = setTimeout(remove, 600);
      spinner.addEventListener(
        "transitionend",
        () => {
          clearTimeout(fallback);
          remove();
        },
        { once: true }
      );
    });
  }

  /**
   * Watch the `ha-camera-stream` shadow root (and any nested sub-component
   * shadow roots) for the underlying `<video>` or `<img>` element and remove
   * the spinner once media is ready.
   *
   * `ha-camera-stream` often delegates rendering to sub-components such as
   * `ha-hls-player` or `ha-web-rtc-player` which have their own shadow roots.
   * The search and observation therefore recurse through every reachable
   * shadow root so that the actual `<video>` element is found regardless of
   * nesting depth.
   *
   * Falls back to removing the spinner after `SPINNER_FALLBACK_MS` so that a
   * broken / slow stream does not leave the spinner on screen indefinitely.
   */
  private _removeSpinnerWhenCameraPlays(
    streamEl: HTMLElement,
    spinner: HTMLElement
  ): void {
    let finished = false;
    const allObs: MutationObserver[] = [];
    const observedRoots = new Set<ShadowRoot>();

    const finish = () => {
      if (finished) return;
      finished = true;
      clearTimeout(fallback);
      for (const obs of allObs) obs.disconnect();
      this._removeSpinner(spinner);
    };

    const fallback = setTimeout(finish, SPINNER_FALLBACK_MS);

    // Recursively search through shadow roots to find the first <video> or <img>.
    // Only custom elements (tag names containing "-") can have open shadow roots,
    // so we restrict recursion to them to avoid iterating native elements.
    const findMedia = (
      root: ParentNode
    ): HTMLVideoElement | HTMLImageElement | null => {
      const v = root.querySelector("video") as HTMLVideoElement | null;
      if (v) return v;
      const i = root.querySelector("img") as HTMLImageElement | null;
      if (i) return i;
      for (const el of Array.from(root.querySelectorAll("*"))) {
        if (!el.localName.includes("-")) continue;
        const sr = (el as any).shadowRoot as ShadowRoot | null;
        if (sr) {
          const found = findMedia(sr);
          if (found) return found;
        }
      }
      return null;
    };

    // The element we most recently bound to; guards against redundant re-binding
    // when the same element triggers multiple observer callbacks.
    let boundTo: HTMLVideoElement | HTMLImageElement | null = null;

    // Find and bind to the media element.  Skips silently when already bound to
    // the same element.  Rebinds when the element changes (e.g. ha-camera-stream
    // re-renders and replaces the video).  Safe to call multiple times.
    const tryBind = (): void => {
      if (finished) return;
      const hostShadow = (streamEl as any).shadowRoot as ShadowRoot | null;
      if (!hostShadow) return;
      const media = findMedia(hostShadow);
      if (!media || media === boundTo) return;

      boundTo = media;

      if (media instanceof HTMLVideoElement) {
        if (!media.paused && media.readyState >= HTMLMediaElement.HAVE_FUTURE_DATA) {
          finish();
        } else {
          media.addEventListener("playing", finish, { once: true });
          // Video load errors are also a signal to dismiss the spinner.
          media.addEventListener("error", finish, { once: true });
        }
      } else {
        // `img.complete` is true for both successfully loaded and errored images.
        // Treat either outcome as "done" — a broken image won't become loadable
        // without a full rebuild.
        if (media.complete) {
          finish();
        } else {
          media.addEventListener("load", finish, { once: true });
          media.addEventListener("error", finish, { once: true });
        }
      }
    };

    // Observe `root` for DOM mutations and expand to any nested shadow roots
    // that appear inside it.
    const observeRoot = (root: ShadowRoot): void => {
      if (observedRoots.has(root)) return;
      observedRoots.add(root);
      const obs = new MutationObserver(() => {
        tryBind();
        expandToNestedRoots(root);
      });
      obs.observe(root, { childList: true, subtree: true });
      allObs.push(obs);
    };

    // Start observing the shadow roots of any custom elements within `root`
    // that have not yet been tracked.  Only custom elements (tag names with "-")
    // can have open shadow roots, so we skip native elements.
    const expandToNestedRoots = (root: ParentNode): void => {
      for (const el of Array.from(root.querySelectorAll("*"))) {
        if (!el.localName.includes("-")) continue;
        const sr = (el as any).shadowRoot as ShadowRoot | null;
        if (sr && !observedRoots.has(sr)) {
          observeRoot(sr);
          expandToNestedRoots(sr);
        }
      }
    };

    tryBind();
    if (finished) return;

    const shadow = (streamEl as any).shadowRoot as ShadowRoot | null;
    if (!shadow) return;

    observeRoot(shadow);
    expandToNestedRoots(shadow);
  }
}
