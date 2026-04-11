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

# Re-export for test modules that import directly from this conftest.
__all__ = ["HA_SETTLE_MS", "PAGE_LOAD_TIMEOUT", "assert_snapshot"]


@pytest.fixture(scope="session")
def ha_browser_context(browser, ha_url: str, ha_token: str) -> BrowserContext:
    """A Playwright browser context pre-authenticated with HA."""
    context = browser.new_context(
        viewport={"width": 1280, "height": 800},
        ignore_https_errors=True,
    )
    page = context.new_page()
    inject_ha_token(page, ha_url, ha_token)
    # Navigate once so the auth token is stored in localStorage for all future pages.
    page.goto(f"{ha_url}/lovelace/0", wait_until="networkidle", timeout=PAGE_LOAD_TIMEOUT)
    page.close()
    yield context
    context.close()


@pytest.fixture()
def ha_page(ha_browser_context: BrowserContext) -> Page:
    """A fresh Playwright page inside the pre-authenticated browser context."""
    page = ha_browser_context.new_page()
    yield page
    page.close()
