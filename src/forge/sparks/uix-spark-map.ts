import { PropertyValues } from "lit";
import { UixForgeSparkBase } from "./uix-spark-base";
import { parseDuration } from "../../helpers/common/parse-duration";

/** A single point of interest in the tour POI list. */
interface TourPoi {
  /** Entity ID — must be present in the ha-map's entities list. */
  entity?: string;
  latitude?: number;
  longitude?: number;
  /** Per-POI zoom level override. */
  zoom?: number;
}

/** CSS position values for the tour pause/play button. */
interface TourIconPosition {
  top?: string;
  bottom?: string;
  left?: string;
  right?: string;
}

/**
 * Map spark — provides memory mode, fit-map, and tour mode for map cards
 * used inside UIX Forge.
 *
 * **Memory mode** (`memory: true`): Captures the current Leaflet zoom and
 * centre before each update and restores them afterwards, so the user's view
 * is always preserved. Without it, every forge template update causes the map
 * to reset to its default zoom level and centre position.
 *
 * **Fit map mode** (`fit_map: true`): Fits the map view when the map card
 * does not auto-fit on load (e.g. when used inside `custom:auto-entities`).
 *
 * **Tour mode** (`tour: true | object`): Automatically moves between a list
 * of points of interest (POI). A pause/play button is injected into the map.
 * When `tour: true` all defaults are used. Pass an object to customise:
 *
 *   tour:
 *     period: 10s             # time at each POI (default 10 s)
 *     zoom: 14                # default zoom (default 14)
 *     icon_pause: mdi:pause   # icon shown while playing
 *     icon_play: mdi:play     # icon shown while paused
 *     icon_position:          # CSS position of the button (default: bottom-right)
 *       bottom: 10px
 *       right: 10px
 *     poi:                    # POI list (omit to use ha-map entities)
 *       - entity: device_tracker.phone
 *       - latitude: 51.5  longitude: -0.1  zoom: 12
 *
 * If `fit_map` is also set the tour waits until the initial fit is complete
 * before starting.
 */
export class UixForgeSparkMap extends UixForgeSparkBase {
  type = "map";

  // ── Memory mode ───────────────────────────────────────────────────────────
  private _memory: boolean = false;
  private _savedZoom: number | null = null;
  private _savedCenter: { lat: number; lng: number } | null = null;

  // ── Fit-map mode ──────────────────────────────────────────────────────────
  private _fitMap: boolean = false;
  private _fitMapAbort?: { cancelled: boolean };
  private _fitMapRunOnce: boolean = false;

  // ── Tour config ───────────────────────────────────────────────────────────
  private _tour: boolean = false;
  private _tourPeriod: number = 10000;
  private _tourZoom: number | undefined = undefined;
  private _tourIconPause: string = "mdi:pause";
  private _tourIconPlay: string = "mdi:play";
  private _tourIconPosition: TourIconPosition | null = null;
  private _tourPoi: TourPoi[] | null = null;

  // ── Tour runtime state ────────────────────────────────────────────────────
  /** Whether the tour is currently advancing between POIs. */
  private _tourPlaying: boolean = true;
  /** Index of the last POI the tour flew to (-1 = not yet started). */
  private _tourPoiIndex: number = -1;
  /** Whether the tour overlay and timer have been initialised. */
  private _tourStarted: boolean = false;
  /** Independent generation counter for tour setup retries. */
  private _tourSetupGen: number = 0;
  private _tourTimer: ReturnType<typeof setTimeout> | null = null;
  private _tourContainerEl: HTMLElement | null = null;
  private _tourIconEl: (HTMLElement & { icon?: string }) | null = null;

  constructor(controller: any, config: Record<string, any>) {
    super(controller, config);
    this._applyConfig(config);
  }

  configUpdated(config: Record<string, any>): void {
    super.configUpdated(config);
    this._applyConfig(config);
  }

  beforeForgedElementRefresh(): void {
    this._saveMapState();
  }

  private _applyConfig(config: Record<string, any>): void {
    const wasFitMap = this._fitMap;
    this._memory = config.memory === true;
    this._fitMap = config.fit_map === true;

    if (!this._fitMap || (!wasFitMap && this._fitMap)) {
      this._fitMapRunOnce = false;
    }

    // ── Tour config ─────────────────────────────────────────────────────────
    const tourRaw = config.tour;
    const newTour = tourRaw === true || (!!tourRaw && typeof tourRaw === "object");

    if (this._tour !== newTour) {
      // Tour enabled/disabled — reset state
      this._stopTour();
    }
    this._tour = newTour;

    if (this._tour) {
      const t: Record<string, any> = (tourRaw === true) ? {} : (tourRaw as Record<string, any>);
      this._tourPeriod = parseDuration(t.period) ?? 10000;
      this._tourZoom = t.zoom !== undefined ? Number(t.zoom) : 14;
      this._tourIconPause = String(t.icon_pause || "mdi:pause");
      this._tourIconPlay = String(t.icon_play || "mdi:play");
      this._tourIconPosition = this._parseTourIconPosition(t.icon_position);
      this._tourPoi = Array.isArray(t.poi) ? (t.poi as TourPoi[]) : null;
    }

    this._saveMapState();
  }

