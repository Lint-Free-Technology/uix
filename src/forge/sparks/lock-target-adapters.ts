/**
 * Lock target adapters provide element-type-specific workarounds applied when
 * the UIX lock spark is active on a particular target element type.
 *
 * To add support for a new element type:
 *  1. Implement the `LockTargetAdapter` interface in a new class below.
 *  2. Add a `case` for the element's tag name in `getLockTargetAdapter`.
 */

/** Pixel offsets used as the default icon position for a target element type. */
export interface AdapterIconPosition {
  top?: string;
  bottom?: string;
  left?: string;
  right?: string;
}

export interface LockTargetAdapter {
  /** Called when the lock becomes active (element should be blocked). */
  lock(element: HTMLElement, overlay: HTMLElement): void;
  /** Called when the lock is temporarily unlocked (element becomes accessible). */
  unlock(element: HTMLElement): void;
  /** Called when the lock spark is removed from the DOM entirely. */
  cleanup(element: HTMLElement): void;
  /** Returns the default lock-icon size for this target element type. */
  defaultIconSize(): string;
  /** Returns the default lock-icon padding for this target element type, or `null` for no override. */
  defaultIconPadding(): string | null;
  /** Returns the default lock-icon border-radius for this target element type, or `null` for no override. */
  defaultIconBorderRadius(): string | null;
  /** Returns the default lock-icon position for this target element type, or `null` for no override. */
  defaultIconPosition(): AdapterIconPosition | null;
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
 *  - Adds a capture-phase listener on `ha-tile-icon`'s shadow root that
 *    **always** stops every `action` event before it can reach `div.container`'s
 *    already-registered handler.
 *
 *    The overlay element (a light-DOM child of `ha-tile-icon`) gets slotted into
 *    the shadow root, so its `action` events also traverse the shadow root in the
 *    flat/composed tree and would be blocked.  To let those through, the listener
 *    inspects `ev.composedPath()[0]`: from the shadow-root context, this is the
 *    true dispatch origin before any retargeting.  If the origin is the overlay
 *    element, the listener re-dispatches a new `action` event directly onto the
 *    overlay (non-bubbling, non-composed) so the lock dialog can open without the
 *    re-fired event propagating back through the shadow root and hitting the
 *    capture listener a second time.
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
  /** The overlay element to re-fire action events on (set during lock()). */
  private _overlayElement: HTMLElement | null = null;

  lock(element: HTMLElement, overlay: HTMLElement): void {
    // Already locked — nothing to do.
    if (this._isLocked) return;
    // Only act when the element is currently interactive.
    if (!element.hasAttribute("interactive")) return;

    this._isLocked = true;
    this._hadInteractive = true;
    this._overlayElement = overlay;

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

    // Capture `action` events at the shadow-root level and always stop them.
    // This reliably blocks div.container's action-handler from firing regardless
    // of how or where the event was dispatched inside the shadow.
    //
    // The overlay (a light-DOM child of ha-tile-icon) is slotted into the shadow
    // root, so its action events also pass through the shadow root in the flat
    // tree. We distinguish them by checking composedPath()[0] (the true origin,
    // unretargeted, which the shadow-root listener can still see). If the origin
    // is the overlay, we re-fire the action directly on the overlay element using
    // a non-bubbling, non-composed event so it triggers the overlay's own listener
    // without looping back through this capture handler.
    if (shadowRoot) {
      this._captureListener = (ev: Event) => {
        if (ev.composedPath()[0] === this._overlayElement) {
          const origin = ev.composedPath()[0] as Node | null;
          if (origin === this._overlayElement && ev.bubbles === true && ev.composed === true) {
            ev.stopImmediatePropagation();
            this._overlayElement.dispatchEvent(
              new CustomEvent("action", {
                detail: (ev as CustomEvent).detail,
                bubbles: false,
                composed: false,
              })
            );
          }
        }
      };
      shadowRoot.addEventListener("action", this._captureListener, true);
    }
  }

  unlock(element: HTMLElement): void {
    // Already unlocked — nothing to do.
    if (!this._isLocked) return;
    this._isLocked = false;

    this._removeCapture(element);
    this._overlayElement = null;

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

  defaultIconSize(): string {
    // ha-tile-icon is a compact element; 12px fits neatly in its corner.
    return "12px";
  }

  defaultIconPadding(): string | null {
    return "2px";
  }

  defaultIconBorderRadius(): string | null {
    return "50%";
  }

  defaultIconPosition(): AdapterIconPosition | null {
    // Position the icon at the top-left corner of ha-tile-icon.
    return { top: "3px", left: "3px" };
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
