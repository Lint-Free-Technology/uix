import {
  normalizeUixBadgePlacement,
  type UixBadgePlacement,
} from "./uix-badge";

/**
 * Element-specific badge placement.
 *
 * Web Awesome positions `wa-badge` children of `wa-button` from within the
 * button component. UIX deliberately uses its own `uix-badge` tag, so the
 * Web Awesome selector does not match. This adapter supplies the equivalent
 * light-DOM placement without depending on, or injecting into, the button's
 * shadow root.
 */
export interface BadgeTargetAdapter {
  place(badge: HTMLElement, target: HTMLElement, placement?: UixBadgePlacement): void;
  detach(badge: HTMLElement): void;
}

type BadgeTargetState = {
  badges: Set<HTMLElement>;
  position?: {
    value: string;
    priority: string;
  };
};

type BadgeStyleState = Map<string, { value: string; priority: string; applied: string }>;

const badgeTargetState = new WeakMap<HTMLElement, BadgeTargetState>();
const badgeTargets = new WeakMap<HTMLElement, HTMLElement>();
const badgeAdapters = new WeakMap<HTMLElement, BadgeTargetAdapter>();
const badgeStyles = new WeakMap<HTMLElement, BadgeStyleState>();
let haButtonBadgeAdapter: HaButtonBadgeAdapter;
let haTileIconBadgeAdapter: HaTileIconBadgeAdapter;
let siblingBadgePlacementAdapter: SiblingBadgePlacementAdapter;

/** Returns an adapter when the target provides a known badge placement. */
export function getBadgeTargetAdapter(element: Element): BadgeTargetAdapter | null {
  switch (element.localName) {
    case "ha-button":
      return haButtonBadgeAdapter;
    default:
      if (getUixButton(element)) return haButtonBadgeAdapter;
      return element.localName === "ha-tile-icon" ? haTileIconBadgeAdapter : null;
  }
}

/**
 * Returns the opt-in generic placement adapter for normal sibling badges.
 * Unlike element-specific adapters, this positions relative to the sibling
 * insertion container rather than attempting to modify the selected target.
 */
export function getSiblingBadgePlacementAdapter(placement: unknown): BadgeTargetAdapter | null {
  return placement === undefined ? null : siblingBadgePlacementAdapter;
}

/** Removes any target-specific placement applied to a generated badge. */
export function detachBadgeTargetAdapter(badge: HTMLElement): void {
  badgeAdapters.get(badge)?.detach(badge);
}

class HaButtonBadgeAdapter implements BadgeTargetAdapter {
  place(badge: HTMLElement, target: HTMLElement, placement?: UixBadgePlacement): void {
    const button = getUixButton(target);
    if (!button) return;
    placeOnPositionedTarget(this, badge, button, "button", placement);
  }

  detach(badge: HTMLElement): void {
    detachFromPositionedTarget(this, badge);
  }
}

class SiblingBadgePlacementAdapter implements BadgeTargetAdapter {
  place(badge: HTMLElement, target: HTMLElement, placement?: UixBadgePlacement): void {
    const root = target.parentNode;
    if (!root) return;
    const anchor = root instanceof ShadowRoot ? root.host : root;
    if (!(anchor instanceof HTMLElement)) return;

    const previousAdapter = badgeAdapters.get(badge);
    if (previousAdapter && previousAdapter !== this) previousAdapter.detach(badge);
    const previousTarget = badgeTargets.get(badge);
    if (previousTarget && previousTarget !== anchor) this.detach(badge);

    let state = badgeTargetState.get(anchor);
    if (!state) {
      state = { badges: new Set() };
      badgeTargetState.set(anchor, state);
      if (window.getComputedStyle(anchor).position === "static") {
        state.position = {
          value: anchor.style.getPropertyValue("position"),
          priority: anchor.style.getPropertyPriority("position"),
        };
        anchor.style.setProperty("position", "relative");
      }
    }

    state.badges.add(badge);
    badgeTargets.set(badge, anchor);
    badgeAdapters.set(badge, this);
    badge.setAttribute("data-uix-badge-adapter", "sibling");
    applyBadgeStyles(badge, {
      position: "absolute",
      "pointer-events": "var(--uix-badge-pointer-events, auto)",
      ...buttonPlacementStyles(placement),
    });
    if (badge.parentNode !== root) root.appendChild(badge);
  }

  detach(badge: HTMLElement): void {
    detachFromPositionedTarget(this, badge);
  }
}

