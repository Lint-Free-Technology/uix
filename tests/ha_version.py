"""Shared Home Assistant version defaults for UIX tests."""

from __future__ import annotations

import os

# Keep test runs deterministic across time by pinning a default HA image tag.
DEFAULT_HA_VERSION = "2026.4.0"


def resolve_ha_version() -> str:
    """Return effective HA version from env, or the repo default."""
    return os.environ.get("HA_VERSION", DEFAULT_HA_VERSION)