  private _parseTourIconPosition(raw: any): TourIconPosition | null {
    if (!raw || typeof raw !== "object") return null;
    const pos: TourIconPosition = {};
    const toPx = (v: any) => (typeof v === "number" ? `${v}px` : String(v));
    if (raw.top !== undefined) pos.top = toPx(raw.top);
    if (raw.bottom !== undefined) pos.bottom = toPx(raw.bottom);
    if (raw.left !== undefined) pos.left = toPx(raw.left);
    if (raw.right !== undefined) pos.right = toPx(raw.right);
    return Object.keys(pos).length > 0 ? pos : null;
  }

  /** Returns the `ha-map` element inside the forged element's shadow root, or null. */
  private _getHaMap(): any {
    const forgedElement = this.controller.forgedElement();
    const huiMap = forgedElement?.querySelector("hui-map-card");
    return huiMap?.shadowRoot?.querySelector("ha-map") ?? null;
  }

  private _saveMapState(): void {
    if (!this._memory) return;
    const haMap = this._getHaMap();
    const leafletMap = haMap?.leafletMap;
    if (leafletMap) {
      try {
        this._savedZoom = leafletMap.getZoom();
        this._savedCenter = leafletMap.getCenter();
      } catch {
        // leafletMap may not be fully initialised yet — skip saving
      }
    }
  }

  updated(_changedProperties: PropertyValues): void {
    const needsMemory = this._memory && this._savedCenter !== null;
    const needsFit = this._fitMap;
    const needsTour = this._tour;

    if (!needsMemory && !needsFit && !needsTour) return;

    if (needsMemory || needsFit) {
      const gen = this._beginUpdate();

      const savedCenter = this._savedCenter;
      const savedZoom = this._savedZoom;
      this._savedCenter = null;
      this._savedZoom = null;

      const forgedElement = this.controller.forgedElement();
      if (!forgedElement) return;

      const doRestore = () => {
        if (gen !== this._callGeneration) return;
        const haMap = this._getHaMap();
        const leafletMap = haMap?.leafletMap;
        // Skip memory restore when tour is playing — the tour manages map position.
        if (leafletMap && savedCenter && !(this._tour && this._tourPlaying)) {
          leafletMap.setView(savedCenter, savedZoom, { reset: true });
        }
      };

      let fitMapAbort = this._fitMapAbort;
      this._fitMapAbort = { cancelled: false };
      fitMapAbort && (fitMapAbort.cancelled = true);

      const doFitMap = async () => {
        if (gen !== this._callGeneration || this._fitMapAbort === undefined || this._fitMapAbort.cancelled) return;
        const haMap = this._getHaMap();
        if (haMap) {
          let tries = 0;
          while ((haMap.clientWidth === 0 || !haMap.leafletMap || !haMap.Leaflet) && tries < 20) {
            if (gen !== this._callGeneration || this._fitMapAbort === undefined || this._fitMapAbort.cancelled) return;
            await new Promise(res => setTimeout(res, 50));
            tries++;
          }
          if (!this._fitMapAbort?.cancelled) {
            haMap.fitMap();
            this._fitMapRunOnce = true;
          }
        }
      };

      const afterForgedElement = () => {
        if (gen !== this._callGeneration) return;
        const haMap = this._getHaMap();
        if (haMap?.updateComplete) {
          (haMap.updateComplete as Promise<boolean>).then(() => {
            if (needsMemory) doRestore();
            if (needsFit && !this._fitMapRunOnce) doFitMap();
          });
        } else {
          if (needsMemory) doRestore();
          if (needsFit && !this._fitMapRunOnce) doFitMap();
        }
      };

      if ((forgedElement as any).updateComplete) {
        ((forgedElement as any).updateComplete as Promise<boolean>).then(afterForgedElement);
      } else {
        afterForgedElement();
      }
    }

    // ── Tour setup ──────────────────────────────────────────────────────────
    // Trigger setup when tour hasn't started yet, or when the button element
    // has been removed from the DOM (e.g. after a forged-element refresh).
    if (needsTour && (!this._tourStarted || !this._tourContainerEl?.isConnected)) {
      this._setupTour();
    }
  }

  disconnectedCallback(): void {
    this._cancelPending();
    this._savedCenter = null;
    this._savedZoom = null;
    this._fitMapAbort = undefined;
    this._stopTour();
  }

  // ── Tour methods ───────────────────────────────────────────────────────────

