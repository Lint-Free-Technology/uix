import { PropertyValues } from "lit";
import { UixForgeSparkBase } from "./uix-spark-base";
import { stateColorCss } from "../../helpers/common/entity/state_color";
import {
  AdapterIconPosition,
  OverlayIconTargetAdapter,
  getOverlayIconTargetAdapter,
} from "./overlay-icon-target-adapters";

const OVERLAY_ICON_ID_ATTR = "data-uix-forge-overlay-icon-id";
const MEDIA_SOURCE_PREFIX = "media-source://";

interface IconPosition {
  top?: string;
  bottom?: string;
  left?: string;
  right?: string;
}

interface MediaSourceResolveResult {
  url?: string;
}

export class UixForgeSparkOverlayIcon extends UixForgeSparkBase {
  type = "overlay-icon";

  private _for: string = "";
  private _icon: string = "";
  private _imageUrl: string = "";
  private _entity: string = "";
  private _value: string = "";
  private _stateColor: boolean = true;
  private _iconColor: string = "";
  private _iconPosition: IconPosition | null = null;
  private _iconSize: string | null = null;
  private _iconBackground: string | null = null;

  private _overlayElement: HTMLElement | null = null;
  private _iconElement: HTMLElement | null = null;
  private _targetElement: HTMLElement | null = null;
  private _targetAdapter: OverlayIconTargetAdapter | null = null;
  private readonly _id: string;

  constructor(controller: any, config: Record<string, any>) {
    super(controller, config);
    this._id = `uix-forge-overlay-icon-${Math.random().toString(36).slice(2, 11)}`;
    this._applyConfig(config);
  }

  configUpdated(config: Record<string, any>): void {
    super.configUpdated(config);
    this._applyConfig(config);
  }

  private _applyConfig(config: Record<string, any>) {
    this._for = config.for || "element";
    this._entity = config.entity || "";
    const rawIcon = config.icon || "";
    const rawImageUrl = config.image_url || "";

    if (this._entity) {
      // Entity mode always renders a ha-state-icon; static icon sources are ignored.
      this._icon = "";
      this._imageUrl = "";
    } else if (rawImageUrl) {
      this._icon = "";
      this._imageUrl = rawImageUrl;
    } else {
      this._icon = rawIcon;
      this._imageUrl = "";
    }
    // Preserve explicit empty-string overrides while treating null/undefined as "no override".
    this._value = config.value !== undefined && config.value !== null ? String(config.value) : "";
    this._stateColor = config.state_color !== undefined ? config.state_color !== false : true;
    this._iconColor = config.icon_color || "";
    this._iconPosition = this._parseIconPosition(config.icon_position);
    this._iconSize = config.icon_size !== undefined
      ? (typeof config.icon_size === "number" ? `${config.icon_size}px` : String(config.icon_size))
      : null;
    this._iconBackground = config.icon_background !== undefined ? String(config.icon_background) : null;
  }

  private _parseIconPosition(raw: any): IconPosition | null {
    if (!raw || typeof raw !== "object") return null;
    const pos: IconPosition = {};
    const toCss = (v: any) => (typeof v === "number" ? `${v}px` : String(v));
    if (raw.top !== undefined) pos.top = toCss(raw.top);
    if (raw.bottom !== undefined) pos.bottom = toCss(raw.bottom);
    if (raw.left !== undefined) pos.left = toCss(raw.left);
    if (raw.right !== undefined) pos.right = toCss(raw.right);
    return Object.keys(pos).length ? pos : null;
  }

  private _getEffectiveIconPosition(): AdapterIconPosition | null {
    if (this._iconPosition !== null) return this._iconPosition;
    return this._targetAdapter?.defaultIconPosition() ?? null;
  }

  private _getEffectiveIconSize(): string {
    if (this._iconSize !== null) return this._iconSize;
    return this._targetAdapter?.defaultIconSize() ?? "24px";
  }

