"""Basic UIX styling visual tests.

These tests verify that UIX correctly injects CSS into Home Assistant's
shadow DOM by pushing Lovelace configurations via the WebSocket API and then
inspecting the rendered page with Playwright.

Test classes
------------
TestUIXLoads
    Smoke tests — HA loads correctly with UIX installed and the UIX
    integration appears in the Integrations settings page.

TestCardBasicStyle
    Push an entities card with a UIX background-color style and verify that:
    - a ``<uix-node>`` element is present in the card's shadow root (UIX ran), and
    - the computed ``background-color`` of ``ha-card`` matches the chosen colour.

TestCardCSSVariable
    Push a tile card with a UIX CSS custom-property style (``--tile-color``)
    and verify the property value is reflected in the computed style.

Shadow DOM helpers
------------------
HA's Lovelace cards live inside nested shadow roots.  The helper JS function
``querySelectorDeep`` pierces all shadow roots to find an element by CSS
selector across the entire HA component tree.
"""

from __future__ import annotations

import pytest
from playwright.sync_api import Page, expect

from ha_testcontainer.visual import PAGE_LOAD_TIMEOUT, HA_SETTLE_MS, assert_snapshot

COMPONENT_DOMAIN = "uix"
COMPONENT_DISPLAY_NAME = "UI eXtension"

# ---------------------------------------------------------------------------
# Shadow-piercing querySelector helper (injected into every evaluate call)
# ---------------------------------------------------------------------------

_QUERY_DEEP_JS = """
    function querySelectorDeep(selector, root) {
        root = root || document.documentElement;
        var direct = root.querySelector(selector);
        if (direct) return direct;
        var all = root.querySelectorAll('*');
        for (var i = 0; i < all.length; i++) {
            if (all[i].shadowRoot) {
                var found = querySelectorDeep(selector, all[i].shadowRoot);
                if (found) return found;
            }
        }
        return null;
    }
"""


def _goto_lovelace(page: Page, ha_url: str, path: str = "/lovelace/0") -> None:
    """Navigate to a Lovelace path and wait for the page to settle."""
    page.goto(f"{ha_url}{path}", wait_until="networkidle", timeout=PAGE_LOAD_TIMEOUT)
    page.wait_for_timeout(HA_SETTLE_MS)


# ---------------------------------------------------------------------------
# Smoke tests
# ---------------------------------------------------------------------------


class TestUIXLoads:
    """Verify that HA loads correctly with UIX installed."""

    def test_ha_shell_present(self, ha_page: Page, ha_url: str) -> None:
        """The <home-assistant> custom element must be present in the DOM."""
        _goto_lovelace(ha_page, ha_url)
        expect(ha_page.locator("home-assistant")).to_be_visible(timeout=PAGE_LOAD_TIMEOUT)

    def test_sidebar_renders(self, ha_page: Page, ha_url: str) -> None:
        """The HA sidebar must be visible (confirms full frontend boot)."""
        _goto_lovelace(ha_page, ha_url)
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
        _goto_lovelace(ha_page, ha_url)
        uix_errors = [e for e in errors if COMPONENT_DOMAIN.lower() in e.lower()]
        assert not uix_errors, f"UIX produced console errors: {uix_errors}"


# ---------------------------------------------------------------------------
# Basic card background-colour style
# ---------------------------------------------------------------------------


