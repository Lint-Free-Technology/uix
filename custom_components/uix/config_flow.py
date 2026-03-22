from typing import Any

import voluptuous as vol

from homeassistant.config_entries import ConfigEntry, ConfigFlow, ConfigFlowResult, OptionsFlow
from homeassistant.helpers import config_validation as cv
from homeassistant.helpers.selector import ObjectSelector

from .checks import (
    check_card_mod_frontend_script_extra_module, 
    check_card_mod_frontend_script_resource
)
from .const import (
    DOMAIN, 
    NAME, 
    CARD_MOD_FRONTEND_SCRIPT_URL,
    CONF_FOUNDRIES,
)

class UixConfigFlow(ConfigFlow, domain=DOMAIN):

    VERSION = 1

    def __init__(self) -> None:
        """Initialize the config flow."""

    async def async_step_user(
        self, user_input: dict[str, Any] | None = None
    ) -> ConfigFlowResult:
        if self._async_current_entries():
            return self.async_abort(reason="single_instance_allowed")
        
        if self.hass.data.get(DOMAIN):
            return self.async_abort(reason="single_instance_allowed")
        
        if await check_card_mod_frontend_script_resource(self.hass):
            return self.async_abort(
                reason="old_frontend_script_resource",
                description_placeholders={"resource": CARD_MOD_FRONTEND_SCRIPT_URL},
            )
        
        if await check_card_mod_frontend_script_extra_module(self.hass):
            return self.async_abort(
                reason="old_frontend_script_extra_module",
                description_placeholders={"resource": CARD_MOD_FRONTEND_SCRIPT_URL},
            )
        
        return self.async_create_entry(
            title=NAME,
            data={},
            description="refresh_message",
        )

    @staticmethod
    def async_get_options_flow(config_entry: ConfigEntry) -> OptionsFlow:
        return UixOptionsFlow(config_entry)


class UixOptionsFlow(OptionsFlow):
    """Options flow for managing UIX foundries."""

    def __init__(self, config_entry: ConfigEntry) -> None:
        """Initialize the options flow."""
        self._config_entry = config_entry
        self._foundries: dict[str, Any] = dict(
            config_entry.options.get(CONF_FOUNDRIES, {})
        )
        self._foundry_name: str | None = None

    async def async_step_init(
        self, user_input: dict[str, Any] | None = None
    ) -> ConfigFlowResult:
        """Show the foundry management menu."""
        return self.async_show_menu(
            step_id="init",
            menu_options=["add_foundry", "delete_foundry"],
        )

    async def async_step_add_foundry(
        self, user_input: dict[str, Any] | None = None
    ) -> ConfigFlowResult:
        """Step 1: collect the foundry name."""
        if user_input is not None:
            self._foundry_name = user_input["name"].strip()
            return await self.async_step_add_foundry_config()

        return self.async_show_form(
            step_id="add_foundry",
            data_schema=vol.Schema(
                {
                    vol.Required("name"): cv.string,
                }
            ),
        )

    async def async_step_add_foundry_config(
        self, user_input: dict[str, Any] | None = None
    ) -> ConfigFlowResult:
        """Step 2: collect (or edit) the foundry configuration."""
        errors: dict[str, str] = {}

        if user_input is not None:
            config = user_input["config"]
            if not isinstance(config, dict):
                errors["config"] = "invalid_config"
            else:
                self._foundries[self._foundry_name] = config
                return self.async_create_entry(
                    title="",
                    data={**self._config_entry.options, CONF_FOUNDRIES: self._foundries},
                )

        existing = self._foundries.get(self._foundry_name)
        return self.async_show_form(
            step_id="add_foundry_config",
            data_schema=vol.Schema(
                {
                    vol.Required("config", default=existing): ObjectSelector(),
                }
            ),
            description_placeholders={"name": self._foundry_name},
            errors=errors,
        )

    async def async_step_delete_foundry(
        self, user_input: dict[str, Any] | None = None
    ) -> ConfigFlowResult:
        """Delete a foundry."""
        errors: dict[str, str] = {}

        if not self._foundries:
            return self.async_abort(reason="no_foundries")

        if user_input is not None:
            name = user_input["name"]
            if name in self._foundries:
                del self._foundries[name]
            return self.async_create_entry(
                title="",
                data={**self._config_entry.options, CONF_FOUNDRIES: self._foundries},
            )

        return self.async_show_form(
            step_id="delete_foundry",
            data_schema=vol.Schema(
                {
                    vol.Required("name"): vol.In(list(self._foundries.keys())),
                }
            ),
            errors=errors,
        )