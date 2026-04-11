"""Shared pytest fixtures for UIX visual tests.

The session-scoped ``ha`` fixture starts one Home Assistant container for the
whole test run, mounts the UIX custom component from the local repository, and
sets up the UIX integration so tests can exercise it against a real HA instance.

Bugs worked around here
-----------------------
These are known ha-testcontainer issues discovered during first use against
current HA stable.  They should be fixed upstream in ha-testcontainer:

1. The ``integration`` onboarding step requires ``redirect_uri`` in the body —
   ha-testcontainer sends only ``client_id``.
2. The ``/api/auth/long_lived_access_token`` REST endpoint no longer exists in
   current HA stable.  Long-lived tokens must now be created via the WebSocket
   API (``auth/long_lived_access_token`` message type).
3. ``config_path`` is mounted read-write so HA writes its runtime state
   (``.storage``, DB, logs) into the source tree.  We copy all static config
   files into a temporary directory instead so the source tree stays clean.
4. The ``/api/lovelace/config`` REST endpoint no longer exists in current HA
   stable.  Lovelace dashboard config must be pushed via the WebSocket API
   (``lovelace/config/save`` message type).

Environment variables
---------------------
HA_VERSION
    Docker image tag to use.  Defaults to ``stable``.
    Set to ``beta``, ``dev``, or a pinned version such as ``2024.6.0``.
"""

from __future__ import annotations

import asyncio
import json
import os
import shutil
import tempfile
import time
from pathlib import Path
from urllib.parse import urlencode

import pytest
import requests
from ha_testcontainer import HATestContainer, HAVersion

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------

REPO_ROOT = Path(__file__).parent.parent
HA_CONFIG_DIR = REPO_ROOT / "tests" / "ha-config"
CUSTOM_COMPONENTS_DIR = REPO_ROOT / "custom_components"

_DEFAULT_USERNAME = "testadmin"
_DEFAULT_PASSWORD = "testpassword123"  # noqa: S105


# ---------------------------------------------------------------------------
# WebSocket helper — mint a long-lived token
# ---------------------------------------------------------------------------


async def _ws_create_llt(ws_url: str, access_token: str, client_name: str = "uix-tests") -> str:
    """Create a long-lived access token via the HA WebSocket API.

    Parameters
    ----------
    ws_url:
        WebSocket URL, e.g. ``ws://localhost:8123/api/websocket``.
    access_token:
        A valid (short-lived) HA Bearer token.
    client_name:
        Display name for the long-lived token entry in the HA profile page.

    Returns
    -------
    str
        The new long-lived access token string.
    """
    import websockets

    async with websockets.connect(ws_url) as ws:
        # HA sends an auth_required message first.
        msg = json.loads(await ws.recv())
        assert msg["type"] == "auth_required", f"Expected auth_required, got: {msg}"

        # Authenticate.
        await ws.send(json.dumps({"type": "auth", "access_token": access_token}))
        msg = json.loads(await ws.recv())
        assert msg["type"] == "auth_ok", f"WebSocket auth failed: {msg}"

        # Request the long-lived token.
        await ws.send(json.dumps({
            "id": 1,
            "type": "auth/long_lived_access_token",
            "client_name": client_name,
            "lifespan": 3650,
        }))
        msg = json.loads(await ws.recv())
        assert msg.get("success"), f"LLT creation failed: {msg}"
        return msg["result"]


def _create_llt_sync(base_url: str, access_token: str) -> str:
    """Synchronous wrapper around :func:`_ws_create_llt`."""
    ws_url = base_url.replace("http://", "ws://") + "/api/websocket"
    return asyncio.run(_ws_create_llt(ws_url, access_token))


# ---------------------------------------------------------------------------
# Custom onboarding — replaces ha-testcontainer's broken _perform_onboarding
# ---------------------------------------------------------------------------