function placeOnPositionedTarget(
  adapter: BadgeTargetAdapter,
  badge: HTMLElement,
  target: HTMLElement,
  adapterName: string,
  placement: UixBadgePlacement | undefined,
): void {
  const previousAdapter = badgeAdapters.get(badge);
  if (previousAdapter && previousAdapter !== adapter) previousAdapter.detach(badge);
  const previousTarget = badgeTargets.get(badge);
  if (previousTarget && previousTarget !== target) adapter.detach(badge);

  let state = badgeTargetState.get(target);
  if (!state) {
    state = { badges: new Set() };
    badgeTargetState.set(target, state);
    if (window.getComputedStyle(target).position === "static") {
      state.position = {
        value: target.style.getPropertyValue("position"),
        priority: target.style.getPropertyPriority("position"),
      };
      target.style.setProperty("position", "relative");
    }
  }

  state.badges.add(badge);
  badgeTargets.set(badge, target);
  badgeAdapters.set(badge, adapter);
  badge.setAttribute("data-uix-badge-adapter", adapterName);
  applyBadgeStyles(badge, {
    position: "absolute",
    "pointer-events": "var(--uix-badge-pointer-events, auto)",
    ...buttonPlacementStyles(placement),
  });
  // Moving an existing child causes a remove/add cycle. Only append when the
  // badge has actually changed target, avoiding visible flashes on updates.
  if (badge.parentElement !== target) target.appendChild(badge);
}

function detachFromPositionedTarget(adapter: BadgeTargetAdapter, badge: HTMLElement): void {
  if (badgeAdapters.get(badge) !== adapter) return;
  const target = badgeTargets.get(badge);
  if (!target) return;

  badgeAdapters.delete(badge);
  badgeTargets.delete(badge);
  restoreBadgeStyles(badge);
  badge.removeAttribute("data-uix-badge-adapter");

  const state = badgeTargetState.get(target);
  if (!state) return;
  state.badges.delete(badge);
  if (state.badges.size) return;

  if (state.position && target.style.getPropertyValue("position") === "relative") {
    target.style.setProperty("position", state.position.value, state.position.priority);
  }
  badgeTargetState.delete(target);
}

class HaTileIconBadgeAdapter implements BadgeTargetAdapter {
  place(badge: HTMLElement, target: HTMLElement, placement?: UixBadgePlacement): void {
    const previousAdapter = badgeAdapters.get(badge);
    if (previousAdapter && previousAdapter !== this) previousAdapter.detach(badge);
    const previousTarget = badgeTargets.get(badge);
    if (previousTarget && previousTarget !== target) this.detach(badge);

    badgeAdapters.set(badge, this);
    badgeTargets.set(badge, target);
    badge.setAttribute("data-uix-badge-adapter", "tile-icon");
    applyBadgeStyles(badge, {
      position: "absolute",
      "pointer-events": "var(--uix-badge-pointer-events, auto)",
      ...tileIconPlacementStyles(placement),
    });
    // Do not reappend an already placed badge: that briefly removes it from
    // the tile icon on every Forge/HA update and presents as a flash.
    if (badge.parentElement !== target) target.appendChild(badge);
  }

  detach(badge: HTMLElement): void {
    if (badgeAdapters.get(badge) !== this) return;
    badgeAdapters.delete(badge);
    badgeTargets.delete(badge);
    restoreBadgeStyles(badge);
    badge.removeAttribute("data-uix-badge-adapter");
  }
}

function applyBadgeStyles(badge: HTMLElement, styles: Record<string, string>): void {
  let badgeStyleState = badgeStyles.get(badge);
  if (!badgeStyleState) {
    badgeStyleState = new Map();
    badgeStyles.set(badge, badgeStyleState);
  }

  // Restore placement properties that no longer apply (for example, `top`
  // when placement changes from top-end to bottom-end) without a detach.
  badgeStyleState.forEach((previous, property) => {
    if (property in styles) return;
    if (badge.style.getPropertyValue(property) === previous.applied) {
      badge.style.setProperty(property, previous.value, previous.priority);
    }
    badgeStyleState!.delete(property);
  });

  Object.entries(styles).forEach(([property, value]) => {
    const previous = badgeStyleState!.get(property);
    if (previous) {
      if (badge.style.getPropertyValue(property) === previous.applied && previous.applied !== value) {
        badge.style.setProperty(property, value);
        previous.applied = value;
      }
      return;
    }
    // An inline value not created by the adapter belongs to the user.
    if (badge.style.getPropertyValue(property)) return;
    badgeStyleState!.set(property, {
      value: "",
      priority: "",
      applied: value,
    });
    badge.style.setProperty(property, value);
  });
}

function restoreBadgeStyles(badge: HTMLElement): void {
  const styles = badgeStyles.get(badge);
  if (!styles) return;
  styles.forEach((previous, property) => {
    if (badge.style.getPropertyValue(property) === previous.applied) {
      badge.style.setProperty(property, previous.value, previous.priority);
    }
  });
  badgeStyles.delete(badge);
}

