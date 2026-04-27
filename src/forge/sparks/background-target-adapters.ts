/**
 * Background target adapters provide element-type-specific behaviour applied
 * when the UIX background spark is active on a particular target element type.
 *
 * To add support for a new element type:
 *  1. Implement the `BackgroundTargetAdapter` interface in a new class below.
 *  2. Add a `case` for the element's tag name in `getBackgroundTargetAdapter`.
 */

export interface BackgroundTargetAdapter {
  /**
   * Apply element-type-specific styles to the background container div.
   * Called just before the container is inserted into the DOM.
   */
  applyStyles(container: HTMLElement): void;
  /**
   * Return the parent node into which the background container should be
   * inserted.  The default is the `forEl` itself (light DOM).  Some adapters
   * (e.g. `ha-card`) insert into the element's shadow root instead so that
   * the background participates in the shadow-root stacking context and so
   * that test assertions via `root: "ha-card"` can reach it.
   */
  getInsertionParent(forEl: HTMLElement): Element | ShadowRoot;
  /**
   * Optionally apply element-type-specific CSS properties directly to the
   * target element itself (e.g. CSS custom properties that cascade to
   * descendant elements).  Implementations **must** record any property they
   * set in `savedStyles` (previous value, or `""` if the property was unset)
   * so the spark can restore the original values when the target element
   * changes or the spark disconnects.
   *
   * Called from `_setupLayout` after position/isolation are saved, so entries
   * written here are automatically restored by `_restoreLayout`.
   */
  applyForElStyles?(forEl: HTMLElement, savedStyles: Map<string, string>): void;
  /**
   * Optionally clean up any styles or mutations applied to descendant elements
   * that are not tracked by `savedStyles` (which only covers `forEl` itself).
   * Called from `_restoreLayout` before the `savedStyles` loop.
   */
  cleanup?(forEl: HTMLElement): void;
  /**
   * Re-apply adapter-managed styles to descendant elements on every `_attach`
   * cycle (not just when the target element changes).  Use this for styles
   * applied to children that can be replaced without the parent element itself
   * changing — e.g. `hui-grid-section` being re-created after a section edit
   * in the UI editor while `hui-section` (the target) remains the same node.
   *
   * Unlike `applyForElStyles`, this method does **not** save previous values
   * to `savedStyles`; it simply re-applies the expected values.  It is called
   * only when the background container is already active.
   */
  refreshChildStyles?(forEl: HTMLElement): void;
}

/**
 * Returns an adapter for the given target element, or `null` if no special
 * handling is required for this element type.
 */
export function getBackgroundTargetAdapter(element: HTMLElement | null): BackgroundTargetAdapter | null {
  if (!element) return null;
  switch (element.tagName.toLowerCase()) {
    case "ha-card":
      return new HaCardBackgroundAdapter();
    case "hui-section":
      return new HuiSectionBackgroundAdapter();
    default:
      return null;
  }
}

/**
 * Adapter for `ha-card` targets.
 *
 * When `ha-card` is the background target:
 *  - The container is inserted into `ha-card`'s shadow root (if available)
 *    rather than its light DOM, so it participates in the shadow-root
 *    stacking context and sits correctly behind the card's shadow-DOM content.
 *  - `border-radius` is matched to the card's own border radius via
 *    `var(--ha-card-border-radius, var(--ha-border-radius-lg))` so the
 *    background follows the card's rounded corners.
 *  - A negative `margin` of `calc(-1 * var(--ha-card-border-width, 1px))`
 *    compensates for the card border so the background fills the full
 *    visual card area including behind the border.
 */
class HaCardBackgroundAdapter implements BackgroundTargetAdapter {
  applyStyles(container: HTMLElement): void {
    container.style.setProperty(
      "border-radius",
      "var(--ha-card-border-radius, var(--ha-border-radius-lg))"
    );
    container.style.setProperty(
      "margin",
      "calc(-1 * var(--ha-card-border-width, 1px))"
    );
  }

  getInsertionParent(forEl: HTMLElement): Element | ShadowRoot {
    const shadowRoot = forEl.shadowRoot;
    return shadowRoot ?? forEl;
  }
}

/**
 * Adapter for `hui-section` targets.
 *
 * When `hui-section` is the background target (typically when `mold: section`
 * with no explicit `for` value):
 *  - `border-radius` is matched to the section's own border radius via
 *    `var(--ha-section-border-radius, var(--ha-border-radius-xl))` so the
 *    background follows the section's rounded corners.
 *  - `padding: var(--ha-space-2)` is applied to the `hui-grid-section` child
 *    element (light DOM of `hui-section`) to inset the cards from the section
 *    edges, matching the section's visual spacing.  The previous padding value
 *    is saved and restored in `cleanup()`.
 *  - `--ha-card-background: none` is applied to the section element itself
 *    so that all cards within the section inherit a transparent card background,
 *    allowing the section background to show through.
 *  - `padding: 0` is applied to the nearest `div.section-container` ancestor
 *    (HA's own section wrapper element) to neutralise any padding it may carry,
 *    preventing a double-padding effect when a HA section background is also
 *    active.  The previous padding value is saved and restored in `cleanup()`.
 */
