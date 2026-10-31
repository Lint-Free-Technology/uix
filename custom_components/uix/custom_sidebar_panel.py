"""Register configurable UIX sidebar redirect panels."""

from collections.abc import Mapping
from typing import Any

from homeassistant.components import frontend
from homeassistant.core import HomeAssistant

from .const import (
    CONF_CUSTOM_SIDEBAR_PANEL_ICON,
    CONF_CUSTOM_SIDEBAR_PANEL_REQUIRE_ADMIN,
    CONF_CUSTOM_SIDEBAR_PANEL_TARGET,
    CONF_CUSTOM_SIDEBAR_PANEL_TITLE,
    CONF_CUSTOM_SIDEBAR_PANELS,
    CUSTOM_SIDEBAR_PANEL_COMPONENT,
    CUSTOM_SIDEBAR_PANEL_PATH_PREFIX,
    DATA_CUSTOM_SIDEBAR_PANELS,
    DOMAIN,
    FRONTEND_SCRIPT_CUSTOM_SIDEBAR_PANEL,
)
from .frontend import async_get_frontend_asset_snapshot


def get_custom_sidebar_panels(options: Mapping[str, Any]) -> dict[str, dict[str, Any]]:
    """Return valid custom sidebar panel configuration from entry options."""
    panels = options.get(CONF_CUSTOM_SIDEBAR_PANELS, {})
    if not isinstance(panels, dict):
        return {}

    valid_panels: dict[str, dict[str, Any]] = {}
    for panel_id, panel in panels.items():
        if (
            not isinstance(panel_id, str)
            or not panel_id.startswith(CUSTOM_SIDEBAR_PANEL_PATH_PREFIX)
            or not isinstance(panel, dict)
            or not all(
                isinstance(panel.get(field), str) and panel[field]
                for field in (
                    CONF_CUSTOM_SIDEBAR_PANEL_ICON,
                    CONF_CUSTOM_SIDEBAR_PANEL_TARGET,
                    CONF_CUSTOM_SIDEBAR_PANEL_TITLE,
                )
            )
            or panel[CONF_CUSTOM_SIDEBAR_PANEL_TARGET].startswith("//")
        ):
            continue

        require_admin = panel.get(CONF_CUSTOM_SIDEBAR_PANEL_REQUIRE_ADMIN, False)
        if not isinstance(require_admin, bool):
            continue

        valid_panels[panel_id] = {
            CONF_CUSTOM_SIDEBAR_PANEL_ICON: panel[CONF_CUSTOM_SIDEBAR_PANEL_ICON],
            CONF_CUSTOM_SIDEBAR_PANEL_REQUIRE_ADMIN: require_admin,
            CONF_CUSTOM_SIDEBAR_PANEL_TARGET: panel[CONF_CUSTOM_SIDEBAR_PANEL_TARGET],
            CONF_CUSTOM_SIDEBAR_PANEL_TITLE: panel[CONF_CUSTOM_SIDEBAR_PANEL_TITLE],
        }

    return valid_panels


async def async_sync_custom_sidebar_panels(
    hass: HomeAssistant, options: Mapping[str, Any]
) -> None:
    """Reconcile sidebar redirect panels with the current entry options."""
    configured_panels = get_custom_sidebar_panels(options)
    registered_panels: set[str] = hass.data.setdefault(DATA_CUSTOM_SIDEBAR_PANELS, set())

    for panel_id in registered_panels - configured_panels.keys():
        frontend.async_remove_panel(hass, panel_id, warn_if_unknown=False)

    asset_snapshot = await async_get_frontend_asset_snapshot(hass)
    module_url = f"/{DOMAIN}/{FRONTEND_SCRIPT_CUSTOM_SIDEBAR_PANEL}?v={asset_snapshot.version}"
    for panel_id, panel in configured_panels.items():
        frontend.async_register_built_in_panel(
            hass,
            "custom",
            frontend_url_path=panel_id,
            sidebar_title=panel[CONF_CUSTOM_SIDEBAR_PANEL_TITLE],
            sidebar_icon=panel[CONF_CUSTOM_SIDEBAR_PANEL_ICON],
            require_admin=panel[CONF_CUSTOM_SIDEBAR_PANEL_REQUIRE_ADMIN],
            config={
                CONF_CUSTOM_SIDEBAR_PANEL_TARGET: panel[CONF_CUSTOM_SIDEBAR_PANEL_TARGET],
                "_panel_custom": {
                    "name": CUSTOM_SIDEBAR_PANEL_COMPONENT,
                    "embed_iframe": False,
                    "trust_external": False,
                    "module_url": module_url,
                },
            },
            update=panel_id in registered_panels,
        )

    registered_panels.clear()
    registered_panels.update(configured_panels)


def async_remove_custom_sidebar_panels(hass: HomeAssistant) -> None:
    """Remove all sidebar redirect panels owned by UIX."""
    registered_panels: set[str] = hass.data.pop(DATA_CUSTOM_SIDEBAR_PANELS, set())
    for panel_id in registered_panels:
        frontend.async_remove_panel(hass, panel_id, warn_if_unknown=False)
