import logging
from homeassistant.core import HomeAssistant, callback
from homeassistant.components.websocket_api import (
    event_message,
    async_register_command,
)
from homeassistant.components import websocket_api
import voluptuous as vol

from .helpers import get_version, resolve_foundries
from .const import (
    DOMAIN,
    WS_CONNECT,
    WS_LOG,
    WS_GET_FOUNDRIES,
    WS_SET_FOUNDRY,
    WS_DELETE_FOUNDRY,
    CONF_FOUNDRIES,
    EVENT_FOUNDRIES_UPDATED,
)

_LOGGER = logging.getLogger(__name__)

async def async_setup_connection(hass: HomeAssistant) -> None:
    version = await hass.async_add_executor_job(get_version, hass)

    @websocket_api.websocket_command(
        {
            vol.Required("type"): WS_CONNECT,
        }
    )
    @websocket_api.async_response
    async def handle_connect(hass: HomeAssistant, connection, msg):
        """Handle a connection request."""

        @callback
        def send_update(data):
            data['version'] = version
            connection.send_message(event_message(msg["id"], {"result": data}))

        @callback
        def on_foundries_updated(event):
            """Push foundry updates to this client via the uix/connect subscription."""
            async def _push():
                try:
                    entries = hass.config_entries.async_entries(DOMAIN)
                    foundries = {}
                    if entries:
                        foundries = dict(entries[0].options.get(CONF_FOUNDRIES, {}))
                    send_update({CONF_FOUNDRIES: await hass.async_add_executor_job(resolve_foundries, hass, foundries)})
                except Exception:
                    _LOGGER.exception("Error pushing foundry update to client")
            hass.async_create_task(_push())

        remove_listener = hass.bus.async_listen(EVENT_FOUNDRIES_UPDATED, on_foundries_updated)

        @callback
        def close_connection():
            remove_listener()

        connection.subscriptions[msg["id"]] = close_connection
        connection.send_result(msg["id"])

        send_update({})
    
    @websocket_api.websocket_command(
        {
            vol.Required("type"): WS_LOG,
            vol.Required("message"): str,
        }
    )
    def handle_log(hass, connection, msg):
        """Print a debug message."""
        _LOGGER.info(f"LOG MESSAGE: {msg['message']}")

    @websocket_api.websocket_command(
        {
            vol.Required("type"): WS_GET_FOUNDRIES,
        }
    )
    @websocket_api.async_response
    async def handle_get_foundries(hass: HomeAssistant, connection, msg):
        """Return all stored foundries."""
        entries = hass.config_entries.async_entries(DOMAIN)
        foundries = {}
        if entries:
            foundries = dict(entries[0].options.get(CONF_FOUNDRIES, {}))
        connection.send_result(msg["id"], {CONF_FOUNDRIES: await hass.async_add_executor_job(resolve_foundries, hass, foundries)})

    @websocket_api.websocket_command(
        {
            vol.Required("type"): WS_SET_FOUNDRY,
            vol.Required("name"): str,
            vol.Required("config"): dict,
        }
    )
    @websocket_api.async_response
    async def handle_set_foundry(hass: HomeAssistant, connection, msg):
        """Create or update a foundry."""
        entries = hass.config_entries.async_entries(DOMAIN)
        if not entries:
            connection.send_error(msg["id"], "no_entry", "No UIX config entry found")
            return
        entry = entries[0]
        foundries = dict(entry.options.get(CONF_FOUNDRIES, {}))
        foundries[msg["name"]] = msg["config"]
        hass.config_entries.async_update_entry(
            entry, options={**entry.options, CONF_FOUNDRIES: foundries}
        )
        hass.bus.async_fire(EVENT_FOUNDRIES_UPDATED, {})
        connection.send_result(msg["id"], {})

    @websocket_api.websocket_command(
        {
            vol.Required("type"): WS_DELETE_FOUNDRY,
            vol.Required("name"): str,
        }
    )
    @websocket_api.async_response
    async def handle_delete_foundry(hass: HomeAssistant, connection, msg):
        """Delete a foundry."""
        entries = hass.config_entries.async_entries(DOMAIN)
        if not entries:
            connection.send_error(msg["id"], "no_entry", "No UIX config entry found")
            return
        entry = entries[0]
        foundries = dict(entry.options.get(CONF_FOUNDRIES, {}))
        if msg["name"] not in foundries:
            connection.send_error(msg["id"], "not_found", f"Foundry '{msg['name']}' not found")
            return
        del foundries[msg["name"]]
        hass.config_entries.async_update_entry(
            entry, options={**entry.options, CONF_FOUNDRIES: foundries}
        )
        hass.bus.async_fire(EVENT_FOUNDRIES_UPDATED, {})
        connection.send_result(msg["id"], {})

    async_register_command(hass, handle_connect)
    async_register_command(hass, handle_log)
    async_register_command(hass, handle_get_foundries)
    async_register_command(hass, handle_set_foundry)
    async_register_command(hass, handle_delete_foundry)