  private _getEffectiveIconColor(stateObj: any): string {
    if (this._iconColor) return this._iconColor;
    if (this._entity && this._stateColor && stateObj) {
      const state = this._value || undefined;
      const stateColor = stateColorCss(stateObj, state);
      if (stateColor) return stateColor;
    }
    return this._targetAdapter?.defaultIconColor() ?? "var(--primary-color, #03a9f4)";
  }

  private _getEffectiveIconBackground(): string {
    if (this._iconBackground !== null) return this._iconBackground;
    return this._targetAdapter?.defaultIconBackground() ?? "none";
  }

  private async _resolveMediaSourceUrl(url: string): Promise<string> {
    if (!url.startsWith(MEDIA_SOURCE_PREFIX)) return url;
    const hass = this.controller.forge.hass;
    if (!hass) return url;
    try {
      const result = await hass.callWS({
        type: "media_source/resolve_media",
        media_content_id: url,
      });
      return (result as MediaSourceResolveResult)?.url ?? url;
    } catch (e) {
      console.warn(
        `UIX Forge overlay-icon spark: failed to resolve media source '${url}', using original URL.`,
        e
      );
      return url;
    }
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
    this._remove();
  }

  private _remove() {
    if (this._overlayElement) {
      this._overlayElement.remove();
      this._overlayElement = null;
      this._iconElement = null;
    }
    this._targetElement = null;
    this._targetAdapter = null;
  }

  private _hasSource(): boolean {
    return !!(this._entity || this._icon || this._imageUrl);
  }

  private async _attach(generation: number) {
    if (!this._hasSource()) {
      this._remove();
      return;
    }

    const elements = await this.controller.target(this._for, this._cancel);
    const element = elements?.[0] as HTMLElement | undefined;
    if (!element) return;
    if (generation !== this._callGeneration) return;

    const existingOverlay = element.querySelector(
      `[${OVERLAY_ICON_ID_ATTR}="${this._id}"]`
    ) as HTMLElement | null;

    if (this._overlayElement && !existingOverlay) {
      this._overlayElement.remove();
      this._overlayElement = null;
      this._iconElement = null;
    }

    let overlay = existingOverlay;
    if (!overlay) {
      const currentPos = window.getComputedStyle(element).position;
      if (currentPos === "static") {
        element.style.setProperty("position", "relative");
      }

      overlay = document.createElement("div");
      overlay.setAttribute(OVERLAY_ICON_ID_ATTR, this._id);
      overlay.style.setProperty("position", "absolute");
      overlay.style.setProperty("inset", "0");
      overlay.style.setProperty("z-index", "var(--uix-overlay-icon-z-index, 10)");
      overlay.style.setProperty("display", "var(--uix-overlay-icon-display, block)");
      overlay.style.setProperty("align-items", "center");
      overlay.style.setProperty("justify-content", "center");
      overlay.style.setProperty("pointer-events", "none");

      element.appendChild(overlay);
    }

    const targetChanged = this._targetElement !== element;
    this._targetElement = element;
    if (!this._targetAdapter || targetChanged) {
      this._targetAdapter = getOverlayIconTargetAdapter(element);
    }

    this._ensureIconElement(overlay);
    const hasCustomImageUrl = !!this._imageUrl && !this._entity;
    const resolvedImageUrl = hasCustomImageUrl
      ? await this._resolveMediaSourceUrl(this._imageUrl)
      : null;
    if (generation !== this._callGeneration) return;

    this._updateOverlay(overlay, resolvedImageUrl);

    this._overlayElement = overlay;
  }

  private _ensureIconElement(overlay: HTMLElement) {
    const expectedTag = this._entity ? "ha-state-icon" : "ha-icon";
    const current = overlay.firstElementChild as HTMLElement | null;
    if (!current || current.tagName.toLowerCase() !== expectedTag) {
      current?.remove();
      const iconEl = document.createElement(expectedTag) as HTMLElement;
      overlay.appendChild(iconEl);
      this._iconElement = iconEl;
      return;
    }
    this._iconElement = current;
  }

