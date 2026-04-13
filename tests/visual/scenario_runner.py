"""YAML-driven scenario engine for UIX visual tests.

Each ``.yaml`` file under ``tests/visual/scenarios/`` defines one test
scenario.  This module provides helpers to load those files, push their
Lovelace configuration to the running HA instance, navigate to the resulting
view, and evaluate the assertions declared in the file.

Interaction types
-----------------
Interactions are declared under the top-level ``interactions:`` key and are
executed (in order) after navigation but before assertions.  They are useful
for triggering hover effects, tooltips, clicks that change entity state, or
any other action that must happen before assertions and snapshots.

hover
    Hover over an element using one of two forms:

    *Simple* — hover an element reachable by a plain CSS selector in the
    main page (no shadow-root crossing):

    .. code-block:: yaml

        interactions:
          - type: hover
            selector: uix-forge
            settle_ms: 800   # optional, default 500

    *Shadow-root* — hover an element inside a shadow-root chain (uses JS to
    obtain the bounding rect then moves the mouse to the element centre):

    .. code-block:: yaml

        interactions:
          - type: hover
            root: hui-tile-card      # or a list for deeper chains
            selector: ha-tile-icon
            settle_ms: 800

click
    Click an element.  Supports the same simple / shadow-root forms as
    ``hover``.  Use ``settle_ms`` to wait for state changes or animations
    after the click (e.g. entity state update + UIX template re-render):

    .. code-block:: yaml

        interactions:
          - type: click
            root: hui-tile-card
            selector: ha-tile-icon
            settle_ms: 3000

ha_service
    Call a Home Assistant service via the REST API.  Useful for putting an
    entity into a known state before navigation or interaction.  Requires the
    ``ha`` container to be passed to :func:`run_interactions`.

    .. code-block:: yaml

        interactions:
          - type: ha_service
            domain: light
            service: turn_off
            entity_id: light.bed_light   # shorthand for data.entity_id

wait
    Wait for a fixed number of milliseconds (default 500):

    .. code-block:: yaml

        interactions:
          - type: wait
            ms: 1000

Assertion types
---------------
element_present
    An element matched by *selector* must exist inside the shadow root of the
    element chain described by *root*.

element_absent
    As ``element_present``, but the element must **not** exist.

css_property
    The computed CSS property named *property* on the element matched by
    *selector* (inside *root*) must equal *expected*.

css_variable
    As ``css_property`` but uses ``getPropertyValue`` — suitable for CSS
    custom properties (``--foo``).

text_equals
    The ``textContent`` of the element matched by *selector* (trimmed) must
    equal *expected*.

text_startswith
    The ``textContent`` of the element matched by *selector* (trimmed) must
    start with *expected*.

snapshot
    A full-page Playwright snapshot is captured under the name *name*.

Shadow-root traversal
---------------------
The *root* field in an assertion (or interaction) may be a **string** (a
single CSS selector located anywhere in the page via a shadow-piercing search)
or a **list of strings** (a chain of selectors, each resolved inside the
previous element's ``shadowRoot``).  The final element in the chain supplies
the shadow root that *selector* is then searched in.

Example — ``ha-button`` inside ``hui-tile-card`` inside ``uix-forge``::

    root:
      - uix-forge
      - hui-tile-card
    selector: ha-button
"""

from __future__ import annotations

import os
import shutil
from pathlib import Path
from typing import Any

import yaml
from ha_testcontainer import HATestContainer
from ha_testcontainer.visual import HA_SETTLE_MS, PAGE_LOAD_TIMEOUT, assert_snapshot
from playwright.sync_api import Page

from lovelace_helpers import push_lovelace_config_to

# Root directory that contains all scenario sub-directories.
SCENARIOS_DIR = Path(__file__).parent / "scenarios"

# Directory where baseline and actual snapshot PNGs are stored.
SNAPSHOTS_DIR = Path(__file__).parent / "snapshots"

# Shadow-piercing querySelector injected into every ``page.evaluate`` call.
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


# ---------------------------------------------------------------------------
# Scenario loading
# ---------------------------------------------------------------------------


def load_all_scenarios() -> list[dict[str, Any]]:
    """Return all scenarios loaded from ``*.yaml`` files under *SCENARIOS_DIR*.

    Files are sorted so the order is deterministic across platforms.
    """
    scenarios: list[dict[str, Any]] = []
    for path in sorted(SCENARIOS_DIR.rglob("*.yaml")):
        with path.open(encoding="utf-8") as fh:
            data = yaml.safe_load(fh)
        data.setdefault("_source", path.relative_to(SCENARIOS_DIR.parent).as_posix())
        scenarios.append(data)
    return scenarios


# ---------------------------------------------------------------------------
# Theme management
# ---------------------------------------------------------------------------


