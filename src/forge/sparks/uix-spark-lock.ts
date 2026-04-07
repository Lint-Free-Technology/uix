import { PropertyValues } from "lit";
import { UixForgeSparkBase } from "./uix-spark-base";
import { actionHandlerBind } from "./action-handler";
import { parseDuration } from "../../helpers/common/parse-duration";

const LOCK_OVERLAY_ID_ATTR = "data-uix-forge-lock-id";

interface LockEntry {
  active?: boolean;
  /** Numeric PIN code (e.g. 1234) – shown with a numpad dialog. */
  pin?: string | number;
  /** Text or numeric code – numeric codes use the numpad dialog, text codes use a password-field dialog. */
  code?: string | number;
  /** Confirmation text or `true` for default HA text. */
  confirmation?: string | boolean;
  /** Usernames this lock applies to. If omitted the lock applies to all non-admin users. */
  users?: string[];
  /** When `true` this lock also applies to (or, when no `users` list, exclusively targets) admins. */
  admins?: boolean;
  /** Usernames exempt from this lock when no `users` list is set. */
  except?: string[];
  /** Milliseconds (or human-readable duration string, e.g. "30s") to wait before another code attempt after a wrong entry. */
  retry_delay?: string | number;
  /** Maximum consecutive wrong attempts before the extended delay kicks in. */
  max_retries?: number;
  /** Milliseconds (or human-readable duration string, e.g. "30s") to wait after `max_retries` wrong attempts. */
  max_retries_delay?: string | number;
}

/** Pixel offsets for the lock icon within the overlay. */
interface IconPosition {
  top?: string;
  bottom?: string;
  left?: string;
  right?: string;
}

export class UixForgeSparkLock extends UixForgeSparkBase {
  type = "lock";

  private _for: string = "";
  private _duration: number = 3000;
  private _action: string = "tap";
  private _iconLocked: string = "mdi:lock-outline";
  private _iconUnlocked: string = " mdi:lock-open-variant-outline";
  private _hasUnlockedIcon: boolean = false;
  private _iconLockedColor: string = "";
  private _iconUnlockedColor: string = "";
  private _iconPosition: IconPosition | null = null;
  private _permissive: boolean = false;
  private _entity: string = "";
  private _unlockAction: Record<string, any> | null = null;
  private _locks: LockEntry[] = [];

  private _overlayElement: HTMLElement | null = null;
  private _iconElement: (HTMLElement & { icon?: string }) | null = null;
  private _relockTimer: ReturnType<typeof setTimeout> | null = null;
  private _isUnlocked: boolean = false;
  private _retryCount: number = 0;
  private _retryUntil: number = 0;
  private readonly _id: string;

  constructor(controller: any, config: Record<string, any>) {
    super(controller, config);
    this._id = `uix-forge-lock-${Math.random().toString(36).slice(2, 11)}`;
    this._applyConfig(config);
  }

  configUpdated(config: Record<string, any>): void {
    super.configUpdated(config);
    this._applyConfig(config);
  }

  private _applyConfig(config: Record<string, any>) {
    this._for = config.for || "";
    this._duration = parseDuration(config.duration) ?? 3000;
    this._action = config.action || "tap";
    this._iconLocked = config.icon_locked || "mdi:lock-outline";
    this._hasUnlockedIcon = !!config.icon_unlocked;
    this._iconUnlocked = config.icon_unlocked || "mdi:lock-open-variant-outline";
    this._iconLockedColor = config.icon_locked_color || "";
    this._iconUnlockedColor = config.icon_unlocked_color || "";
    this._iconPosition = this._parseIconPosition(config.icon_position);
    this._permissive = config.permissive === true;
    this._entity = config.entity || "";
    this._unlockAction = config.unlocked_action || null;
    this._locks = Array.isArray(config.locks) ? config.locks : [];
  }

  /**
   * Parse the `icon_position` config value into a normalised `IconPosition`
   * object with string values (numbers are treated as pixels).
   */
  private _parseIconPosition(raw: any): IconPosition | null {
    if (!raw || typeof raw !== "object") return null;
    const pos: IconPosition = {};
    const toPx = (v: any) => (typeof v === "number" ? `${v}px` : String(v));
    if (raw.top !== undefined) pos.top = toPx(raw.top);
    if (raw.bottom !== undefined) pos.bottom = toPx(raw.bottom);
    if (raw.left !== undefined) pos.left = toPx(raw.left);
    if (raw.right !== undefined) pos.right = toPx(raw.right);
    return Object.keys(pos).length > 0 ? pos : null;
  }

