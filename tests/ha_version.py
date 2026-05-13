"""Shared Home Assistant version defaults for UIX tests."""

from __future__ import annotations

import os
from pathlib import Path

# Single source of truth for the pinned HA version used by the test suite.
# Edit tests/HA_VERSION to change it — one line, no Python knowledge required.
_VERSION_FILE = Path(__file__).parent / "HA_VERSION"


def resolve_ha_version() -> str:
    """Return effective HA version from env, or the repo-pinned default in tests/HA_VERSION."""
    env_version = os.environ.get("HA_VERSION")
    if env_version is not None:
        env_version = env_version.strip()
        if env_version:
            return env_version
    return _VERSION_FILE.read_text().strip()

