from typing import Any
from uuid import uuid4
import math
import re

import voluptuous as vol

from homeassistant.config_entries import ConfigEntry, ConfigFlow, ConfigFlowResult, OptionsFlow
from homeassistant.helpers import config_validation as cv
from homeassistant.helpers.selector import (
    BooleanSelector,
    IconSelector,
    NumberSelector,
    NumberSelectorConfig,
    NumberSelectorMode,
    ObjectSelector,
    SelectSelector,
    SelectSelectorConfig,
    SelectSelectorMode,
    TextSelector,
)

from .checks import (
    check_card_mod_frontend_script_extra_module, 
    check_card_mod_frontend_script_resource
)
from .const import (
    CONF_ALWAYS_PATCH_HA_CARD,
    CONF_STYLE_CUSTOM_PANELS,
    CONF_STYLE_FRAME_PANELS,
    DOMAIN, 
    NAME, 
    CARD_MOD_FRONTEND_SCRIPT_URL,
    CONF_FOUNDRIES,
    CONF_ELEMENT_CONFIG,
    CONF_UIX_BROKER,
    CONF_UIX_BROKER_FILES,
    CONF_FOUNDRY_FILES,
    CONF_HASS_THROTTLE_ENABLE,
    CONF_HASS_THROTTLE_MS,
    DEFAULT_HASS_THROTTLE_MS,
    CONF_DIALOG_APPLY_AFTER_SHOW,
    CONF_DISABLE_HASH_TEMPLATE_VARIABLE,
    CONF_DISABLE_ICON_STYLING,
    CONF_DISABLE_ENTITY_PICTURE_IMAGE_OVERRIDE,
    CONF_CUSTOM_SIDEBAR_PANEL_ICON,
    CONF_CUSTOM_SIDEBAR_PANEL_OPEN_IN_NEW_TAB,
    CONF_CUSTOM_SIDEBAR_PANEL_REQUIRE_ADMIN,
    CONF_CUSTOM_SIDEBAR_PANEL_TARGET,
    CONF_CUSTOM_SIDEBAR_PANEL_TITLE,
    CONF_CUSTOM_SIDEBAR_PANELS,
    CUSTOM_SIDEBAR_PANEL_PATH_PREFIX,
    EVENT_FOUNDRIES_UPDATED,
)
from .custom_sidebar_panel import (
    _is_valid_custom_sidebar_panel_target,
    get_custom_sidebar_panels,
)
from .helpers import validate_broker_file, validate_foundry_file


ELEMENT_CONFIG_UIX_TYPES = frozenset({"card", "badge", "heading-badge", "row", "element"})
ELEMENT_CONFIG_KEY_RE = re.compile(r"^[A-Za-z_][A-Za-z0-9_-]*$")
TEMPLATE_TOKENS = ("{{", "}}", "{%", "%}", "{#", "#}")

ELEMENT_CONFIG_TYPE_SELECTOR = SelectSelector(
    SelectSelectorConfig(
        options=[
            {"value": "card", "label": "Card"},
            {"value": "badge", "label": "Badge"},
            {"value": "heading-badge", "label": "Heading badge"},
            {"value": "row", "label": "Entity row"},
            {"value": "element", "label": "Picture element"},
        ],
        mode=SelectSelectorMode.DROPDOWN,
    )
)

ELEMENT_CONFIG_SELECTOR = ObjectSelector(
    {
        "multiple": True,
        "label_field": "uix_type",
        "description_field": "element_type",
        "fields": {
            "uix_type": {
                "label": "UIX element type",
                "required": True,
                "selector": ELEMENT_CONFIG_TYPE_SELECTOR,
            },
            "element_type": {
                "label": "Element type (card type, badge type etc.)",
                "required": True,
                "selector": TextSelector(),
            },
            "config_key": {
                "label": "Configuration key to set default value",
                "required": True,
                "selector": TextSelector(),
            },
            "value": {
                "label": "Default value",
                "required": True,
                "selector": ObjectSelector(),
            },
        },
    }
)


