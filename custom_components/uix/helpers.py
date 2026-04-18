import json
import logging
import os
import re
from pathlib import Path

from homeassistant.core import HomeAssistant
from homeassistant.util.yaml import load_yaml, Secrets

from .const import DOMAIN

_LOGGER = logging.getLogger(__name__)

_INCLUDE_RE = re.compile(r"^!include\s+(\S+)\s*$")
_SECRET_RE = re.compile(r"^!secret\s+(\S+)\s*$")

def get_version(hass: HomeAssistant):
    with open(hass.config.path(f"custom_components/{DOMAIN}/manifest.json"), "r") as fp:
        manifest = json.load(fp)
        return manifest["version"]

def resolve_foundries(hass: HomeAssistant, foundries: dict) -> dict:
    """Resolve foundry configs at serve time, expanding ``!include`` and ``!secret`` strings.

    Recursively walks each foundry config and replaces string values that match
    known YAML constructor patterns:

    - ``!include <path>`` — loads the YAML file at *path* (resolved relative to
      the HA config directory when not absolute) using HA's native loader.  The
      native loader handles nested ``!include`` and ``!secret`` references within
      the included file automatically.
    - ``!secret <name>`` — resolves the named secret via HA's native
      :class:`~homeassistant.util.yaml.Secrets` class, which reads
      ``secrets.yaml`` from the HA config directory.

    This function performs file I/O and must be called from an executor thread
    (e.g. via :meth:`~homeassistant.core.HomeAssistant.async_add_executor_job`).
    """
    secrets = Secrets(Path(hass.config.config_dir))

    def _resolve(value):
        if isinstance(value, dict):
            return {k: _resolve(v) for k, v in value.items()}
        if isinstance(value, list):
            return [_resolve(item) for item in value]
        if isinstance(value, str):
            m = _INCLUDE_RE.match(value)
            if m:
                file_path = m.group(1)
                if not os.path.isabs(file_path):
                    file_path = hass.config.path(file_path)
                try:
                    return load_yaml(file_path, secrets)
                except Exception:
                    _LOGGER.exception(
                        "Failed to load !include file %r in foundry config", file_path
                    )
                    return value
            m = _SECRET_RE.match(value)
            if m:
                secret_name = m.group(1)
                try:
                    # Use secrets.yaml as the requester path so Secrets searches
                    # from the HA config directory.
                    return secrets.get(hass.config.path("secrets.yaml"), secret_name)
                except Exception:
                    _LOGGER.exception(
                        "Failed to resolve !secret %r in foundry config", secret_name
                    )
                    return value
        return value

    return {name: _resolve(config) for name, config in foundries.items()}
