import { UIX_FORGE_TYPE } from "../forge/uix-forge-types";
import { patch_element } from "../helpers/patch_function";

const badgeForgeConfig = (config: any): any => {
  if (config?.type !== UIX_FORGE_TYPE && config?.type !== `custom:${UIX_FORGE_TYPE}`) return config;
  return {
    ...config,
    forge: { ...config.forge, mold: "badge" },
  };
};

@patch_element("hui-badge-picker")
class HuiBadgePickerPatch extends HTMLElement {
  /**
   * Home Assistant obtains custom-card and custom-badge stubs through the
   * element class' static getStubConfig(), which has no picker context. UIX
   * Forge therefore exposes one canonical type and corrects its card-shaped
   * static stub only at the picker boundaries.
   */
  _badgePicked(_orig, event: Event, ...rest) {
    const target = event.currentTarget as { config?: any } | null;
    const config = target?.config;
    const badgeConfig = badgeForgeConfig(config);
    if (badgeConfig === config) return _orig?.(event, ...rest);

    target!.config = badgeConfig;
    try {
      return _orig?.(event, ...rest);
    } finally {
      target!.config = config;
    }
  }

  _tryCreateBadgeElement(_orig, config, ...rest) {
    return _orig?.(badgeForgeConfig(config), ...rest);
  }
}
