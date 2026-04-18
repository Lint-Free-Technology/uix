import json
import logging
from io import StringIO
from pathlib import Path

from homeassistant.core import HomeAssistant
from homeassistant.util.yaml import parse_yaml, Secrets

from .const import DOMAIN

_LOGGER = logging.getLogger(__name__)

def get_version(hass: HomeAssistant):
    with open(hass.config.path(f"custom_components/{DOMAIN}/manifest.json"), "r") as fp:
        manifest = json.load(fp)
        return manifest["version"]

def resolve_foundries(hass: HomeAssistant, foundries: dict) -> dict:
    """Resolve foundry configs at serve time using annotatedyaml's ``parse_yaml``.

    Recursively walks each foundry config and, for any string value that begins
    with ``!``, re-parses it as a YAML fragment via
    :func:`homeassistant.util.yaml.parse_yaml`.  This delegates resolution to
    annotatedyaml's native constructors, giving full support for:

    - ``!include <path>`` — loads a YAML file relative to the HA config
      directory; nested ``!include`` and ``!secret`` inside that file are also
      resolved automatically.
    - ``!secret <name>`` — resolves the named secret from ``secrets.yaml``.
    - ``!include_dir_list``, ``!include_dir_named``, ``!env_var``, etc.

    String values that do not begin with ``!`` are left unchanged.

    This function performs file I/O and must be called from an executor thread
    (e.g. via :meth:`~homeassistant.core.HomeAssistant.async_add_executor_job`).
    """
    secrets = Secrets(Path(hass.config.config_dir))
    # A path inside the config dir so the annotatedyaml loader resolves
    # !include paths relative to the HA config directory.
    base_path = hass.config.path("configuration.yaml")

    def _resolve(value):
        if isinstance(value, dict):
            return {k: _resolve(v) for k, v in value.items()}
        if isinstance(value, list):
            return [_resolve(item) for item in value]
        if isinstance(value, str) and value.startswith("!"):
            sio = StringIO(value)
            sio.name = base_path
            try:
                return parse_yaml(sio, secrets)
            except Exception:
                _LOGGER.error(
                    "Failed to resolve YAML constructor in foundry config — "
                    "check that any !include paths exist and are readable, "
                    "and that any !secret names are defined in secrets.yaml"
                )
                return value
        return value

    return {name: _resolve(config) for name, config in foundries.items()}