  private _updateOverlay(overlay: HTMLElement, resolvedImageUrl: string | null) {
    const isRow = this.controller.forge.mold?.isRow() === true;
    const defaultOpacity = this._targetElement?.tagName.toLowerCase() === "ha-tile-icon" ? "1" : "0.5";
    overlay.style.setProperty("display", "var(--uix-overlay-icon-display, block)");
    overlay.style.setProperty("opacity", `var(--uix-overlay-icon-opacity, ${defaultOpacity})`);
    overlay.style.setProperty(
      "border-radius",
      isRow
        ? "var(--uix-overlay-icon-row-border-radius, var(--uix-overlay-icon-border-radius, inherit))"
        : "var(--uix-overlay-icon-border-radius, inherit)"
    );
    overlay.style.setProperty("border", "var(--uix-overlay-icon-border, unset)");

    if (!this._iconElement) return;

    const iconEl = this._iconElement as any;
    const hass = this.controller.forge.hass;
    const stateObj = this._entity ? hass?.states?.[this._entity] : undefined;

    if (this._entity) {
      iconEl.hass = hass;
      if (stateObj) {
        iconEl.stateObj = this._value
          ? { ...stateObj, state: this._value }
          : stateObj;
      } else {
        iconEl.stateObj = undefined;
      }
    } else {
      iconEl.icon = this._icon || undefined;
    }

    this._iconElement.style.setProperty("pointer-events", "none");
    this._iconElement.style.setProperty(
      "--mdc-icon-size",
      `var(--uix-overlay-icon-size, ${this._getEffectiveIconSize()})`
    );
    if (this._iconBackground !== null) {
      this._iconElement.style.removeProperty("background-attachment");
      this._iconElement.style.removeProperty("background-origin");
      this._iconElement.style.removeProperty("background-clip");
      this._iconElement.style.setProperty("background", this._iconBackground);
    } else {
      const defaultBackground = this._getEffectiveIconBackground();
      const defaultBackgroundColor = defaultBackground === "none"
        ? "transparent"
        : defaultBackground;
      this._iconElement.style.removeProperty("background");
      this._iconElement.style.removeProperty("background-attachment");
      this._iconElement.style.removeProperty("background-origin");
      this._iconElement.style.removeProperty("background-clip");
      this._iconElement.style.setProperty(
        "background-color",
        `var(--uix-overlay-icon-background, ${defaultBackgroundColor})`
      );
    }
    const defaultBorderRadius = this._targetAdapter?.defaultIconBorderRadius() ?? "none";
    this._iconElement.style.setProperty(
      "border-radius",
      `var(--uix-overlay-icon-icon-border-radius, ${defaultBorderRadius})`
    );
    const defaultPadding = this._targetAdapter?.defaultIconPadding() ?? "0";
    this._iconElement.style.setProperty(
      "padding",
      `var(--uix-overlay-icon-padding, ${defaultPadding})`
    );
    this._iconElement.style.setProperty("line-height", this._getEffectiveIconSize());
    this._iconElement.style.setProperty("display", "inline-flex");
    this._iconElement.style.setProperty("translate", "var(--uix-overlay-icon-position, none)");
    this._iconElement.style.setProperty(
      "color",
      `var(--uix-overlay-icon-color, ${this._getEffectiveIconColor(stateObj)})`
    );

    if (resolvedImageUrl !== null) {
      this._iconElement.style.setProperty("background-image", `url("${resolvedImageUrl}")`);
      this._iconElement.style.setProperty("background-repeat", "no-repeat");
      this._iconElement.style.setProperty("background-position", "center");
      this._iconElement.style.setProperty("background-size", "contain");
      this._iconElement.style.setProperty("color", "transparent");
      iconEl.icon = undefined;
    } else {
      this._iconElement.style.removeProperty("background-image");
      this._iconElement.style.removeProperty("background-repeat");
      this._iconElement.style.removeProperty("background-position");
      this._iconElement.style.removeProperty("background-size");
    }

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
}
