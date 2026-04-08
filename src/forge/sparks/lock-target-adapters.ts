/**
 * Lock target adapters provide element-type-specific workarounds applied when
 * the UIX lock spark is active on a particular target element type.
 *
 * To add support for a new element type:
 *  1. Implement the `LockTargetAdapter` interface in a new class below.
 *  2. Add a `case` for the element's tag name in `getLockTargetAdapter`.
 */

export interface LockTargetAdapter {
  /** Called when the lock becomes active (element should be blocked). */
  lock(element: HTMLElement): void;
  /** Called when the lock is temporarily unlocked (element becomes accessible). */
  unlock(element: HTMLElement): void;
  /** Called when the lock spark is removed from the DOM entirely. */
  cleanup(element: HTMLElement): void;
}

/**
 * Returns an adapter for the given target element, or `null` if no special
 * handling is required for this element type.
 */
export function getLockTargetAdapter(element: HTMLElement): LockTargetAdapter | null {
  switch (element.tagName.toLowerCase()) {
    case "ha-tile-icon":
      return new HaTileIconLockAdapter();
    default:
      return null;
  }
}

/**
 * Adapter for `ha-tile-icon` targets.
 *
 * When locked:
 *  - Removes the `interactive` attribute so that the HA action-handler is no
 *    longer triggered by pointer events on the icon (there is no unbind path
 *    for the action-handler, so attribute removal combined with event capture
 *    is the reliable approach).
 *  - Adds a capture-phase listener on the inner `div.container` (in the
 *    shadow root) to intercept the `action` event before Home Assistant's own
 *    handler runs, preventing unintended entity actions while locked.
 *
 * When unlocked / cleaned up:
 *  - Restores the `interactive` attribute (only if it was present before
 *    locking was applied).
 *  - Removes the capture listener.
 *
 * No-op when `ha-tile-icon` does not have the `interactive` attribute at the
 * time locking is first applied (i.e. the element was already non-interactive).
 */
class HaTileIconLockAdapter implements LockTargetAdapter {
  /** Whether we have currently applied the lock to the target element. */
  private _isLocked = false;
  /** Whether the element had the `interactive` attribute when we locked it. */
  private _hadInteractive = false;
  private _captureListener: ((ev: Event) => void) | null = null;

  lock(element: HTMLElement): void {
    // Already locked — nothing to do.
    if (this._isLocked) return;
    // Only act when the element is currently interactive.
    if (!element.hasAttribute("interactive")) return;

    this._isLocked = true;
    this._hadInteractive = true;
    element.removeAttribute("interactive");

    const container = (element as any).shadowRoot?.querySelector(
      "div.container"
    ) as HTMLElement | null;
    if (container) {
      this._captureListener = (ev: Event) => {
        ev.stopImmediatePropagation();
      };
      container.addEventListener("action", this._captureListener, true);
    }
  }

  unlock(element: HTMLElement): void {
    // Already unlocked — nothing to do.
    if (!this._isLocked) return;
    this._isLocked = false;
    this._removeCapture(element);
    if (this._hadInteractive) {
      element.setAttribute("interactive", "");
      this._hadInteractive = false;
    }
  }

  cleanup(element: HTMLElement): void {
    this.unlock(element);
  }

  private _removeCapture(element: HTMLElement): void {
    if (!this._captureListener) return;
    const container = (element as any).shadowRoot?.querySelector(
      "div.container"
    ) as HTMLElement | null;
    if (container) {
      container.removeEventListener("action", this._captureListener, true);
    }
    this._captureListener = null;
  }
}
