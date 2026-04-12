"""UIX Forge and Sparks visual tests.

These tests verify that the ``custom:uix-forge`` element renders correctly and
that individual sparks augment the forged element as expected.

Test classes
------------
TestForgeRenders
    Smoke test — a UIX Forge wrapping a tile card renders without errors and
    the ``<uix-forge>`` custom element is present in the DOM.

TestForgeTooltipSpark
    Push a forge with a ``tooltip`` spark and verify that a ``<wa-tooltip>``
    element is added to the forge's shadow root as a sibling of the tile card.

TestForgeButtonSpark
    Push a forge with a ``button`` spark and verify that a ``<ha-button>``
    element is added inside the tile card's shadow root, after the tile icon.

TestForgeUIXStyle
    Push a forge with a UIX style on the forge itself and verify the
    ``--ha-card-border-radius`` CSS custom property is applied.

Shadow DOM helpers
------------------
HA's Lovelace cards live inside nested shadow roots.  The helper JS function
``querySelectorDeep`` pierces all shadow roots to find an element by CSS
selector across the entire HA component tree.
"""

from __future__ import annotations

import pytest
from playwright.sync_api import Page

from ha_testcontainer.visual import PAGE_LOAD_TIMEOUT, HA_SETTLE_MS, assert_snapshot
from conftest import push_lovelace_config_to

# Entity from the HA demo integration — always available.
_DEMO_LIGHT = "light.bed_light"

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


def _goto_lovelace(page: Page, ha_url: str, path: str = "/home/overview") -> None:
    """Navigate to a Lovelace path and wait for the page to settle.

    Waits for network idle plus 2×HA_SETTLE_MS.  UIX processes card configs
    asynchronously (template render round-trip to HA backend) *after* network
    idle, so the double settle ensures injection is complete before assertions.
    """
    page.goto(f"{ha_url}{path}", wait_until="networkidle", timeout=PAGE_LOAD_TIMEOUT)
    page.wait_for_timeout(HA_SETTLE_MS * 2)


# ---------------------------------------------------------------------------
# Forge renders
# ---------------------------------------------------------------------------


class TestForgeRenders:
    """Verify that a basic UIX Forge wrapping a tile card renders correctly."""

    @pytest.fixture(autouse=True)
    def _push_test_dashboard(self, ha, ha_lovelace_url_path: str):
        config = {
            "title": "UIX Forge Test",
            "views": [
                {
                    "title": "Forge Renders",
                    "path": "forge-renders",
                    "cards": [
                        {
                            "type": "custom:uix-forge",
                            "forge": {"mold": "card"},
                            "element": {
                                "type": "tile",
                                "entity": _DEMO_LIGHT,
                            },
                        },
                    ],
                }
            ],
        }
        push_lovelace_config_to(ha, ha_lovelace_url_path, config)
        yield
        push_lovelace_config_to(ha, ha_lovelace_url_path, {"title": "UIX Tests", "views": []})

    def test_forge_element_present(self, ha_page: Page, ha_url: str, ha_lovelace_url_path: str) -> None:
        """The <uix-forge> custom element must be present in the DOM."""
        _goto_lovelace(ha_page, ha_url, f"/{ha_lovelace_url_path}/forge-renders")
        forge_present = ha_page.evaluate(
            "() => {" + _QUERY_DEEP_JS + "return querySelectorDeep('uix-forge') !== null; }"
        )
        assert forge_present, "<uix-forge> element not found in the DOM"

    def test_forge_contains_tile_card(self, ha_page: Page, ha_url: str, ha_lovelace_url_path: str) -> None:
        """The forge's shadow root must contain the forged hui-tile-card."""
        _goto_lovelace(ha_page, ha_url, f"/{ha_lovelace_url_path}/forge-renders")
        tile_present = ha_page.evaluate(
            "() => {" + _QUERY_DEEP_JS + """
                const forge = querySelectorDeep('uix-forge');
                if (!forge?.shadowRoot) return false;
                return forge.shadowRoot.querySelector('hui-tile-card') !== null;
            }"""
        )
        assert tile_present, "hui-tile-card not found inside uix-forge shadow root"

    def test_forge_renders_snapshot(self, ha_page: Page, ha_url: str, ha_lovelace_url_path: str) -> None:
        """Snapshot of a basic UIX Forge wrapping a tile card."""
        _goto_lovelace(ha_page, ha_url, f"/{ha_lovelace_url_path}/forge-renders")
        assert_snapshot(ha_page, "03_forge_basic")


