/**
 * UixSparkHost — the minimal interface that UixForgeSparkController needs from
 * its host.  Both UixForge (for uix-forge cards) and UixElementSparkHost (for
 * theme-driven sparks on patched elements) implement this interface.
 */
export interface UixSparkHost {
  /** The current Home Assistant object. May be undefined if not yet available. */
  readonly hass: any;

  /**
   * The root element that sparks operate on.  For a forge card this is the
   * forged inner element; for a themed element this is the patched element
   * itself.
   */
  readonly forgedElement: HTMLElement | null;

  /**
   * Whether the host is currently hidden/not-rendered.  Sparks skip their
   * attachment logic while the host is hidden to avoid measuring 0×0 elements.
   */
  readonly hidden: boolean;

  /**
   * The forge mold (if any).  Used by the lock spark to adjust icon position
   * for row molds.  Returns undefined for non-forge hosts.
   */
  readonly mold: { isRow(): boolean } | undefined | null;

  /**
   * The configuration object of the forged/hosted element.  Used by the lock
   * spark to dispatch `hass-action` events with the element's own config.
   * Returns an empty object for hosts that have no element config.
   */
  readonly forgedElementConfig: any;

  /** Request a full template re-evaluation (no-op for non-forge hosts). */
  refreshForgeTemplates(): void;

  /** Request a forge/host refresh for the given config path (no-op for non-forge hosts). */
  refreshForge(path?: string[]): void;
}
