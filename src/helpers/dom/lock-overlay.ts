import { actionHandlerBind } from "./action-handler";
import { parseDuration } from "../common/parse-duration";
import { LockTargetAdapter, getLockTargetAdapter } from "../../helpers/dom/lock-target-adapters";
import {
  CodeDialogConfig,
  createLockRetryState,
  getLockAccessState,
  LockEntry,
  LockRetryState,
  LockUser,
  requestLockAccess,
} from "../lock-access";

export const LOCK_OVERLAY_ID_ATTR = "data-uix-lock-id";

export interface LockIconPosition {
  top?: string | number;
  bottom?: string | number;
  left?: string | number;
  right?: string | number;
}

export interface LockOverlayConfig {
  duration?: string | number;
  action?: string;
  icon_locked?: string;
  icon_unlocked?: string;
  icon_locked_color?: string;
  icon_unlocked_color?: string;
  icon_position?: LockIconPosition;
  icon_size?: string | number;
  permissive?: boolean;
  locks?: LockEntry[];
  code_dialog?: CodeDialogConfig;
}

export interface LockOverlayOptions {
  /** A stable, document-unique id so multiple locks may share one target. */
  id: string;
  /** Optional attribute used to identify overlays owned by this consumer. */
  overlayAttribute?: string;
  getUser: () => LockUser | undefined;
  isRow?: () => boolean;
  onUnlocked?: (overlay: HTMLElement) => void;
}

/**
 * Reusable lock overlay used by Forge and Broker. It owns the visual overlay,
 * user challenge, retry state, and target-specific interaction workarounds;
 * callers only resolve a target and choose what a successful unlock does.
 */
export class UixLockOverlay {
  private config: LockOverlayConfig = {};
  private target: HTMLElement | null = null;
  private adapter: LockTargetAdapter | null = null;
  private overlay: HTMLElement | null = null;
  private icon: (HTMLElement & { icon?: string }) | null = null;
  private relockTimer: ReturnType<typeof setTimeout> | null = null;
  private unlocked = false;
  private retryState: LockRetryState = createLockRetryState();
  private visualNeedsUpdate = true;

  constructor(private readonly options: LockOverlayOptions) {}

  get element(): HTMLElement | null {
    return this.overlay;
  }

  configure(config: LockOverlayConfig): void {
    this.config = config;
    this.visualNeedsUpdate = true;
    if (this.overlay) this.update();
  }

  attach(target: HTMLElement): HTMLElement {
    if (this.target && this.target !== target) this.detach();
    this.target = target;
    this.adapter ??= getLockTargetAdapter(target);

    // Some target adapters move the overlay into a shadow-root container. Keep
    // the owned reference first because a light-DOM query cannot find it there.
    let overlay = this.overlay?.isConnected ? this.overlay : target.querySelector(
      `[${this.overlayAttribute}="${this.options.id}"]`,
    ) as HTMLElement | null;
    const isNew = !overlay;
    if (!overlay) {
      if (window.getComputedStyle(target).position === "static") target.style.setProperty("position", "relative");
      overlay = document.createElement("div");
      overlay.setAttribute(this.overlayAttribute, this.options.id);
      this.applyBaseStyles(overlay);
      const icon = document.createElement("ha-icon") as HTMLElement & { icon?: string };
      overlay.appendChild(icon);
      overlay.addEventListener("action", (event) => {
        if ((event as CustomEvent).detail?.action === (this.config.action || "tap")) void this.handleUnlockAttempt();
      });
      overlay.addEventListener("click", (event) => {
        if (!this.unlocked) {
          event.stopPropagation();
          event.preventDefault();
        }
      });
      target.appendChild(overlay);
      this.icon = icon;
    } else {
      this.icon = overlay.querySelector("ha-icon") as (HTMLElement & { icon?: string }) | null;
    }
    this.overlay = overlay;
    if (isNew || this.visualNeedsUpdate) {
      actionHandlerBind(overlay, {
        hasHold: (this.config.action || "tap") === "hold",
        hasDoubleClick: (this.config.action || "tap") === "double_tap",
      });
      this.update();
      this.visualNeedsUpdate = false;
    }
    return overlay;
  }