  /** Tear down the tour overlay and timer, resetting all runtime state. */
  private _stopTour(): void {
    this._clearTourTimer();
    ++this._tourSetupGen; // cancel any pending _setupTour retries
    if (this._tourContainerEl) {
      this._tourContainerEl.remove();
      this._tourContainerEl = null;
      this._tourIconEl = null;
    }
    this._tourPoiIndex = -1;
    this._tourStarted = false;
    this._tourPlaying = true; // reset to playing for next activation
  }

  private _clearTourTimer(): void {
    if (this._tourTimer !== null) {
      clearTimeout(this._tourTimer);
      this._tourTimer = null;
    }
  }

  /**
   * Async setup for tour mode. Uses a dedicated generation counter so that
   * multiple concurrent calls (e.g. from rapid hass updates) are coalesced —
   * only the latest call proceeds through the retry loops.
   */
  private async _setupTour(): Promise<void> {
    const gen = ++this._tourSetupGen;

    // Wait for fit_map to complete before starting the tour.
    if (this._fitMap && !this._fitMapRunOnce) {
      let tries = 0;
      while (!this._fitMapRunOnce && tries < 40) {
        if (gen !== this._tourSetupGen) return;
        await new Promise(res => setTimeout(res, 100));
        tries++;
      }
      if (!this._fitMapRunOnce) return; // timed out — tour will retry next updated()
    }

    if (gen !== this._tourSetupGen) return;

    // Wait for the Leaflet map to be fully initialised.
    let haMap = this._getHaMap();
    let tries = 0;
    while ((!haMap?.leafletMap || !haMap?.Leaflet || haMap?.clientWidth === 0) && tries < 20) {
      if (gen !== this._tourSetupGen) return;
      await new Promise(res => setTimeout(res, 50));
      tries++;
      haMap = this._getHaMap();
    }

    if (gen !== this._tourSetupGen || !haMap?.leafletMap) return;

    // Create or reconnect the pause/play button overlay.
    this._ensureTourButton(haMap);

    // Start the timer on first setup only; resume after pause is handled by
    // _toggleTourPlay() so we must not start a second timer here.
    if (!this._tourStarted) {
      this._tourStarted = true;
      if (this._tourPlaying) {
        this._advanceTour(); // navigate to first POI immediately
        this._scheduleTourTick();
      }
    }
  }

  /** Create the tour button overlay, or refresh its position/icon if it already exists. */
  private _ensureTourButton(haMap: any): void {
    if (this._tourContainerEl?.isConnected) {
      // Already present — just refresh position and icon in case config changed.
      this._applyTourButtonPosition(this._tourContainerEl);
      this._updateTourButtonIcon();
      return;
    }

    // Stale reference — clean up.
    if (this._tourContainerEl) {
      this._tourContainerEl.remove();
      this._tourContainerEl = null;
      this._tourIconEl = null;
    }

    // Inject into the Leaflet container inside ha-map's open shadow root.
    const leafletContainer = haMap.shadowRoot?.querySelector(".leaflet-container") as HTMLElement | null;
    if (!leafletContainer) return;

    // ── Container ───────────────────────────────────────────────────────────
    const container = document.createElement("div");
    container.classList.add("uix-tour-control");
    container.style.setProperty("position", "absolute");
    container.style.setProperty("z-index", "var(--uix-map-tour-icon-z-index, 1000)");
    this._applyTourButtonPosition(container);

    // ── ha-icon-button ──────────────────────────────────────────────────────
    const btnEl = document.createElement("ha-icon-button") as HTMLElement;
    (btnEl as any).label = this._tourPlaying ? "Pause tour" : "Play tour";
    btnEl.style.setProperty("color", "var(--uix-map-tour-icon-color, var(--primary-color, #03a9f4))");
    btnEl.style.setProperty("background", "var(--uix-map-tour-icon-background, rgba(255,255,255,0.8))");
    btnEl.style.setProperty("width", "var(--uix-map-tour-icon-width, auto)");
    btnEl.style.setProperty("height", "var(--uix-map-tour-icon-height, auto)");
    btnEl.style.setProperty("border-radius", "var(--uix-map-tour-icon-border-radius, 9999px)");

    // Inner ha-icon carries the mdi icon string.
    const iconEl = document.createElement("ha-icon") as HTMLElement & { icon?: string };
    iconEl.icon = this._tourPlaying ? this._tourIconPause : this._tourIconPlay;
    btnEl.appendChild(iconEl);

    btnEl.addEventListener("click", (ev: Event) => {
      ev.stopPropagation();
      this._toggleTourPlay();
    });

    container.appendChild(btnEl);
    leafletContainer.appendChild(container);

    this._tourContainerEl = container;
    this._tourIconEl = iconEl;
  }