class HuiSectionBackgroundAdapter implements BackgroundTargetAdapter {
  private static readonly CARD_BG_PROP = "--ha-card-background";
  private static readonly GRID_SECTION_TAG = "hui-grid-section";
  private static readonly PADDING_VALUE = "var(--ha-space-2)";
  private static readonly SECTION_CONTAINER_SELECTOR = "div.section-container";

  private _savedGridPadding: string | null = null;
  private _sectionContainer: HTMLElement | null = null;
  private _savedSectionContainerPadding: string | null = null;

  /** Find (or reuse) the nearest .section-container and zero its padding. */
  private _applyToSectionContainer(forEl: HTMLElement): void {
    if (this._sectionContainer) {
      // Already have a reference — just ensure padding is still zeroed.
      if (this._sectionContainer.style.getPropertyValue("padding") !== "0") {
        this._sectionContainer.style.setProperty("padding", "0");
      }
      return;
    }
    const sectionContainer = forEl.closest<HTMLElement>(
      HuiSectionBackgroundAdapter.SECTION_CONTAINER_SELECTOR
    );
    if (sectionContainer) {
      this._sectionContainer = sectionContainer;
      this._savedSectionContainerPadding = sectionContainer.style.getPropertyValue("padding");
      sectionContainer.style.setProperty("padding", "0");
    }
  }

  /** Restore a saved inline style property, removing it if the saved value was empty. */
  private static _restoreProperty(
    element: HTMLElement,
    property: string,
    savedValue: string
  ): void {
    if (savedValue) {
      element.style.setProperty(property, savedValue);
    } else {
      element.style.removeProperty(property);
    }
  }

  applyStyles(container: HTMLElement): void {
    container.style.setProperty(
      "border-radius",
      "var(--ha-section-border-radius, var(--ha-border-radius-xl))"
    );
  }

  getInsertionParent(forEl: HTMLElement): Element | ShadowRoot {
    return forEl;
  }

  applyForElStyles(forEl: HTMLElement, savedStyles: Map<string, string>): void {
    const prop = HuiSectionBackgroundAdapter.CARD_BG_PROP;
    const prev = forEl.style.getPropertyValue(prop);
    savedStyles.set(prop, prev);
    forEl.style.setProperty(prop, "none");

    // Apply padding to hui-grid-section (light DOM child of hui-section)
    const gridSection = forEl.querySelector<HTMLElement>(
      HuiSectionBackgroundAdapter.GRID_SECTION_TAG
    );
    if (gridSection) {
      this._savedGridPadding = gridSection.style.getPropertyValue("padding");
      gridSection.style.setProperty("padding", HuiSectionBackgroundAdapter.PADDING_VALUE);
    }

    // Zero out the padding on the nearest .section-container ancestor (HA's own
    // section wrapper).  When a HA section background is also active it applies
    // its own padding via this element; zeroing it prevents double padding.
    this._applyToSectionContainer(forEl);
  }

  cleanup(forEl: HTMLElement): void {
    const gridSection = forEl.querySelector<HTMLElement>(
      HuiSectionBackgroundAdapter.GRID_SECTION_TAG
    );
    if (gridSection && this._savedGridPadding !== null) {
      HuiSectionBackgroundAdapter._restoreProperty(gridSection, "padding", this._savedGridPadding);
      this._savedGridPadding = null;
    }

    // Restore section-container padding.
    if (this._sectionContainer && this._savedSectionContainerPadding !== null) {
      HuiSectionBackgroundAdapter._restoreProperty(
        this._sectionContainer, "padding", this._savedSectionContainerPadding
      );
      this._savedSectionContainerPadding = null;
      this._sectionContainer = null;
    }
  }

  refreshChildStyles(forEl: HTMLElement): void {
    // Re-apply the section padding whenever _attach runs, so it is restored if
    // the hui-grid-section element is replaced (e.g. after a section edit in
    // the UI editor) without the hui-section parent element changing.
    const gridSection = forEl.querySelector<HTMLElement>(
      HuiSectionBackgroundAdapter.GRID_SECTION_TAG
    );
    if (!gridSection) return;
    if (gridSection.style.getPropertyValue("padding") !== HuiSectionBackgroundAdapter.PADDING_VALUE) {
      // Update the saved value in case this is a brand-new element (no prior padding).
      if (this._savedGridPadding === null) {
        this._savedGridPadding = gridSection.style.getPropertyValue("padding");
      }
      gridSection.style.setProperty("padding", HuiSectionBackgroundAdapter.PADDING_VALUE);
    }

    // Re-apply padding:0 to the section-container if it was reset (e.g. by HA
    // re-rendering the sections layout).  Also handles the case where
    // applyForElStyles ran before section-container was available.
    this._applyToSectionContainer(forEl);
  }
}
