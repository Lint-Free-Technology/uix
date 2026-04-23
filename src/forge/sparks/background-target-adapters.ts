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
