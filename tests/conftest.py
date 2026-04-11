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
from pathlib import Path

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