  /**
   * Return the effective icon position, considering the explicit config and
   * the row-mold default (`top: 6px, left: 30px`).
   */
  private _getEffectiveIconPosition(): IconPosition | null {
    if (this._iconPosition !== null) return this._iconPosition;
    if (this.controller.forge.mold?.isRow()) return { top: "6px", left: "30px" };
    return null;
  }

  updated(_changedProperties: PropertyValues): void {
    const gen = this._beginUpdate();
    this._attach(gen);
  }

  connectedCallback(): void {
    const gen = this._beginUpdate();
    this._attach(gen);
  }

  disconnectedCallback(): void {
    this._cancelPending();
    this._clearRelockTimer();
    this._remove();
  }

  private _clearRelockTimer() {
    if (this._relockTimer !== null) {
      clearTimeout(this._relockTimer);
      this._relockTimer = null;
    }
  }

  private _remove() {
    if (this._overlayElement) {
      this._overlayElement.remove();
      this._overlayElement = null;
      this._iconElement = null;
    }
  }

  private async _attach(generation: number) {
    const target = this._for || "element";
    const elements = await this.controller.target(target, this._cancel);
    const element = elements?.[0] as HTMLElement | undefined;
    if (!element) return;
    if (generation !== this._callGeneration) return;

    // Find an existing overlay already appended to the target element
    const existingOverlay = element.querySelector(
      `[${LOCK_OVERLAY_ID_ATTR}="${this._id}"]`
    ) as HTMLElement | null;

    // If our tracked overlay is no longer inside the target, clean up
    if (this._overlayElement && !existingOverlay) {
      this._overlayElement.remove();
      this._overlayElement = null;
      this._iconElement = null;
    }

    // Ensure the target element creates a positioning context for the overlay
    const currentPos = window.getComputedStyle(element).position;
    if (currentPos === "static") {
      element.style.setProperty("position", "relative");
    }

    let overlay = existingOverlay;
    if (!overlay) {
      overlay = document.createElement("div");
      overlay.setAttribute(LOCK_OVERLAY_ID_ATTR, this._id);

      // Icon element (ha-icon as per requirement)
      const iconEl = document.createElement("ha-icon") as HTMLElement & { icon?: string };
      overlay.appendChild(iconEl);
      this._iconElement = iconEl;

      // Position the overlay to cover the target completely
      overlay.style.setProperty("position", "absolute");
      overlay.style.setProperty("inset", "0");
      overlay.style.setProperty("z-index", "var(--uix-lock-z-index, 10)");
      overlay.style.setProperty("display", "flex");
      overlay.style.setProperty("align-items", "center");
      overlay.style.setProperty("justify-content", "center");
      overlay.style.setProperty("cursor", "pointer");
      // Prevent the browser from initiating scroll, zoom, or long-press callouts
      // on this element. This is required for hold detection to work reliably on
      // touch devices — without it the browser fires pointercancel before the
      // hold timer can complete.
      overlay.style.setProperty("touch-action", "none");
      overlay.style.setProperty("user-select", "none");
      overlay.style.setProperty("-webkit-user-select", "none");

      overlay.addEventListener("action", (ev: Event) => {
        if ((ev as CustomEvent).detail?.action === this._action) {
          this._handleUnlockAttempt(overlay!);
        }
      });

      // Stop click events from bubbling to parent HA action handlers (e.g. card
      // navigation) while the overlay is locked.  We do NOT stop pointerdown /
      // mousedown / touchstart because the HA action-handler singleton listens at
      // the document level — stopping those events prevents the hold timer from
      // ever starting.  The overlay sits on top of the target (position: absolute,
      // inset: 0, pointer-events: all) so pointer events naturally hit the overlay
      // and never reach the element below; no extra stopPropagation is needed for
      // start events.
      const stopClickIfLocked = (ev: Event) => {
        if (!this._isUnlocked) {
          ev.stopPropagation();
          ev.preventDefault();
        }
      };
      overlay.addEventListener("click", stopClickIfLocked);

      element.appendChild(overlay);
    } else {
      this._iconElement = overlay.querySelector("ha-icon") as (HTMLElement & { icon?: string }) | null;
    }

    // Always refresh the action-handler binding so that hasHold / hasDoubleClick
    // stay current if the config is updated after the overlay was first created.
    actionHandlerBind(overlay, {
      hasHold: this._action === "hold",
      hasDoubleClick: this._action === "double_tap",
    });

    this._updateOverlay(overlay);
    this._overlayElement = overlay;
  }

