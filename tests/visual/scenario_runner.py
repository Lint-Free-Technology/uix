"""YAML-driven scenario engine for UIX visual tests.

Each ``.yaml`` file under ``tests/visual/scenarios/`` defines one test
scenario.  This module provides helpers to load those files, push their
Lovelace configuration to the running HA instance, navigate to the resulting
view, and evaluate the assertions declared in the file.

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
The *root* field in an assertion may be a **string** (a single CSS selector
located anywhere in the page via a shadow-piercing search) or a **list of
strings** (a chain of selectors, each resolved inside the previous element's
``shadowRoot``).  The final element in the chain supplies the shadow root that
*selector* is then searched in.

Example — ``ha-button`` inside ``hui-tile-card`` inside ``uix-forge``::

    root:
      - "uix-forge"
      - "hui-tile-card"
    selector: "ha-button"
"""

from __future__ import annotations

from pathlib import Path
from typing import Any

import yaml
from ha_testcontainer import HATestContainer
from ha_testcontainer.visual import HA_SETTLE_MS, PAGE_LOAD_TIMEOUT, assert_snapshot
from playwright.sync_api import Page

from conftest import push_lovelace_config_to

# Root directory that contains all scenario sub-directories.
SCENARIOS_DIR = Path(__file__).parent / "scenarios"

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
# Assertion engine
# ---------------------------------------------------------------------------


def run_assertions(page: Page, scenario: dict[str, Any]) -> None:
    """Execute every assertion declared in *scenario*."""
    for assertion in scenario.get("assertions", []):
        atype = assertion["type"]
        if atype == "snapshot":
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