  private _applyTourButtonPosition(el: HTMLElement): void {
    const pos = this._tourIconPosition ?? { bottom: "10px", right: "10px" };
    el.style.removeProperty("top");
    el.style.removeProperty("bottom");
    el.style.removeProperty("left");
    el.style.removeProperty("right");
    if (pos.top !== undefined) el.style.setProperty("top", pos.top);
    if (pos.bottom !== undefined) el.style.setProperty("bottom", pos.bottom);
    if (pos.left !== undefined) el.style.setProperty("left", pos.left);
    if (pos.right !== undefined) el.style.setProperty("right", pos.right);
  }

  private _updateTourButtonIcon(): void {
    if (this._tourIconEl) {
      this._tourIconEl.icon = this._tourPlaying ? this._tourIconPause : this._tourIconPlay;
    }
  }

  /** Toggle between playing and paused states. */
  private _toggleTourPlay(): void {
    this._tourPlaying = !this._tourPlaying;
    this._updateTourButtonIcon();
    if (this._tourPlaying) {
      // Resume: schedule the next tick.
      this._scheduleTourTick();
    } else {
      // Pause: stop the timer.
      this._clearTourTimer();
    }
  }

  /** Schedule one tour tick after `_tourPeriod` ms. */
  private _scheduleTourTick(): void {
    this._clearTourTimer();
    this._tourTimer = setTimeout(() => {
      this._tourTimer = null;
      if (!this._tour || !this._tourPlaying) return;
      this._advanceTour();
      this._scheduleTourTick();
    }, this._tourPeriod);
  }

  /** Advance to the next POI and fly the map there. */
  private _advanceTour(): void {
    const pois = this._getEffectivePois();
    if (pois.length === 0) return;
    this._tourPoiIndex = (this._tourPoiIndex + 1) % pois.length;
    this._flyToPoi(pois[this._tourPoiIndex]);
  }

  private _flyToPoi(poi: { lat: number; lng: number; zoom?: number }): void {
    const haMap = this._getHaMap();
    const leafletMap = haMap?.leafletMap;
    if (!leafletMap) return;
    const zoom = poi.zoom ?? this._tourZoom ?? leafletMap.getZoom();
    leafletMap.setView([poi.lat, poi.lng], zoom);
  }

  /**
   * Build the effective POI list.
   *
   * If `poi` is configured in the tour config, use that list (resolving entity
   * lat/lng from hass states and warning when an entity is not in the map's
   * entity list).  Otherwise fall back to all entities on the ha-map card that
   * have `latitude`/`longitude` state attributes.
   */
  private _getEffectivePois(): Array<{ lat: number; lng: number; zoom?: number }> {
    const hass = (this.controller.forge as any).hass;

    if (this._tourPoi && this._tourPoi.length > 0) {
      const mapEntityIds = this._getMapEntityIds();
      const resolved: Array<{ lat: number; lng: number; zoom?: number }> = [];
      for (const poi of this._tourPoi) {
        if (poi.entity) {
          if (!mapEntityIds.includes(poi.entity)) {
            console.warn(`UIX Forge Map Tour: entity '${poi.entity}' is not on the map — skipping`);
            continue;
          }
          const state = hass?.states?.[poi.entity];
          const lat = state?.attributes?.latitude;
          const lng = state?.attributes?.longitude;
          if (lat === undefined || lng === undefined) {
            console.warn(`UIX Forge Map Tour: entity '${poi.entity}' has no latitude/longitude attributes — skipping`);
            continue;
          }
          resolved.push({ lat: Number(lat), lng: Number(lng), zoom: poi.zoom });
        } else if (poi.latitude !== undefined && poi.longitude !== undefined) {
          resolved.push({ lat: Number(poi.latitude), lng: Number(poi.longitude), zoom: poi.zoom });
        } else {
          console.warn("UIX Forge Map Tour: poi entry must have 'entity' or 'latitude'+'longitude' — skipping");
        }
      }
      return resolved;
    }

    // No poi list configured: derive POIs from the ha-map's entity list.
    const pois: Array<{ lat: number; lng: number; zoom?: number }> = [];
    for (const entityId of this._getMapEntityIds()) {
      const state = hass?.states?.[entityId];
      const lat = state?.attributes?.latitude;
      const lng = state?.attributes?.longitude;
      if (lat !== undefined && lng !== undefined) {
        pois.push({ lat: Number(lat), lng: Number(lng) });
      }
    }
    return pois;
  }

  /** Return the entity IDs declared in the forged element's map configuration. */
  private _getMapEntityIds(): string[] {
    const entities = (this.controller.forge as any).forgedElementConfig?.entities;
    if (!Array.isArray(entities)) return [];
    return entities
      .map((e: any) => (typeof e === "string" ? e : e?.entity))
      .filter((id: any): id is string => typeof id === "string");
  }
}