  /** Refresh the overlay's visual state to match the current lock/unlock state. */
  private _updateOverlay(overlay: HTMLElement) {
    const shouldShow = this._shouldShowLock();

    if (!shouldShow) {
      overlay.style.setProperty("display", "none");
      return;
    }

    overlay.style.removeProperty("display");

    const isRow = this.controller.forge.mold?.isRow() === true;
    const isBlocked = this._isBlocked();

    // ── Overlay background ───────────────────────────────────────────────────
    // When unlocked the overlay falls back to --uix-lock-background-unlocked
    // (default: none) so that --uix-lock-background only applies while locked.
    if (this._isUnlocked) {
      overlay.style.setProperty("background", "var(--uix-lock-background-unlocked, none)");
    } else if (isRow) {
      overlay.style.setProperty(
        "background",
        "var(--uix-lock-row-background, var(--uix-lock-background, transparent))"
      );
    } else {
      overlay.style.setProperty(
        "background",
        isBlocked
          ? "var(--uix-lock-background-blocked, var(--uix-lock-background, transparent))"
          : "var(--uix-lock-background, transparent)"
      );
    }

    // ── Border-radius / outline ──────────────────────────────────────────────
    if (isRow) {
      overlay.style.setProperty(
        "border-radius",
        "var(--uix-lock-row-border-radius, var(--uix-lock-border-radius, inherit))"
      );
      overlay.style.setProperty(
        "outline",
        isBlocked ? "var(--uix-lock-row-outlined-blocked, none)" : "none"
      );
    } else {
      overlay.style.setProperty(
        "border-radius",
        "var(--uix-lock-border-radius, inherit)"
      );
      overlay.style.removeProperty("outline");
    }

    // ── Overlay opacity ──────────────────────────────────────────────────────
    overlay.style.setProperty("opacity", "var(--uix-lock-opacity, 0.5)");

    // ── Icon ─────────────────────────────────────────────────────────────────
    // When unlocked and no explicit icon_unlocked is configured, keep the lock
    // icon but fade it to opacity 0. When an unlocked icon is configured, swap
    // to it at full opacity.
    const fadeOut = this._isUnlocked && !this._hasUnlockedIcon;
    const icon = (this._isUnlocked && this._hasUnlockedIcon) ? this._iconUnlocked : this._iconLocked;
    // When fading out (no unlocked icon), keep the locked colour — changing it
    // would be visible during the fade. Only apply the unlocked colour when
    // actually swapping to a new icon.
    const customColor = fadeOut ? this._iconLockedColor : (this._isUnlocked ? this._iconUnlockedColor : this._iconLockedColor);
    const defaultColor = (this._isUnlocked && !fadeOut)
      // Material Design green/red used as fallbacks when HA theme variables are unavailable
      ? "var(--success-color, #43a047)"
      : "var(--error-color, #db4437)";

    if (this._iconElement) {
      this._iconElement.icon = icon;
      this._iconElement.style.setProperty("pointer-events", "none");
      this._iconElement.style.setProperty("--mdc-icon-size", "var(--uix-lock-icon-size, 24px)");
      this._iconElement.style.setProperty("color", customColor || defaultColor);
      // When fading the lock icon out (no icon_unlocked configured) use the
      // CSS-var-controlled duration (default 2s). When swapping to an explicit
      // unlocked icon, keep the fast 0.25s swap transition.
      const opacityDuration = fadeOut
        ? "var(--uix-lock-icon-fade-duration, 2s)"
        : "0.25s";
      this._iconElement.style.setProperty("transition", `color 0.25s ease, opacity ${opacityDuration} ease`);
      this._iconElement.style.setProperty("opacity", fadeOut ? "0" : "1");
      // Allow CSS-var-based positional override independent of config-based offset.
      this._iconElement.style.setProperty("translate", "var(--uix-lock-icon-position, none)");

      // ── Icon position ─────────────────────────────────────────────────────
      const iconPos = this._getEffectiveIconPosition();
      if (iconPos) {
        this._iconElement.style.setProperty("position", "relative");
        if (iconPos.top !== undefined) {
          this._iconElement.style.setProperty("top", iconPos.top);
        } else {
          this._iconElement.style.removeProperty("top");
        }
        if (iconPos.bottom !== undefined) {
          this._iconElement.style.setProperty("bottom", iconPos.bottom);
        } else {
          this._iconElement.style.removeProperty("bottom");
        }
        if (iconPos.left !== undefined) {
          this._iconElement.style.setProperty("left", iconPos.left);
        } else {
          this._iconElement.style.removeProperty("left");
        }
        if (iconPos.right !== undefined) {
          this._iconElement.style.setProperty("right", iconPos.right);
        } else {
          this._iconElement.style.removeProperty("right");
        }
      } else {
        this._iconElement.style.removeProperty("position");
        this._iconElement.style.removeProperty("top");
        this._iconElement.style.removeProperty("bottom");
        this._iconElement.style.removeProperty("left");
        this._iconElement.style.removeProperty("right");
      }
    }

    // When unlocked the overlay should not block interaction with the underlying element
    overlay.style.setProperty("pointer-events", this._isUnlocked ? "none" : "all");
    overlay.style.setProperty("cursor", this._isUnlocked ? "default" : "pointer");
  }