def set_theme(ha: HATestContainer, theme: str) -> None:
    """Activate *theme* for the HA frontend via the REST service API."""
    ha.api("POST", "services/frontend/set_theme", json={"name": theme}).raise_for_status()


def reset_theme(ha: HATestContainer) -> None:
    """Reset the HA frontend theme to the built-in default."""
    ha.api("POST", "services/frontend/set_theme", json={"name": "default"}).raise_for_status()


# ---------------------------------------------------------------------------
# Dashboard management
# ---------------------------------------------------------------------------


def push_scenario(ha: HATestContainer, url_path: str, scenario: dict[str, Any]) -> None:
    """Push *scenario*'s card config to the named Lovelace dashboard."""
    push_lovelace_config_to(
        ha,
        url_path,
        {
            "title": f"UIX Scenario: {scenario['id']}",
            "views": [
                {
                    "title": scenario.get("description", scenario["id"]),
                    "path": scenario["view_path"],
                    "cards": [scenario["card"]],
                }
            ],
        },
    )


def clear_scenario(ha: HATestContainer, url_path: str) -> None:
    """Remove all views from the named dashboard after a scenario finishes."""
    push_lovelace_config_to(ha, url_path, {"title": "UIX Tests", "views": []})


# ---------------------------------------------------------------------------
# Navigation
# ---------------------------------------------------------------------------


def goto_scenario(page: Page, ha_url: str, url_path: str, view_path: str) -> None:
    """Navigate to *view_path* on the named dashboard and wait for UIX to settle.

    UIX template evaluation is asynchronous — it finishes after network-idle —
    so we wait an additional ``2×HA_SETTLE_MS`` before running assertions.
    """
    page.goto(
        f"{ha_url}/{url_path}/{view_path}",
        wait_until="networkidle",
        timeout=PAGE_LOAD_TIMEOUT,
    )
    page.wait_for_timeout(HA_SETTLE_MS * 2)


# ---------------------------------------------------------------------------
# Interaction engine
# ---------------------------------------------------------------------------


def run_interactions(
    page: Page,
    scenario: dict[str, Any],
    ha: HATestContainer | None = None,
) -> None:
    """Execute any interactions declared in *scenario* before assertions.

    Interactions let tests put the page into a specific UI state (e.g. a
    hover that reveals a tooltip, a click that changes entity state) before
    running assertions and snapshots.

    Pass the HA container as *ha* when any ``ha_service`` interactions are
    present in the scenario.
    """
    for interaction in scenario.get("interactions", []):
        itype = interaction["type"]
        if itype == "hover":
            _perform_hover(page, interaction)
        elif itype == "click":
            _perform_click(page, interaction)
        elif itype == "ha_service":
            if ha is None:
                raise ValueError(
                    "ha_service interaction requires the ha container — "
                    "pass ha= to run_interactions()"
                )
            _call_ha_service(ha, interaction)
        elif itype == "wait":
            page.wait_for_timeout(interaction.get("ms", 500))
        else:
            raise ValueError(f"Unknown interaction type: {itype!r}")


def _perform_hover(page: Page, interaction: dict[str, Any]) -> None:
    """Hover over an element and wait for hover effects to settle.

    If *root* is present the element is resolved inside a shadow-root chain
    using JS (``getBoundingClientRect`` + ``page.mouse.move``).  Otherwise
    a simple page-level Playwright locator hover is used.
    """
    settle_ms: int = interaction.get("settle_ms", 500)

    if "root" in interaction:
        rect = _get_element_rect(page, interaction)
        page.mouse.move(rect["x"] + rect["w"] / 2, rect["y"] + rect["h"] / 2)
    else:
        page.locator(interaction["selector"]).hover()

    page.wait_for_timeout(settle_ms)


def _perform_click(page: Page, interaction: dict[str, Any]) -> None:
    """Click an element and wait for effects to settle.

    If *root* is present the element is resolved inside a shadow-root chain
    using JS (``getBoundingClientRect`` + ``page.mouse.click``).  Otherwise
    a simple page-level Playwright locator click is used.

    Use ``settle_ms`` to allow enough time for entity state changes and UIX
    template re-renders to propagate back to the browser after the click.
    """
    settle_ms: int = interaction.get("settle_ms", 500)

    if "root" in interaction:
        rect = _get_element_rect(page, interaction)
        page.mouse.click(rect["x"] + rect["w"] / 2, rect["y"] + rect["h"] / 2)
    else:
        page.locator(interaction["selector"]).click()

    page.wait_for_timeout(settle_ms)