class TestCardBasicStyle:
    """Push a card with a UIX background-colour style and verify it renders."""

    # Pure red — distinctive and easy to verify.
    _BG_COLOR = "rgb(255, 0, 0)"

    @pytest.fixture(autouse=True)
    def _push_test_dashboard(self, ha, ha_url: str):
        """Push a minimal Lovelace config with a UIX-styled entities card."""
        config = {
            "title": "UIX Style Test",
            "views": [
                {
                    "title": "Style Test",
                    "path": "style-test",
                    "cards": [
                        {
                            "type": "entities",
                            "title": "UIX Red Background",
                            "entities": ["light.bed_light"],
                            "uix": {
                                "style": f"ha-card {{ background: {self._BG_COLOR}; }}"
                            },
                        },
                    ],
                }
            ],
        }
        ha.push_lovelace_config(config)
        yield
        ha.push_lovelace_config({"title": "Home", "views": []})

    def test_uix_node_injected(self, ha_page: Page, ha_url: str) -> None:
        """A <uix-node> element must be present in the card's shadow root."""
        _goto_lovelace(ha_page, ha_url, "/home/style-test")
        has_uix_node = ha_page.evaluate(
            "() => {" + _QUERY_DEEP_JS + """
                var card = querySelectorDeep('hui-entities-card');
                if (!card || !card.shadowRoot) return false;
                return card.shadowRoot.querySelector('uix-node') !== null;
            }"""
        )
        assert has_uix_node, "UIX did not inject a <uix-node> into the entities card's shadow root"

    def test_card_background_color(self, ha_page: Page, ha_url: str) -> None:
        """The computed background-color of ha-card must match the UIX style."""
        _goto_lovelace(ha_page, ha_url, "/home/style-test")
        bg_color = ha_page.evaluate(
            "() => {" + _QUERY_DEEP_JS + """
                var card = querySelectorDeep('hui-entities-card');
                if (!card || !card.shadowRoot) return null;
                var haCard = card.shadowRoot.querySelector('ha-card');
                if (!haCard) return null;
                return getComputedStyle(haCard).backgroundColor;
            }"""
        )
        assert bg_color == self._BG_COLOR, (
            f"Expected background-color {self._BG_COLOR!r}, got {bg_color!r}"
        )

    def test_card_style_snapshot(self, ha_page: Page, ha_url: str) -> None:
        """Snapshot of a card with a UIX background-color style."""
        _goto_lovelace(ha_page, ha_url, "/home/style-test")
        assert_snapshot(ha_page, "01_card_basic_style")


# ---------------------------------------------------------------------------
# CSS custom property style
# ---------------------------------------------------------------------------


class TestCardCSSVariable:
    """Push a tile card with a UIX CSS custom-property style and verify it."""

    @pytest.fixture(autouse=True)
    def _push_test_dashboard(self, ha, ha_url: str):
        """Push a tile card where UIX sets --tile-color to teal."""
        config = {
            "title": "UIX CSS Variable Test",
            "views": [
                {
                    "title": "CSS Var Test",
                    "path": "cssvar-test",
                    "cards": [
                        {
                            "type": "tile",
                            "entity": "light.bed_light",
                            "uix": {
                                "style": "ha-card { --tile-color: rgb(0, 128, 128); }"
                            },
                        },
                    ],
                }
            ],
        }
        ha.push_lovelace_config(config)
        yield
        ha.push_lovelace_config({"title": "Home", "views": []})

    def test_css_variable_applied(self, ha_page: Page, ha_url: str) -> None:
        """The --tile-color CSS variable must be set by UIX on ha-card."""
        _goto_lovelace(ha_page, ha_url, "/home/cssvar-test")
        tile_color = ha_page.evaluate(
            "() => {" + _QUERY_DEEP_JS + """
                var card = querySelectorDeep('hui-tile-card');
                if (!card || !card.shadowRoot) return null;
                var haCard = card.shadowRoot.querySelector('ha-card');
                if (!haCard) return null;
                return getComputedStyle(haCard).getPropertyValue('--tile-color').trim();
            }"""
        )
        assert tile_color == "rgb(0, 128, 128)", (
            f"Expected --tile-color to be 'rgb(0, 128, 128)', got {tile_color!r}"
        )

    def test_css_variable_snapshot(self, ha_page: Page, ha_url: str) -> None:
        """Snapshot of a tile card with a UIX CSS custom-property style."""
        _goto_lovelace(ha_page, ha_url, "/home/cssvar-test")
        assert_snapshot(ha_page, "02_card_css_variable")
