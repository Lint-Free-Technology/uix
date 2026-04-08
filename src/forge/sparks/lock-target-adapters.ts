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
 *  - Removes the `interactive` attribute to suppress hover/scale interactive
 *    feedback. The action-handler binding on `div.container` cannot be unbound
 *    so it remains registered; the capture listener below stops it from firing.
 *  - Preserves the CSS classes on `div.container` (including the `background`
 *    class that provides the colored circle) via a `MutationObserver` that
 *    re-applies the snapshotted classes after each Lit re-render.
 *  - Adds a capture-phase listener on `ha-tile-icon`'s shadow root to
 *    intercept `action` events before they reach `div.container`'s own handler.
 *    The shadow root is a true ancestor of `div.container` in the composed
 *    event path, so our listener fires during the real capture phase — before
 *    `div.container` is reached — rather than in target-phase registration
 *    order (which would let HA's earlier-registered handler fire first).
 *    The overlay's own `action` events travel through the light DOM and never
 *    cross the shadow root, so the lock mechanism is unaffected.
 *
 * When unlocked / cleaned up:
 *  - Removes the shadow-root capture listener.
 *  - Disconnects the `MutationObserver`.
 *  - Restores the `interactive` attribute; HA's Lit re-render then manages
 *    the container classes correctly again.
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
  private _classObserver: MutationObserver | null = null;
  private _savedContainerClasses: string[] = [];

  lock(element: HTMLElement): void {
    // Already locked — nothing to do.
    if (this._isLocked) return;
    // Only act when the element is currently interactive.
    if (!element.hasAttribute("interactive")) return;

    this._isLocked = true;
    this._hadInteractive = true;

    const shadowRoot = (element as any).shadowRoot as ShadowRoot | null;
    const container = shadowRoot?.querySelector("div.container") as HTMLElement | null;

    if (container) {
      // Snapshot the classes on div.container before removing `interactive`.
      // HA's Lit re-render will strip the `background` class (and any others
      // conditioned on `interactive`) that draw the colored circle; the
      // observer re-applies them so the icon looks unchanged while locked.
      this._savedContainerClasses = Array.from(container.classList);
      element.removeAttribute("interactive");

      const restoreClasses = () => {
        for (const cls of this._savedContainerClasses) {
          if (!container.classList.contains(cls)) {
            container.classList.add(cls);
          }
        }
      };
      const observer = new MutationObserver(restoreClasses);
      observer.observe(container, { attributes: true, attributeFilter: ["class"] });
      this._classObserver = observer;
    } else {
      element.removeAttribute("interactive");
    }

    // Capture `action` events at the shadow-root level so they are stopped
    // before reaching div.container's already-registered handler.
    if (shadowRoot) {
      this._captureListener = (ev: Event) => {
        ev.stopImmediatePropagation();
      };
      shadowRoot.addEventListener("action", this._captureListener, true);
    }
  }

  unlock(element: HTMLElement): void {
    // Already unlocked — nothing to do.
    if (!this._isLocked) return;
    this._isLocked = false;

    this._removeCapture(element);

    // Disconnect the observer before restoring `interactive` so Lit's
    // re-render can manage the container classes freely again.
    this._classObserver?.disconnect();
    this._classObserver = null;
    this._savedContainerClasses = [];

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
    const shadowRoot = (element as any).shadowRoot as ShadowRoot | null;
    if (shadowRoot) {
      shadowRoot.removeEventListener("action", this._captureListener, true);
    }
    this._captureListener = null;
  }
}
