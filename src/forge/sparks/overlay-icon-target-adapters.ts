/** Pixel offsets used as the default icon position for a target element type. */
export interface AdapterIconPosition {
  top?: string;
  bottom?: string;
  left?: string;
  right?: string;
}

export interface OverlayIconTargetAdapter {
  /** Returns the default overlay icon size for this target element type. */
  defaultIconSize(): string;
  /** Returns the default icon padding for this target element type, or `null` for no override. */
  defaultIconPadding(): string | null;
  /** Returns the default icon border-radius for this target element type, or `null` for no override. */
  defaultIconBorderRadius(): string | null;
  /** Returns the default icon position for this target element type, or `null` for no override. */
  defaultIconPosition(): AdapterIconPosition | null;
  /** Returns the default icon color for this target element type. */
  defaultIconColor(): string;
  /** Returns the default icon background for this target element type, or `null` for no override. */
  defaultIconBackground(): string | null;
}

const TILE_ICON_DEFAULT_ICON_POSITION = { top: "2px", left: "30px" } as const;

/**
 * Returns an adapter for the given target element, or `null` if no special
 * handling is required for this element type.
 */
export function getOverlayIconTargetAdapter(element: HTMLElement): OverlayIconTargetAdapter | null {
  switch (element.tagName.toLowerCase()) {
    case "ha-tile-icon":
      return new HaTileIconOverlayIconAdapter();
    case "hui-generic-entity-row":
      return new HuiGenericEntityRowOverlayIconAdapter();
    default:
      return null;
  }
}

class HaTileIconOverlayIconAdapter implements OverlayIconTargetAdapter {
  defaultIconSize(): string {
    return "12px";
  }

  defaultIconPadding(): string | null {
    return "2px";
  }

  defaultIconBorderRadius(): string | null {
    return "50%";
  }

  defaultIconPosition(): AdapterIconPosition | null {
    // Move to the right of the tile icon, similar to tile badges.
    return { ...TILE_ICON_DEFAULT_ICON_POSITION };
  }

  defaultIconColor(): string {
    return "var(--white-color, #ffffff)";
  }

  defaultIconBackground(): string | null {
    return "var(--primary-color, #03a9f4)";
  }
}

class HuiGenericEntityRowOverlayIconAdapter implements OverlayIconTargetAdapter {
  defaultIconSize(): string {
    return "24px";
  }

  defaultIconPadding(): string | null {
    return null;
  }

  defaultIconBorderRadius(): string | null {
    return null;
  }

  defaultIconPosition(): AdapterIconPosition | null {
    return null;
  }

  defaultIconColor(): string {
    return "var(--primary-color, #03a9f4)";
  }

  defaultIconBackground(): string | null {
    return null;
  }
}