def _is_static_element_config_value(value: Any) -> bool:
    if value is None or isinstance(value, (bool, int)):
        return True
    if isinstance(value, float):
        return math.isfinite(value)
    if isinstance(value, str):
        return not any(token in value for token in TEMPLATE_TOKENS)
    if isinstance(value, list):
        return all(_is_static_element_config_value(item) for item in value)
    if isinstance(value, dict):
        return all(
            isinstance(key, str) and _is_static_element_config_value(child)
            for key, child in value.items()
        )
    return False


def _valid_element_config_rules(value: Any) -> bool:
    if not isinstance(value, list):
        return False
    seen: set[tuple[str, str, str]] = set()
    for rule in value:
        if not isinstance(rule, dict):
            return False
        uix_type = rule.get("uix_type")
        element_type = rule.get("element_type")
        config_key = rule.get("config_key")
        if (
            not isinstance(uix_type, str)
            or uix_type not in ELEMENT_CONFIG_UIX_TYPES
            or not isinstance(element_type, str)
            or not element_type
            or not isinstance(config_key, str)
            or not ELEMENT_CONFIG_KEY_RE.fullmatch(config_key)
            or config_key in {"__proto__", "constructor", "prototype"}
            or "value" not in rule
            or not _is_static_element_config_value(rule["value"])
        ):
            return False
        key = (uix_type, element_type, config_key)
        if key in seen:
            return False
        seen.add(key)
    return True


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
    """Options flow for configuring UIX."""

    def __init__(self, config_entry: ConfigEntry) -> None:
        """Initialize the options flow."""
        self._config_entry = config_entry
        self._foundries: dict[str, Any] = dict(
            config_entry.options.get(CONF_FOUNDRIES, {})
        )
        self._foundry_files: list[str] = list(
            config_entry.options.get(CONF_FOUNDRY_FILES, [])
        )
        self._broker_files: list[str] = list(
            config_entry.options.get(CONF_UIX_BROKER_FILES, [])
        )
        self._custom_sidebar_panels = get_custom_sidebar_panels(config_entry.options)
        self._foundry_name: str | None = None
        self._custom_sidebar_panel_id: str | None = None

    async def async_step_init(
        self, user_input: dict[str, Any] | None = None
    ) -> ConfigFlowResult:
        """Show the top-level UIX settings menu."""
        return self.async_show_menu(
            step_id="init",
            menu_options=[
                "foundry_menu",
                "foundry_file_menu",
                "element_config",
                "broker_settings",
                "broker_file_menu",
                "custom_sidebar_panel_menu",
                "performance_settings",
                "experimental_settings",
            ],
            description_placeholders={
                "foundries_docs_link": "[Foundries documentation](https://uix.lf.technology/forge/foundries)",
            },
        )

    def _custom_sidebar_panel_choices(self) -> dict[str, str]:
        """Return panel IDs mapped to human-readable choice labels."""
        return {
            panel_id: (
                f"{panel[CONF_CUSTOM_SIDEBAR_PANEL_TITLE]} "
                f"→ {panel[CONF_CUSTOM_SIDEBAR_PANEL_TARGET]}"
            )
            for panel_id, panel in self._custom_sidebar_panels.items()
        }

    @staticmethod
    def _validate_custom_sidebar_panel(
        user_input: dict[str, Any], errors: dict[str, str]
    ) -> dict[str, Any] | None:
        """Validate and normalize custom sidebar panel form input."""
        icon = user_input[CONF_CUSTOM_SIDEBAR_PANEL_ICON]
        open_in_new_tab = user_input[CONF_CUSTOM_SIDEBAR_PANEL_OPEN_IN_NEW_TAB]
        require_admin = user_input[CONF_CUSTOM_SIDEBAR_PANEL_REQUIRE_ADMIN]
        title = user_input[CONF_CUSTOM_SIDEBAR_PANEL_TITLE].strip()
        target = user_input[CONF_CUSTOM_SIDEBAR_PANEL_TARGET]
        if not isinstance(icon, str) or not icon:
            errors[CONF_CUSTOM_SIDEBAR_PANEL_ICON] = "invalid_custom_sidebar_panel"
        if not isinstance(open_in_new_tab, bool):
            errors[CONF_CUSTOM_SIDEBAR_PANEL_OPEN_IN_NEW_TAB] = (
                "invalid_custom_sidebar_panel"
            )
        if not isinstance(require_admin, bool):
            errors[CONF_CUSTOM_SIDEBAR_PANEL_REQUIRE_ADMIN] = "invalid_custom_sidebar_panel"
        if not title:
            errors[CONF_CUSTOM_SIDEBAR_PANEL_TITLE] = "invalid_custom_sidebar_panel"
        if not _is_valid_custom_sidebar_panel_target(target):
            errors[CONF_CUSTOM_SIDEBAR_PANEL_TARGET] = "invalid_custom_sidebar_panel"
        if errors:
            return None
        return {
            CONF_CUSTOM_SIDEBAR_PANEL_ICON: icon,
            CONF_CUSTOM_SIDEBAR_PANEL_OPEN_IN_NEW_TAB: open_in_new_tab,
            CONF_CUSTOM_SIDEBAR_PANEL_REQUIRE_ADMIN: require_admin,
            CONF_CUSTOM_SIDEBAR_PANEL_TARGET: target,
            CONF_CUSTOM_SIDEBAR_PANEL_TITLE: title,
        }

    def _custom_sidebar_panel_schema(
        self, panel: dict[str, Any] | None = None
    ) -> vol.Schema:
        """Build the create or edit form schema for a sidebar redirect panel."""
        icon = vol.Required(CONF_CUSTOM_SIDEBAR_PANEL_ICON)
        open_in_new_tab = vol.Required(
            CONF_CUSTOM_SIDEBAR_PANEL_OPEN_IN_NEW_TAB, default=False
        )
        require_admin = vol.Required(
            CONF_CUSTOM_SIDEBAR_PANEL_REQUIRE_ADMIN, default=False
        )
        title = vol.Required(CONF_CUSTOM_SIDEBAR_PANEL_TITLE)
        target = vol.Required(CONF_CUSTOM_SIDEBAR_PANEL_TARGET, default="/")
        if panel is not None:
            icon = vol.Required(
                CONF_CUSTOM_SIDEBAR_PANEL_ICON,
                default=panel[CONF_CUSTOM_SIDEBAR_PANEL_ICON],
            )
            open_in_new_tab = vol.Required(
                CONF_CUSTOM_SIDEBAR_PANEL_OPEN_IN_NEW_TAB,
                default=panel.get(CONF_CUSTOM_SIDEBAR_PANEL_OPEN_IN_NEW_TAB, False),
            )
            require_admin = vol.Required(
                CONF_CUSTOM_SIDEBAR_PANEL_REQUIRE_ADMIN,
                default=panel[CONF_CUSTOM_SIDEBAR_PANEL_REQUIRE_ADMIN],
            )
            title = vol.Required(
                CONF_CUSTOM_SIDEBAR_PANEL_TITLE,
                default=panel[CONF_CUSTOM_SIDEBAR_PANEL_TITLE],
            )
            target = vol.Required(
                CONF_CUSTOM_SIDEBAR_PANEL_TARGET,
                default=panel[CONF_CUSTOM_SIDEBAR_PANEL_TARGET],
            )
        return vol.Schema(
            {
                icon: IconSelector(),
                open_in_new_tab: BooleanSelector(),
                require_admin: BooleanSelector(),
                title: TextSelector(),
                target: TextSelector(),
            }
        )

    async def async_step_custom_sidebar_panel_menu(
        self, user_input: dict[str, Any] | None = None
    ) -> ConfigFlowResult:
        """Show the custom sidebar panel management menu."""
        panels_list = "\n".join(
            f"- {label}" for label in self._custom_sidebar_panel_choices().values()
        ) or "_None_"
        return self.async_show_menu(
            step_id="custom_sidebar_panel_menu",
            menu_options=[
                "add_custom_sidebar_panel",
                "edit_custom_sidebar_panel",
                "delete_custom_sidebar_panel",
            ],
            description_placeholders={"panels_list": panels_list},
        )

    async def async_step_add_custom_sidebar_panel(
        self, user_input: dict[str, Any] | None = None
    ) -> ConfigFlowResult:
        """Create a custom sidebar redirect panel."""
        errors: dict[str, str] = {}
        if user_input is not None:
            panel = self._validate_custom_sidebar_panel(user_input, errors)
            if panel is not None:
                panel_id = f"{CUSTOM_SIDEBAR_PANEL_PATH_PREFIX}{uuid4().hex}"
                self._custom_sidebar_panels[panel_id] = panel
                return self.async_create_entry(
                    title="",
                    data={
                        **self._config_entry.options,
                        CONF_CUSTOM_SIDEBAR_PANELS: self._custom_sidebar_panels,
                    },
                )

        return self.async_show_form(
            step_id="add_custom_sidebar_panel",
            data_schema=self._custom_sidebar_panel_schema(),
            errors=errors,
        )

    async def async_step_edit_custom_sidebar_panel(
        self, user_input: dict[str, Any] | None = None
    ) -> ConfigFlowResult:
        """Select a custom sidebar redirect panel to edit."""
        if not self._custom_sidebar_panels:
            return self.async_abort(reason="no_custom_sidebar_panels")

        if user_input is not None:
            self._custom_sidebar_panel_id = user_input["panel_id"]
            return await self.async_step_edit_custom_sidebar_panel_config()

        return self.async_show_form(
            step_id="edit_custom_sidebar_panel",
            data_schema=vol.Schema(
                {
                    vol.Required("panel_id"): vol.In(
                        self._custom_sidebar_panel_choices()
                    ),
                }
            ),
        )

    async def async_step_edit_custom_sidebar_panel_config(
        self, user_input: dict[str, Any] | None = None
    ) -> ConfigFlowResult:
        """Update a custom sidebar redirect panel."""
        errors: dict[str, str] = {}
        panel_id = self._custom_sidebar_panel_id
        if panel_id not in self._custom_sidebar_panels:
            return self.async_abort(reason="no_custom_sidebar_panels")

        if user_input is not None:
            panel = self._validate_custom_sidebar_panel(user_input, errors)
            if panel is not None:
                self._custom_sidebar_panels[panel_id] = panel
                return self.async_create_entry(
                    title="",
                    data={
                        **self._config_entry.options,
                        CONF_CUSTOM_SIDEBAR_PANELS: self._custom_sidebar_panels,
                    },
                )

        return self.async_show_form(
            step_id="edit_custom_sidebar_panel_config",
            data_schema=self._custom_sidebar_panel_schema(
                self._custom_sidebar_panels[panel_id]
            ),
            description_placeholders={
                "name": self._custom_sidebar_panels[panel_id][
                    CONF_CUSTOM_SIDEBAR_PANEL_TITLE
                ]
            },
            errors=errors,
        )

    async def async_step_delete_custom_sidebar_panel(
        self, user_input: dict[str, Any] | None = None
    ) -> ConfigFlowResult:
        """Delete a custom sidebar redirect panel."""
        if not self._custom_sidebar_panels:
            return self.async_abort(reason="no_custom_sidebar_panels")

        if user_input is not None:
            self._custom_sidebar_panels.pop(user_input["panel_id"], None)
            return self.async_create_entry(
                title="",
                data={
                    **self._config_entry.options,
                    CONF_CUSTOM_SIDEBAR_PANELS: self._custom_sidebar_panels,
                },
            )

        return self.async_show_form(
            step_id="delete_custom_sidebar_panel",
            data_schema=vol.Schema(
                {
                    vol.Required("panel_id"): vol.In(
                        self._custom_sidebar_panel_choices()
                    ),
                }
            ),
        )

    async def async_step_foundry_menu(
        self, user_input: dict[str, Any] | None = None
    ) -> ConfigFlowResult:
        """Show the UI foundry sub-menu with the loaded foundries list."""
        foundries_list = "\n".join(
            f"- {name}" for name in self._foundries
        ) or "_None_"
        return self.async_show_menu(
            step_id="foundry_menu",
            menu_options=[
                "add_foundry",
                "edit_foundry",
                "delete_foundry",
            ],
            description_placeholders={
                "foundries_docs_link": "[Foundries documentation](https://uix.lf.technology/forge/foundries)",
                "foundries_list": foundries_list,
            },
        )

    async def async_step_foundry_file_menu(
        self, user_input: dict[str, Any] | None = None
    ) -> ConfigFlowResult:
        """Show the foundry-file sub-menu with the registered files list."""
        foundry_files_list = "\n".join(
            f"- {f}" for f in self._foundry_files
        ) or "_None_"
        return self.async_show_menu(
            step_id="foundry_file_menu",
            menu_options=[
                "register_foundry_file",
                "deregister_foundry_file",
                "reload_foundry_files",
            ],
            description_placeholders={
                "foundries_docs_link": "[Foundries documentation](https://uix.lf.technology/forge/foundries)",
                "foundry_files_list": foundry_files_list,
            },
        )

    async def async_step_performance_settings(
        self, user_input: dict[str, Any] | None = None
    ) -> ConfigFlowResult:
        """Configure performance settings."""
        if user_input is not None:
            return self.async_create_entry(
                title="",
                data={
                    **self._config_entry.options,
                    CONF_HASS_THROTTLE_ENABLE: user_input[CONF_HASS_THROTTLE_ENABLE],
                    CONF_HASS_THROTTLE_MS: int(user_input[CONF_HASS_THROTTLE_MS]),
                    CONF_DIALOG_APPLY_AFTER_SHOW: user_input[CONF_DIALOG_APPLY_AFTER_SHOW],
                    CONF_DISABLE_HASH_TEMPLATE_VARIABLE: user_input[CONF_DISABLE_HASH_TEMPLATE_VARIABLE],
                    CONF_DISABLE_ICON_STYLING: user_input[CONF_DISABLE_ICON_STYLING],
                    CONF_DISABLE_ENTITY_PICTURE_IMAGE_OVERRIDE: user_input[CONF_DISABLE_ENTITY_PICTURE_IMAGE_OVERRIDE],
                },
            )

        return self.async_show_form(
            step_id="performance_settings",
            data_schema=vol.Schema(
                {
                    vol.Optional(
                        CONF_HASS_THROTTLE_ENABLE,
                        default=self._config_entry.options.get(CONF_HASS_THROTTLE_ENABLE, False),
                    ): BooleanSelector(),
                    vol.Optional(
                        CONF_HASS_THROTTLE_MS,
                        default=self._config_entry.options.get(CONF_HASS_THROTTLE_MS, DEFAULT_HASS_THROTTLE_MS),
                    ): NumberSelector(
                        NumberSelectorConfig(
                            min=50,
                            max=10000,
                            step=50,
                            unit_of_measurement="ms",
                            mode=NumberSelectorMode.BOX,
                        )
                    ),
                    vol.Optional(
                        CONF_DIALOG_APPLY_AFTER_SHOW,
                        default=self._config_entry.options.get(CONF_DIALOG_APPLY_AFTER_SHOW, False),
                    ): BooleanSelector(),
                    vol.Optional(
                        CONF_DISABLE_HASH_TEMPLATE_VARIABLE,
                        default=self._config_entry.options.get(CONF_DISABLE_HASH_TEMPLATE_VARIABLE, False),
                    ): BooleanSelector(),
                    vol.Optional(
                        CONF_DISABLE_ICON_STYLING,
                        default=self._config_entry.options.get(CONF_DISABLE_ICON_STYLING, False),
                    ): BooleanSelector(),
                    vol.Optional(
                        CONF_DISABLE_ENTITY_PICTURE_IMAGE_OVERRIDE,
                        default=self._config_entry.options.get(CONF_DISABLE_ENTITY_PICTURE_IMAGE_OVERRIDE, False),
                    ): BooleanSelector(),
                }
            ),
        )

    async def async_step_broker_file_menu(
        self, user_input: dict[str, Any] | None = None
    ) -> ConfigFlowResult:
        """Show the Broker-file sub-menu with registered file paths."""
        broker_files_list = "\n".join(f"- {path}" for path in self._broker_files) or "_None_"
        return self.async_show_menu(
            step_id="broker_file_menu",
            menu_options=[
                "register_broker_file",
                "deregister_broker_file",
                "reload_broker_files",
            ],
            description_placeholders={"broker_files_list": broker_files_list},
        )

    async def async_step_broker_settings(
        self, user_input: dict[str, Any] | None = None
    ) -> ConfigFlowResult:
        """Configure the global UIX Broker interaction list."""
        errors: dict[str, str] = {}
        if user_input is not None:
            config = user_input[CONF_UIX_BROKER]
            if not isinstance(config, dict) or not isinstance(config.get(CONF_UIX_BROKER), list):
                errors[CONF_UIX_BROKER] = "invalid_broker_config"
            else:
                return self.async_create_entry(
                    title="",
                    data={
                        **self._config_entry.options,
                        CONF_UIX_BROKER: config[CONF_UIX_BROKER],
                    },
                )

        return self.async_show_form(
            step_id="broker_settings",
            data_schema=vol.Schema(
                {
                    vol.Required(
                        CONF_UIX_BROKER,
                        default={CONF_UIX_BROKER: self._config_entry.options.get(CONF_UIX_BROKER, [])},
                    ): ObjectSelector(),
                }
            ),
            errors=errors,
        )

    async def async_step_element_config(
        self, user_input: dict[str, Any] | None = None
    ) -> ConfigFlowResult:
        """Choose an editor for static Lovelace element defaults."""
        return self.async_show_menu(
            step_id="element_config",
            menu_options=["element_config_ui", "element_config_yaml"],
        )

    def _async_create_element_config_entry(self, rules: list[dict[str, Any]]) -> ConfigFlowResult:
        """Save validated static Lovelace element defaults."""
        return self.async_create_entry(
            title="",
            data={
                **self._config_entry.options,
                CONF_ELEMENT_CONFIG: rules,
            },
        )

    async def async_step_element_config_ui(
        self, user_input: dict[str, Any] | None = None
    ) -> ConfigFlowResult:
        """Configure static Lovelace element defaults with form fields."""
        errors: dict[str, str] = {}
        if user_input is not None:
            rules = user_input[CONF_ELEMENT_CONFIG]
            if not _valid_element_config_rules(rules):
                errors[CONF_ELEMENT_CONFIG] = "invalid_element_config"
            else:
                return self._async_create_element_config_entry(rules)

        return self.async_show_form(
            step_id="element_config_ui",
            data_schema=vol.Schema(
                {
                    vol.Required(
                        CONF_ELEMENT_CONFIG,
                        default=self._config_entry.options.get(CONF_ELEMENT_CONFIG, []),
                    ): ELEMENT_CONFIG_SELECTOR,
                }
            ),
            errors=errors,
        )

    async def async_step_element_config_yaml(
        self, user_input: dict[str, Any] | None = None
    ) -> ConfigFlowResult:
        """Configure static Lovelace element defaults with YAML."""
        errors: dict[str, str] = {}
        if user_input is not None:
            config = user_input[CONF_ELEMENT_CONFIG]
            rules = config.get(CONF_ELEMENT_CONFIG) if isinstance(config, dict) else None
            if not _valid_element_config_rules(rules):
                errors[CONF_ELEMENT_CONFIG] = "invalid_element_config"
            else:
                return self._async_create_element_config_entry(rules)

        return self.async_show_form(
            step_id="element_config_yaml",
            data_schema=vol.Schema(
                {
                    vol.Required(
                        CONF_ELEMENT_CONFIG,
                        default={CONF_ELEMENT_CONFIG: self._config_entry.options.get(CONF_ELEMENT_CONFIG, [])},
                    ): ObjectSelector(),
                }
            ),
            errors=errors,
        )

    async def async_step_experimental_settings(
        self, user_input: dict[str, Any] | None = None
    ) -> ConfigFlowResult:
        """Configure experimental settings."""
        if user_input is not None:
            return self.async_create_entry(
                title="",
                data={
                    **self._config_entry.options,
                    CONF_ALWAYS_PATCH_HA_CARD: user_input[CONF_ALWAYS_PATCH_HA_CARD],
                    CONF_STYLE_FRAME_PANELS: user_input[CONF_STYLE_FRAME_PANELS],
                },
            )

        return self.async_show_form(
            step_id="experimental_settings",
            data_schema=vol.Schema(
                {
                    vol.Optional(
                        CONF_ALWAYS_PATCH_HA_CARD,
                        default=self._config_entry.options.get(CONF_ALWAYS_PATCH_HA_CARD, False),
                    ): BooleanSelector(),
                    vol.Optional(
                        CONF_STYLE_FRAME_PANELS,
                        default=self._config_entry.options.get(
                            CONF_STYLE_FRAME_PANELS,
                            self._config_entry.options.get(CONF_STYLE_CUSTOM_PANELS, False),
                        ),
                    ): BooleanSelector(),
                }
            ),
        )

    async def async_step_register_broker_file(
        self, user_input: dict[str, Any] | None = None
    ) -> ConfigFlowResult:
        """Register a YAML file containing Broker interactions."""
        errors: dict[str, str] = {}
        if user_input is not None:
            file_path: str = user_input["file_path"].strip()
            if file_path in self._broker_files:
                errors["file_path"] = "broker_file_already_added"
            else:
                error_key = await self.hass.async_add_executor_job(
                    validate_broker_file, self.hass, file_path
                )
                if error_key is not None:
                    errors["file_path"] = error_key
                else:
                    self._broker_files.append(file_path)
                    return self.async_create_entry(
                        title="",
                        data={
                            **self._config_entry.options,
                            CONF_UIX_BROKER_FILES: self._broker_files,
                        },
                    )

        return self.async_show_form(
            step_id="register_broker_file",
            data_schema=vol.Schema({vol.Required("file_path"): cv.string}),
            errors=errors,
        )

    async def async_step_deregister_broker_file(
        self, user_input: dict[str, Any] | None = None
    ) -> ConfigFlowResult:
        """Deregister a Broker file without deleting it."""
        if not self._broker_files:
            return self.async_abort(reason="no_broker_files")
        if user_input is not None:
            file_path = user_input["file_path"]
            if file_path in self._broker_files:
                self._broker_files.remove(file_path)
            return self.async_create_entry(
                title="",
                data={
                    **self._config_entry.options,
                    CONF_UIX_BROKER_FILES: self._broker_files,
                },
            )

        return self.async_show_form(
            step_id="deregister_broker_file",
            data_schema=vol.Schema({vol.Required("file_path"): vol.In(self._broker_files)}),
        )

    async def async_step_reload_broker_files(
        self, user_input: dict[str, Any] | None = None
    ) -> ConfigFlowResult:
        """Re-read registered Broker files and push the merged configuration."""
        self.hass.bus.async_fire(EVENT_FOUNDRIES_UPDATED, {})
        return self.async_create_entry(title="", data=self._config_entry.options)

    async def async_step_add_foundry(
        self, user_input: dict[str, Any] | None = None
    ) -> ConfigFlowResult:
        """Add a new foundry (name + config in one form)."""
        errors: dict[str, str] = {}

        if user_input is not None:
            name = user_input["name"].strip()
            config = user_input["config"]
            if not isinstance(config, dict):
                errors["config"] = "invalid_config"
            else:
                self._foundries[name] = config
                return self.async_create_entry(
                    title="",
                    data={**self._config_entry.options, CONF_FOUNDRIES: self._foundries},
                )

        return self.async_show_form(
            step_id="add_foundry",
            data_schema=vol.Schema(
                {
                    vol.Required("name"): cv.string,
                    vol.Required("config"): ObjectSelector(),
                }
            ),
            errors=errors,
        )

    async def async_step_edit_foundry(
        self, user_input: dict[str, Any] | None = None
    ) -> ConfigFlowResult:
        """Step 1: select an existing foundry to edit."""
        if not self._foundries:
            return self.async_abort(reason="no_foundries")

        if user_input is not None:
            self._foundry_name = user_input["name"]
            return await self.async_step_edit_foundry_config()

        return self.async_show_form(
            step_id="edit_foundry",
            data_schema=vol.Schema(
                {
                    vol.Required("name"): vol.In(list(self._foundries.keys())),
                }
            ),
        )

    async def async_step_edit_foundry_config(
        self, user_input: dict[str, Any] | None = None
    ) -> ConfigFlowResult:
        """Step 2: edit the selected foundry's configuration."""
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
            step_id="edit_foundry_config",
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

    async def async_step_register_foundry_file(
        self, user_input: dict[str, Any] | None = None
    ) -> ConfigFlowResult:
        """Register a foundry YAML file path."""
        errors: dict[str, str] = {}

        if user_input is not None:
            file_path: str = user_input["file_path"].strip()
            if file_path in self._foundry_files:
                errors["file_path"] = "file_already_added"
            else:
                error_key = await self.hass.async_add_executor_job(
                    validate_foundry_file, self.hass, file_path
                )
                if error_key is not None:
                    errors["file_path"] = error_key
                else:
                    self._foundry_files.append(file_path)
                    return self.async_create_entry(
                        title="",
                        data={
                            **self._config_entry.options,
                            CONF_FOUNDRY_FILES: self._foundry_files,
                        },
                    )

        return self.async_show_form(
            step_id="register_foundry_file",
            data_schema=vol.Schema(
                {
                    vol.Required("file_path"): cv.string,
                }
            ),
            errors=errors,
        )

    async def async_step_deregister_foundry_file(
        self, user_input: dict[str, Any] | None = None
    ) -> ConfigFlowResult:
        """Deregister a foundry YAML file path."""
        if not self._foundry_files:
            return self.async_abort(reason="no_foundry_files")

        if user_input is not None:
            file_path = user_input["file_path"]
            if file_path in self._foundry_files:
                self._foundry_files.remove(file_path)
            return self.async_create_entry(
                title="",
                data={
                    **self._config_entry.options,
                    CONF_FOUNDRY_FILES: self._foundry_files,
                },
            )

        return self.async_show_form(
            step_id="deregister_foundry_file",
            data_schema=vol.Schema(
                {
                    vol.Required("file_path"): vol.In(self._foundry_files),
                }
            ),
        )

    async def async_step_reload_foundry_files(
        self, user_input: dict[str, Any] | None = None
    ) -> ConfigFlowResult:
        """Reload all foundry YAML files and push updates to connected clients."""
        self.hass.bus.async_fire(EVENT_FOUNDRIES_UPDATED, {})
        return self.async_create_entry(
            title="",
            data=self._config_entry.options,
        )