# ---------------------------------------------------------------------------
# Tooltip spark
# ---------------------------------------------------------------------------


class TestForgeTooltipSpark:
    """Verify that the tooltip spark attaches a wa-tooltip to the forged element."""

    @pytest.fixture(autouse=True)
    def _push_test_dashboard(self, ha, ha_lovelace_url_path: str):
        config = {
            "title": "UIX Forge Tooltip Test",
            "views": [
                {
                    "title": "Tooltip Spark",
                    "path": "forge-tooltip",
                    "cards": [
                        {
                            "type": "custom:uix-forge",
                            "forge": {
                                "mold": "card",
                                "sparks": [
                                    {
                                        "type": "tooltip",
                                        "for": "hui-tile-card",
                                        "content": "This is a UIX tooltip",
                                    }
                                ],
                            },
                            "element": {
                                "type": "tile",
                                "entity": _DEMO_LIGHT,
                            },
                        },
                    ],
                }
            ],
        }
        push_lovelace_config_to(ha, ha_lovelace_url_path, config)
        yield
        push_lovelace_config_to(ha, ha_lovelace_url_path, {"title": "UIX Tests", "views": []})

    def test_tooltip_element_present(self, ha_page: Page, ha_url: str, ha_lovelace_url_path: str) -> None:
        """A <wa-tooltip> must be added to the forge shadow root by the tooltip spark."""
        _goto_lovelace(ha_page, ha_url, f"/{ha_lovelace_url_path}/forge-tooltip")
        has_tooltip = ha_page.evaluate(
            "() => {" + _QUERY_DEEP_JS + """
                const forge = querySelectorDeep('uix-forge');
                if (!forge?.shadowRoot) return false;
                return forge.shadowRoot.querySelector('wa-tooltip') !== null;
            }"""
        )
        assert has_tooltip, "wa-tooltip not found in uix-forge shadow root"

    def test_tooltip_content(self, ha_page: Page, ha_url: str, ha_lovelace_url_path: str) -> None:
        """The wa-tooltip content attribute must match the configured content."""
        _goto_lovelace(ha_page, ha_url, f"/{ha_lovelace_url_path}/forge-tooltip")
        content = ha_page.evaluate(
            "() => {" + _QUERY_DEEP_JS + """
                const forge = querySelectorDeep('uix-forge');
                if (!forge?.shadowRoot) return null;
                const tooltip = forge.shadowRoot.querySelector('wa-tooltip');
                return tooltip ? tooltip.textContent?.trim() : null;
            }"""
        )
        assert content is not None and content.startswith("This is a UIX tooltip"), (
            f"Unexpected tooltip content: {content!r}"
        )

    def test_tooltip_spark_snapshot(self, ha_page: Page, ha_url: str, ha_lovelace_url_path: str) -> None:
        """Snapshot of a forge with a tooltip spark (tooltip not visible at rest)."""
        _goto_lovelace(ha_page, ha_url, f"/{ha_lovelace_url_path}/forge-tooltip")
        assert_snapshot(ha_page, "04_forge_tooltip_spark")


# ---------------------------------------------------------------------------
# Button spark
# ---------------------------------------------------------------------------


