"""Shared pytest fixtures for UIX visual tests.

The session-scoped ``ha`` fixture starts one Home Assistant container for the
whole test run, mounts the UIX custom component from the local repository, and
sets up the UIX integration so tests can exercise it against a real HA instance.

Environment variables
---------------------
HA_VERSION
    Docker image tag to use.  Defaults to ``stable``.
    Set to ``beta``, ``dev``, or a pinned version such as ``2024.6.0``.
HA_URL
    Base URL of a **pre-running** Home Assistant instance (e.g.
    ``http://localhost:12345``).  When set together with ``HA_TOKEN``, the
    test session connects to that instance instead of starting a new Docker
    container — eliminating the boot-time overhead for fast iterative work.
    Start a persistent instance with ``make ha_up`` (or
    ``python tests/ha_server.py``).
HA_TOKEN
    Long-lived access token for the pre-running HA instance.  Required when
    ``HA_URL`` is set.
"""

from __future__ import annotations

import json
import os
import shutil
import threading
from pathlib import Path
from typing import Any

import pytest
import requests
import websocket
from ha_testcontainer import HATestContainer, HAVersion

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------

REPO_ROOT = Path(__file__).parent.parent
HA_CONFIG_DIR = REPO_ROOT / "tests" / "ha-config"
CUSTOM_COMPONENTS_DIR = REPO_ROOT / "custom_components"


# ---------------------------------------------------------------------------
# Proxy for a pre-running HA instance (HA_URL + HA_TOKEN env vars)
# ---------------------------------------------------------------------------


class _ExternalHA:
    """Thin proxy for a Home Assistant instance started by ``ha_server.py``.

    Exposes the same interface used by the test fixtures (``get_url``,
    ``get_token``, ``api``, ``_ws_call``, ``setup_integration``) so the
    rest of the test infrastructure works unchanged when connecting to a
    pre-running container instead of spinning up a fresh one.
    """

    def __init__(self, url: str, token: str) -> None:
        self._url = url.rstrip("/")
        self._token = token

    # -- Public interface (mirrors HATestContainer) --

    def get_url(self) -> str:
        return self._url

    def get_token(self) -> str:
        return self._token

    def api(self, method: str, path: str, **kwargs: Any) -> requests.Response:
        if not path.startswith("/api/"):
            path = f"/api/{path.lstrip('/')}"
        url = f"{self._url}{path}"
        headers = kwargs.pop("headers", {})
        headers["Authorization"] = f"Bearer {self._token}"
        headers.setdefault("Content-Type", "application/json")
        return requests.request(method, url, headers=headers, timeout=30, **kwargs)

    def _ws_call(self, command: dict[str, Any]) -> dict[str, Any]:
        ws_url = self._url.replace("http://", "ws://").replace("https://", "wss://") + "/api/websocket"
        ws = websocket.create_connection(ws_url, timeout=15)
        try:
            ws.recv()  # auth_required
            ws.send(json.dumps({"type": "auth", "access_token": self._token}))
            auth_result = json.loads(ws.recv())
            if auth_result.get("type") != "auth_ok":
                raise RuntimeError(f"WebSocket auth failed: {auth_result}")
            ws.send(json.dumps(command))
            return json.loads(ws.recv())
        finally:
            ws.close()

    def setup_integration(self, domain: str) -> dict[str, Any]:
        """Set up a HA integration — a no-op when it's already configured."""
        resp = self.api("POST", "/api/config/config_entries/flow", json={"handler": domain})
        # 400 / "already_configured" is fine — the integration was set up when
        # ha_server.py started the container.
        if resp.status_code not in (200, 201, 400):
            resp.raise_for_status()
        return resp.json()

    def stop(self) -> None:
        """No-op — the caller (ha_server.py) is responsible for teardown."""


# ---------------------------------------------------------------------------
# Session-scoped HA container
# ---------------------------------------------------------------------------


@pytest.fixture(scope="session")
def ha_version() -> str:
    return os.environ.get("HA_VERSION", HAVersion.STABLE)


@pytest.fixture(scope="session")
def ha(ha_version: str, tmp_path_factory):
    """Session-scoped HA instance with UIX mounted and configured.

    **Normal mode** (default): starts a fresh Docker container, mounts the
    local ``custom_components/`` directory, performs HA onboarding, and tears
    everything down at the end of the session.

    **Fast-iteration mode**: when ``HA_URL`` *and* ``HA_TOKEN`` are set in the
    environment, the fixture skips Docker entirely and connects to a
    pre-running instance.  Use ``make ha_up`` (or ``python tests/ha_server.py``)
    in a separate terminal to start the persistent instance; source the printed
    ``export`` lines before running pytest::

        # Terminal 1
        make ha_up          # keeps running — Ctrl-C to stop

        # Terminal 2
        source .ha_env
        pytest tests/visual/test_doc_images.py -k my_scenario   # instant!
    """
    ha_url_env = os.environ.get("HA_URL")
    ha_token_env = os.environ.get("HA_TOKEN")
    if ha_url_env and ha_token_env:
        yield _ExternalHA(ha_url_env, ha_token_env)
        return

    # ---- Normal Docker-container mode ----

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
def ha_url(ha) -> str:
    """Base URL of the running HA instance, e.g. ``http://localhost:8123``."""
    return ha.get_url()


@pytest.fixture(scope="session")
def ha_token(ha) -> str:
    """Long-lived access token for the admin user."""
    return ha.get_token()


# ---------------------------------------------------------------------------
# Named Lovelace test dashboard
# ---------------------------------------------------------------------------

#: URL path for the dedicated UIX test dashboard created at session start.
UIX_TEST_DASHBOARD_URL_PATH = "uix-tests"


def _create_dashboard(ha, url_path: str, title: str) -> None:
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
    if t.is_alive():
        raise TimeoutError("lovelace/dashboards/create timed out after 30 seconds")
    if exc_holder:
        raise exc_holder[0]
    # "success": false with code "url_path_already_in_use" means it exists — OK.
    if not result.get("success"):
        error = (result.get("error") or {}).get("code", "")
        if error != "url_path_already_in_use":
            raise RuntimeError(f"lovelace/dashboards/create failed: {result}")


@pytest.fixture(scope="session")
def ha_lovelace_url_path(ha) -> str:
    """URL path of the dedicated UIX test Lovelace dashboard.

    Creates the dashboard (once per session) and returns its ``url_path`` so
    individual test fixtures can push configs to it and navigate to its views.
    """
    _create_dashboard(ha, UIX_TEST_DASHBOARD_URL_PATH, "UIX Tests")
    return UIX_TEST_DASHBOARD_URL_PATH