  /**
   * Whether the lock overlay should currently be shown (and blocking) for the
   * logged-in user.  Returns `true` when a matching, active lock is found.
   *
   * When no entry matches:
   *   - `permissive: true`  → no overlay (element is accessible for everyone).
   *   - `permissive: false` → admins auto-bypass (no overlay); non-admins are
   *                           permanently blocked (overlay shown, no unlock path).
   */
  private _shouldShowLock(): boolean {
    const lock = this._findMatchingLock();
    if (lock !== null) return lock.active !== false;
    // No matching entry
    if (this._permissive) return false;
    // permissive:false — admins always bypass when no entry explicitly covers them
    const user = this.controller.forge.hass?.user;
    return user?.is_admin !== true;
  }

  /**
   * Whether the current user is permanently blocked (overlay shown, no unlock
   * path).  This is the case when no lock entry matches, `permissive` is
   * `false`, and the user is not an admin.
   */
  private _isBlocked(): boolean {
    if (this._permissive) return false;
    if (this._findMatchingLock() !== null) return false;
    const user = this.controller.forge.hass?.user;
    return user?.is_admin !== true;
  }

  /**
   * Returns the first LockEntry that applies to the current user, or `null` if
   * none matches.
   *
   * `admins` is an *additive* flag — it extends the scope of an entry to also
   * cover admin users.  By default (admins unset / false) admin users are
   * excluded from every entry and always bypass the lock (unless matched
   * explicitly via a `users` list).
   *
   * Matching rules:
   *
   * Case A — `users` list present:
   *   • Matches if the current user's name is in the list.
   *   • Also matches if `admins === true` and the current user is an admin.
   *
   * Case B — no `users` list:
   *   • By default admins are excluded; they skip to the next entry.
   *   • If `admins === true` the entry applies to EVERYONE (admin + non-admin).
   *   • Non-admins whose name appears in `except` are also skipped.
   */
  private _findMatchingLock(): LockEntry | null {
    const user = this.controller.forge.hass?.user;
    const userName: string = user?.name ?? "";
    const isAdmin: boolean = user?.is_admin === true;

    for (const lock of this._locks) {
      const hasUsersList = Array.isArray(lock.users) && lock.users.length > 0;

      if (hasUsersList) {
        // Case A: explicit user list
        if (lock.users!.includes(userName)) return lock;
        // admins: true additionally covers admin users for this entry
        if (isAdmin && lock.admins === true) return lock;
      } else {
        // Case B: no users list — applies to everyone by default, but admins are
        // excluded unless admins: true (which makes the entry apply to all users)
        if (isAdmin && lock.admins !== true) continue;
        const hasExcept = Array.isArray(lock.except) && lock.except.length > 0;
        if (hasExcept && lock.except!.includes(userName)) continue;
        return lock;
      }
    }

    return null;
  }

