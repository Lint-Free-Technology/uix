"""Playwright fixtures for UIX visual tests.

Provides a pre-authenticated browser context and per-test page fixture so that
individual test functions receive a fresh Playwright ``Page`` without needing to
log in to Home Assistant on every test.

Bug worked around here
----------------------
``ha_testcontainer.visual.inject_ha_token`` uses ``wait_until="domcontentloaded"``
then immediately calls ``page.evaluate()``.  HA is a SPA that performs a
JavaScript redirect shortly after ``domcontentloaded``, destroying the page
execution context before ``evaluate`` can run.

We replace the token injection with ``page.add_init_script()``, which runs the
script *before* any page code so the ``hassTokens`` localStorage entry is set
before HA's router kicks in.
"""

from __future__ import annotations

import asyncio
import json
import time

import pytest
from playwright.sync_api import BrowserContext, Page

from ha_testcontainer import HATestContainer
from ha_testcontainer.visual import (
    HA_SETTLE_MS,
    PAGE_LOAD_TIMEOUT,
    assert_snapshot,
)

# Re-export for test modules that import directly from this conftest.
__all__ = ["HA_SETTLE_MS", "PAGE_LOAD_TIMEOUT", "assert_snapshot", "push_lovelace_config"]


def _inject_token_via_init_script(page: Page, ha_url: str, token: str) -> None:
    """Inject the HA auth token into localStorage using an init script.

    Unlike ``inject_ha_token`` from ha-testcontainer, this approach registers
    the script to run *before* any page JavaScript so it survives HA's SPA
    routing redirect that happens immediately after the initial page load.
    """
    expires_ms = int(time.time() * 1000) + 365 * 24 * 3600 * 1000
    # Escape values that go into the JS string literal.
    safe_url = ha_url.replace("'", "\\'")
    safe_token = token.replace("'", "\\'")
    page.add_init_script(f"""
        localStorage.setItem('hassTokens', JSON.stringify({{
            access_token: '{safe_token}',
            token_type: 'Bearer',
            expires_in: 31536000,
            refresh_token: null,
            hassUrl: '{safe_url}',
            clientId: '{safe_url}/',
            expires: {expires_ms}
        }}));
    """)


# ---------------------------------------------------------------------------
# WebSocket helper — push Lovelace dashboard config
# ---------------------------------------------------------------------------


async def _ws_push_lovelace_config(ws_url: str, access_token: str, config: dict) -> None:
    """Save a Lovelace dashboard config via the HA WebSocket API.

    The ``/api/lovelace/config`` REST endpoint was removed from current HA
    stable.  Use the ``lovelace/config/save`` WebSocket command instead.
    """
    import websockets

    async with websockets.connect(ws_url) as ws:
        msg = json.loads(await ws.recv())
        assert msg["type"] == "auth_required", f"Expected auth_required, got: {msg}"

        await ws.send(json.dumps({"type": "auth", "access_token": access_token}))
        msg = json.loads(await ws.recv())
        assert msg["type"] == "auth_ok", f"WebSocket auth failed: {msg}"

        await ws.send(json.dumps({
            "id": 1,
            "type": "lovelace/config/save",
            "config": config,
        }))
        msg = json.loads(await ws.recv())
        assert msg.get("success"), f"Lovelace config save failed: {msg}"


def push_lovelace_config(container: HATestContainer, config: dict) -> None:
    """Push a Lovelace dashboard config to the running HA instance.

    The ``/api/lovelace/config`` REST endpoint was removed from current HA
    stable.  This helper uses the WebSocket API instead.

    Runs the async WebSocket call in a dedicated thread with its own event
    loop so it can be called safely from within pytest-playwright's event loop
    (where ``asyncio.run()`` would raise ``RuntimeError``).

    Test fixtures should call this function instead of
    ``container.api("POST", "lovelace/config?force=true")``.
    """
    import threading

    base_url = container.get_url()
    token = container.get_token()
    ws_url = base_url.replace("http://", "ws://") + "/api/websocket"

    error: list[Exception] = []

    def _run() -> None:
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        try:
            loop.run_until_complete(_ws_push_lovelace_config(ws_url, token, config))
        except Exception as exc:
            error.append(exc)
        finally:
            loop.close()

    t = threading.Thread(target=_run, daemon=True)
    t.start()
    t.join()
    if error:
        raise error[0]


# ---------------------------------------------------------------------------
# Playwright fixtures
# ---------------------------------------------------------------------------


@pytest.fixture(scope="session")
def ha_browser_context(browser, ha_url: str, ha_token: str) -> BrowserContext:
    """A Playwright browser context pre-authenticated with HA."""
    context = browser.new_context(
        viewport={"width": 1280, "height": 800},
        ignore_https_errors=True,
    )
    # Use a single page to warm up the auth state.
    page = context.new_page()
    _inject_token_via_init_script(page, ha_url, ha_token)
    page.goto(f"{ha_url}/lovelace/0", wait_until="networkidle", timeout=PAGE_LOAD_TIMEOUT)
    page.close()
    yield context
    context.close()


@pytest.fixture()
def ha_page(ha_browser_context: BrowserContext) -> Page:
    """A fresh Playwright page inside the pre-authenticated browser context.

    The token init script is NOT re-registered here; the auth cookies/storage
    are inherited from the shared browser context that was warmed up by
    ``ha_browser_context``.
    """
    page = ha_browser_context.new_page()
    yield page
    page.close()