function buttonPlacementStyles(placement: UixBadgePlacement | undefined): Record<string, string> {
  switch (normalizeUixBadgePlacement(placement)) {
    case "top": return { top: "0", left: "50%", translate: badgeTranslate("-50%", "calc(-50% + 1px)") };
    case "top-start": return { top: "0", "inset-inline-start": "0", translate: badgeTranslate("calc(-50% + 1px)", "calc(-50% + 1px)") };
    case "top-end": return { top: "0", "inset-inline-end": "0", translate: badgeTranslate("calc(50% - 1px)", "calc(-50% + 1px)") };
    case "bottom": return { bottom: "0", left: "50%", translate: badgeTranslate("-50%", "calc(50% - 1px)") };
    case "bottom-start": return { bottom: "0", "inset-inline-start": "0", translate: badgeTranslate("calc(-50% + 1px)", "calc(50% - 1px)") };
    case "bottom-end": return { bottom: "0", "inset-inline-end": "0", translate: badgeTranslate("calc(50% - 1px)", "calc(50% - 1px)") };
    case "left": return { "inset-inline-start": "0", top: "50%", translate: badgeTranslate("calc(-50% + 1px)", "-50%") };
    case "left-start": return { "inset-inline-start": "0", top: "0", translate: badgeTranslate("calc(-50% + 1px)", "calc(-50% + 1px)") };
    case "left-end": return { "inset-inline-start": "0", bottom: "0", translate: badgeTranslate("calc(-50% + 1px)", "calc(50% - 1px)") };
    case "right": return { "inset-inline-end": "0", top: "50%", translate: badgeTranslate("calc(50% - 1px)", "-50%") };
    case "right-start": return { "inset-inline-end": "0", top: "0", translate: badgeTranslate("calc(50% - 1px)", "calc(-50% + 1px)") };
    case "right-end": return { "inset-inline-end": "0", bottom: "0", translate: badgeTranslate("calc(50% - 1px)", "calc(50% - 1px)") };
  }
}

function tileIconPlacementStyles(placement: UixBadgePlacement | undefined): Record<string, string> {
  switch (normalizeUixBadgePlacement(placement)) {
    case "top": return { top: "3px", left: "50%", translate: badgeTranslate("-50%", "0px") };
    case "top-start": return { top: "3px", "inset-inline-start": "3px", translate: badgeTranslate("0px", "0px") };
    case "top-end": return { top: "3px", right: "3px", "inset-inline-end": "3px", translate: badgeTranslate("0px", "0px") };
    case "bottom": return { bottom: "3px", left: "50%", translate: badgeTranslate("-50%", "0px") };
    case "bottom-start": return { bottom: "3px", "inset-inline-start": "3px", translate: badgeTranslate("0px", "0px") };
    case "bottom-end": return { bottom: "3px", "inset-inline-end": "3px", translate: badgeTranslate("0px", "0px") };
    case "left": return { "inset-inline-start": "3px", top: "50%", translate: badgeTranslate("0px", "-50%") };
    case "left-start": return { "inset-inline-start": "3px", top: "3px", translate: badgeTranslate("0px", "0px") };
    case "left-end": return { "inset-inline-start": "3px", bottom: "3px", translate: badgeTranslate("0px", "0px") };
    case "right": return { "inset-inline-end": "3px", top: "50%", translate: badgeTranslate("0px", "-50%") };
    case "right-start": return { "inset-inline-end": "3px", top: "3px", translate: badgeTranslate("0px", "0px") };
    case "right-end": return { "inset-inline-end": "3px", bottom: "3px", translate: badgeTranslate("0px", "0px") };
  }
}

function badgeTranslate(x: string, y: string): string {
  return `calc(${x} + var(--uix-badge-offset-x, 0px)) calc(${y} + var(--uix-badge-offset-y, 0px))`;
}

/** UIX-generated button wrappers are display-contents wrappers around ha-button. */
function getUixButton(element: Element): HTMLElement | null {
  if (element.localName === "ha-button") return element as HTMLElement;
  if (!element.matches("div[data-uix-forge-button-id], div[data-uix-broker-button]")) return null;
  return element.querySelector(":scope > ha-button") as HTMLElement | null;
}

haButtonBadgeAdapter = new HaButtonBadgeAdapter();
haTileIconBadgeAdapter = new HaTileIconBadgeAdapter();
siblingBadgePlacementAdapter = new SiblingBadgePlacementAdapter();
import type { UixBadgePlacement } from "./uix-badge";
