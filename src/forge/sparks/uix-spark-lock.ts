import { PropertyValues } from "lit";
import { UixForgeSparkBase } from "./uix-spark-base";
import { actionHandlerBind } from "./action-handler";

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
  /** Milliseconds to wait before another code attempt after a wrong entry. */
  retry_delay?: number;
  /** Maximum consecutive wrong attempts before the extended delay kicks in. */
  max_retries?: number;
  /** Milliseconds to wait after `max_retries` wrong attempts. */
  max_retries_delay?: number;
}

export class UixForgeSparkLock extends UixForgeSparkBase {
  type = "lock";

  private _for: string = "";
  private _duration: number = 3000;
  private _action: string = "tap";
  private _iconLocked: string = "mdi:lock";
  private _iconUnlocked: string = "mdi:lock-open-variant";
  private _iconLockedColor: string = "";
  private _iconUnlockedColor: string = "";
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
    this._duration = typeof config.duration === "number" ? config.duration : 3000;
    this._action = config.action || "tap";
    this._iconLocked = config.icon_locked || "mdi:lock";
    this._iconUnlocked = config.icon_unlocked || "mdi:lock-open-variant";
    this._iconLockedColor = config.icon_locked_color || "";
    this._iconUnlockedColor = config.icon_unlocked_color || "";
    this._permissive = config.permissive === true;
    this._entity = config.entity || "";
    this._unlockAction = config.unlock_action || null;
    this._locks = Array.isArray(config.locks) ? config.locks : [];
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
      overlay.style.setProperty("border-radius", "var(--uix-lock-border-radius, inherit)");
      overlay.style.setProperty("cursor", "pointer");
      overlay.style.setProperty("background", "var(--uix-lock-background, transparent)");
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

      // While locked, block all pointer interactions from reaching the underlying element.
      // stopPropagation prevents HA action handlers; preventDefault stops native defaults
      // (e.g. touch scroll, context-menu) — touchstart uses passive:true so no preventDefault there.
      const stopIfLocked = (ev: Event) => {
        if (!this._isUnlocked) {
          ev.stopPropagation();
          ev.preventDefault();
        }
      };
      const stopIfLockedPassive = (ev: Event) => {
        if (!this._isUnlocked) ev.stopPropagation();
      };
      overlay.addEventListener("click", stopIfLocked);
      overlay.addEventListener("mousedown", stopIfLocked);
      overlay.addEventListener("touchstart", stopIfLockedPassive, { passive: true });
      overlay.addEventListener("pointerdown", stopIfLocked);
      // Prevent the browser's native context-menu (triggered by long-press on
      // iOS / Android) from appearing and cancelling the touch sequence before
      // the hold timer fires.
      overlay.addEventListener("contextmenu", stopIfLocked);

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

    const icon = this._isUnlocked ? this._iconUnlocked : this._iconLocked;
    const customColor = this._isUnlocked ? this._iconUnlockedColor : this._iconLockedColor;
    const defaultColor = this._isUnlocked
      // Material Design green/red used as fallbacks when HA theme variables are unavailable
      ? "var(--success-color, #43a047)"
      : "var(--error-color, #db4437)";

    if (this._iconElement) {
      this._iconElement.icon = icon;
      this._iconElement.style.setProperty("pointer-events", "none");
      this._iconElement.style.setProperty("--mdc-icon-size", "var(--uix-lock-icon-size, 24px)");
      this._iconElement.style.setProperty("color", customColor || defaultColor);
      this._iconElement.style.setProperty("transition", "color 0.25s ease");
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
          this._retryUntil = Date.now() + (lock.max_retries_delay ?? 30000);
          this._retryCount = 0;
        } else if (lock.retry_delay) {
          this._retryUntil = Date.now() + lock.retry_delay;
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
   * call-service, …) configured via `unlock_action`.
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
