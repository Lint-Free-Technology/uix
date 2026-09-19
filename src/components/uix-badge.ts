import { css, html } from "lit";
import { property } from "lit/decorators.js";
import WebAwesomeElement from "@home-assistant/webawesome/dist/internal/webawesome-element.js";
import variantStyles from "@home-assistant/webawesome/dist/styles/component/variants.styles.js";
import badgeStyles from "@home-assistant/webawesome/dist/components/badge/badge.styles.js";

const UIX_BADGE_TAG = "uix-badge";
const HOVER_BORDER_COLOR_ATTRIBUTE = "data-uix-badge-hover-border-color";
const BADGE_VARIANTS = ["brand", "neutral", "success", "warning", "danger"] as const;
const BADGE_APPEARANCES = ["accent", "filled", "outlined", "filled-outlined"] as const;
const BADGE_ATTENTIONS = ["none", "pulse", "bounce"] as const;
const BADGE_PLACEMENTS = [
  "top", "top-start", "top-end",
  "bottom", "bottom-start", "bottom-end",
  "left", "left-start", "left-end",
  "right", "right-start", "right-end",
] as const;

const uixBadgeStyles = css`
  :host {
    --uix-badge-resolved-color: var(--wa-color-fill-loud, var(--wa-color-brand-fill-loud));
    --uix-badge-resolved-content-color: var(--wa-color-on-loud, var(--wa-color-brand-on-loud));
    --uix-badge-resolved-border-color: transparent;
    --uix-badge-resolved-attention-color: var(
      --wa-color-fill-loud,
      var(--wa-color-brand-fill-loud)
    );
    font-size: var(
      --uix-badge-font-size,
      max(var(--wa-font-size-3xs, var(--ha-font-size-xs)), 0.75em)
    );
    padding: var(--uix-badge-padding, 0.375em 0.625em);
    max-width: var(--uix-badge-max-width, none);
    overflow: var(--uix-badge-overflow, visible);
    color: var(--uix-badge-content-color, var(--uix-badge-resolved-content-color));
    background-color: var(--uix-badge-color, var(--uix-badge-resolved-color));
    border: var(
      --uix-badge-border,
      var(--wa-border-width-s) var(--wa-border-style)
        var(--uix-badge-border-color, var(--uix-badge-color, var(--uix-badge-resolved-border-color)))
    );
    box-shadow: var(--uix-badge-box-shadow, none);
    --pulse-color: var(
      --uix-badge-attention-color,
      var(--uix-badge-color, var(--uix-badge-resolved-attention-color))
    );
    z-index: var(--uix-badge-z-index, auto);
  }

  :host([appearance="outlined"]) {
    --uix-badge-resolved-color: transparent;
    --uix-badge-resolved-content-color: var(--wa-color-on-quiet, var(--wa-color-brand-on-quiet));
    --uix-badge-resolved-border-color: var(--wa-color-border-loud, var(--wa-color-brand-border-loud));
    --uix-badge-resolved-attention-color: var(
      --wa-color-border-loud,
      var(--wa-color-brand-border-loud)
    );
  }

  :host([appearance="filled-outlined"]) {
    --uix-badge-resolved-color: var(--wa-color-fill-normal, var(--wa-color-brand-fill-normal));
    --uix-badge-resolved-content-color: var(--wa-color-on-normal, var(--wa-color-brand-on-normal));
    --uix-badge-resolved-border-color: var(--wa-color-border-normal, var(--wa-color-brand-border-normal));
    --uix-badge-resolved-attention-color: var(
      --wa-color-border-normal,
      var(--wa-color-brand-border-normal)
    );
  }

  :host([appearance="accent"]) {
    --uix-badge-resolved-color: var(--wa-color-fill-loud, var(--wa-color-brand-fill-loud));
    --uix-badge-resolved-content-color: var(--wa-color-on-loud, var(--wa-color-brand-on-loud));
    --uix-badge-resolved-border-color: transparent;
    --uix-badge-resolved-attention-color: var(
      --wa-color-fill-loud,
      var(--wa-color-brand-fill-loud)
    );
  }

  :host([appearance="filled"]) {
    --uix-badge-resolved-color: var(--wa-color-fill-normal, var(--wa-color-brand-fill-normal));
    --uix-badge-resolved-content-color: var(--wa-color-on-normal, var(--wa-color-brand-on-normal));
    --uix-badge-resolved-border-color: transparent;
    --uix-badge-resolved-attention-color: var(
      --wa-color-fill-normal,
      var(--wa-color-brand-fill-normal)
    );
  }

  /* Match Web Awesome's appearance-selector specificity for UIX overrides. */
  :host([appearance]) {
    color: var(--uix-badge-content-color, var(--uix-badge-resolved-content-color));
    background-color: var(--uix-badge-color, var(--uix-badge-resolved-color));
    border: var(
      --uix-badge-border,
      var(--wa-border-width-s) var(--wa-border-style)
        var(--uix-badge-border-color, var(--uix-badge-color, var(--uix-badge-resolved-border-color)))
    );
    --pulse-color: var(
      --uix-badge-attention-color,
      var(--uix-badge-color, var(--uix-badge-resolved-attention-color))
    );
  }

  :host(:hover) {
    color: var(--uix-badge-content-color-hover, var(--uix-badge-content-color, var(--uix-badge-resolved-content-color)));
    background-color: var(--uix-badge-color-hover, var(--uix-badge-color, var(--uix-badge-resolved-color)));
    --pulse-color: var(
      --uix-badge-attention-color-hover,
      var(
        --uix-badge-attention-color,
        var(
          --uix-badge-color-hover,
          var(--uix-badge-color, var(--uix-badge-resolved-attention-color))
        )
      )
    );
  }

  /* Preserve a color supplied by the complete border shorthand unless a
   * separate hover border color is configured. */
  :host(:hover[data-uix-badge-hover-border-color]) {
    border-color: var(--uix-badge-border-color-hover);
  }

  /* Outlined appearances use their visible border for the pulse ring. */
  :host([appearance="outlined"]),
  :host([appearance="filled-outlined"]) {
    --pulse-color: var(
      --uix-badge-attention-color,
      var(--uix-badge-border-color, var(--uix-badge-resolved-attention-color))
    );
  }

  :host([appearance="outlined"]:hover),
  :host([appearance="filled-outlined"]:hover) {
    --pulse-color: var(
      --uix-badge-attention-color-hover,
      var(
        --uix-badge-attention-color,
        var(--uix-badge-border-color, var(--uix-badge-resolved-attention-color))
      )
    );
  }

  /* Web Awesome's pulse replaces the host's box-shadow. Add the expanding
   * ring as a final shadow layer so configured shadows persist throughout the
   * animation. The transparent fallback keeps the native pulse when no custom
   * shadow is configured. */
  :host([attention="pulse"]) {
    animation: uix-badge-pulse 1.5s infinite;
  }

  @keyframes uix-badge-pulse {
    0% {
      box-shadow:
        var(--uix-badge-box-shadow, 0 0 0 0 transparent),
        0 0 0 0 var(--pulse-color);
    }
    70% {
      box-shadow:
        var(--uix-badge-box-shadow, 0 0 0 0 transparent),
        0 0 0 0.5rem transparent;
    }
    100% {
      box-shadow:
        var(--uix-badge-box-shadow, 0 0 0 0 transparent),
        0 0 0 0 transparent;
    }
  }

  :host([data-uix-badge-adapter]) {
    z-index: var(--uix-badge-z-index, 1);
  }

  :host([data-uix-badge-adapter]) {
    font-size: var(--uix-badge-font-size, var(--ha-font-size-xs));
    padding: var(--uix-badge-padding, 0.25em 0.5em);
    min-width: var(--uix-badge-min-width, calc(1.5em + 2px));
  }
`;