  private async _handleUnlockAttempt(overlay: HTMLElement) {
    if (this._isUnlocked) return;

    // Honour retry cooldown
    if (Date.now() < this._retryUntil) return;

    const lock = this._findMatchingLock();

    // No matching lock: only unlock if permissive
    if (lock === null) {
      if (this._permissive) this._unlock(overlay);
      return;
    }

    // An explicitly inactive lock means this user should have free access
    if (lock.active === false) {
      this._unlock(overlay);
      return;
    }

    // Load HA card helpers (provides all dialogs)
    let helpers: any;
    try {
      helpers = await (window as any).loadCardHelpers();
    } catch {
      return;
    }

    // ── Code / PIN check ─────────────────────────────────────────────────────
    const codeValue = lock.code ?? lock.pin;
    if (codeValue !== undefined && codeValue !== null && String(codeValue) !== "") {
      // Numeric codes get the HA numpad dialog; text codes get a password field
      const isNumeric = /^\d+$/.test(String(codeValue));
      const entered = await helpers.showEnterCodeDialog(overlay, {
        codeFormat: isNumeric ? "number" : "text",
      }) as string | null;

      if (entered === null) return; // User cancelled

      if (String(entered) !== String(codeValue)) {
        this._retryCount++;

        // Apply per-attempt or max-retries cooldown
        if (lock.max_retries !== undefined && this._retryCount >= lock.max_retries) {
          this._retryUntil = Date.now() + (parseDuration(lock.max_retries_delay) ?? 30000);
          this._retryCount = 0;
        } else if (lock.retry_delay) {
          this._retryUntil = Date.now() + (parseDuration(lock.retry_delay) ?? 0);
        }

        await helpers.showAlertDialog(overlay, {
          title: "Wrong code",
        });
        return;
      }

      this._retryCount = 0;
    }

    // ── Confirmation check ────────────────────────────────────────────────────
    if (lock.confirmation !== undefined && lock.confirmation !== false) {
      const confirmed = await helpers.showConfirmationDialog(overlay, {
        text: typeof lock.confirmation === "string" ? lock.confirmation : undefined,
      }) as boolean;

      if (!confirmed) return;
    }

    this._unlock(overlay);
  }

  /**
   * Play a quick bounce animation on the icon element using the Web Animations
   * API (no external CSS / style injection required).
   */
  private _animateIcon(unlocking: boolean) {
    if (!this._iconElement) return;

    const keyframes: Keyframe[] = unlocking
      ? [
          { transform: "scale(1) rotate(0deg)", offset: 0 },
          { transform: "scale(1.3) rotate(-20deg)", offset: 0.35 },
          { transform: "scale(0.95) rotate(5deg)", offset: 0.65 },
          { transform: "scale(1) rotate(0deg)", offset: 1 },
        ]
      : [
          { transform: "scale(1)", offset: 0 },
          { transform: "scale(1.2)", offset: 0.4 },
          { transform: "scale(1)", offset: 1 },
        ];

    (this._iconElement as HTMLElement).animate(keyframes, {
      duration: unlocking ? 400 : 300,
      easing: "ease",
    });
  }

  private _unlock(overlay: HTMLElement) {
    this._isUnlocked = true;
    this._updateOverlay(overlay);
    this._animateIcon(true);
    this._executeUnlockAction(overlay);
    this._clearRelockTimer();
    this._relockTimer = setTimeout(() => this._relock(overlay), this._duration);
  }

  private _relock(overlay: HTMLElement) {
    this._isUnlocked = false;
    this._updateOverlay(overlay);
    this._animateIcon(false);
  }

  private _executeUnlockAction(overlay: HTMLElement) {
    if (!this._unlockAction) return;
    const action = this._unlockAction.action as string | undefined;
    if (!action) return;

    if (action.startsWith("element_")) {
      this._triggerElementAction(action.slice("element_".length), overlay);
    } else {
      this._triggerHassAction(this._unlockAction, overlay);
    }
  }

  /**
   * Trigger one of the forged element's own actions (tap / hold / double_tap)
   * by dispatching a `hass-action` event with the forged element's config.
   */
  private _triggerElementAction(actionType: string, source: HTMLElement) {
    const forgedElementConfig = this.controller.forge.forgedElementConfig;
    source.dispatchEvent(
      new CustomEvent("hass-action", {
        bubbles: true,
        composed: true,
        detail: { config: forgedElementConfig, action: actionType },
      })
    );
  }

  /**
   * Dispatch a `hass-action` event for a plain HA action (toggle, navigate,
   * call-service, …) configured via `unlocked_action`.
   */
  private _triggerHassAction(action: Record<string, any>, source: HTMLElement) {
    const config: Record<string, any> = {};
    if (this._entity) config.entity = this._entity;
    config.tap_action = { ...action };
    source.dispatchEvent(
      new CustomEvent("hass-action", {
        bubbles: true,
        composed: true,
        detail: { config, action: "tap" },
      })
    );
  }
}