def _perform_onboarding_fixed(container: HATestContainer) -> None:
    """Run the HA onboarding sequence with fixes for current HA stable.

    Differences from the stock ha-testcontainer implementation:
    - Includes ``redirect_uri`` in the ``integration`` onboarding step.
    - Uses the WebSocket API to mint the long-lived token instead of the
      deprecated ``/api/auth/long_lived_access_token`` REST endpoint.
    - Falls back to password login when onboarding is already complete.
    """
    base_url = container.get_url()
    client_id = f"{base_url}/"

    # Check whether onboarding has already been completed (e.g. pre-seeded config).
    try:
        resp = requests.get(f"{base_url}/api/onboarding", timeout=10)
        if resp.status_code == 200:
            steps = resp.json()
            already_done = all(s.get("done", False) for s in steps)
            if already_done:
                container._token = _password_login_fixed(container)
                return
    except requests.exceptions.RequestException:
        pass

    # Step 1 – create the admin user.
    resp = requests.post(
        f"{base_url}/api/onboarding/users",
        json={
            "client_id": client_id,
            "name": "Test Admin",
            "username": _DEFAULT_USERNAME,
            "password": _DEFAULT_PASSWORD,
            "language": "en",
        },
        timeout=30,
    )
    resp.raise_for_status()
    auth_code = resp.json()["auth_code"]

    # Step 2 – exchange auth code for a short-lived access token.
    token_resp = requests.post(
        f"{base_url}/auth/token",
        data=urlencode({
            "client_id": client_id,
            "grant_type": "authorization_code",
            "code": auth_code,
        }),
        headers={"Content-Type": "application/x-www-form-urlencoded"},
        timeout=15,
    )
    token_resp.raise_for_status()
    short_token = token_resp.json()["access_token"]

    # Step 3 – complete remaining onboarding steps.
    for step in ("core_config", "analytics"):
        requests.post(
            f"{base_url}/api/onboarding/{step}",
            json={"client_id": client_id},
            headers={"Authorization": f"Bearer {short_token}"},
            timeout=15,
        )

    # FIX: integration step requires redirect_uri (ha-testcontainer omits it).
    requests.post(
        f"{base_url}/api/onboarding/integration",
        json={"client_id": client_id, "redirect_uri": client_id},
        headers={"Authorization": f"Bearer {short_token}"},
        timeout=15,
    )

    # Step 4 – mint a long-lived token via the WebSocket API.
    # FIX: The /api/auth/long_lived_access_token REST endpoint no longer
    #      exists in current HA stable.  Use the WebSocket API instead.
    llt = _create_llt_sync(base_url, short_token)
    container._token = llt


def _password_login_fixed(container: HATestContainer) -> str:
    """Password-based login returning a long-lived token (already-onboarded path)."""
    base_url = container.get_url()
    client_id = f"{base_url}/"

    flow_resp = requests.post(
        f"{base_url}/auth/login_flow",
        json={
            "client_id": client_id,
            "handler": ["homeassistant", None],
            "redirect_uri": client_id,
        },
        timeout=15,
    )
    flow_resp.raise_for_status()
    flow_id = flow_resp.json()["flow_id"]

    cred_resp = requests.post(
        f"{base_url}/auth/login_flow/{flow_id}",
        json={"username": container._username, "password": container._password},
        timeout=15,
    )
    cred_resp.raise_for_status()
    auth_code = cred_resp.json()["result"]

    token_resp = requests.post(
        f"{base_url}/auth/token",
        data=urlencode({
            "client_id": client_id,
            "grant_type": "authorization_code",
            "code": auth_code,
        }),
        headers={"Content-Type": "application/x-www-form-urlencoded"},
        timeout=15,
    )
    token_resp.raise_for_status()
    short_token = token_resp.json()["access_token"]

    return _create_llt_sync(base_url, short_token)


# ---------------------------------------------------------------------------
# Custom HATestContainer subclass with fixed onboarding
# ---------------------------------------------------------------------------


class _UIXTestContainer(HATestContainer):
    """HATestContainer subclass with fixes for current HA stable.

    Overrides ``_perform_onboarding`` to:
    - include ``redirect_uri`` in the integration onboarding step, and
    - create the long-lived token via the WebSocket API (REST endpoint removed).
    """

    def _perform_onboarding(self) -> None:
        _perform_onboarding_fixed(self)


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

    container = _UIXTestContainer(
        version=ha_version,
        config_path=ha_tmp,
    )
    # Mount local UIX alongside the temp config dir.
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