type UixBadgeVariant = typeof BADGE_VARIANTS[number];
type UixBadgeAppearance = typeof BADGE_APPEARANCES[number];
type UixBadgeAttention = typeof BADGE_ATTENTIONS[number];
export type UixBadgePlacement = typeof BADGE_PLACEMENTS[number];

export function normalizeUixBadgePlacement(value: unknown): UixBadgePlacement {
  return BADGE_PLACEMENTS.includes(value as UixBadgePlacement) ? value as UixBadgePlacement : "top-end";
}

export type UixBadgeConfig = {
  content?: string | number;
  variant?: UixBadgeVariant;
  appearance?: UixBadgeAppearance;
  pill?: boolean;
  attention?: UixBadgeAttention;
  placement?: UixBadgePlacement;
  start_icon?: string;
  end_icon?: string;
};

/**
 * A UIX-owned badge using Home Assistant's patched Web Awesome base and styles.
 *
 * Do not import Web Awesome's badge component module here. It self-registers
 * `wa-badge`; UIX intentionally imports only the registration-free base and
 * styles so this namespaced element cannot conflict with a future HA badge.
 */
class UixBadge extends WebAwesomeElement {
  static css = [variantStyles, badgeStyles, uixBadgeStyles];

  @property({ reflect: true })
  variant: UixBadgeVariant = "brand";

