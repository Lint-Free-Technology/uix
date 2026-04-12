"""UIX smoke tests — verify HA starts correctly with UIX installed.

These tests do **not** push any Lovelace configuration; they simply check that
the HA instance boots, the UIX integration is registered, and no UIX-related
JavaScript errors appear on the default page.

Card styling and forge tests live in ``tests/visual/scenarios/`` as YAML files
and are run by ``test_scenarios.py``.
"""

from __future__ import annotations

from playwright.sync_api import Page, expect

from ha_testcontainer.visual import PAGE_LOAD_TIMEOUT, HA_SETTLE_MS

COMPONENT_DOMAIN = "uix"
COMPONENT_DISPLAY_NAME = "UI eXtension"


def _goto_home(page: Page, ha_url: str) -> None:
    """Navigate to the HA home overview and wait for the page to settle."""
    page.goto(f"{ha_url}/home/overview", wait_until="networkidle", timeout=PAGE_LOAD_TIMEOUT)
    page.wait_for_timeout(HA_SETTLE_MS * 2)


class TestUIXLoads:
    """Verify that HA loads correctly with UIX installed."""

    def test_ha_shell_present(self, ha_page: Page, ha_url: str) -> None:
        """The <home-assistant> custom element must be present in the DOM."""
        _goto_home(ha_page, ha_url)
        expect(ha_page.locator("home-assistant")).to_be_visible(timeout=PAGE_LOAD_TIMEOUT)

    def test_sidebar_renders(self, ha_page: Page, ha_url: str) -> None:
        """The HA sidebar must be visible (confirms full frontend boot)."""
        _goto_home(ha_page, ha_url)
        expect(ha_page.locator("ha-sidebar")).to_be_visible(timeout=PAGE_LOAD_TIMEOUT)

    def test_uix_integration_in_settings(self, ha_page: Page, ha_url: str) -> None:
        """UIX must appear as a configured integration in HA Settings."""
        ha_page.goto(
            f"{ha_url}/config/integrations",
            wait_until="networkidle",
            timeout=PAGE_LOAD_TIMEOUT,
        )
        card = ha_page.get_by_text(COMPONENT_DISPLAY_NAME, exact=False)
        expect(card).to_be_visible(timeout=30_000)

    def test_no_uix_console_errors(self, ha_page: Page, ha_url: str) -> None:
        """No JavaScript errors mentioning UIX should appear on page load."""
        errors: list[str] = []
        ha_page.on(
            "console",
            lambda msg: errors.append(msg.text) if msg.type == "error" else None,
        )
        _goto_home(ha_page, ha_url)
        uix_errors = [e for e in errors if COMPONENT_DOMAIN.lower() in e.lower()]
        assert not uix_errors, f"UIX produced console errors: {uix_errors}"
