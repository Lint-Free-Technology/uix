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

/** CSS position values for the slider container. */
interface SliderPosition {
  top?: string;
  bottom?: string;
  left?: string;
  right?: string;
}

/** Settings for the hours_to_show slider mode. */
interface HoursToShowConfig {
  min: number;
  max: number;
  step: number;
  position: SliderPosition | null;
  tooltip_distance: number;
}

/** CSS position values for the entity filter container. */
interface EntityFilterPosition {
  top?: string;
  bottom?: string;
  left?: string;
  right?: string;
}

/** Settings for the entity_filter mode. */
interface EntityFilterConfig {
  position: EntityFilterPosition | null;
  size: string;
  variant: string;
  appearance: string;
  icon: string;
  label: string;
  show_all_label: string;
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
  /** ID of the last POI the tour flew to. */
  private _lastTourPoiId: string | null = null;
  /** Whether the tour overlay and timer have been initialised. */
  private _tourStarted: boolean = false;
  /** Independent generation counter for tour setup retries. */
  private _tourSetupGen: number = 0;
  private _tourTimer: ReturnType<typeof setTimeout> | null = null;
  private _tourContainerEl: HTMLElement | null = null;
  private _tourIconEl: (HTMLElement & { icon?: string }) | null = null;
  private _tourRingSvgEl: SVGSVGElement | null = null;
  private _tourRingEl: SVGCircleElement | null = null;
  private _tourRingAnimation: Animation | null = null;

  /** Radius of the SVG countdown ring in viewBox units (viewBox is 48×48, centre 24,24). */
  private static readonly TOUR_RING_RADIUS = 21;

  // ── Hours to show config ──────────────────────────────────────────────────
  private _hoursToShowConfig: HoursToShowConfig | null = null;

  // ── Slider runtime state ──────────────────────────────────────────────────
  private _hoursToShowValue: number | null = null;
  private _sliderStarted: boolean = false;
  private _sliderSetupGen: number = 0;
  private _sliderContainerEl: HTMLElement | null = null;
  private _sliderEl: any = null;
  private _sliderLabelEl: HTMLElement | null = null;

  // ── Entity filter config ──────────────────────────────────────────────────
  private _entityFilterConfig: EntityFilterConfig | null = null;

  // ── Entity filter runtime state ───────────────────────────────────────────
  private _selectedEntities: Set<string> | null = null;
  private _lastKnownEntityIds: string[] | null = null;
  private _fullMapEntityIds: string[] | null = null;
  private _entityFilterStarted: boolean = false;
  private _entityFilterSetupGen: number = 0;
  private _entityFilterSettingUp: boolean = false;
  private _entityFilterContainerEl: HTMLElement | null = null;

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

    // ── Hours to show / Slider config ───────────────────────────────────────
    const hoursToShowRaw = config.hours_to_show;
    const hasHoursToShow = hoursToShowRaw === true || (!!hoursToShowRaw && typeof hoursToShowRaw === "object");

    if (!hasHoursToShow) {
      if (this._hoursToShowConfig !== null) {
        this._stopSlider();
      }
      this._hoursToShowConfig = null;
    } else {
      const h: Record<string, any> = (hoursToShowRaw === true) ? {} : (hoursToShowRaw as Record<string, any>);
      const min = h.min !== undefined ? Number(h.min) : 0;
      const max = h.max !== undefined ? Number(h.max) : 24;
      const step = h.step !== undefined ? Number(h.step) : 1;
      const position = this._parseSliderPosition(h.position);
      const tooltip_distance = h.tooltip_distance !== undefined ? Number(h.tooltip_distance) : 20;

      this._hoursToShowConfig = { min, max, step, position, tooltip_distance };
      if (this._hoursToShowValue !== null) {
        // Clamp existing value within boundaries
        if (this._hoursToShowValue < min) this._hoursToShowValue = min;
        if (this._hoursToShowValue > max) this._hoursToShowValue = max;
      }
    }

    // ── Entity filter config ────────────────────────────────────────────────
    const entityFilterRaw = config.entity_filter;
    const hasEntityFilter = entityFilterRaw === true || (!!entityFilterRaw && typeof entityFilterRaw === "object");

    if (!hasEntityFilter) {
      if (this._entityFilterConfig !== null) {
        this._stopEntityFilter();
      }
      this._entityFilterConfig = null;
    } else {
      const e: Record<string, any> = (entityFilterRaw === true) ? {} : (entityFilterRaw as Record<string, any>);
      const position = this._parseEntityFilterPosition(e.position);
      const size = String(e.size || "s");
      const variant = String(e.variant || "neutral");
      const appearance = String(e.appearance || "plain");
      const icon = String(e.icon !== undefined ? e.icon : "mdi:filter-variant");
      const label = String(e.label !== undefined ? e.label : "Filter");
      const show_all_label = String(e.show_all_label !== undefined ? e.show_all_label : "Show All");

      this._entityFilterConfig = { position, size, variant, appearance, icon, label, show_all_label };
    }