def _get_element_rect(page: Page, interaction: dict[str, Any]) -> dict[str, float]:
    """Return the ``{x, y, w, h}`` bounding rect for an element inside a shadow root."""
    raw_root = interaction["root"]
    roots = [raw_root] if isinstance(raw_root, str) else list(raw_root)
    selector: str = interaction.get("selector", "")
    root_js = _build_root_js(roots)
    rect = page.evaluate(
        f"() => {{ {root_js} if (_err) return {{error: _err}};"
        f" var el = currentRoot.querySelector({selector!r});"
        f" if (!el) return {{error: 'selector {selector} not found'}};"
        f" var r = el.getBoundingClientRect();"
        f" return {{x: r.x, y: r.y, w: r.width, h: r.height}}; }}"
    )
    _check_traversal(rect, interaction)
    return rect


def _call_ha_service(ha: HATestContainer, interaction: dict[str, Any]) -> None:
    """Call a Home Assistant service via the REST API."""
    domain = interaction["domain"]
    service = interaction["service"]
    data: dict[str, Any] = dict(interaction.get("data", {}))
    if "entity_id" in interaction:
        data["entity_id"] = interaction["entity_id"]
    ha.api("POST", f"services/{domain}/{service}", json=data).raise_for_status()


# ---------------------------------------------------------------------------
# Assertion engine
# ---------------------------------------------------------------------------


def run_assertions(page: Page, scenario: dict[str, Any]) -> None:
    """Execute every assertion declared in *scenario*."""
    for assertion in scenario.get("assertions", []):
        atype = assertion["type"]
        if atype == "snapshot":
            threshold = assertion.get("threshold", 0.0)
            if threshold > 0.0:
                _assert_snapshot_with_threshold(page, assertion["name"], threshold)
            else:
                assert_snapshot(page, assertion["name"])
        elif atype in {
            "element_present",
            "element_absent",
            "css_property",
            "css_variable",
            "text_equals",
            "text_startswith",
        }:
            _run_dom_assertion(page, assertion, atype)
        else:
            raise ValueError(f"Unknown assertion type: {atype!r}")


def _assert_snapshot_with_threshold(page: Page, name: str, threshold: float) -> None:
    """Take a screenshot and compare to baseline, tolerating minor pixel differences.

    Uses Pillow's pixel-level diff when available.  Falls back to an exact
    byte comparison (no tolerance) if Pillow is not installed.

    Parameters
    ----------
    page:
        Playwright page to screenshot.
    name:
        Filename stem for the PNG, e.g. ``"01_card_basic_style"``.
    threshold:
        Maximum fraction of pixels (0.0–1.0) that may differ from the
        baseline before the assertion fails.  For example ``0.001`` allows
        up to 0.1 % of pixels to differ.  Use this to tolerate minor
        cross-platform font-rendering differences without masking real
        visual regressions.
    """
    SNAPSHOTS_DIR.mkdir(parents=True, exist_ok=True)
    baseline = SNAPSHOTS_DIR / f"{name}.png"
    actual = SNAPSHOTS_DIR / f"{name}.actual.png"

    page.wait_for_timeout(HA_SETTLE_MS)
    page.screenshot(path=str(actual), full_page=False)

    if os.environ.get("SNAPSHOT_UPDATE") == "1" or not baseline.exists():
        state = "updated" if baseline.exists() else "created"
        shutil.copy(actual, baseline)
        print(f"\n[snapshot] baseline {state}: {baseline}")
        return

    try:
        from PIL import Image, ImageChops  # type: ignore[import]

        img_base = Image.open(baseline).convert("RGB")
        img_actual = Image.open(actual).convert("RGB")

        if img_base.size != img_actual.size:
            raise AssertionError(
                f"Snapshot '{name}': image size changed "
                f"from {img_base.size} to {img_actual.size}. "
                "Run with SNAPSHOT_UPDATE=1 to accept the new baseline."
            )

        diff = ImageChops.difference(img_base, img_actual)
        # get_flattened_data returns one tuple-per-pixel; fall back to getdata for older Pillow.
        try:
            diff_pixels = sum(1 for p in diff.get_flattened_data() if any(c > 0 for c in p))
        except AttributeError:
            diff_pixels = sum(1 for p in diff.getdata() if any(c > 0 for c in p))  # type: ignore[attr-defined]
        total_pixels = img_base.size[0] * img_base.size[1]
        diff_fraction = diff_pixels / total_pixels

        if diff_fraction > threshold:
            raise AssertionError(
                f"Snapshot mismatch for '{name}': "
                f"{diff_pixels}/{total_pixels} pixels differ "
                f"({diff_fraction:.4%}), threshold is {threshold:.4%}. "
                "Run with SNAPSHOT_UPDATE=1 to accept new baseline."
            )

    except ImportError:
        # Pillow not installed — fall back to byte-level comparison (no tolerance).
        if baseline.read_bytes() != actual.read_bytes():
            raise AssertionError(
                f"Snapshot mismatch for '{name}'. "
                "Install Pillow for tolerant comparison, or run with "
                "SNAPSHOT_UPDATE=1 to accept new baseline."
            )


