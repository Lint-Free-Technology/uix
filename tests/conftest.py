"""Shared pytest fixtures for UIX visual tests.

The session-scoped ``ha`` fixture starts one Home Assistant container for the
whole test run, mounts the UIX custom component from the local repository, and
sets up the UIX integration so tests can exercise it against a real HA instance.

Environment variables
---------------------
HA_VERSION
    Docker image tag to use.  Defaults to ``stable``.
    Set to ``beta``, ``dev``, or a pinned version such as ``2024.6.0``.
"""

from __future__ import annotations

import os
import shutil
import threading
from pathlib import Path
from typing import Any

import pytest
from ha_testcontainer import HATestContainer, HAVersion

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------

REPO_ROOT = Path(__file__).parent.parent
HA_CONFIG_DIR = REPO_ROOT / "tests" / "ha-config"
CUSTOM_COMPONENTS_DIR = REPO_ROOT / "custom_components"


# ---------------------------------------------------------------------------
# Session-scoped HA container
# ---------------------------------------------------------------------------


@pytest.fixture(scope="session")
def ha_version() -> str:
    return os.environ.get("HA_VERSION", HAVersion.STABLE)


@pytest.fixture(scope="session")
def ha(ha_version: str, tmp_path_factory):
    """Session-scoped HATestContainer with UIX mounted and configured.

    Uses a **temporary directory** for the HA runtime state so that HA's
    generated files (``.storage``, database, logs) never pollute the
    ``tests/ha-config/`` source tree.  Only ``configuration.yaml`` is
    copied into the temp dir; everything else is created fresh by HA.

    The UIX custom component is mounted from the repository root's
    ``custom_components/`` directory so tests exercise the local build.
    """
    # Create an isolated temp dir for this test session's HA state.
    # Copy all static ha-config files (configuration.yaml etc.) into it
    # so the source tree is never polluted by HA's runtime writes.
    ha_tmp = tmp_path_factory.mktemp("ha-state")
    shutil.copytree(str(HA_CONFIG_DIR), str(ha_tmp), dirs_exist_ok=True)

    container = HATestContainer(
        version=ha_version,
        config_path=ha_tmp,
    )
    # Mount local UIX alongside the temp config dir.
    # (config_path takes precedence in the constructor, so custom_components
    # must be mapped separately here.)
    container.with_volume_mapping(
        str(CUSTOM_COMPONENTS_DIR.resolve()),
        "/config/custom_components",
        "rw",
    )

    container.start()
    container.setup_integration("uix")
    yield container
    container.stop()


# ---------------------------------------------------------------------------
# Derived fixtures
# ---------------------------------------------------------------------------


@pytest.fixture(scope="session")
def ha_url(ha: HATestContainer) -> str:
    """Base URL of the running HA instance, e.g. ``http://localhost:8123``."""
    return ha.get_url()


@pytest.fixture(scope="session")
def ha_token(ha: HATestContainer) -> str:
    """Long-lived access token for the admin user."""
    return ha.get_token()


# ---------------------------------------------------------------------------
# Named Lovelace test dashboard
# ---------------------------------------------------------------------------

#: URL path for the dedicated UIX test dashboard created at session start.
UIX_TEST_DASHBOARD_URL_PATH = "uix-tests"


def _create_dashboard(ha: HATestContainer, url_path: str, title: str) -> None:
    """Create a named Lovelace dashboard via the WebSocket API.

    Uses ``lovelace/dashboards/create`` to register a new ``storage``-backed
    dashboard at *url_path*.  Any existing dashboard with the same ``url_path``
    is silently ignored so the session fixture is idempotent.
    """
    result: dict[str, Any] = {}
    exc_holder: list[BaseException] = []

    def _run() -> None:
        try:
            result.update(
                ha._ws_call(
                    {
                        "id": 1,
                        "type": "lovelace/dashboards/create",
                        "url_path": url_path,
                        "title": title,
                        "show_in_sidebar": False,
                        "require_admin": False,
                    }
                )
            )
        except BaseException as e:  # noqa: BLE001
            exc_holder.append(e)

    t = threading.Thread(target=_run, daemon=True)
    t.start()
    t.join(timeout=30)
    if exc_holder:
        raise exc_holder[0]
    # "success": false with code "url_path_already_in_use" means it exists — OK.
    if not result.get("success"):
        error = (result.get("error") or {}).get("code", "")
        if error != "url_path_already_in_use":
            raise RuntimeError(f"lovelace/dashboards/create failed: {result}")


@pytest.fixture(scope="session")
def ha_lovelace_url_path(ha: HATestContainer) -> str:
    """URL path of the dedicated UIX test Lovelace dashboard.

    Creates the dashboard (once per session) and returns its ``url_path`` so
    individual test fixtures can push configs to it and navigate to its views.
    """
    _create_dashboard(ha, UIX_TEST_DASHBOARD_URL_PATH, "UIX Tests")
    return UIX_TEST_DASHBOARD_URL_PATH