  @property({ reflect: true })
  appearance: UixBadgeAppearance = "accent";

  @property({ type: Boolean, reflect: true })
  pill = false;

  @property({ reflect: true })
  attention: UixBadgeAttention = "none";

  private onPointerEnter = () => this.syncHoverBorderColor();

  private onPointerLeave = () => {
    this.removeAttribute(HOVER_BORDER_COLOR_ATTRIBUTE);
  };

  connectedCallback(): void {
    super.connectedCallback();
    this.addEventListener("pointerenter", this.onPointerEnter);
    this.addEventListener("pointerleave", this.onPointerLeave);
  }

  disconnectedCallback(): void {
    this.removeEventListener("pointerenter", this.onPointerEnter);
    this.removeEventListener("pointerleave", this.onPointerLeave);
    super.disconnectedCallback();
  }

  private syncHoverBorderColor(): void {
    this.toggleAttribute(
      HOVER_BORDER_COLOR_ATTRIBUTE,
      getComputedStyle(this).getPropertyValue("--uix-badge-border-color-hover").trim() !== "",
    );
  }

  render() {
    return html`
      <span part="start"><slot name="start"></slot></span>
      <span part="base" role="status"><slot></slot></span>
      <span part="end"><slot name="end"></slot></span>
    `;
  }
}

export function ensureUixBadge(): void {
  if (!customElements.get(UIX_BADGE_TAG)) {
    customElements.define(UIX_BADGE_TAG, UixBadge);
  }
}

export function createUixBadge(config: UixBadgeConfig): HTMLElement {
  ensureUixBadge();
  const badge = document.createElement(UIX_BADGE_TAG);
  updateUixBadge(badge, config);
  return badge;
}

export function updateUixBadge(badge: HTMLElement, config: UixBadgeConfig): void {
  updateBadgeContent(badge, config.content === undefined ? "" : String(config.content));
  setAttributeValue(badge, "variant", validValue(BADGE_VARIANTS, config.variant) ?? "brand");
  setAttributeValue(badge, "appearance", validValue(BADGE_APPEARANCES, config.appearance) ?? "accent");
  setAttributeValue(badge, "attention", validValue(BADGE_ATTENTIONS, config.attention) ?? "none");
  if (badge.hasAttribute("pill") !== (config.pill === true)) {
    badge.toggleAttribute("pill", config.pill === true);
  }
  updateSlottedIcon(badge, "start", config.start_icon);
  updateSlottedIcon(badge, "end", config.end_icon);
}

function updateBadgeContent(badge: HTMLElement, content: string): void {
  let text = Array.from(badge.childNodes).find((node) => node.nodeType === Node.TEXT_NODE) as Text | undefined;
  if (!text) {
    badge.insertBefore(document.createTextNode(content), badge.firstChild);
    return;
  }
  if (text.data !== content) text.data = content;
}

function validValue<T extends readonly string[]>(values: T, value: unknown): T[number] | undefined {
  return values.includes(value as T[number]) ? value as T[number] : undefined;
}

function setAttributeValue(element: Element, name: string, value: string): void {
  if (element.getAttribute(name) !== value) element.setAttribute(name, value);
}

function updateSlottedIcon(badge: HTMLElement, slot: "start" | "end", icon: string | undefined): void {
  let iconEl = badge.querySelector(`:scope > ha-icon[slot="${slot}"]`) as (HTMLElement & { icon: string }) | null;
  if (!icon) {
    iconEl?.remove();
    return;
  }
  if (!iconEl) {
    iconEl = document.createElement("ha-icon") as HTMLElement & { icon: string };
    iconEl.setAttribute("slot", slot);
    badge.appendChild(iconEl);
  }
  if (iconEl.icon !== icon) iconEl.icon = icon;
}

declare global {
  interface HTMLElementTagNameMap {
    "uix-badge": UixBadge;
  }
}