  private get overlayAttribute(): string {
    return this.options.overlayAttribute ?? LOCK_OVERLAY_ID_ATTR;
  }

  detach(): void {
    if (this.relockTimer !== null) clearTimeout(this.relockTimer);
    this.relockTimer = null;
    if (this.adapter && this.target) this.adapter.cleanup(this.target);
    this.adapter = null;
    this.target = null;
    this.overlay?.remove();
    this.overlay = null;
    this.icon = null;
  }

  private applyBaseStyles(overlay: HTMLElement): void {
    const styles: Record<string, string> = {
      position: "absolute", inset: "0", "z-index": "var(--uix-lock-z-index, 10)",
      display: "var(--uix-lock-display, block)", "align-items": "center", "justify-content": "center",
      cursor: "var(--uix-lock-cursor, pointer)", "touch-action": "none", "user-select": "none",
      "-webkit-user-select": "none",
    };
    Object.entries(styles).forEach(([name, value]) => overlay.style.setProperty(name, value));
  }

  private accessConfig() {
    return {
      locks: Array.isArray(this.config.locks) ? this.config.locks : [],
      permissive: this.config.permissive === true,
      code_dialog: this.config.code_dialog && typeof this.config.code_dialog === "object" ? this.config.code_dialog : {},
    };
  }

  private accessState() {
    return getLockAccessState(this.accessConfig(), this.options.getUser());
  }

  private update(): void {
    const overlay = this.overlay;
    if (!overlay) return;
    const state = this.accessState();
    const shouldShow = state.requiresUnlock || state.blocked;
    if (this.adapter && this.target) {
      if (shouldShow && !this.unlocked) this.adapter.lock(this.target, overlay);
      else this.adapter.unlock(this.target);
    }
    if (!shouldShow) {
      overlay.style.setProperty("display", "none");
      return;
    }
    overlay.style.setProperty("display", "var(--uix-lock-display, block)");
    const isRow = this.options.isRow?.() === true;
    if (this.unlocked) overlay.style.setProperty("background", "var(--uix-lock-background-unlocked, none)");
    else if (isRow) overlay.style.setProperty("background", "var(--uix-lock-row-background, var(--uix-lock-background, transparent))");
    else overlay.style.setProperty("background", state.blocked ? "var(--uix-lock-background-blocked, var(--uix-lock-background, transparent))" : "var(--uix-lock-background, transparent)");
    overlay.style.setProperty("border-radius", isRow ? "var(--uix-lock-row-border-radius, var(--uix-lock-border-radius, inherit))" : "var(--uix-lock-border-radius, inherit)");
    if (isRow) overlay.style.setProperty("outline", state.blocked ? "var(--uix-lock-row-outlined-blocked, none)" : "none");
    else overlay.style.removeProperty("outline");
    overlay.style.setProperty("opacity", "var(--uix-lock-opacity, 0.5)");
    overlay.style.setProperty("pointer-events", this.unlocked ? "none" : "all");
    overlay.style.setProperty("cursor", this.unlocked
      ? "var(--uix-lock-cursor-unlocked, var(--uix-lock-cursor, pointer))"
      : state.blocked ? "var(--uix-lock-cursor-blocked, var(--uix-lock-cursor, pointer))" : "var(--uix-lock-cursor-locked, var(--uix-lock-cursor, pointer))");
    this.updateIcon(state.blocked);
  }