    this._saveMapState();
  }

  private _parseEntityFilterPosition(raw: any): EntityFilterPosition | null {
    if (!raw || typeof raw !== "object") return null;
    const pos: EntityFilterPosition = {};
    const toPx = (v: any) => (typeof v === "number" ? `${v}px` : String(v));
    if (raw.top !== undefined) pos.top = toPx(raw.top);
    if (raw.bottom !== undefined) pos.bottom = toPx(raw.bottom);
    if (raw.left !== undefined) pos.left = toPx(raw.left);
    if (raw.right !== undefined) pos.right = toPx(raw.right);
    return Object.keys(pos).length > 0 ? pos : null;
  }

  private _parseSliderPosition(raw: any): SliderPosition | null {
    if (!raw || typeof raw !== "object") return null;
    const pos: SliderPosition = {};
    const toPx = (v: any) => (typeof v === "number" ? `${v}px` : String(v));
    if (raw.top !== undefined) pos.top = toPx(raw.top);
    if (raw.bottom !== undefined) pos.bottom = toPx(raw.bottom);
    if (raw.left !== undefined) pos.left = toPx(raw.left);
    if (raw.right !== undefined) pos.right = toPx(raw.right);
    return Object.keys(pos).length > 0 ? pos : null;
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

  /** Returns the parent `hui-map-card` element, or null. */
  private _getHuiMapCard(): any {
    const forgedElement = this.controller.forgedElement();
    return forgedElement?.querySelector("hui-map-card") ?? null;
  }

  /** Returns the `ha-map` element inside the forged element's shadow root, or null. */
  private _getHaMap(): any {
    const huiMap = this._getHuiMapCard();
    return huiMap?.shadowRoot?.querySelector("ha-map") ?? null;
  }

  private async _waitForMapToBeReady(gen: number, checkGen: () => boolean): Promise<any> {
    let haMap = this._getHaMap();
    let huiMap = this._getHuiMapCard();
    let tries = 0;
    const originalConfig = (this.controller.forge as any).forgedElementConfig || {};
    const hasOriginalShowAll = originalConfig.show_all === true;

    while (
      (!haMap?.leafletMap ||
        !haMap?.Leaflet ||
        haMap?.clientWidth === 0 ||
        !huiMap?._filteredMapEntities ||
        (hasOriginalShowAll && huiMap._filteredMapEntities.length === 0)) &&
      tries < 60
    ) {
      if (!checkGen()) return null;
      await new Promise(res => setTimeout(res, 50));
      tries++;
      haMap = this._getHaMap();
      huiMap = this._getHuiMapCard();
    }
    if (!checkGen() || !haMap?.leafletMap || !huiMap?._filteredMapEntities) return null;
    return haMap;
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
    const needsSlider = this._hoursToShowConfig !== null;
    const needsEntityFilter = this._entityFilterConfig !== null;

    if (!needsMemory && !needsFit && !needsTour && !needsSlider && !needsEntityFilter) return;

    if (needsMemory || needsFit || needsSlider || needsEntityFilter) {
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

      const doApplyHoursToShow = () => {
        if (gen !== this._callGeneration) return;
        const huiMap = this._getHuiMapCard();
        if (huiMap && huiMap._config && this._hoursToShowValue !== null && this._hoursToShowValue !== undefined) {
          if (huiMap._config.hours_to_show !== this._hoursToShowValue) {
            huiMap._config = {
              ...huiMap._config,
              hours_to_show: this._hoursToShowValue
            };
          }
        }
      };

      const doApplyEntityFilter = () => {
        if (gen !== this._callGeneration) return;
        this._applyFilteredEntities();
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
            if (needsSlider) doApplyHoursToShow();
            if (needsEntityFilter) doApplyEntityFilter();
            if (needsTour) this._syncTourPois();
          });
        } else {
          if (needsMemory) doRestore();
          if (needsFit && !this._fitMapRunOnce) doFitMap();
          if (needsSlider) doApplyHoursToShow();
          if (needsEntityFilter) doApplyEntityFilter();
          if (needsTour) this._syncTourPois();
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

    // ── Slider setup ────────────────────────────────────────────────────────
    // Trigger setup when slider hasn't started yet, or when the slider element
    // has been removed from the DOM (e.g. after a forged-element refresh).
    if (needsSlider && (!this._sliderStarted || !this._sliderContainerEl?.isConnected)) {
      this._setupSlider();
    }

    // ── Entity filter setup ──────────────────────────────────────────────────
    // Trigger setup when entity filter hasn't started yet, or when the container element
    // has been removed from the DOM (e.g. after a forged-element refresh).
    if (needsEntityFilter) {
      this._syncSelectedEntities();
      if ((!this._entityFilterStarted || !this._entityFilterContainerEl?.isConnected) && !this._entityFilterSettingUp) {
        this._setupEntityFilter();
      } else if (this._entityFilterStarted && this._entityFilterContainerEl?.isConnected) {
        // If entity filter already started, check if the list of original entities changed.
        // If so, we recreate the filter overlay UI to include the new entities!
        const originalConfig = (this.controller.forge as any).forgedElementConfig || {};
        const originalIds = this._getOriginalMapEntityIds();
        const currentItemsCount = this._entityFilterContainerEl?.querySelectorAll("ha-check-list-item[value]").length || 0;
        const expectedCount = originalIds.length + (originalConfig.show_all === true ? 1 : 0);
        if (currentItemsCount !== expectedCount) {
          const haMap = this._getHaMap();
          if (haMap) {
            this._ensureEntityFilter(haMap);
          }
        }
      }
    }
  }

  disconnectedCallback(): void {
    this._cancelPending();
    this._savedCenter = null;
    this._savedZoom = null;
    this._fitMapAbort = undefined;
    this._stopTour();
    this._stopSlider();
    this._stopEntityFilter();
  }

  // ── Tour methods ───────────────────────────────────────────────────────────

  /** Tear down the tour overlay and timer, resetting all runtime state. */
  private _stopTour(): void {
    this._clearTourTimer();
    this._cancelRingAnimation();
    ++this._tourSetupGen; // cancel any pending _setupTour retries
    if (this._tourContainerEl) {
      this._tourContainerEl.remove();
      this._tourContainerEl = null;
      this._tourIconEl = null;
    }
    this._tourRingSvgEl = null;
    this._tourRingEl = null;
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

    // Wait for the Leaflet map to be fully initialised and _filteredMapEntities to be populated.
    const haMap = await this._waitForMapToBeReady(gen, () => gen === this._tourSetupGen);
    if (!haMap) return;

    // Create or reconnect the pause/play button overlay.
    const buttonWasDisconnected = !this._tourContainerEl?.isConnected;
    this._ensureTourButton(haMap);

    // Start the timer on first setup only; resume after pause is handled by
    // _toggleTourPlay() so we must not start a second timer here.
    if (!this._tourStarted) {
      this._tourStarted = true;
      if (this._tourPlaying) {
        this._advanceTour(); // navigate to first POI immediately
        this._startRingAnimation();
        this._scheduleTourTick();
      }
    } else if (buttonWasDisconnected && this._tourPlaying) {
      // Button was recreated — restart ring animation to match playing state.
      this._startRingAnimation();
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
    this._cancelRingAnimation();
    this._tourRingSvgEl = null;
    this._tourRingEl = null;

    // Inject into the Leaflet container inside ha-map's open shadow root.
    const leafletContainer = haMap.shadowRoot?.querySelector(".leaflet-container") as HTMLElement | null;
    if (!leafletContainer) return;

    // ── Container ───────────────────────────────────────────────────────────
    const container = document.createElement("div");
    container.classList.add("uix-tour-control");
    container.style.setProperty("position", "absolute");
    container.style.setProperty("z-index", "var(--uix-map-tour-icon-z-index, 1000)");
    container.style.setProperty("box-shadow", "var(--uix-map-tour-icon-box-shadow, 0 1px 5px rgba(0,0,0,0.4))");
    container.style.setProperty("border-radius", "var(--uix-map-tour-icon-border-radius, 9999px)");
    this._applyTourButtonPosition(container);

    // ── Wrapper (relative positioning context for SVG ring overlay) ──────────
    const wrapperEl = document.createElement("div");
    wrapperEl.style.setProperty("position", "relative");
    wrapperEl.style.setProperty("display", "inline-flex");

    // ── Countdown ring (SVG) ─────────────────────────────────────────────────
    const svgNS = "http://www.w3.org/2000/svg";
    const svgEl = document.createElementNS(svgNS, "svg") as SVGSVGElement;
    svgEl.setAttribute("viewBox", "0 0 48 48");
    svgEl.setAttribute("preserveAspectRatio", "xMidYMid meet");
    svgEl.style.setProperty("position", "absolute");
    svgEl.style.setProperty("top", "0");
    svgEl.style.setProperty("left", "0");
    svgEl.style.setProperty("width", "100%");
    svgEl.style.setProperty("height", "100%");
    svgEl.style.setProperty("pointer-events", "none");
    svgEl.style.setProperty("overflow", "visible");
    svgEl.style.setProperty("display", "none"); // hidden until tour starts playing

    const circumference = 2 * Math.PI * UixForgeSparkMap.TOUR_RING_RADIUS;
    const circleEl = document.createElementNS(svgNS, "circle") as SVGCircleElement;
    circleEl.setAttribute("cx", "24");
    circleEl.setAttribute("cy", "24");
    circleEl.setAttribute("r", String(UixForgeSparkMap.TOUR_RING_RADIUS));
    circleEl.setAttribute("fill", "none");
    circleEl.setAttribute("stroke-width", "3");
    circleEl.setAttribute("stroke-dasharray", `${circumference} ${circumference}`);
    circleEl.setAttribute("stroke-dashoffset", "0");
    circleEl.setAttribute("transform", "rotate(-90 24 24)");
    circleEl.style.setProperty("stroke", "var(--uix-map-tour-icon-ring-color, var(--uix-map-tour-icon-color, var(--primary-color, #03a9f4)))");
    circleEl.style.setProperty("stroke-linecap", "round");
    svgEl.appendChild(circleEl);
    wrapperEl.appendChild(svgEl);
    this._tourRingSvgEl = svgEl;
    this._tourRingEl = circleEl;

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

    wrapperEl.appendChild(btnEl);
    container.appendChild(wrapperEl);
    this._mountBottomRightControl(container, "3", this._tourIconPosition, haMap);

    this._tourContainerEl = container;
    this._tourIconEl = iconEl;
  }

  private _applyTourButtonPosition(el: HTMLElement): void {
    const pos = this._tourIconPosition ?? { bottom: "10px", right: "10px" };
    const isDefault = pos.bottom === "10px" && pos.right === "10px";
    if (isDefault) {
      return;
    }
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

  /** Start (or restart) the circular countdown ring animation for the current period. */
  private _startRingAnimation(): void {
    if (!this._tourRingEl || !this._tourRingSvgEl) return;
    if (this._tourRingAnimation) {
      this._tourRingAnimation.cancel();
      this._tourRingAnimation = null;
    }
    this._tourRingSvgEl.style.removeProperty("display");
    const circumference = 2 * Math.PI * UixForgeSparkMap.TOUR_RING_RADIUS;
    this._tourRingAnimation = this._tourRingEl.animate(
      [{ strokeDashoffset: "0" }, { strokeDashoffset: String(circumference) }],
      { duration: this._tourPeriod, easing: "linear", fill: "forwards" }
    );
  }

  /** Cancel the countdown ring animation and hide the ring. */
  private _cancelRingAnimation(): void {
    if (this._tourRingAnimation) {
      this._tourRingAnimation.cancel();
      this._tourRingAnimation = null;
    }
    if (this._tourRingSvgEl) this._tourRingSvgEl.style.setProperty("display", "none");
  }

  /** Toggle between playing and paused states. */
  private _toggleTourPlay(): void {
    this._tourPlaying = !this._tourPlaying;
    this._updateTourButtonIcon();
    if (this._tourPlaying) {
      // Resume: restart the countdown ring and schedule the next tick.
      this._startRingAnimation();
      this._scheduleTourTick();
    } else {
      // Pause: stop the timer and hide the countdown ring.
      this._clearTourTimer();
      this._cancelRingAnimation();
    }
  }

  /** Schedule one tour tick after `_tourPeriod` ms. */
  private _scheduleTourTick(): void {
    this._clearTourTimer();
    this._tourTimer = setTimeout(() => {
      this._tourTimer = null;
      if (!this._tour || !this._tourPlaying) return;
      this._advanceTour();
      this._startRingAnimation();
      this._scheduleTourTick();
    }, this._tourPeriod);
  }

  /** Advance to the next POI and fly the map there. */
  private _advanceTour(): void {
    const pois = this._getEffectivePois();
    if (pois.length === 0) return;
    this._tourPoiIndex = (this._tourPoiIndex + 1) % pois.length;
    const targetPoi = pois[this._tourPoiIndex];
    this._lastTourPoiId = targetPoi.id;
    this._flyToPoi(targetPoi);
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
  private _getEffectivePois(): Array<{ lat: number; lng: number; zoom?: number; id: string }> {
    const hass = (this.controller.forge as any).hass;

    if (this._tourPoi && this._tourPoi.length > 0) {
      const mapEntityIds = this._getMapEntityIds();
      const resolved: Array<{ lat: number; lng: number; zoom?: number; id: string }> = [];
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
          resolved.push({ lat: Number(lat), lng: Number(lng), zoom: poi.zoom, id: `entity:${poi.entity}` });
        } else if (poi.latitude !== undefined && poi.longitude !== undefined) {
          resolved.push({ lat: Number(poi.latitude), lng: Number(poi.longitude), zoom: poi.zoom, id: `coords:${poi.latitude},${poi.longitude}` });
        } else {
          console.warn("UIX Forge Map Tour: poi entry must have 'entity' or 'latitude'+'longitude' — skipping");
        }
      }
      return resolved;
    }

    // No poi list configured: derive POIs from the ha-map's entity list.
    const pois: Array<{ lat: number; lng: number; zoom?: number; id: string }> = [];
    for (const entityId of this._getMapEntityIds()) {
      const state = hass?.states?.[entityId];
      const lat = state?.attributes?.latitude;
      const lng = state?.attributes?.longitude;
      if (lat !== undefined && lng !== undefined) {
        pois.push({ lat: Number(lat), lng: Number(lng), id: `entity:${entityId}` });
      }
    }
    return pois;
  }

  /** Return the entity IDs declared in the map. */
  private _getMapEntityIds(): string[] {
    const huiMap = this._getHuiMapCard();
    if (huiMap && Array.isArray(huiMap._filteredMapEntities)) {
      return huiMap._filteredMapEntities
        .map((e: any) => (typeof e === "string" ? e : (e?.entity_id || e?.entityId || e?.entity || e?.id)))
        .filter((id: any): id is string => typeof id === "string");
    }
    // Fallback to configured entities
    const entities = (this.controller.forge as any).forgedElementConfig?.entities;
    if (!Array.isArray(entities)) return [];
    return entities
      .map((e: any) => (typeof e === "string" ? e : e?.entity))
      .filter((id: any): id is string => typeof id === "string");
  }

  private _getOriginalMapEntityIds(): string[] {
    const originalConfig = (this.controller.forge as any).forgedElementConfig || {};
    const originalEntities = originalConfig.entities;

    if (originalConfig.show_all === true) {
      const huiMap = this._getHuiMapCard();
      // If we haven't captured _fullMapEntityIds yet, or it is empty, and we now have filtered map entities,
      // let's capture them dynamically.
      if (huiMap && Array.isArray(huiMap._filteredMapEntities) && huiMap._filteredMapEntities.length > 0) {
        const ids = huiMap._filteredMapEntities
          .map((e: any) => (typeof e === "string" ? e : (e?.entity_id || e?.entityId || e?.entity || e?.id)))
          .filter((id: any): id is string => typeof id === "string");
        if (ids.length > 0 && (this._fullMapEntityIds === null || this._fullMapEntityIds.length === 0)) {
          this._fullMapEntityIds = ids;
        }
      }
      if (this._fullMapEntityIds !== null) {
        return this._fullMapEntityIds;
      }
    }

    if (Array.isArray(originalEntities)) {
      return originalEntities
        .map((e: any) => (typeof e === "string" ? e : e?.entity))
        .filter((id: any): id is string => typeof id === "string");
    }

    return [];
  }

  private _syncTourPois(): void {
    if (!this._tour || !this._tourStarted) return;

    const pois = this._getEffectivePois();
    if (pois.length === 0) {
      this._tourPoiIndex = -1;
      this._lastTourPoiId = null;
      this._clearTourTimer();
      this._cancelRingAnimation();
      return;
    }

    // Attempt to locate our last active POI in the new list
    let newIndex = -1;
    if (this._lastTourPoiId !== null) {
      newIndex = pois.findIndex(p => p.id === this._lastTourPoiId);
    }

    if (newIndex !== -1) {
      // Still present: update the index to match its position
      this._tourPoiIndex = newIndex;
    } else {
      // Current POI is no longer displayed/available. Select a new active POI.
      this._tourPoiIndex = 0;
      const targetPoi = pois[0];
      this._lastTourPoiId = targetPoi.id;

      // Fly to the new POI immediately since the old one is gone.
      this._flyToPoi(targetPoi);

      // Reset the countdown ring and timer if the tour is playing
      if (this._tourPlaying) {
        this._startRingAnimation();
        this._scheduleTourTick();
      }
    }
  }

  // ── Hours to show Slider Methods ──────────────────────────────────────────

  /** Tear down the slider overlay, resetting runtime state. */
  private _stopSlider(): void {
    ++this._sliderSetupGen;
    if (this._sliderContainerEl) {
      this._sliderContainerEl.remove();
      this._sliderContainerEl = null;
      this._sliderEl = null;
      this._sliderLabelEl = null;
    }
    this._sliderStarted = false;
  }

  /**
   * Async setup for hours_to_show slider overlay mode. Uses a dedicated
   * generation counter to coalesce updates.
   */
  private async _setupSlider(): Promise<void> {
    const gen = ++this._sliderSetupGen;

    // Wait for the Leaflet map to be fully initialised and _filteredMapEntities to be populated.
    const haMap = await this._waitForMapToBeReady(gen, () => gen === this._sliderSetupGen);
    if (!haMap) return;

    // Read initial hoursToShow value if we haven't selected one yet.
    if (this._hoursToShowValue === null || this._hoursToShowValue === undefined) {
      const huiMap = this._getHuiMapCard();
      const cardActualHours = huiMap?._config?.hours_to_show;
      const cardConfig = (this.controller.forge as any).forgedElementConfig;
      const configHours = cardConfig?.hours_to_show;
      const initialValue = cardActualHours !== undefined ? Number(cardActualHours) : (configHours !== undefined ? Number(configHours) : null);
      const min = this._hoursToShowConfig?.min ?? 0;
      this._hoursToShowValue = initialValue !== null ? initialValue : min;
    }

    this._ensureSlider(haMap);

    // Initial state set on target map card
    if (this._hoursToShowValue !== null) {
      const huiMap = this._getHuiMapCard();
      if (huiMap && huiMap._config && huiMap._config.hours_to_show !== this._hoursToShowValue) {
        huiMap._config = {
          ...huiMap._config,
          hours_to_show: this._hoursToShowValue
        };
      }
    }

    this._sliderStarted = true;
  }

  /** Create the slider overlay or update its limits if it already exists. */
  private _ensureSlider(haMap: any): void {
    if (this._sliderContainerEl?.isConnected) {
      this._applySliderPosition(this._sliderContainerEl);
      this._updateSliderControl();
      return;
    }

    if (this._sliderContainerEl) {
      this._sliderContainerEl.remove();
      this._sliderContainerEl = null;
      this._sliderEl = null;
      this._sliderLabelEl = null;
    }

    // Inject into Leaflet container of ha-map's open shadow root.
    const leafletContainer = haMap.shadowRoot?.querySelector(".leaflet-container") as HTMLElement | null;
    if (!leafletContainer) return;

    // ── Container ───────────────────────────────────────────────────────────
    const container = document.createElement("div");
    container.classList.add("uix-map-slider-control");
    container.style.setProperty("position", "absolute");
    container.style.setProperty("z-index", "var(--uix-map-slider-z-index, 1000)");
    container.style.setProperty("display", "flex");
    container.style.setProperty("align-items", "center");
    container.style.setProperty("gap", "8px");
    container.style.setProperty("background", "var(--uix-map-slider-background, rgba(255,255,255,0.8))");
    container.style.setProperty("padding", "var(--uix-map-slider-padding, 4px 12px)");
    container.style.setProperty("border-radius", "var(--uix-map-slider-border-radius, 20px)");
    container.style.setProperty("box-shadow", "var(--uix-map-slider-box-shadow, 0 1px 5px rgba(0,0,0,0.4))");
    container.style.setProperty("pointer-events", "auto");
    this._applySliderPosition(container);

    // Stop Leaflet from intercepting navigation gestures (dragging/scrolling) on the slider container.
    // We only stop propagation of mousedown/touchstart/pointerdown (which starts drags), click/dblclick (zoom/pan),
    // and wheel/mousewheel (scroll-zoom). We MUST NOT stop mousemove/mouseup/pointermove/pointerup/touchmove/touchend,
    // otherwise the document/window won't receive them, breaking standard dragging and release of the slider control!
    const stopEvents = [
      "mousedown",
      "pointerdown",
      "touchstart",
      "click",
      "dblclick",
      "wheel",
      "mousewheel"
    ];
    for (const name of stopEvents) {
      container.addEventListener(name, (ev) => ev.stopPropagation());
    }

    // ── Label ───────────────────────────────────────────────────────────────
    const label = document.createElement("span");
    label.style.setProperty("color", "var(--uix-map-slider-text-color, var(--primary-text-color, #212121))");
    label.style.setProperty("font-size", "12px");
    label.style.setProperty("font-weight", "bold");
    label.style.setProperty("user-select", "none");
    label.style.setProperty("min-width", "var(--uix-map-slider-label-min-width, 28px)");
    label.style.setProperty("text-align", "right");
    label.style.setProperty("display", "inline-block");
    this._sliderLabelEl = label;

    // ── Slider ──────────────────────────────────────────────────────────────
    const slider = document.createElement("ha-slider") as any;
    slider.min = this._hoursToShowConfig?.min ?? 0;
    slider.max = this._hoursToShowConfig?.max ?? 24;
    slider.step = this._hoursToShowConfig?.step ?? 1;
    slider.pin = true;
    slider.value = this._hoursToShowValue;
    slider.style.setProperty("width", "var(--uix-map-slider-width, 100px)");
    slider.style.setProperty("display", "inline-block");

    // Modern styling leveraging CSS shadow parts and fallback variables that copy slider-entity-row options
    const styleEl = document.createElement("style");
    styleEl.classList.add("uix-map-slider-styles");
    styleEl.innerHTML = `
      ha-slider {
        --thumb-height: var(--uix-map-slider-thumb-size, var(--uix-map-slider-thumb-height, 16px));
        --thumb-width: var(--uix-map-slider-thumb-size, var(--uix-map-slider-thumb-width, 16px));
        --track-size: var(--uix-map-slider-track-size, var(--ha-slider-track-size, 4px));
        padding: 0 calc(var(--uix-map-slider-thumb-size, var(--uix-map-slider-thumb-width, 16px)) / 2);
      }
      ha-slider::part(track) {
        background: var(--uix-map-slider-track-color, var(--ha-slider-track-color, var(--disabled-color)));
      }
      ha-slider::part(indicator) {
        background: var(--uix-map-slider-indicator-color, var(--ha-slider-indicator-color, var(--primary-color)));
      }
      ha-slider::part(thumb) {
        background: var(--uix-map-slider-thumb-color, var(--uix-map-slider-indicator-color, var(--ha-slider-thumb-color, var(--primary-color))));
        overflow: visible;
      }
      ha-slider::part(thumb)::before {
        content: "";
        border-radius: 50%;
        position: absolute;
        width: calc(var(--thumb-width, 16px) * 2 + 8px);
        height: calc(var(--thumb-height, 16px) * 2 + 8px);
        background-color: var(--uix-map-slider-thumb-color, var(--uix-map-slider-indicator-color, var(--ha-slider-thumb-color, var(--primary-color))));
        left: calc(-50% - 4px);
        top: calc(-50% - 4px);
        z-index: -1;
        opacity: 0;
        transition: opacity 0.15s ease-in-out;
      }
      ha-slider::part(thumb):hover::before,
      ha-slider::part(thumb):focus-visible::before {
        opacity: var(--uix-map-slider-thumb-hover-opacity, var(--ha-ripple-hover-opacity, 0.08));
      }
      ha-slider::part(thumb):active::before {
        opacity: var(--uix-map-slider-thumb-pressed-opacity, var(--ha-ripple-pressed-opacity, 0.12));
      }
      ha-slider::part(tooltip) {
        --wa-tooltip-content-color: var(--uix-map-slider-tooltip-color, var(--ha-tooltip-text-color, var(--primary-text-color)));
        --wa-tooltip-font-size: var(--uix-map-slider-tooltip-font-size, var(--ha-tooltip-font-size, var(--ha-font-size-s)));
        --wa-tooltip-font-weight: var(--uix-map-slider-tooltip-font-weight, var(--ha-tooltip-font-weight, var(--ha-font-weight-normal)));
        --wa-tooltip-background-color: var(--uix-map-slider-tooltip-background-color, var(--ha-tooltip-background-color, var(--secondary-background-color)));
        --wa-tooltip-border-radius: var(--uix-map-slider-tooltip-border-radius, var(--ha-tooltip-border-radius, var(--ha-border-radius-sm)));
        --wa-tooltip-border-width: var(--uix-map-slider-tooltip-border-width, 0px);
        --wa-tooltip-border-color: var(--uix-map-slider-tooltip-border-color, currentColor);
        --wa-tooltip-border-style: var(--uix-map-slider-tooltip-border-style, none);
      }
    `;
    container.appendChild(styleEl);

    // Apply thumb box shadow inside shadow root of custom element
    if (slider.updateComplete) {
      (slider.updateComplete as Promise<void>).then(() => {
        if (!slider.shadowRoot) return;
        if (!slider.shadowRoot.querySelector(".uix-map-slider-thumb-style")) {
          const innerStyle = document.createElement("style");
          innerStyle.classList.add("uix-map-slider-thumb-style");
          innerStyle.innerHTML = `
            span#thumb {
              box-shadow: var(--uix-map-slider-thumb-box-shadow, inherit);
            }
            wa-tooltip {
              --wa-tooltip-content-color: var(--uix-map-slider-tooltip-color, var(--ha-tooltip-text-color, var(--primary-text-color)));
              --wa-tooltip-font-size: var(--uix-map-slider-tooltip-font-size, var(--ha-tooltip-font-size, var(--ha-font-size-s)));
              --wa-tooltip-font-weight: var(--uix-map-slider-tooltip-font-weight, var(--ha-tooltip-font-weight, var(--ha-font-weight-normal)));
              --wa-tooltip-background-color: var(--uix-map-slider-tooltip-background-color, var(--ha-tooltip-background-color, var(--secondary-background-color)));
              --wa-tooltip-border-radius: var(--uix-map-slider-tooltip-border-radius, var(--ha-tooltip-border-radius, var(--ha-border-radius-sm)));
              --wa-tooltip-border-width: var(--uix-map-slider-tooltip-border-width, 0px);
              --wa-tooltip-border-color: var(--uix-map-slider-tooltip-border-color, currentColor);
              --wa-tooltip-border-style: var(--uix-map-slider-tooltip-border-style, none);
            }
          `;
          slider.shadowRoot.appendChild(innerStyle);
        }
        const tooltip = slider.shadowRoot.querySelector("wa-tooltip");
        if (tooltip) {
          tooltip.setAttribute("distance", String(this._hoursToShowConfig?.tooltip_distance ?? 20));
        }
      });
    }

    this._sliderEl = slider;

    this._updateLabelText();

    const updateHandler = (ev: any) => {
      ev.stopPropagation();
      const val = Number(ev.target.value);
      this._hoursToShowValue = val;
      this._updateLabelText();
      const huiMap = this._getHuiMapCard();
      if (huiMap && huiMap._config && huiMap._config.hours_to_show !== val) {
        huiMap._config = {
          ...huiMap._config,
          hours_to_show: val
        };
      }
    };
    slider.addEventListener("change", updateHandler);
    slider.addEventListener("input", updateHandler);

    container.appendChild(slider);
    container.appendChild(label);

    this._mountBottomRightControl(container, "2", this._hoursToShowConfig?.position, haMap);

    this._sliderContainerEl = container;
  }

  private _applySliderPosition(el: HTMLElement): void {
    const sliderPos = this._hoursToShowConfig?.position;
    const isDefault = !sliderPos || (sliderPos.bottom === "10px" && sliderPos.right === "10px");
    if (isDefault) {
      return;
    }

    el.style.removeProperty("top");
    el.style.removeProperty("bottom");
    el.style.removeProperty("left");
    el.style.removeProperty("right");

    if (sliderPos) {
      if (sliderPos.top !== undefined) el.style.setProperty("top", sliderPos.top);
      if (sliderPos.bottom !== undefined) el.style.setProperty("bottom", sliderPos.bottom);
      if (sliderPos.left !== undefined) el.style.setProperty("left", sliderPos.left);
      if (sliderPos.right !== undefined) el.style.setProperty("right", sliderPos.right);
    }
  }

  private _updateSliderControl(): void {
    if (this._sliderEl && this._hoursToShowConfig) {
      this._sliderEl.min = this._hoursToShowConfig.min;
      this._sliderEl.max = this._hoursToShowConfig.max;
      this._sliderEl.step = this._hoursToShowConfig.step;
      this._sliderEl.value = this._hoursToShowValue;

      const tooltip = this._sliderEl.shadowRoot?.querySelector("wa-tooltip");
      if (tooltip) {
        tooltip.setAttribute("distance", String(this._hoursToShowConfig.tooltip_distance));
      }

      this._updateLabelText();
    }
  }

  private _updateLabelText(): void {
    if (this._sliderLabelEl && this._hoursToShowValue !== null) {
      this._sliderLabelEl.textContent = `${this._hoursToShowValue}h`;
    }
  }

  // ── Entity filter methods ──────────────────────────────────────────────────

  /** Tear down the entity filter overlay, resetting runtime state and restoring config. */
  private _stopEntityFilter(): void {
    ++this._entityFilterSetupGen;
    if (this._entityFilterContainerEl) {
      this._entityFilterContainerEl.remove();
      this._entityFilterContainerEl = null;
    }
    this._entityFilterStarted = false;
    this._entityFilterSettingUp = false;

    // Restore original entities configuration
    const huiMap = this._getHuiMapCard();
    if (huiMap && huiMap._config) {
      const originalConfig = (this.controller.forge as any).forgedElementConfig || {};
      const newConfig = { ...huiMap._config };
      if (originalConfig.show_all !== undefined) {
        newConfig.show_all = originalConfig.show_all;
      } else {
        delete newConfig.show_all;
      }
      if (originalConfig.entities !== undefined) {
        newConfig.entities = originalConfig.entities;
      } else {
        delete newConfig.entities;
      }
      huiMap.setConfig(newConfig);
    }

    this._selectedEntities = null;
    this._lastKnownEntityIds = null;
    this._fullMapEntityIds = null;
  }

  /**
   * Async setup for entity_filter overlay mode. Uses a dedicated
   * generation counter to coalesce updates.
   */
  private async _setupEntityFilter(): Promise<void> {
    if (this._entityFilterSettingUp) return;
    this._entityFilterSettingUp = true;
    const gen = ++this._entityFilterSetupGen;

    try {
      // Wait for the Leaflet map to be fully initialised and _filteredMapEntities to be populated.
      const haMap = await this._waitForMapToBeReady(gen, () => gen === this._entityFilterSetupGen);
      if (!haMap) return;

      // Capture the initial full list of map entities before starting any filtering
      const huiMap = this._getHuiMapCard();
      if (huiMap && Array.isArray(huiMap._filteredMapEntities)) {
        this._fullMapEntityIds = huiMap._filteredMapEntities
          .map((e: any) => (typeof e === "string" ? e : (e?.entity_id || e?.entityId || e?.entity || e?.id)))
          .filter((id: any): id is string => typeof id === "string");
      }

      this._syncSelectedEntities();

      this._ensureEntityFilter(haMap);

      this._entityFilterStarted = true;

      // Initial state set on target map card
      this._applyFilteredEntities();
    } finally {
      this._entityFilterSettingUp = false;
    }
  }

  private _getOrCreateBottomRightControls(haMap: any): HTMLElement | null {
    const leafletContainer = haMap.shadowRoot?.querySelector(".leaflet-container") as HTMLElement | null;
    if (!leafletContainer) return null;

    let controls = leafletContainer.querySelector(".uix-map-controls-bottom-right") as HTMLElement | null;
    if (!controls) {
      controls = document.createElement("div");
      controls.classList.add("uix-map-controls-bottom-right");
      controls.style.setProperty("position", "absolute");
      controls.style.setProperty("bottom", "10px");
      controls.style.setProperty("right", "10px");
      controls.style.setProperty("z-index", "1000");
      controls.style.setProperty("display", "flex");
      controls.style.setProperty("align-items", "center");
      controls.style.setProperty("gap", "8px");
      controls.style.setProperty("pointer-events", "none");

      const style = document.createElement("style");
      style.innerHTML = `
        .uix-map-controls-bottom-right > div {
          position: static !important;
          pointer-events: auto !important;
        }
      `;
      controls.appendChild(style);
      leafletContainer.appendChild(controls);
    }
    return controls;
  }

  private _mountBottomRightControl(container: HTMLElement, order: string, positionConfig: any, haMap: any): void {
    const leafletContainer = haMap.shadowRoot?.querySelector(".leaflet-container") as HTMLElement | null;
    if (!leafletContainer) return;

    const isDefault = !positionConfig || (positionConfig.bottom === "10px" && positionConfig.right === "10px");

    if (isDefault) {
      const controls = this._getOrCreateBottomRightControls(haMap);
      if (controls) {
        container.style.setProperty("order", order);
        controls.appendChild(container);
        return;
      }
    }

    leafletContainer.appendChild(container);
  }

  /** Create the entity filter overlay or update its list if it already exists. */
  private _ensureEntityFilter(haMap: any): void {
    if (this._entityFilterContainerEl?.isConnected) {
      this._applyEntityFilterPosition(this._entityFilterContainerEl);
      this._updateEntityFilterControl();
      return;
    }

    if (this._entityFilterContainerEl) {
      this._entityFilterContainerEl.remove();
      this._entityFilterContainerEl = null;
    }

    // Inject into Leaflet container of ha-map's open shadow root.
    const leafletContainer = haMap.shadowRoot?.querySelector(".leaflet-container") as HTMLElement | null;
    if (!leafletContainer) return;

    // ── Container ───────────────────────────────────────────────────────────
    const container = document.createElement("div");
    container.classList.add("uix-map-entity-filter-control");
    container.style.setProperty("position", "absolute");
    container.style.setProperty("z-index", "var(--uix-map-entity-filter-z-index, 1000)");
    container.style.setProperty("pointer-events", "auto");
    this._applyEntityFilterPosition(container);

    // Stop Leaflet from intercepting navigation gestures (dragging/scrolling) on the container.
    const stopEvents = [
      "mousedown",
      "pointerdown",
      "touchstart",
      "click",
      "dblclick",
      "wheel",
      "mousewheel"
    ];
    for (const name of stopEvents) {
      container.addEventListener(name, (ev) => ev.stopPropagation());
    }

    // Modern styling leveraging CSS variables
    const styleEl = document.createElement("style");
    styleEl.classList.add("uix-map-entity-filter-styles");
    styleEl.innerHTML = `
      .uix-map-entity-filter-control {
        background: var(--uix-map-entity-filter-background, rgba(255,255,255,0.8));
        padding: var(--uix-map-entity-filter-padding, 4px);
        border-radius: var(--uix-map-entity-filter-border-radius, 20px);
        box-shadow: var(--uix-map-entity-filter-box-shadow, 0 1px 5px rgba(0,0,0,0.4));
      }
      ha-dropdown {
        --mdc-menu-min-width: var(--uix-map-entity-filter-dropdown-min-width, 180px);
      }
      ha-check-list-item {
        padding-left: 12px;
        padding-right: 12px;
      }
      .uix-map-divider {
        height: 1px;
        background-color: var(--divider-color, rgba(0, 0, 0, 0.12));
        margin: 4px 0;
        list-style-type: none;
      }
      ha-button::part(base) {
        padding-inline-end: var(--ha-space-2);
      }
    `;
    container.appendChild(styleEl);

    // ── Dropdown ────────────────────────────────────────────────────────────
    const dropdown = document.createElement("ha-dropdown") as any;
    dropdown.setAttribute("size", this._entityFilterConfig?.size || "s");

    // ── Trigger Button ──────────────────────────────────────────────────────
    const button = document.createElement("ha-button") as any;
    button.setAttribute("slot", "trigger");
    button.setAttribute("size", this._entityFilterConfig?.size || "s");
    button.setAttribute("variant", this._entityFilterConfig?.variant || "neutral");
    button.setAttribute("appearance", this._entityFilterConfig?.appearance || "filled");

    if (this._entityFilterConfig?.icon) {
      const iconEl = document.createElement("ha-icon");
      (iconEl as any).icon = this._entityFilterConfig.icon;
      iconEl.setAttribute("slot", "start");
      if (this._entityFilterConfig?.label == "") {
        // Icon-only button: add aria-label for accessibility
        iconEl.style.setProperty("margin-inline-end", "0");
      }
      button.appendChild(iconEl);
    }

    const labelSpan = document.createElement("span");
    labelSpan.textContent = (this._entityFilterConfig?.label !== undefined ? this._entityFilterConfig.label : "Filter");
    button.appendChild(labelSpan);
    dropdown.appendChild(button);

    // ── Generate Check List Items ───────────────────────────────────────────
    const currentEntityIds = this._getOriginalMapEntityIds();
    const isAllInitiallySelected = this._selectedEntities && currentEntityIds.length > 0 && currentEntityIds.every(id => this._selectedEntities!.has(id));

    let showAllItem: any = null;
    const originalConfig = (this.controller.forge as any).forgedElementConfig || {};
    const hasOriginalShowAll = originalConfig.show_all === true;

    if (hasOriginalShowAll) {
      // Create the master "Show All" checkbox
      showAllItem = document.createElement("ha-check-list-item") as any;
      showAllItem.value = "show_all_toggle";
      showAllItem.left = true;
      showAllItem.setAttribute("left", "");
      showAllItem.textContent = this._entityFilterConfig?.show_all_label || "Show All";
      
      showAllItem.selected = isAllInitiallySelected;
      if ("checked" in showAllItem) {
        showAllItem.checked = isAllInitiallySelected;
      }
      if (isAllInitiallySelected) {
        showAllItem.setAttribute("selected", "");
        showAllItem.setAttribute("checked", "");
      } else {
        showAllItem.removeAttribute("selected");
        showAllItem.removeAttribute("checked");
      }

      showAllItem.addEventListener("click", (ev: Event) => {
        ev.stopPropagation();
        if (showAllItem.disabled) {
          return;
        }

        // Show All can only be toggled ON directly. It is disabled when it is already ON.
        // Therefore, clicking it will always turn it ON.
        const nextState = true;
        showAllItem.selected = nextState;
        if ("checked" in showAllItem) {
          showAllItem.checked = nextState;
        }
        showAllItem.setAttribute("selected", "");
        showAllItem.setAttribute("checked", "");

        if (this._selectedEntities) {
          const allIds = this._getOriginalMapEntityIds();
          allIds.forEach(id => this._selectedEntities!.add(id));
          // Update all individual items in dropdown UI
          const otherItems = dropdown.querySelectorAll("ha-check-list-item");
          otherItems.forEach((it: any) => {
            if (it.value !== "show_all_toggle") {
              it.selected = true;
              if ("checked" in it) {
                it.checked = true;
              }
              it.setAttribute("selected", "");
              it.setAttribute("checked", "");
            }
          });
          this._updateDisabledStates(dropdown);
          this._applyFilteredEntities();
        }
      });

      const suppressCloseShowAll = (ev: Event) => {
        ev.stopPropagation();
      };
      showAllItem.addEventListener("selected", suppressCloseShowAll);
      showAllItem.addEventListener("select", suppressCloseShowAll);
      showAllItem.addEventListener("action", suppressCloseShowAll);

      dropdown.appendChild(showAllItem);

      // Create a divider after Show All
      const divider = document.createElement("li");
      divider.classList.add("uix-map-divider");
      divider.setAttribute("role", "separator");
      dropdown.appendChild(divider);
    }

    // Create individual entity check items
    for (const id of currentEntityIds) {
      const item = document.createElement("ha-check-list-item") as any;
      item.value = id;
      item.left = true;
      item.setAttribute("left", "");
      
      const isSelected = this._selectedEntities?.has(id) ?? true;
      item.selected = isSelected;
      if ("checked" in item) {
        item.checked = isSelected;
      }
      if (isSelected) {
        item.setAttribute("selected", "");
        item.setAttribute("checked", "");
      } else {
        item.removeAttribute("selected");
        item.removeAttribute("checked");
      }

      const friendlyName = this._formatEntityName(id);
      item.textContent = friendlyName;

      // Click event updates filter state to let custom element update and keep dropdown open.
      item.addEventListener("click", (ev: Event) => {
        ev.stopPropagation();
        const isCurrentlyChecked = item.selected === true || item.checked === true || item.hasAttribute("selected") || item.hasAttribute("checked");
        if (isCurrentlyChecked && this._selectedEntities && this._selectedEntities.size <= 1 && this._selectedEntities.has(id)) {
          // Keep it selected; maps always need at least one entity
          item.selected = true;
          if ("checked" in item) {
            item.checked = true;
          }
          item.setAttribute("selected", "");
          item.setAttribute("checked", "");
          return;
        }

        const nextState = !isCurrentlyChecked;
        item.selected = nextState;
        if ("checked" in item) {
          item.checked = nextState;
        }
        if (nextState) {
          item.setAttribute("selected", "");
          item.setAttribute("checked", "");
        } else {
          item.removeAttribute("selected");
          item.removeAttribute("checked");
        }
        if (this._selectedEntities) {
          if (nextState) {
            this._selectedEntities.add(id);
          } else {
            this._selectedEntities.delete(id);
          }

          // Recalculate and update the "Show All" checkbox state
          if (showAllItem) {
            const allIds = this._getOriginalMapEntityIds();
            const allSelected = allIds.length > 0 && allIds.every(otherId => this._selectedEntities!.has(otherId));
            showAllItem.selected = allSelected;
            if ("checked" in showAllItem) {
              showAllItem.checked = allSelected;
            }
            if (allSelected) {
              showAllItem.setAttribute("selected", "");
              showAllItem.setAttribute("checked", "");
            } else {
              showAllItem.removeAttribute("selected");
              showAllItem.removeAttribute("checked");
            }
          }

          this._updateDisabledStates(dropdown);
          this._applyFilteredEntities();
        }
      });

      // Prevent checklist selection events from bubbling to dropdown and closing it.
      const suppressClose = (ev: Event) => {
        ev.stopPropagation();
      };
      item.addEventListener("selected", suppressClose);
      item.addEventListener("select", suppressClose);
      item.addEventListener("action", suppressClose);

      dropdown.appendChild(item);
    }

    container.appendChild(dropdown);
    this._mountBottomRightControl(container, "1", this._entityFilterConfig?.position, haMap);

    this._updateDisabledStates(dropdown);

    this._entityFilterContainerEl = container;
  }

  private _updateDisabledStates(dropdown: any): void {
    const items = dropdown.querySelectorAll("ha-check-list-item");
    const selectedCount = this._selectedEntities ? this._selectedEntities.size : 0;
    const currentEntityIds = this._getOriginalMapEntityIds();
    const allSelected = this._selectedEntities && currentEntityIds.length > 0 && currentEntityIds.every(id => this._selectedEntities!.has(id));

    items.forEach((item: any) => {
      const id = item.value;
      if (id === "show_all_toggle") {
        if (allSelected) {
          item.disabled = true;
          item.setAttribute("disabled", "");
        } else {
          item.disabled = false;
          item.removeAttribute("disabled");
        }
      } else if (id && this._selectedEntities) {
        if (selectedCount <= 1 && this._selectedEntities.has(id)) {
          item.disabled = true;
          item.setAttribute("disabled", "");
        } else {
          item.disabled = false;
          item.removeAttribute("disabled");
        }
      }
    });
  }

  private _applyEntityFilterPosition(el: HTMLElement): void {
    const filterPos = this._entityFilterConfig?.position;
    const isDefault = !filterPos || (filterPos.bottom === "10px" && filterPos.right === "10px");
    if (isDefault) {
      return;
    }

    el.style.removeProperty("top");
    el.style.removeProperty("bottom");
    el.style.removeProperty("left");
    el.style.removeProperty("right");

    if (filterPos) {
      if (filterPos.top !== undefined) el.style.setProperty("top", filterPos.top);
      if (filterPos.bottom !== undefined) el.style.setProperty("bottom", filterPos.bottom);
      if (filterPos.left !== undefined) el.style.setProperty("left", filterPos.left);
      if (filterPos.right !== undefined) el.style.setProperty("right", filterPos.right);
    }
  }

  private _updateEntityFilterControl(): void {
    if (!this._entityFilterContainerEl) return;
    const dropdown = this._entityFilterContainerEl.querySelector("ha-dropdown");
    if (!dropdown) return;

    // Refresh check states for list items
    const items = dropdown.querySelectorAll("ha-check-list-item");
    const currentEntityIds = this._getOriginalMapEntityIds();
    const allSelected = this._selectedEntities && currentEntityIds.length > 0 && currentEntityIds.every(id => this._selectedEntities!.has(id));

    items.forEach((item: any) => {
      const id = item.value;
      if (id === "show_all_toggle") {
        item.selected = allSelected;
        if ("checked" in item) {
          item.checked = allSelected;
        }
        if (allSelected) {
          item.setAttribute("selected", "");
          item.setAttribute("checked", "");
        } else {
          item.removeAttribute("selected");
          item.removeAttribute("checked");
        }
      } else if (id && this._selectedEntities) {
        const isSel = this._selectedEntities.has(id);
        item.selected = isSel;
        if ("checked" in item) {
          item.checked = isSel;
        }
        if (isSel) {
          item.setAttribute("selected", "");
          item.setAttribute("checked", "");
        } else {
          item.removeAttribute("selected");
          item.removeAttribute("checked");
        }
      }
    });

    this._updateDisabledStates(dropdown);

    // Refresh trigger button attributes in case config changed on the fly
    const button = dropdown.querySelector("ha-button") as any;
    if (button && this._entityFilterConfig) {
      button.setAttribute("size", this._entityFilterConfig.size);
      button.setAttribute("variant", this._entityFilterConfig.variant);
      button.setAttribute("appearance", this._entityFilterConfig.appearance);

      const span = button.querySelector("span");
      if (span) span.textContent = this._entityFilterConfig.label;

      const icon = button.querySelector("ha-icon") as any;
      if (icon) {
        icon.icon = this._entityFilterConfig.icon;
        icon.style.setProperty("margin-inline-end", this._entityFilterConfig.icon && this._entityFilterConfig.label !== "" ? "var(--ha-space-1)" : "0");
      }
    }
  }

  private _getFilteredEntities(originalEntities: any[]): any[] {
    if (!Array.isArray(originalEntities)) return [];
    return originalEntities.filter(e => {
      const id = typeof e === "string" ? e : e?.entity;
      return typeof id === "string" && this._selectedEntities && this._selectedEntities.has(id);
    });
  }

  private _syncSelectedEntities(): void {
    const currentEntityIds = this._getOriginalMapEntityIds();
    if (currentEntityIds.length === 0) {
      // If the map has no entities (e.g. not loaded or empty config), do not wipe out our selections.
      return;
    }

    if (!this._selectedEntities) {
      this._selectedEntities = new Set();
    }

    if (this._lastKnownEntityIds === null) {
      // First run: select all entities by default
      for (const id of currentEntityIds) {
        this._selectedEntities.add(id);
      }
    } else {
      // Add any new entities that have appeared
      const oldSet = new Set(this._lastKnownEntityIds);
      for (const id of currentEntityIds) {
        if (!oldSet.has(id)) {
          this._selectedEntities.add(id);
        }
      }
      // Remove stale entities that are no longer in original map config
      for (const id of this._selectedEntities) {
        if (!currentEntityIds.includes(id)) {
          this._selectedEntities.delete(id);
        }
      }
    }
    this._lastKnownEntityIds = currentEntityIds;
  }

  private _applyFilteredEntities(): void {
    if (!this._entityFilterStarted) return;

    const huiMap = this._getHuiMapCard();
    if (!huiMap || !huiMap._config) return;

    const originalConfig = (this.controller.forge as any).forgedElementConfig || {};
    const originalEntities = originalConfig.entities || [];
    const hasOriginalShowAll = originalConfig.show_all === true;

    const currentEntityIds = this._getOriginalMapEntityIds();
    const isAllSelected = this._selectedEntities && currentEntityIds.length > 0 && currentEntityIds.every(id => this._selectedEntities!.has(id));

    const newConfig = { ...huiMap._config };

    if (hasOriginalShowAll) {
      if (isAllSelected) {
        // Reset show_all to true and restore original config as is to avoid loops
        if (originalConfig.show_all !== undefined) {
          newConfig.show_all = originalConfig.show_all;
        } else {
          delete newConfig.show_all;
        }
        if (originalConfig.entities !== undefined) {
          newConfig.entities = originalEntities;
        } else {
          delete newConfig.entities;
        }
      } else {
        // When we filter, we remove show_all from config as having in config generates an error
        delete newConfig.show_all;
        const allKnown = this._getOriginalMapEntityIds();
        newConfig.entities = allKnown
          .filter(id => this._selectedEntities && this._selectedEntities.has(id))
          .map(id => {
            const orig = Array.isArray(originalEntities) ? originalEntities.find((e: any) => (typeof e === "string" ? e === id : e?.entity === id)) : null;
            return orig || id;
          });
      }
    } else {
      // Normal filtering (for show_all: false/undefined case)
      delete newConfig.show_all;
      if (isAllSelected) {
        newConfig.entities = originalEntities;
      } else {
        newConfig.entities = originalEntities.filter((e: any) => {
          const id = typeof e === "string" ? e : e?.entity;
          return typeof id === "string" && this._selectedEntities && this._selectedEntities.has(id);
        });
      }
    }

    if (!newConfig.show_all && (!newConfig.entities || newConfig.entities.length === 0)) {
      // Prevent setting an empty entities list which would crash the card
      return;
    }

    const currentEntities = huiMap._config.entities;
    const currentShowAll = huiMap._config.show_all;

    const hasChanged = JSON.stringify(currentEntities) !== JSON.stringify(newConfig.entities) ||
                        currentShowAll !== newConfig.show_all ||
                        !("entities" in newConfig) !== !("entities" in huiMap._config) ||
                        !("show_all" in newConfig) !== !("show_all" in huiMap._config);

    if (hasChanged) {
      huiMap.setConfig(newConfig);
      if (this._tour && this._tourStarted) {
        if (huiMap.updateComplete) {
          (huiMap.updateComplete as Promise<void>).then(() => {
            this._syncTourPois();
          });
        } else {
          setTimeout(() => this._syncTourPois(), 100);
        }
      }
    }
  }

  private _formatEntityName(entityId: string): string {
    const hass = (this.controller.forge as any).hass;
    const stateObj = hass?.states?.[entityId];
    if (stateObj) {
      if (typeof hass?.formatEntityName === "function") {
        try {
          return hass.formatEntityName(stateObj, { type: "entity" });
        } catch (e) {
          console.error("UIX Forge Map Entity Filter: failed to call hass.formatEntityName", e);
        }
      }
      return stateObj.attributes?.friendly_name || stateObj.entity_id || entityId;
    }
    return entityId;
  }
}
