import { PropertyValues } from "lit";
import { UixForgeSparkBase } from "./uix-spark-base";

/**
 * Map spark — provides memory mode for map cards used inside UIX Forge.
 *
 * When `memory: true` is set, the current Leaflet zoom level and map center
 * are captured in `willUpdate` (before the forged element re-renders with
 * new `hass` data) and then restored in `updated` after the map has finished
 * its own update cycle. This prevents the map from snapping back to its
 * default view every time Home Assistant state changes.
 *
 * Configuration:
 *   type: map
 *   memory: true   # save and restore zoom + center across hass updates
 *
 * The spark expects the forged element to be a map card whose shadow root
 * contains a `ha-map` element with a `leafletMap` property exposing the
 * Leaflet map instance.
 */
export class UixForgeSparkMap extends UixForgeSparkBase {
  type = "map";

  private _memory: boolean = false;
  private _savedZoom: number | null = null;
  private _savedCenter: { lat: number; lng: number } | null = null;

  constructor(controller: any, config: Record<string, any>) {
    super(controller, config);
    this._applyConfig(config);
  }

  configUpdated(config: Record<string, any>): void {
    super.configUpdated(config);
    this._applyConfig(config);
  }

  private _applyConfig(config: Record<string, any>): void {
    this._memory = config.memory === true;
  }

  /** Returns the `ha-map` element inside the forged element's shadow root, or null. */
  private _getHaMap(): any {
    const forgedElement = this.controller.forgedElement();
    return forgedElement?.shadowRoot?.querySelector("ha-map") ?? null;
  }

  willUpdate(_changedProperties: PropertyValues): void {
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
    if (!this._memory || this._savedCenter === null) return;

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
      if (leafletMap && savedCenter) {
        leafletMap.setView(savedCenter, savedZoom);
      }
    };

    const afterForgedElement = () => {
      if (gen !== this._callGeneration) return;
      const haMap = this._getHaMap();
      if (haMap?.updateComplete) {
        (haMap.updateComplete as Promise<boolean>).then(doRestore);
      } else {
        doRestore();
      }
    };

    if ((forgedElement as any).updateComplete) {
      ((forgedElement as any).updateComplete as Promise<boolean>).then(afterForgedElement);
    } else {
      afterForgedElement();
    }
  }

  disconnectedCallback(): void {
    this._cancelPending();
    this._savedCenter = null;
    this._savedZoom = null;
  }
}