class TestForgeButtonSpark:
    """Verify that the button spark inserts an ha-button into the tile card."""

    @pytest.fixture(autouse=True)
    def _push_test_dashboard(self, ha, ha_lovelace_url_path: str):
        config = {
            "title": "UIX Forge Button Test",
            "views": [
                {
                    "title": "Button Spark",
                    "path": "forge-button",
                    "cards": [
                        {
                            "type": "custom:uix-forge",
                            "forge": {
                                "mold": "card",
                                "sparks": [
                                    {
                                        "type": "button",
                                        "after": "hui-tile-card $ ha-tile-icon",
                                        "label": "Toggle",
                                        "entity": _DEMO_LIGHT,
                                        "tap_action": {"action": "toggle"},
                                    }
                                ],
                            },
                            "element": {
                                "type": "tile",
                                "entity": _DEMO_LIGHT,
                            },
                        },
                    ],
                }
            ],
        }
        push_lovelace_config_to(ha, ha_lovelace_url_path, config)
        yield
        push_lovelace_config_to(ha, ha_lovelace_url_path, {"title": "UIX Tests", "views": []})

    def test_button_element_present(self, ha_page: Page, ha_url: str, ha_lovelace_url_path: str) -> None:
        """An <ha-button> must be added inside the tile card by the button spark."""
        _goto_lovelace(ha_page, ha_url, f"/{ha_lovelace_url_path}/forge-button")
        has_button = ha_page.evaluate(
            "() => {" + _QUERY_DEEP_JS + """
                const forge = querySelectorDeep('uix-forge');
                if (!forge?.shadowRoot) return false;
                const tileCard = forge.shadowRoot.querySelector('hui-tile-card');
                if (!tileCard?.shadowRoot) return false;
                return tileCard.shadowRoot.querySelector('ha-button') !== null;
            }"""
        )
        assert has_button, "ha-button not found inside hui-tile-card shadow root"

    def test_button_label(self, ha_page: Page, ha_url: str, ha_lovelace_url_path: str) -> None:
        """The ha-button must display the configured label text."""
        _goto_lovelace(ha_page, ha_url, f"/{ha_lovelace_url_path}/forge-button")
        label = ha_page.evaluate(
            "() => {" + _QUERY_DEEP_JS + """
                const forge = querySelectorDeep('uix-forge');
                if (!forge?.shadowRoot) return null;
                const tileCard = forge.shadowRoot.querySelector('hui-tile-card');
                if (!tileCard?.shadowRoot) return null;
                const btn = tileCard.shadowRoot.querySelector('ha-button');
                return btn ? btn.textContent?.trim() : null;
            }"""
        )
        assert label == "Toggle", f"Unexpected button label: {label!r}"

    def test_button_spark_snapshot(self, ha_page: Page, ha_url: str, ha_lovelace_url_path: str) -> None:
        """Snapshot of a forge with a button spark."""
        _goto_lovelace(ha_page, ha_url, f"/{ha_lovelace_url_path}/forge-button")
        assert_snapshot(ha_page, "05_forge_button_spark")


# ---------------------------------------------------------------------------
# Forge UIX style
# ---------------------------------------------------------------------------


class TestForgeUIXStyle:
    """Verify that a UIX style applied to the forge element itself takes effect."""

    @pytest.fixture(autouse=True)
    def _push_test_dashboard(self, ha, ha_lovelace_url_path: str):
        config = {
            "title": "UIX Forge Style Test",
            "views": [
                {
                    "title": "Forge Style",
                    "path": "forge-style",
                    "cards": [
                        {
                            "type": "custom:uix-forge",
                            "forge": {
                                "mold": "card",
                                "uix": {
                                    "style": ":host { --ha-card-border-radius: 20px; }"
                                },
                            },
                            "element": {
                                "type": "tile",
                                "entity": _DEMO_LIGHT,
                            },
                        },
                    ],
                }
            ],
        }
        push_lovelace_config_to(ha, ha_lovelace_url_path, config)
        yield
        push_lovelace_config_to(ha, ha_lovelace_url_path, {"title": "UIX Tests", "views": []})

    def test_forge_uix_node_injected(self, ha_page: Page, ha_url: str, ha_lovelace_url_path: str) -> None:
        """A <uix-node> must be injected into the forge's shadow root."""
        _goto_lovelace(ha_page, ha_url, f"/{ha_lovelace_url_path}/forge-style")
        has_uix_node = ha_page.evaluate(
            "() => {" + _QUERY_DEEP_JS + """
                const forge = querySelectorDeep('uix-forge');
                if (!forge?.shadowRoot) return false;
                return forge.shadowRoot.querySelector('uix-node') !== null;
            }"""
        )
        assert has_uix_node, "UIX did not inject a <uix-node> into the forge's shadow root"

    def test_forge_style_snapshot(self, ha_page: Page, ha_url: str, ha_lovelace_url_path: str) -> None:
        """Snapshot of a forge with a UIX style applied to the forge element."""
        _goto_lovelace(ha_page, ha_url, f"/{ha_lovelace_url_path}/forge-style")
        assert_snapshot(ha_page, "06_forge_uix_style")
