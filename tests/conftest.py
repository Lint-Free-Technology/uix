"""UIX-specific pytest configuration.

Sets environment-variable defaults consumed by the ``ha_testcontainer``
pytest plugin so that tests run against a properly configured Home Assistant
instance with the UIX integration installed.

All session-scoped HA container fixtures (``ha``, ``ha_url``, ``ha_token``,
``ha_lovelace_url_path``, ``ha_browser_context``, ``ha_page``) are provided
automatically by ``ha_testcontainer.pytest_plugin``, which is registered via
the ``pytest11`` entry point and requires no explicit import.

Environment variables
---------------------
HA_VERSION
    Docker image tag to use.  Defaults to the value in ``tests/HA_VERSION``.
    Set to ``beta``, ``dev``, or a pinned version such as ``2024.6.0``.
HA_URL
    Base URL of a **pre-running** Home Assistant instance (e.g.
    ``http://localhost:12345``).  When set together with ``HA_TOKEN``, the
    test session connects to that instance instead of starting a new Docker
    container — eliminating the boot-time overhead for fast iterative work.
    Start a persistent instance with ``make ha_up``.
HA_TOKEN
    Long-lived access token for the pre-running HA instance.  Required when
    ``HA_URL`` is set.
HA_EXTRA_CONFIG_DIR
    Path to a directory whose contents are copied on top of
    ``tests/ha-config/`` before the container starts.  Use this to inject
    additional themes, entity fixtures, etc. without modifying the test config.
HA_PLUGINS_YAML
    Path to an alternative ``plugins.yaml``.  Defaults to
    ``tests/plugins.yaml``.
"""

from __future__ import annotations

import os
import sys
from pathlib import Path

# ---------------------------------------------------------------------------
# UIX-specific env-var defaults — consumed by ha_testcontainer.pytest_plugin
# ---------------------------------------------------------------------------
# Set at module import time so they are visible to the session-scoped ``ha``
# fixture before it runs.  os.environ.setdefault() leaves any externally-set
# value (e.g. from ``source .ha_env``) unchanged.

_REPO_ROOT = Path(__file__).parent.parent
_HA_VERSION_FILE = _REPO_ROOT / "tests" / "HA_VERSION"


def _resolve_default_ha_version() -> str:
    """Resolve default HA version from tests/HA_VERSION, falling back to stable."""
    try:
        for line in _HA_VERSION_FILE.read_text(encoding="utf-8").splitlines():
            value = line.strip()
            if value and not value.startswith("#"):
                return value
    except FileNotFoundError:
        pass
    return "stable"

os.environ.setdefault("HA_VERSION", _resolve_default_ha_version())
os.environ.setdefault("HA_CONFIG_PATH", str(_REPO_ROOT / "tests" / "ha-config"))
os.environ.setdefault("HA_CUSTOM_COMPONENTS_PATH", str(_REPO_ROOT / "custom_components"))
os.environ.setdefault("HA_SETUP_INTEGRATION", "uix")
os.environ.setdefault("HA_PLUGINS_YAML", str(_REPO_ROOT / "tests" / "plugins.yaml"))

# ---------------------------------------------------------------------------
# Make tests/visual/ importable so uix_extensions can be imported before
# pytest adds it to sys.path during collection.
# ---------------------------------------------------------------------------

sys.path.insert(0, str(Path(__file__).parent / "visual"))

import uix_extensions  # noqa: F401, E402 - side-effect: registers UIX interaction types
