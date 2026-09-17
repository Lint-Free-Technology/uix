import { PropertyValues } from "lit";
import { computeRtl } from "../../helpers/rtl";
import { createUixBadge, UixBadgeConfig, updateUixBadge } from "../../components/uix-badge";
import {
  detachBadgeTargetAdapter,
  getBadgeTargetAdapter,
  getSiblingBadgePlacementAdapter,
} from "../../components/badge-target-adapters";
import { UixForgeSparkBase } from "./uix-spark-base";

const BADGE_ID_ATTR = "data-uix-forge-badge-id";

export class UixForgeSparkBadge extends UixForgeSparkBase {
  type = "badge";

  private after = "";
  private before = "";
  private badgeConfig: UixBadgeConfig = {};
  private style: Record<string, string | number> = {};
  private appliedStyleProperties = new Map<string, string>();
  private badgeElement: HTMLElement | null = null;
  private readonly id: string;

  constructor(controller: any, config: Record<string, any>) {
    super(controller, config);
    this.id = `uix-forge-badge-${Math.random().toString(36).slice(2, 11)}`;
    this.applyConfig(config);
  }

  configUpdated(config: Record<string, any>): void {
    super.configUpdated(config);
    this.applyConfig(config);
  }

  private applyConfig(config: Record<string, any>): void {
    this.after = config.after || config.for || (config.before === undefined ? this.defaultTarget("") : "");
    this.before = config.before || "";
    this.badgeConfig = {
      content: config.content,
      variant: config.variant,
      appearance: config.appearance,
      pill: config.pill,
      attention: config.attention,
      placement: config.placement,
      start_icon: config.start_icon,
      end_icon: config.end_icon,
    };
    this.style = config.style ?? {};
  }

  updated(_changedProperties: PropertyValues): void {
    this.attach(this._beginUpdate());
  }

  connectedCallback(): void {
    this.attach(this._beginUpdate());
  }

  disconnectedCallback(): void {
    this._cancelPending();
    this.remove();
  }

  private remove(): void {
    if (this.badgeElement) detachBadgeTargetAdapter(this.badgeElement);
    this.badgeElement?.remove();
    this.badgeElement = null;
  }

  private async attach(generation: number): Promise<void> {
    const selector = this.after || this.before;
    if (!selector) return;

    const target = (await this.controller.target(selector, this._cancel))?.[0];
    if (generation !== this._callGeneration) return;
    if (!target) {
      this.remove();
      return;
    }
    const targetAdapter = getBadgeTargetAdapter(target);
    const adapter = targetAdapter ?? getSiblingBadgePlacementAdapter(this.badgeConfig.placement);
    const parent = targetAdapter ? target : target.parentElement || target.parentNode;
    if (!parent) return;

    // An adapter can mount outside the selected target, so retain that
    // connected instance rather than searching only its light DOM.
    let badge = adapter && this.badgeElement?.isConnected
      ? this.badgeElement
      : (parent as ParentNode).querySelector?.(
          `uix-badge[${BADGE_ID_ATTR}="${this.id}"]`,
        ) as HTMLElement | null;
    if (this.badgeElement && !badge) this.remove();

    if (!badge) {
      badge = createUixBadge(this.badgeConfig);
      badge.setAttribute(BADGE_ID_ATTR, this.id);
      if (!targetAdapter) {
        const slot = target.getAttribute("slot");
        if (slot) badge.setAttribute("slot", slot);
      }
    }

    updateUixBadge(badge, this.badgeConfig);
    this.applyStyle(badge);
    if (adapter) {
      const hass = this.controller.forge.hass;
      adapter.place(
        badge,
        target as HTMLElement,
        this.badgeConfig.placement,
        computeRtl(hass?.language, hass?.translationMetadata?.translations),
      );
    } else {
      detachBadgeTargetAdapter(badge);
      if (this.before) {
        if (badge.nextSibling !== target) parent.insertBefore(badge, target);
      } else {
        const nextSibling = target.nextSibling;
        if (nextSibling !== badge) parent.insertBefore(badge, nextSibling);
      }
    }
    this.badgeElement = badge;
  }

  /** Applies and replaces the optional per-badge CSS property map. */
  private applyStyle(badge: HTMLElement): void {
    const styles = new Map<string, string>();
    // The visual editor supplies intermediate YAML values while the user is
    // typing. Ignore an incomplete style map until it becomes valid instead
    // of surfacing an uncaught promise rejection in the browser console.
    if (this.style && typeof this.style === "object" && !Array.isArray(this.style)) {
      for (const [property, value] of Object.entries(this.style)) {
        if (!property.trim() || (typeof value !== "string" && typeof value !== "number")) {
          continue;
        }
        styles.set(property, String(value));
      }
    }
    this.appliedStyleProperties.forEach((previous, property) => {
      if (!styles.has(property) && badge.style.getPropertyValue(property) === previous) {
        badge.style.removeProperty(property);
      }
    });
    this.appliedStyleProperties = styles;
    styles.forEach((value, property) => {
      if (badge.style.getPropertyValue(property) !== value) {
        badge.style.setProperty(property, value);
      }
    });
  }
}