  private updateIcon(blocked: boolean): void {
    if (!this.icon) return;
    const hasUnlockedIcon = Boolean(this.config.icon_unlocked);
    const fadeOut = this.unlocked && !hasUnlockedIcon;
    const customColor = fadeOut ? this.config.icon_locked_color : this.unlocked ? this.config.icon_unlocked_color : this.config.icon_locked_color;
    this.icon.icon = this.unlocked && hasUnlockedIcon ? this.config.icon_unlocked : (this.config.icon_locked || "mdi:lock-outline");
    this.icon.style.setProperty("pointer-events", "none");
    const configuredSize = this.config.icon_size;
    const size = configuredSize === undefined ? this.adapter?.defaultIconSize() ?? "24px" : typeof configuredSize === "number" ? `${configuredSize}px` : String(configuredSize);
    this.icon.style.setProperty("--mdc-icon-size", `var(--uix-lock-icon-size, ${size})`);
    this.icon.style.setProperty("background", this.unlocked ? "var(--uix-lock-icon-background-unlocked, var(--uix-lock-icon-background, none))" : blocked ? "var(--uix-lock-icon-background-blocked, var(--uix-lock-icon-background, none))" : "var(--uix-lock-icon-background, none)");
    this.icon.style.setProperty("border-radius", `var(--uix-lock-icon-border-radius, ${this.adapter?.defaultIconBorderRadius() ?? "none"})`);
    this.icon.style.setProperty("padding", `var(--uix-lock-icon-padding, ${this.adapter?.defaultIconPadding() ?? "0"})`);
    const color = customColor || (this.unlocked && !fadeOut ? "var(--uix-lock-icon-unlocked-color, var(--uix-lock-icon-color, var(--success-color, #43a047)))" : blocked ? "var(--uix-lock-icon-blocked-color, var(--uix-lock-icon-color, var(--error-color, #db4437)))" : "var(--uix-lock-icon-locked-color, var(--uix-lock-icon-color, var(--error-color, #db4437)))");
    this.icon.style.setProperty("color", color);
    this.icon.style.setProperty("transition", `color 0.25s ease, opacity ${fadeOut ? "var(--uix-lock-icon-fade-duration, 2s)" : "0.25s"} ease`);
    this.icon.style.setProperty("opacity", fadeOut ? "0" : "1");
    this.icon.style.setProperty("display", "inline-flex");
    this.icon.style.setProperty("line-height", "normal");
    this.icon.style.setProperty("translate", "var(--uix-lock-icon-position, none)");
    const position = this.configuredIconPosition()
      ?? (this.options.isRow?.() ? { top: "6px", left: "30px" } : this.adapter?.defaultIconPosition() ?? undefined);
    if (position) {
      this.icon.style.setProperty("position", "relative");
      (["top", "bottom", "left", "right"] as const).forEach((side) => position[side] === undefined ? this.icon!.style.removeProperty(side) : this.icon!.style.setProperty(side, typeof position[side] === "number" ? `${position[side]}px` : position[side]!));
    } else {
      ["position", "top", "bottom", "left", "right"].forEach((name) => this.icon!.style.removeProperty(name));
    }
  }

  /** Match the Spark's forgiving icon-position parsing for both consumers. */
  private configuredIconPosition(): LockIconPosition | undefined {
    const raw = this.config.icon_position;
    if (!raw || typeof raw !== "object") return undefined;
    const position: LockIconPosition = {};
    (["top", "bottom", "left", "right"] as const).forEach((side) => {
      const value = raw[side];
      if (value !== undefined) position[side] = typeof value === "number" ? `${value}px` : String(value);
    });
    return Object.keys(position).length ? position : undefined;
  }

  private async handleUnlockAttempt(): Promise<void> {
    const overlay = this.overlay;
    if (!overlay || this.unlocked) return;
    if (!await requestLockAccess({ config: this.accessConfig(), user: this.options.getUser(), anchor: overlay, retryState: this.retryState })) return;
    this.unlocked = true;
    this.update();
    this.animateIcon(true);
    this.options.onUnlocked?.(overlay);
    if (this.relockTimer !== null) clearTimeout(this.relockTimer);
    this.relockTimer = setTimeout(() => {
      this.unlocked = false;
      this.update();
      this.animateIcon(false);
    }, parseDuration(this.config.duration) ?? 3000);
  }

  private animateIcon(unlocking: boolean): void {
    this.icon?.animate(unlocking
      ? [{ transform: "scale(1) rotate(0deg)" }, { transform: "scale(1.3) rotate(-20deg)", offset: .35 }, { transform: "scale(.95) rotate(5deg)", offset: .65 }, { transform: "scale(1) rotate(0deg)", offset: 1 }]
      : [{ transform: "scale(1)" }, { transform: "scale(1.2)", offset: .4 }, { transform: "scale(1)", offset: 1 }],
    { duration: unlocking ? 400 : 300, easing: "ease" });
  }
}
