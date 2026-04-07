import json
import os
import re
import yaml
from homeassistant.core import HomeAssistant

from .const import DOMAIN

def get_version(hass: HomeAssistant):
    with open(hass.config.path(f"custom_components/{DOMAIN}/manifest.json"), "r") as fp:
        manifest = json.load(fp)
        return manifest["version"]

_SECRET_RE = re.compile(r"^!secret\s+(\S+)\s*$")

def load_secrets(hass: HomeAssistant) -> dict:
    """Load and return the contents of secrets.yaml, or an empty dict if unavailable."""
    try:
        secrets_path = hass.config.path("secrets.yaml")
        if not os.path.exists(secrets_path):
            return {}
        with open(secrets_path, "r") as fp:
            return yaml.safe_load(fp) or {}
    except Exception:
        return {}

def resolve_secrets_in_config(config, secrets: dict):
    """Recursively replace ``!secret <name>`` string values with their resolved secrets."""
    if isinstance(config, dict):
        return {k: resolve_secrets_in_config(v, secrets) for k, v in config.items()}
    if isinstance(config, list):
        return [resolve_secrets_in_config(item, secrets) for item in config]
    if isinstance(config, str):
        match = _SECRET_RE.match(config)
        if match:
            secret_name = match.group(1)
            return secrets.get(secret_name, config)
    return config
