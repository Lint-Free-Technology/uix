"""Playwright fixtures for UIX visual tests.

Provides a pre-authenticated browser context and per-test page fixture so that
individual test functions receive a fresh Playwright ``Page`` without needing to
log in to Home Assistant on every test.
"""

from __future__ import annotations

import pytest
from playwright.sync_api import BrowserContext, Page

from ha_testcontainer.visual import (
    HA_SETTLE_MS,
    PAGE_LOAD_TIMEOUT,
    assert_snapshot,
    inject_ha_token,
)

from lovelace_helpers import push_lovelace_config_to

__all__ = ["HA_SETTLE_MS", "PAGE_LOAD_TIMEOUT", "assert_snapshot", "push_lovelace_config_to"]


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
    # Use a single page to seed the auth token in localStorage.  The token is
    # injected via add_init_script (inside inject_ha_token) so it runs before
    # HA's SPA router — surviving the initial SPA redirect.  localStorage is
    # shared across pages within the same browser context, so subsequent pages
    # opened for individual tests inherit the auth state automatically.
    page = context.new_page()
    inject_ha_token(page, ha_url, ha_token)
    page.wait_for_load_state("networkidle", timeout=PAGE_LOAD_TIMEOUT)
    page.close()
    yield context
    context.close()


@pytest.fixture()
def ha_page(ha_browser_context: BrowserContext) -> Page:
    """A fresh Playwright page inside the pre-authenticated browser context.

    Auth state (localStorage ``hassTokens``) is inherited from the shared
    browser context that was seeded by ``ha_browser_context``.
    """
    page = ha_browser_context.new_page()
    yield page
    page.close()