def _build_root_js(roots: list[str]) -> str:
    """Return JS that traverses a chain of shadow roots.

    Starting from ``document.documentElement``, each entry in *roots* is
    located with ``querySelectorDeep`` and the traversal descends into its
    ``shadowRoot``.  After the loop ``currentRoot`` holds the final shadow
    root and ``_err`` is non-null if any step failed.
    """
    lines = [
        _QUERY_DEEP_JS,
        "var currentRoot = document.documentElement; var _err = null;",
    ]
    for sel in roots:
        lines.append(
            f"""
            if (!_err) {{
                var _next = querySelectorDeep({sel!r}, currentRoot);
                if (!_next) {{ _err = 'Element not found: {sel}'; }}
                else if (!_next.shadowRoot) {{ _err = 'No shadowRoot on: {sel}'; }}
                else {{ currentRoot = _next.shadowRoot; }}
            }}
            """
        )
    return "\n".join(lines)


def _run_dom_assertion(page: Page, assertion: dict[str, Any], atype: str) -> None:
    """Build and evaluate the JS for a single DOM-based assertion."""
    raw_root = assertion["root"]
    roots = [raw_root] if isinstance(raw_root, str) else list(raw_root)
    selector: str = assertion.get("selector", "")

    root_js = _build_root_js(roots)

    if atype == "element_present":
        result = page.evaluate(
            f"() => {{ {root_js} if (_err) return {{error: _err}};"
            f" var el = currentRoot.querySelector({selector!r});"
            f" return {{present: el !== null}}; }}"
        )
        _check_traversal(result, assertion)
        assert result["present"], (
            f"Expected <{selector}> inside shadowRoot of {roots[-1]!r}"
        )

    elif atype == "element_absent":
        result = page.evaluate(
            f"() => {{ {root_js} if (_err) return {{error: _err}};"
            f" var el = currentRoot.querySelector({selector!r});"
            f" return {{present: el !== null}}; }}"
        )
        _check_traversal(result, assertion)
        assert not result["present"], (
            f"Expected <{selector}> to be absent inside shadowRoot of {roots[-1]!r}"
        )

    elif atype == "css_property":
        prop = assertion["property"]
        expected = assertion["expected"]
        result = page.evaluate(
            f"() => {{ {root_js} if (_err) return {{error: _err}};"
            f" var el = currentRoot.querySelector({selector!r});"
            f" if (!el) return {{error: 'selector {selector} not found'}};"
            f" return {{value: getComputedStyle(el).{prop}}}; }}"
        )
        _check_traversal(result, assertion)
        assert result["value"] == expected, (
            f"CSS property {prop!r} on <{selector}>:"
            f" expected {expected!r}, got {result['value']!r}"
        )

    elif atype == "css_variable":
        prop = assertion["property"]
        expected = assertion["expected"]
        result = page.evaluate(
            f"() => {{ {root_js} if (_err) return {{error: _err}};"
            f" var el = currentRoot.querySelector({selector!r});"
            f" if (!el) return {{error: 'selector {selector} not found'}};"
            f" return {{value: getComputedStyle(el).getPropertyValue({prop!r}).trim()}}; }}"
        )
        _check_traversal(result, assertion)
        assert result["value"] == expected, (
            f"CSS variable {prop!r} on <{selector}>:"
            f" expected {expected!r}, got {result['value']!r}"
        )

    elif atype == "text_equals":
        expected = assertion["expected"]
        result = page.evaluate(
            f"() => {{ {root_js} if (_err) return {{error: _err}};"
            f" var el = currentRoot.querySelector({selector!r});"
            f" if (!el) return {{error: 'selector {selector} not found'}};"
            f" return {{text: (el.textContent || '').trim()}}; }}"
        )
        _check_traversal(result, assertion)
        assert result["text"] == expected, (
            f"Text of <{selector}>: expected {expected!r}, got {result['text']!r}"
        )

    elif atype == "text_startswith":
        expected = assertion["expected"]
        result = page.evaluate(
            f"() => {{ {root_js} if (_err) return {{error: _err}};"
            f" var el = currentRoot.querySelector({selector!r});"
            f" if (!el) return {{error: 'selector {selector} not found'}};"
            f" return {{text: (el.textContent || '').trim()}}; }}"
        )
        _check_traversal(result, assertion)
        assert result["text"].startswith(expected), (
            f"Text of <{selector}> does not start with {expected!r};"
            f" got {result['text']!r}"
        )


def _check_traversal(result: Any, assertion: dict[str, Any]) -> None:
    """Raise ``AssertionError`` if the JS returned a traversal error dict."""
    if isinstance(result, dict) and "error" in result:
        raise AssertionError(
            f"Shadow-DOM traversal failed for assertion {assertion}: {result['error']}"
        )
