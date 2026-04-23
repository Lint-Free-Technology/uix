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
 */
class HuiSectionBackgroundAdapter implements BackgroundTargetAdapter {
  private static readonly CARD_BG_PROP = "--ha-card-background";
  private static readonly GRID_SECTION_TAG = "hui-grid-section";
  private static readonly PADDING_VALUE = "var(--ha-space-2)";

  private _savedGridPadding: string | null = null;

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
  }

  cleanup(forEl: HTMLElement): void {
    const gridSection = forEl.querySelector<HTMLElement>(
      HuiSectionBackgroundAdapter.GRID_SECTION_TAG
    );
    if (gridSection && this._savedGridPadding !== null) {
      if (this._savedGridPadding) {
        gridSection.style.setProperty("padding", this._savedGridPadding);
      } else {
        gridSection.style.removeProperty("padding");
      }
      this._savedGridPadding = null;
    }
  }
}
