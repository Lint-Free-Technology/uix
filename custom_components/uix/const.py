DOMAIN = "uix"
NAME = "UI eXtension for Home Assistant"

CARD_MOD_FRONTEND_SCRIPT_URL = "card-mod.js"
FRONTEND_SCRIPT_URL = "uix.js"

DATA_EXTRA_MODULE_URL = "frontend_extra_module_url"

WS_CONNECT = f"{DOMAIN}/connect"
WS_LOG = f"{DOMAIN}/log"

CONF_FOUNDRIES = "foundries"

WS_GET_FOUNDRIES = f"{DOMAIN}/get_foundries"
WS_SET_FOUNDRY = f"{DOMAIN}/set_foundry"
WS_DELETE_FOUNDRY = f"{DOMAIN}/delete_foundry"

EVENT_FOUNDRIES_UPDATED = f"{DOMAIN}_foundries_updated"